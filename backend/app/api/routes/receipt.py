from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from app.models.receipt import ProcessReceiptResponse
from app.services.receipt_service import ReceiptService
from app.core.config import settings
import os

router = APIRouter()
receipt_service = ReceiptService()

@router.post("/process", response_model=ProcessReceiptResponse)
def process_receipt(file: UploadFile = File(...), client_info: str | None = Form(None)):
    """
    Processa imagem de nota fiscal.

    Aceita: JPEG, PNG
    Max size: 10MB (validado no nginx/config ou aqui se desejar)

    Rota síncrona (def) de propósito: o FastAPI a executa num threadpool,
    então a chamada bloqueante ao Gemini não trava o event loop.
    """
    # Validar extensão
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS.split(','):
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG ou PNG.")

    try:
        content = file.file.read()
        if client_info:
            # Diagnóstico enviado pela PWA: tempo de compressão no aparelho, tamanhos, user agent
            print(f"📱 Cliente: {client_info[:400]}")

        # Processar OCR
        receipt_data, processing_time = receipt_service.process_receipt_image(content)
        
        # DEBUG: Verificar quantos itens estão sendo retornados
        print(f"\n📤 RESPOSTA HTTP: Enviando {len(receipt_data.items)} itens para o cliente")
        for idx, item in enumerate(receipt_data.items, 1):
            desc = f" (desc. R${item.discount:.2f})" if item.discount else ""
            print(f"   {idx}. {item.name[:40]} - {item.quantity}x R${item.unit_price:.2f}{desc} = R${item.total_price:.2f}")
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

@router.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}
