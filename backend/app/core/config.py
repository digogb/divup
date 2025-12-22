from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "DivUp API"
    API_V1_PREFIX: str = "/api/v1"
    UPLOAD_DIR: str = "/app/uploads"
    ALLOWED_EXTENSIONS: str = ".jpg,.jpeg,.png"
    
    # Google Cloud Vision
    # Caminho para o arquivo JSON de credenciais (dentro do container ou local)
    GOOGLE_APPLICATION_CREDENTIALS: str = "/app/credentials.json"
    
    class Config:
        env_file = ".env"

settings = Settings()
