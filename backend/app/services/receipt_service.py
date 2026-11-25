from app.core.ocr.gemini_vision import GeminiVisionExtractor
from app.models.receipt import ReceiptData
import time


class ReceiptService:
    """Serviço de processamento de notas."""

    def __init__(self):
        self.gemini_extractor = GeminiVisionExtractor()

    def process_receipt_image(self, image_bytes: bytes) -> tuple[ReceiptData, int, dict]:
        """Lê a nota com o Gemini. Devolve (nota, tempo em ms, uso: modelo, tokens e custo)."""
        start_time = time.time()
        try:
            receipt_data, usage = self.gemini_extractor.extract(image_bytes)
        except Exception as e:
            print(f"❌ Erro no processamento com Gemini: {e}")
            import traceback
            traceback.print_exc()
            raise
        processing_time = int((time.time() - start_time) * 1000)
        return receipt_data, processing_time, usage
