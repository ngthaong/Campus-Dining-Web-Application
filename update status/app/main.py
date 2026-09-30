from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from app.order_status import router as order_status_router

app = FastAPI(
    title="Order Status Microservice",
    description="Provides order status updates for food delivery orders",
    version="1.0"
)

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def docs_redirect():
    return RedirectResponse(url="/docs")

app.include_router(order_status_router)
