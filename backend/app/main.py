from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.routes import api_router
from app.core.config import settings
import os

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API para processamento de notas fiscais com OCR",
    version="1.0.0"
)

# CORS para desenvolvimento local e PWA
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Aceitar qualquer origem (PWA, localhost, etc)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas da API
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Caminho para a pasta PWA
PWA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pwa")

# Servir arquivos estáticos da PWA (CSS, JS, assets)
if os.path.exists(PWA_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(PWA_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(PWA_DIR, "js")), name="js")
    app.mount("/assets", StaticFiles(directory=os.path.join(PWA_DIR, "assets")), name="assets")

@app.get("/")
async def root():
    """Serve a PWA ou mensagem de boas-vindas"""
    index_path = os.path.join(PWA_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {"message": "DivUp API - Use /docs para documentação"}

@app.get("/manifest.json")
async def manifest():
    """Serve o manifest da PWA"""
    manifest_path = os.path.join(PWA_DIR, "manifest.json")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/json")
    return {"error": "Manifest not found"}

@app.get("/sw.js")
async def service_worker():
    """Serve o Service Worker da PWA"""
    sw_path = os.path.join(PWA_DIR, "sw.js")
    if os.path.exists(sw_path):
        return FileResponse(sw_path, media_type="application/javascript")
    return {"error": "Service Worker not found"}

