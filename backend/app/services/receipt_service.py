from app.core.ocr.gemini_vision import GeminiVisionExtractor
from app.models.receipt import ReceiptData
import time
import os

class ReceiptService:
    """Serviço de processamento de notas."""
    
    def __init__(self):
        self.gemini_extractor = GeminiVisionExtractor()
    
    def process_receipt_image(self, image_path: str) -> tuple[ReceiptData, int]:
        """Pipeline completo de processamento com Gemini Vision."""
        start_time = time.time()
        
        try:
            receipt_data = self.gemini_extractor.extract(image_path)
            
            processing_time = int((time.time() - start_time) * 1000)
            
            return receipt_data, processing_time
        except Exception as e:
            print(f"❌ Erro no processamento com Gemini: {e}")
            import traceback
            traceback.print_exc()
            raise e
