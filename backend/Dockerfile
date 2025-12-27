FROM python:3.11-slim-bookworm

# Instalar dependências básicas
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código do backend
COPY backend/app ./app

# Copiar PWA (frontend web para iOS)
COPY pwa ./pwa

# Expor porta
EXPOSE 8001

# Servidor (sem --reload em produção para melhor performance)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]


