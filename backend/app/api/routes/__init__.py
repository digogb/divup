from fastapi import APIRouter
from app.api.routes import admin, auth, casa, events, history, receipt

api_router = APIRouter()
api_router.include_router(receipt.router, prefix="/receipt", tags=["receipt"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
api_router.include_router(casa.router, prefix="/casa", tags=["casa"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
