from fastapi import APIRouter
from app.api.routes import auth, casa, history, receipt

api_router = APIRouter()
api_router.include_router(receipt.router, prefix="/receipt", tags=["receipt"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
api_router.include_router(casa.router, prefix="/casa", tags=["casa"])
