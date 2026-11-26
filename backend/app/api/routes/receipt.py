from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from app.models.receipt import ProcessReceiptResponse
from app.services.receipt_service import ReceiptService
from app.core.config import settings
from app.core import usage as usage_limits
import os
import time

router = APIRouter()
receipt_service = ReceiptService()


@router.post("/process", response_model=ProcessReceiptResponse)
def process_receipt(
    request: Request,
    file: UploadFile = File(...),
    client_info: str | None = Form(None),
    device_id: str | None = Form(None),
    casa: str | None = Form(None),
):
    """
    Processa imagem de nota fiscal.

    Aceita: JPEG, PNG. device_id identifica o aparelho (para a cota grátis);
    casa é o código do bar parceiro que veio no QR Code da mesa.

    Rota síncrona (def) de propósito: o FastAPI a executa num threadpool,
    então a chamada bloqueante ao Gemini não trava o event loop.
    """
    # Validar extensão
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in settings.ALLOWED_EXTENSIONS.split(','):
        raise HTTPException(status_code=400, detail="Formato inválido. Use JPG ou PNG.")

    device_hash, ip_hash = usage_limits.client_hashes(request, device_id)
    # Levanta 429 se passou de algum limite; antes de gastar com a IA
    casa_row = usage_limits.find_casa(casa)
    try:
        partner = usage_limits.check_allowed(casa_row, device_hash, ip_hash)
    except HTTPException as e:
        if e.status_code == 429:  # o painel conta quem esbarrou no limite, e em qual
            usage_limits.record_event("blocked", device_hash, casa_id=casa_row["id"] if casa_row else None,
                                      detail=(e.headers or {}).get("X-Limit", ""))
        raise

    start = time.time()
    usage, establishment, success = None, "", False
    try:
        content = file.file.read()
        if client_info:
            # Diagnóstico enviado pela PWA: tempo de compressão no aparelho, tamanhos, user agent
            print(f"📱 Cliente: {client_info[:400]}")

        receipt_data, processing_time, usage = receipt_service.process_receipt_image(content)
        establishment = receipt_data.establishment_name or ""
        success = bool(receipt_data.items)

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
        usage = usage or getattr(e, "usage", None)  # leitura que falhou depois de cobrada
        return ProcessReceiptResponse(
            success=False,
            error=str(e),
            processing_time_ms=0
        )
    finally:
        spent = usage_limits.record_read(
            casa=partner, device_hash=device_hash, ip_hash=ip_hash, usage=usage,
            establishment_name=establishment, success=success, ms=int((time.time() - start) * 1000),
        )
        origem = f"bar {partner['slug']}" if partner else "fora de parceiro"
        print(f"📊 Leitura ({origem}, {'ok' if success else 'falhou'}); gasto do mês: R$ {spent:.2f}")


@router.get("/health")
async def health_check():
    """Health check."""
    return {"status": "healthy"}
