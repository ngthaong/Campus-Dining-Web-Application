from fastapi import APIRouter, HTTPException
from app.models import CreateOrderRequest, OrderStatusResponse
import time

router = APIRouter()

# In-memory order storage (replace with DB if needed)
orders = {}

# For demonstration: each state lasts a few seconds
RECEIVED_DURATION = 20      # 0–20 sec
PREPARING_DURATION = 60     # 20–60 sec

def get_progress_state(start_time: float) -> str:
    elapsed = time.time() - start_time

    if elapsed < RECEIVED_DURATION:
        return "received"
    elif elapsed < PREPARING_DURATION:
        return "preparing"
    else:
        return "ready"

@router.post("/order/create", response_model=OrderStatusResponse)
def create_order(request: CreateOrderRequest):
    order_id = request.order_id

    if order_id in orders:
        raise HTTPException(status_code=400, detail="Order already exists")

    orders[order_id] = {
        "start_time": time.time()
    }

    return OrderStatusResponse(
        order_id=order_id,
        status="received",
        message="Order successfully created."
    )


@router.get("/order/status/{order_id}", response_model=OrderStatusResponse)
def get_order_status(order_id: str):

    # User story 1: Check order status.
    if order_id not in orders:
        raise HTTPException(status_code=404, detail="Order not found")

    start_time = orders[order_id]["start_time"]
    status = get_progress_state(start_time)

    return OrderStatusResponse(order_id=order_id, status=status)


@router.get("/order/progress/{order_id}", response_model=OrderStatusResponse)
def auto_update_status(order_id: str):
    
    # User story 2: Automatic progress updates.
    if order_id not in orders:
        raise HTTPException(status_code=404, detail="Order not found")

    start_time = orders[order_id]["start_time"]
    status = get_progress_state(start_time)

    return OrderStatusResponse(
        order_id=order_id,
        status=status,
        message="Order status automatically updated."
    )
