from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import smtplib
from email.message import EmailMessage

EMAIL_ADDRESS = 'ngthaong0102@gmail.com'
EMAIL_PASSWORD = 'lcrn xxjo drum gxmx'

SMTP_ERROR_CODES = {
    211: "System status, or system help reply.",
    214: "Help message.",
    220: "Service ready.",
    221: "Service closing transmission channel.",
    235: "Authentication successful.",
    250: "Requested mail action okay, completed.",
    251: "User not local; will forward to {}",
    252: "Cannot VRFY user, but will accept message and attempt delivery.",
    354: "Start mail input; end with <CRLF>.<CRLF>",
    421: "Service not available, closing transmission channel. The server response was: {}",
    450: "Requested mail action not taken: mailbox unavailable. The server response was: {}",
    451: "Requested action aborted: local error in processing.",
    452: "Requested action not taken: insufficient system storage.",
    455: "Server unable to accommodate parameters.",
    500: "Syntax error, command unrecognized.",
    501: "Syntax error in parameters or arguments.",
    502: "Command not implemented.",
    503: "Bad sequence of commands.",
    504: "Command parameter not implemented.",
    530: "Authentication required.",
    534: "Authentication mechanism is too weak.",
    535: "Authentication failed. The server response was: {}",
    538: "Encryption required for requested authentication mechanism.",
    550: "Requested action not taken: mailbox unavailable. The server response was: {}",
    551: "User not local; please try {}. The server response was: {}",
    552: "Requested mail action aborted: exceeded storage allocation.",
    553: "Requested action not taken: mailbox name not allowed.",
    554: "Transaction failed. The server response was: {}",
}

def send_email(t,subject = "Welcome Email", username="New User"):
    msg = EmailMessage()

    body = f"Hello, {username}.\n We welcome you onboard! Hope you will have a good time!"

    msg['Subject'] = subject
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = t
    msg.set_content(body)


    with smtplib.SMTP('smtp.gmail.com', 587) as smtp: 
        try:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()

            smtp.login(EMAIL_ADDRESS,EMAIL_PASSWORD)


            smtp.send_message(msg)

            response = {
                "user_email": t,
                "Status": "Queued. Thank you!",
            }

            return response
        except smtplib.SMTPResponseException as err:
            
            error_code = err.smtp_code
            error_message = SMTP_ERROR_CODES.get(error_code, f"Unknown error ({error_code})")
            response = {
                "Error code": error_code,
                "Error message": error_message,
                "Status": "Unsuccessful!",

            }


            return response
        
        except Exception as Err:
            response = {
                "Error message": f"Unknown error sending email to {t} ",
                "Status": "Unsuccessful!",
            }

            return response

def send_order_notification(user_email, order_id, status, order_details=None):
    """Send order status notification email"""
    msg = EmailMessage()
    
    # Create nice status messages
    status_messages = {
        'received': 'Your order has been received!',
        'pending': 'Your order is pending confirmation.',
        'processing': 'Your order is being prepared!',
        'shipped': 'Your order is ready for pickup!',
        'delivered': 'Your order is ready! Please pick it up.',
        'completed': 'Thank you for your order!',
        'cancelled': 'Your order has been cancelled.'
    }
    
    status_msg = status_messages.get(status.lower(), f'Status: {status}')
    
    # Create email body
    body = f"""Hello!

{status_msg}

Order ID: {order_id}
Status: {status.upper()}

"""
    
    if order_details:
        body += "\nOrder Details:\n"
        if 'items' in order_details:
            body += "Items:\n"
            for item in order_details['items']:
                body += f"  - {item.get('name', 'Item')} x{item.get('quantity', 1)}\n"
        if 'total' in order_details:
            body += f"\nTotal: ${order_details['total']}\n"
        if 'location' in order_details:
            body += f"Location: {order_details['location']}\n"
    
    body += "\nThank you for your order!\n\n- Campus Dining Team"
    
    msg['Subject'] = f"Order Update: {order_id}"
    msg['From'] = EMAIL_ADDRESS
    msg['To'] = user_email
    msg.set_content(body)
    
    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            smtp.send_message(msg)
        
        return {
            "status": "success",
            "message": "Email sent successfully",
            "user_email": user_email,
            "order_id": order_id
        }
    except Exception as e:
        print(f"Error sending email: {e}")
        return {
            "status": "error",
            "message": str(e),
            "user_email": user_email
        }


app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# In-memory storage for notification preferences
notification_storage = {}

@app.route("/", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "ok"}), 200


@app.route("/preferences", methods=["POST"])
def save_preferences():
    """Save user notification preferences"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default')
        
        notification_storage[user_id] = {
            'user_id': user_id,
            'email': data.get('email', False),
            'email_address': data.get('email_address', '')
        }
        
        print(f"✅ Saved preferences for user {user_id}: {notification_storage[user_id]}")
        
        return jsonify({
            "status": "success",
            "message": "Preferences saved successfully",
            "user_id": user_id
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/preferences/<user_id>", methods=["GET"])
def get_preferences(user_id):
    """Get user notification preferences"""
    if user_id in notification_storage:
        return jsonify(notification_storage[user_id]), 200
    else:
        return jsonify({
            "user_id": user_id,
            "email": False,
            "email_address": ""
        }), 200


@app.route("/send", methods=["POST"])
def send_notification():
    """Send notification based on user preferences"""
    try:
        data = request.get_json()
        user_id = data.get('user_id', 'default')
        order_id = data.get('order_id')
        status = data.get('status')
        order_details = data.get('order_details', {})
        
        # Get user preferences
        preferences = notification_storage.get(user_id, {})
        
        email_sent = False
        
        # Send email if enabled
        if preferences.get('email') and preferences.get('email_address'):
            email_address = preferences.get('email_address')
            print(f"📧 Sending email to {email_address} for order {order_id}")
            
            result = send_order_notification(
                email_address,
                order_id,
                status,
                order_details
            )
            
            email_sent = result.get('status') == 'success'
            if email_sent:
                print(f"✅ Email sent successfully to {email_address}")
            else:
                print(f"❌ Failed to send email: {result.get('message')}")
        
        return jsonify({
            "status": "success",
            "message": "Email notification sent" if email_sent else "No email configured",
            "order_id": order_id,
            "email_sent": email_sent
        }), 200
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/send-email/<user_email>", methods=["GET"])
def get_user(user_email):
    """Legacy welcome email endpoint"""
    user_name = request.args.get("user_name")
    if user_name:
        response = send_email(t=user_email, username=user_name)
    else:
        response = send_email(user_email)
    return jsonify(response), 200


if __name__ == "__main__":
    print("🔔 Notification Service Starting...")
    print("📧 Email: Enabled (Gmail)")
    print("🌐 Port: 8080")
    print("📍 URL: http://127.0.0.1:8080")
    print("=" * 50)
    app.run(host="127.0.0.1", port=8080, debug=True)