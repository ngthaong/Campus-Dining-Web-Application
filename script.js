// ============================================
// GLOBAL STATE
// ============================================

let cart = [];
let userKeys = null;
let completedOrders = {}; // Store orders by ID
let currentOrderId = null;
let statusPollingInterval = null;
let userToken = null; // Store JWT token from account service

const CRYPTO_API_BASE = "http://127.0.0.1:8000"; // Key-gen microservice
const ORDER_STATUS_API_BASE = "http://127.0.0.1:8001"; // Order status microservice
const ACCOUNT_API_BASE = "http://127.0.0.1:8003"; // Account microservice
const NOTIFICATION_API_BASE = "http://127.0.0.1:8080"; // Notification microservice


// ============================================
// CRYPTOGRAPHIC FUNCTIONS (Key Generation Service)
// ============================================

async function generateUserKeys() {
    try {
        const response = await fetch(`${CRYPTO_API_BASE}/generateKeyPair`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ algorithm: "Ed25519" })
        });

        if (!response.ok) {
            throw new Error('Failed to generate keys');
        }

        const data = await response.json();
        userKeys = {
            publicKey: data.public_key,
            privateKey: data.private_key
        };
        
        console.log('Keys generated successfully');
        console.log('Public Key:', userKeys.publicKey);
        return userKeys;
    } catch (error) {
        console.error('Error generating keys:', error);
        alert('Error connecting to key generation service. Please ensure the FastAPI service is running on port 8000.');
        return null;
    }
}

async function signOrderData(orderData) {
    if (!userKeys) {
        console.error('No keys available for signing');
        return null;
    }

    try {
        const response = await fetch(`${CRYPTO_API_BASE}/signData`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                private_key: userKeys.privateKey,
                message: JSON.stringify(orderData)
            })
        });

        if (!response.ok) {
            throw new Error('Failed to sign data');
        }

        const data = await response.json();
        console.log('Order signed successfully');
        return data.signature;
    } catch (error) {
        console.error('Error signing order:', error);
        return null;
    }
}

async function verifyOrderSignature(orderData, signature) {
    if (!userKeys) {
        console.error('No keys available for verification');
        return false;
    }

    try {
        const response = await fetch(`${CRYPTO_API_BASE}/verifySignature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                public_key: userKeys.publicKey,
                message: JSON.stringify(orderData),
                signature: signature
            })
        });

        if (!response.ok) {
            throw new Error('Failed to verify signature');
        }

        const data = await response.json();
        console.log('Signature verification result:', data.valid);
        return data.valid;
    } catch (error) {
        console.error('Error verifying signature:', error);
        return false;
    }
}

// ============================================
// ORDER STATUS SERVICE FUNCTIONS
// ============================================

async function createOrderInService(orderId) {
    try {
        console.log('Creating order in service:', orderId);
        const response = await fetch(`${ORDER_STATUS_API_BASE}/order/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                order_id: orderId
            })
        });

        console.log('Create order response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to create order - error response:', errorData);
            throw new Error('Failed to create order in service');
        }

        const data = await response.json();
        console.log('Order created in status service:', data);
        return data;
    } catch (error) {
        console.error('Error creating order in service:', error);
        return null;
    }
}

async function getOrderStatus(orderId) {
    try {
        const response = await fetch(`${ORDER_STATUS_API_BASE}/order/status/${orderId}`);

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }
            throw new Error('Failed to get order status');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting order status:', error);
        return null;
    }
}

async function getOrderProgress(orderId) {
    try {
        const response = await fetch(`${ORDER_STATUS_API_BASE}/order/progress/${orderId}`);

        if (!response.ok) {
            throw new Error('Failed to get order progress');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting order progress:', error);
        return null;
    }
}

// ============================================
// SCREEN NAVIGATION
// ============================================

function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }

    // Stop polling when leaving track order screen
    if (screenId !== 'trackOrderScreen' && statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }
}

// ============================================
// REGISTRATION & LOGIN HANDLERS
// ============================================

