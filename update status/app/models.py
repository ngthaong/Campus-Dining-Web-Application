from pydantic import BaseModel

class CreateOrderRequest(BaseModel):
    order_id: str


class OrderStatusResponse(BaseModel):
    order_id: str
    status: str
    message: str | None = None
