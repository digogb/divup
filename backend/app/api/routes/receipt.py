from fastapi import APIRouter, File, UploadFile, HTTPException
from app.models.receipt import ProcessReceiptResponse
from app.services.receipt_service import ReceiptService
from app.core.config import settings
import os
import uuid
import shutil

router = APIRouter()
receipt_service = ReceiptService()

@router.post("/process", response_model=ProcessReceiptResponse)
async def process_receipt(file: UploadFile = File(...)):
    """
    Processa imagem de nota fiscal.
    
    Aceita: JPEG, PNG
    Max size: 10MB (validado no nginx/config ou aqui se desejar)
    """
    # Validar extensão
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS.split(','):
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG ou PNG.")
    
    # Garantir diretório de upload
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Salvar temporariamente
    temp_filename = f"{uuid.uuid4()}{ext}"
    temp_path = os.path.join(settings.UPLOAD_DIR, temp_filename)
    
    try:
        with open(temp_path, "wb") as f:
            # Ler em chunks para não estourar memória se for grande, 
            # mas aqui assumimos < 10MB
            content = await file.read()
            f.write(content)
        
        # Processar OCR
        receipt_data, processing_time = receipt_service.process_receipt_image(temp_path)
        
        # DEBUG: Verificar quantos itens estão sendo retornados
        print(f"\n📤 RESPOSTA HTTP: Enviando {len(receipt_data.items)} itens para o cliente")
        for idx, item in enumerate(receipt_data.items, 1):
            print(f"   {idx}. {item.name[:40]} - {item.quantity}x R${item.unit_price:.2f}")
        print()
        
        return ProcessReceiptResponse(
            success=True,
            receipt=receipt_data,
            processing_time_ms=processing_time
        )
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ProcessReceiptResponse(
            success=False,
            error=str(e),
            processing_time_ms=0
        )
    
    finally:
        # Limpar arquivo temporário
        # Em produção, poderíamos mover para S3 ou manter por um tempo para debug
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}