async function handleRegister(button) {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;

    if (!name || !email || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    if (!email.includes('@')) {
        alert('Please enter a valid email');
        return;
    }

    const originalText = button.textContent;
    button.textContent = 'Creating account...';
    button.disabled = true;

    try {
        // Create user in account service
        const registerResponse = await fetch(`${ACCOUNT_API_BASE}/user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: email,  // Use email as username
                password: password
            })
        });

        if (!registerResponse.ok) {
            const errorData = await registerResponse.json();
            button.textContent = originalText;
            button.disabled = false;
            alert('Registration failed: ' + (errorData.message || 'Unknown error'));
            return;
        }

        // Generate crypto keys for user
        const keys = await generateUserKeys();
        
        button.textContent = originalText;
        button.disabled = false;

        if (keys) {
            alert('Account created successfully!');
            showScreen('locationsScreen');
        } else {
            alert('Account created, but key generation failed. Please try logging in.');
        }
    } catch (error) {
        console.error('Registration error:', error);
        button.textContent = originalText;
        button.disabled = false;
        alert('Registration failed: ' + error.message);
    }
}

async function handleLogin(button) {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    const originalText = button.textContent;
    button.textContent = 'Logging in...';
    button.disabled = true;

    try {
        // Login with account service
        const loginResponse = await fetch(`${ACCOUNT_API_BASE}/user/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: email,  // Use email as username
                password: password
            })
        });

        if (!loginResponse.ok) {
            const errorData = await loginResponse.json();
            button.textContent = originalText;
            button.disabled = false;
            alert('Login failed: ' + (errorData.message || 'Invalid credentials'));
            return;
        }

        const loginData = await loginResponse.json();
        userToken = loginData.token;  // Store JWT token
        console.log('Login successful, token:', userToken);

        // Generate crypto keys
        const keys = await generateUserKeys();
        
        button.textContent = originalText;
        button.disabled = false;

        if (keys) {
            alert('Logged in successfully!');
            showScreen('locationsScreen');
        } else {
            alert('Login successful, but key generation failed.');
        }
    } catch (error) {
        console.error('Login error:', error);
        button.textContent = originalText;
        button.disabled = false;
        alert('Login failed: ' + error.message);
    }
}

// ============================================
// CART FUNCTIONS
// ============================================

function addToCart(itemName, itemPrice, itemId) {
    const existingItem = cart.find(item => item.id === itemId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: itemId,
            name: itemName,
            price: itemPrice,
            quantity: 1
        });
    }
    
    updateCartUI();
    showCartNotification(itemName);
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCartUI();
}

function updateQuantity(itemId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(itemId);
        return;
    }
    
    const item = cart.find(item => item.id === itemId);
    if (item) {
        item.quantity = newQuantity;
        updateCartUI();
    }
}

function getCartTotal() {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2);
}

function updateCartUI() {
    const cartBadges = document.querySelectorAll('.cart-badge');
    const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
    cartBadges.forEach(badge => {
        badge.textContent = itemCount;
    });

    const cartBody = document.getElementById('cartBody');
    const cartFooter = document.getElementById('cartFooter');
    
    if (cart.length === 0) {
        cartBody.innerHTML = `
            <div class="empty-cart">
                <div class="empty-icon">🛒</div>
                <p>Your cart is empty</p>
            </div>
        `;
        cartFooter.style.display = 'none';
    } else {
        cartBody.innerHTML = `
            <div class="cart-items">
                ${cart.map(item => `
                    <div class="cart-item">
                        <div class="cart-item-header">
                            <h3 class="cart-item-name">${item.name}</h3>
                            <button class="cart-item-remove" onclick="removeFromCart(${item.id})">✕</button>
                        </div>
                        <div class="cart-item-footer">
                            <div class="quantity-controls">
                                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">−</button>
                                <span class="quantity-value">${item.quantity}</span>
                                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
                            </div>
                            <p class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        cartFooter.style.display = 'block';
        document.getElementById('cartTotalAmount').textContent = '$' + getCartTotal();
    }
}

function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    cartSidebar.classList.toggle('active');
}

