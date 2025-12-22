from fastapi import APIRouter
from app.api.routes import receipt

api_router = APIRouter()
api_router.include_router(receipt.router, prefix="/receipt", tags=["receipt"])