function showCartNotification(itemName) {
    const notification = document.createElement('div');
    notification.textContent = `${itemName} added to cart!`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #065f46;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 2000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

// ============================================
// CHECKOUT HANDLER (WITH DIGITAL SIGNATURE)
// ============================================

async function handleCheckout() {
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    if (!userKeys) {
        alert('Please log in or register first to generate secure keys!');
        toggleCart();
        showScreen('loginScreen');
        return;
    }

    const checkoutBtn = document.querySelector('.btn-checkout');
    const originalText = checkoutBtn.textContent;
    checkoutBtn.textContent = 'Processing & Signing Order...';
    checkoutBtn.disabled = true;

    const orderId = 'ORD' + Date.now().toString().slice(-8);
    const orderDate = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
    const orderTotal = getCartTotal();
    const orderItems = [...cart];

    const orderData = {
        orderId: orderId,
        items: orderItems,
        total: orderTotal,
        timestamp: new Date().toISOString(),
        userPublicKey: userKeys.publicKey
    };

    // Sign the order with key-gen service
    const signature = await signOrderData(orderData);

    if (!signature) {
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = false;
        alert('Failed to sign order. Please try again or check if the crypto service is running.');
        return;
    }

    const isValid = await verifyOrderSignature(orderData, signature);
    
    if (!isValid) {
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = false;
        await logOrderEvent(orderId, 'verification_failed', { reason: 'signature_invalid' });
        alert('Order signature verification failed! Order cancelled for security reasons.');
        return;
    }

    console.log('✓ Order signed and verified successfully!');
    console.log('Order ID:', orderId);
    console.log('Signature:', signature);

    // Create order in status service
    const orderCreated = await createOrderInService(orderId);
    
    checkoutBtn.textContent = originalText;
    checkoutBtn.disabled = false;

    if (!orderCreated) {
        alert('Warning: Order signed but status tracking may not work. Please ensure order status service is running on port 8001.');
    }

    // Store order locally with initial status
    completedOrders[orderId] = {
        id: orderId,
        items: orderItems,
        total: orderTotal,
        location: 'Arnold Dining Hall',
        placedAt: orderDate,
        estimatedTime: calculateEstimatedTime(),
        currentStatus: 'received',
        signature: signature,
        publicKey: userKeys.publicKey,
        createdInService: orderCreated !== null
    };

    currentOrderId = orderId;

    document.getElementById('orderId').textContent = orderId;
    document.getElementById('orderDate').textContent = orderDate;
    document.getElementById('orderTotal').textContent = '$' + orderTotal;
    
    const orderSummaryItems = document.getElementById('orderSummaryItems');
    orderSummaryItems.innerHTML = orderItems.map(item => `
        <div class="summary-item">
            <span class="summary-item-name">${item.name} x${item.quantity}</span>
            <span class="summary-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');

    const signatureInfo = document.createElement('div');
    signatureInfo.className = 'signature-info';
    signatureInfo.innerHTML = `
        <div style="margin-top: 1.5rem; padding: 1rem; background-color: #d1fae5; border-radius: 0.5rem; text-align: left;">
            <p style="font-weight: 600; color: #065f46; margin-bottom: 0.5rem;">🔒 Digitally Signed Order</p>
            <p style="font-size: 0.75rem; color: #059669; word-break: break-all;">Signature: ${signature.substring(0, 40)}...</p>
            <p style="font-size: 0.75rem; color: #059669; margin-top: 0.25rem;">Public Key: ${userKeys.publicKey.substring(0, 40)}...</p>
            <p style="font-size: 0.75rem; color: #047857; margin-top: 0.5rem;">✓ Verified using Ed25519</p>
        </div>
    `;
    
    const orderSummary = document.querySelector('.order-summary');
    const existingSignatureInfo = document.querySelector('.signature-info');
    if (existingSignatureInfo) {
        existingSignatureInfo.remove();
    }
    orderSummary.appendChild(signatureInfo);

    // Send notification email to user
    await sendOrderNotification(orderId, 'received', {
        items: orderItems,
        total: orderTotal,
        location: 'Arnold Dining Hall',
        estimatedTime: completedOrders[orderId].estimatedTime
    });

    cart = [];
    updateCartUI();
    toggleCart();
    showScreen('orderConfirmationScreen');

    alert('Order placed successfully and digitally signed! ✓\nCheck your email for confirmation.');
}

// ============================================
// ORDER TRACKING FUNCTIONS
// ============================================

function calculateEstimatedTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 25);
    return now.toLocaleString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
}

function trackCurrentOrder() {
    if (currentOrderId) {
        document.getElementById('trackOrderInput').value = currentOrderId;
        showScreen('trackOrderScreen');
        trackOrder();
    }
}

async function trackOrder() {
    const orderId = document.getElementById('trackOrderInput').value.trim().toUpperCase();
    const errorDiv = document.getElementById('trackError');
    const statusContainer = document.getElementById('orderStatusContainer');

    errorDiv.style.display = 'none';
    statusContainer.style.display = 'none';

    // Stop any existing polling
    if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
        statusPollingInterval = null;
    }

    if (!orderId) {
        errorDiv.textContent = 'Please enter an order ID';
        errorDiv.style.display = 'block';
        return;
    }

    // Try to get status from the order status service
    const serviceStatus = await getOrderStatus(orderId);
    
    if (!serviceStatus) {
        // Check if we have it in local storage
        const localOrder = completedOrders[orderId];
        if (!localOrder) {
            errorDiv.textContent = 'Order not found. Please check your order ID and try again.';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Display local order without live updates
        displayOrderStatusLocal(localOrder);
        return;
    }

    // Display order with live updates from service
    displayOrderStatusLive(orderId, serviceStatus);

    // Start polling for status updates every 5 seconds
    statusPollingInterval = setInterval(async () => {
        const updatedStatus = await getOrderStatus(orderId);
        if (updatedStatus) {
            displayOrderStatusLive(orderId, updatedStatus);
        }
    }, 5000);
}

function displayOrderStatusLocal(order) {
    const statusContainer = document.getElementById('orderStatusContainer');
    
    const statusColorMap = {
        'received': 'bg-blue-100 text-blue-800',
        'preparing': 'bg-yellow-100 text-yellow-800',
        'ready': 'bg-green-100 text-green-800',
        'completed': 'bg-gray-100 text-gray-800'
    };

    const statusTextMap = {
        'received': 'Order Received',
        'preparing': 'Being Prepared',
        'ready': 'Ready for Pickup',
        'completed': 'Order Completed'
    };

    const statusIconMap = {
        'received': '📋',
        'preparing': '👨‍🍳',
        'ready': '✅',
        'completed': '🎉'
    };

    statusContainer.innerHTML = `
        <div class="order-status-card">
            <div class="status-header">
                <div>
                    <h3 class="status-order-id">Order ${order.id}</h3>
                    <p class="status-location">${order.location}</p>
                </div>
                <span class="status-badge ${statusColorMap[order.currentStatus]}">
                    ${statusIconMap[order.currentStatus]} ${statusTextMap[order.currentStatus]}
                </span>
            </div>

            <div class="status-alert" style="background-color: #fef3c7; border: 2px solid #fbbf24; margin-bottom: 1.5rem;">
                <span class="alert-icon">⚠️</span>
                <div>
                    <h4 style="color: #92400e;">Limited Tracking</h4>
                    <p style="color: #78350f;">Live status updates unavailable. Order status service may be offline.</p>
                </div>
            </div>

            <div class="status-time-info">
                <div>
                    <p class="time-label">Placed At</p>
                    <p class="time-value">${order.placedAt}</p>
                </div>
                <div>
                    <p class="time-label">Estimated Ready Time</p>
                    <p class="time-value">${order.estimatedTime}</p>
                </div>
            </div>

            <div class="status-items">
                <h4 class="items-title">Order Items</h4>
                ${order.items.map(item => `
                    <div class="status-item">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('')}
                <div class="status-total">
                    <span>Total</span>
                    <span>$${order.total}</span>
                </div>
            </div>

            ${order.signature ? `
                <div class="signature-badge">
                    <p class="signature-title">🔒 Digitally Signed Order</p>
                    <p class="signature-text">Signature: ${order.signature.substring(0, 40)}...</p>
                    <p class="signature-text">Public Key: ${order.publicKey.substring(0, 40)}...</p>
                    <p class="signature-verified">✓ Verified using Ed25519</p>
                </div>
            ` : ''}
        </div>
    `;

    statusContainer.style.display = 'block';
}

function displayOrderStatusLive(orderId, serviceStatus) {
    const statusContainer = document.getElementById('orderStatusContainer');
    const localOrder = completedOrders[orderId];
    
    const statusColorMap = {
        'received': 'bg-blue-100 text-blue-800',
        'preparing': 'bg-yellow-100 text-yellow-800',
        'ready': 'bg-green-100 text-green-800',
        'completed': 'bg-gray-100 text-gray-800'
    };

    const statusTextMap = {
        'received': 'Order Received',
        'preparing': 'Being Prepared',
        'ready': 'Ready for Pickup',
        'completed': 'Order Completed'
    };

    const statusIconMap = {
        'received': '📋',
        'preparing': '👨‍🍳',
        'ready': '✅',
        'completed': '🎉'
    };

    // Build status history based on current status
    const statusHistory = [
        { status: 'received', completed: true },
        { status: 'preparing', completed: serviceStatus.status === 'preparing' || serviceStatus.status === 'ready' },
        { status: 'ready', completed: serviceStatus.status === 'ready' }
    ];

    statusContainer.innerHTML = `
        <div class="order-status-card">
            <div class="status-header">
                <div>
                    <h3 class="status-order-id">Order ${orderId}</h3>
                    <p class="status-location">${localOrder ? localOrder.location : 'Arnold Dining Hall'}</p>
                </div>
                <span class="status-badge ${statusColorMap[serviceStatus.status]}">
                    ${statusIconMap[serviceStatus.status]} ${statusTextMap[serviceStatus.status]}
                </span>
            </div>

            <div class="status-alert" style="background-color: #d1fae5; border: 2px solid #10b981; margin-bottom: 1.5rem;">
                <span class="alert-icon">🔄</span>
                <div>
                    <h4 style="color: #065f46;">Live Tracking Active</h4>
                    <p style="color: #047857;">Status updates automatically every 5 seconds</p>
                </div>
            </div>

            ${localOrder ? `
            <div class="status-time-info">
                <div>
                    <p class="time-label">Placed At</p>
                    <p class="time-value">${localOrder.placedAt}</p>
                </div>
                <div>
                    <p class="time-label">Estimated Ready Time</p>
                    <p class="time-value">${localOrder.estimatedTime}</p>
                </div>
            </div>

            <div class="status-items">
                <h4 class="items-title">Order Items</h4>
                ${localOrder.items.map(item => `
                    <div class="status-item">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>$${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('')}
                <div class="status-total">
                    <span>Total</span>
                    <span>$${localOrder.total}</span>
                </div>
            </div>
            ` : ''}

            <div class="status-timeline">
                <h4 class="timeline-title">Order Progress</h4>
                ${statusHistory.map((step, index) => `
                    <div class="timeline-step">
                        <div class="timeline-icon ${step.completed ? 'completed' : 'pending'}">
                            ${step.completed ? '✓' : statusIconMap[step.status]}
                        </div>
                        ${index < statusHistory.length - 1 ? `<div class="timeline-line ${step.completed ? 'completed' : ''}"></div>` : ''}
                        <div class="timeline-content">
                            <h5 class="${step.completed ? 'completed' : 'pending'}">${statusTextMap[step.status]}</h5>
                            ${!step.completed && step.status === statusHistory.find(s => !s.completed)?.status ? '<p class="in-progress">In progress...</p>' : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${serviceStatus.status === 'ready' ? `
                <div class="status-alert ready-alert">
                    <span class="alert-icon">🎉</span>
                    <div>
                        <h4>Your order is ready!</h4>
                        <p>Please proceed to ${localOrder ? localOrder.location : 'the dining hall'} to pick up your order. Show this order ID at the counter.</p>
                    </div>
                </div>
            ` : ''}

            ${localOrder && localOrder.signature ? `
                <div class="signature-badge">
                    <p class="signature-title">🔒 Digitally Signed Order</p>
                    <p class="signature-text">Signature: ${localOrder.signature.substring(0, 40)}...</p>
                    <p class="signature-text">Public Key: ${localOrder.publicKey.substring(0, 40)}...</p>
                    <p class="signature-verified">✓ Verified using Ed25519</p>
                </div>
            ` : ''}
        </div>
    `;

    statusContainer.style.display = 'block';
}

// ============================================
// INITIALIZATION
// ============================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', function() {
    showScreen('welcomeScreen');
    updateCartUI();
    
    console.log('Campus Dining App initialized');
    console.log('Crypto Service URL:', CRYPTO_API_BASE);
    console.log('Order Status Service URL:', ORDER_STATUS_API_BASE);
    console.log('Make sure both services are running:');
    console.log('- Key-gen: uvicorn main:app --reload --port 8000');
    console.log('- Order Status: uvicorn main:app --reload --port 8001');
});

// ============================================
// NOTIFICATION PREFERENCES INTEGRATION CODE
// ============================================

// Global notification preferences
let notificationPreferences = {
    email: false,
    emailAddress: ''
};

// ============================================
// NOTIFICATION MODAL FUNCTIONS
// ============================================

function showNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
        modal.style.display = 'flex';
        // Load saved preferences if they exist
        loadNotificationPreferences();
    }
}

function hideNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleNotification(type) {
    notificationPreferences[type] = !notificationPreferences[type];
    updateNotificationUI();
}

function updateNotificationUI() {
    // Update toggle switches
    const emailToggle = document.getElementById('emailToggle');
    const emailInput = document.getElementById('emailNotifInput');

    if (emailToggle) {
        emailToggle.checked = notificationPreferences.email;
    }
    if (emailInput) {
        emailInput.style.display = notificationPreferences.email ? 'block' : 'none';
        emailInput.value = notificationPreferences.emailAddress;
    }
}

async function saveNotificationPreferences() {
    // Get values from inputs
    const emailInput = document.getElementById('emailNotifInput');

    if (notificationPreferences.email) {
        notificationPreferences.emailAddress = emailInput.value;
    }

    // Validate
    if (!notificationPreferences.email) {
        alert('Please enable email notifications');
        return;
    }

    if (notificationPreferences.email && !notificationPreferences.emailAddress) {
        alert('Please enter your email address');
        return;
    }

    try {
        // Validate input
        if (notificationPreferences.email && !notificationPreferences.emailAddress.includes('@')) {
            alert('Please enter a valid email address');
            return;
        }

        // Save to notification service
        const userId = userToken || 'user_' + Date.now();
        const response = await fetch(`${NOTIFICATION_API_BASE}/preferences`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                email: notificationPreferences.email,
                email_address: notificationPreferences.emailAddress
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Preferences saved to service:', data);
            
            // Also save to localStorage as backup
            localStorage.setItem('notificationPreferences', JSON.stringify(notificationPreferences));
            localStorage.setItem('notificationUserId', userId);

            // Show success message
            const saveBtn = document.querySelector('#notificationModal .btn-confirm');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '✓ Saved!';
            saveBtn.style.backgroundColor = '#10b981';
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.backgroundColor = '';
                hideNotificationModal();
            }, 1500);
        } else {
            throw new Error('Failed to save preferences to server');
        }

    } catch (error) {
        console.error('Error saving preferences:', error);
        alert('Failed to save preferences. Please make sure the notification service is running on port 8080.');
    }
}

function loadNotificationPreferences() {
    // Try to load from localStorage
    const saved = localStorage.getItem('notificationPreferences');
    if (saved) {
        notificationPreferences = JSON.parse(saved);
        updateNotificationUI();
    }
}

// ============================================
// SEND NOTIFICATIONS
// ============================================

async function sendOrderNotification(orderId, status, orderDetails) {
    // Check if user has set preferences
    const saved = localStorage.getItem('notificationPreferences');
    if (!saved) {
        console.log('No notification preferences set');
        return;
    }

    const prefs = JSON.parse(saved);
    if (!prefs.email) {
        console.log('Email notifications not enabled');
        return;
    }

    try {
        const userId = localStorage.getItem('notificationUserId') || 'user_' + Date.now();
        
        const response = await fetch(`${NOTIFICATION_API_BASE}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                order_id: orderId,
                status: status,
                order_details: orderDetails
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Notification sent:', data);
            if (data.email_sent) {
                console.log('📧 Email sent to:', prefs.emailAddress);
            }
        } else {
            throw new Error('Failed to send notification');
        }
    } catch (error) {
        console.error('Error sending notification:', error);
        console.log('Make sure notification service is running on port 8080');
    }
}

// ============================================
// MODIFY EXISTING CHECKOUT FUNCTION
// ============================================

// Replace your existing handleCheckout function with this modified version:
async function handleCheckoutWithNotifications() {
    // Check if notification preferences are set
    if (!notificationPreferences.email && !notificationPreferences.sms) {
        // Show notification modal first
        showNotificationModal();
        alert('Please set your notification preferences to receive order updates!');
        return;
    }

    // Your existing checkout code here...
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }

    if (!userKeys) {
        alert('Please log in or register first to generate secure keys!');
        toggleCart();
        showScreen('loginScreen');
        return;
    }

    const checkoutBtn = document.querySelector('.btn-checkout');
    const originalText = checkoutBtn.textContent;
    checkoutBtn.textContent = 'Processing & Signing Order...';
    checkoutBtn.disabled = true;

    const orderId = 'ORD' + Date.now().toString().slice(-8);
    const orderDate = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
    const orderTotal = getCartTotal();
    const orderItems = [...cart];

    const orderData = {
        orderId: orderId,
        items: orderItems,
        total: orderTotal,
        timestamp: new Date().toISOString(),
        userPublicKey: userKeys.publicKey
    };

    // Sign and verify order
    const signature = await signOrderData(orderData);

    if (!signature) {
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = false;
        alert('Failed to sign order. Please try again.');
        return;
    }

    const isValid = await verifyOrderSignature(orderData, signature);
    
    if (!isValid) {
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = false;
        alert('Order signature verification failed!');
        return;
    }

    // Create order in status service
    const orderCreated = await createOrderInService(orderId);
    
    checkoutBtn.textContent = originalText;
    checkoutBtn.disabled = false;

    // Store order locally
    completedOrders[orderId] = {
        id: orderId,
        items: orderItems,
        total: orderTotal,
        location: 'Arnold Dining Hall',
        placedAt: orderDate,
        estimatedTime: calculateEstimatedTime(),
        currentStatus: 'received',
        signature: signature,
        publicKey: userKeys.publicKey,
        createdInService: orderCreated !== null
    };

    currentOrderId = orderId;

    // Send initial notification
    await sendOrderNotification(orderId, 'received', {
        items: orderItems,
        total: orderTotal,
        location: 'Arnold Dining Hall',
        estimatedTime: completedOrders[orderId].estimatedTime
    });

    // Update UI
    document.getElementById('orderId').textContent = orderId;
    document.getElementById('orderDate').textContent = orderDate;
    document.getElementById('orderTotal').textContent = '$' + orderTotal;
    
    const orderSummaryItems = document.getElementById('orderSummaryItems');
    orderSummaryItems.innerHTML = orderItems.map(item => `
        <div class="summary-item">
            <span class="summary-item-name">${item.name} x${item.quantity}</span>
            <span class="summary-item-price">$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');

    const signatureInfo = document.createElement('div');
    signatureInfo.className = 'signature-info';
    signatureInfo.innerHTML = `
        <div style="margin-top: 1.5rem; padding: 1rem; background-color: #d1fae5; border-radius: 0.5rem; text-align: left;">
            <p style="font-weight: 600; color: #065f46; margin-bottom: 0.5rem;">🔒 Digitally Signed Order</p>
            <p style="font-size: 0.75rem; color: #059669; word-break: break-all;">Signature: ${signature.substring(0, 40)}...</p>
            <p style="font-size: 0.75rem; color: #059669; margin-top: 0.25rem;">Public Key: ${userKeys.publicKey.substring(0, 40)}...</p>
            <p style="font-size: 0.75rem; color: #047857; margin-top: 0.5rem;">✓ Verified using Ed25519</p>
        </div>
    `;
    
    const orderSummary = document.querySelector('.order-summary');
    const existingSignatureInfo = document.querySelector('.signature-info');
    if (existingSignatureInfo) {
        existingSignatureInfo.remove();
    }
    orderSummary.appendChild(signatureInfo);

    cart = [];
    updateCartUI();
    toggleCart();
    showScreen('orderConfirmationScreen');

    alert('Order placed successfully! You will receive notifications via ' + 
          (notificationPreferences.email ? 'email' : '') + 
          (notificationPreferences.email && notificationPreferences.sms ? ' and ' : '') +
          (notificationPreferences.sms ? 'SMS' : ''));
}

// ============================================
// MODIFY STATUS POLLING TO SEND NOTIFICATIONS
// ============================================

// Update your displayOrderStatusLive function to include notifications:
async function displayOrderStatusLiveWithNotifications(orderId, serviceStatus) {
    // Your existing display code...
    displayOrderStatusLive(orderId, serviceStatus);
    
    // Check if status changed and send notification
    const localOrder = completedOrders[orderId];
    if (localOrder && localOrder.currentStatus !== serviceStatus.status) {
        // Status changed, send notification
        await sendOrderNotification(orderId, serviceStatus.status, {
            items: localOrder.items,
            total: localOrder.total,
            location: localOrder.location,
            estimatedTime: localOrder.estimatedTime
        });
        
        // Update local status
        localOrder.currentStatus = serviceStatus.status;
        completedOrders[orderId] = localOrder;
    }
}