from google.cloud import vision
from app.models.receipt import ReceiptItem, ReceiptData
from typing import List
import io
import re
import os

class GoogleVisionExtractor:
    """Extrai texto e estrutura usando Google Cloud Vision API."""
    
    def __init__(self):
        # Tenta carregar explicitamente do caminho definido nas configs
        creds_path = "/app/credentials.json"
        
        if os.path.exists(creds_path):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = creds_path
            
        self.client = vision.ImageAnnotatorClient()

    def extract(self, image_path: str) -> ReceiptData:
        with io.open(image_path, 'rb') as image_file:
            content = image_file.read()

        image = vision.Image(content=content)
        
        # Usar TEXT_DETECTION (mais rápido/barato) ou DOCUMENT_TEXT_DETECTION (melhor para layouts densos)
        response = self.client.text_detection(image=image)
        
        if response.error.message:
            raise Exception(f"Google Vision Error: {response.error.message}")

        texts = response.text_annotations
        if not texts:
            return ReceiptData(
                raw_text="", items=[], subtotal=0.0, total=0.0, confidence_score=0.0
            )

        # O primeiro elemento contém todo o texto
        raw_text = texts[0].description
        
        # Aqui poderíamos usar a posição das palavras (bounding boxes) para ser mais precisos,
        # mas por enquanto vamos reutilizar nossa lógica de Regex no texto bruto,
        # que o Google Vision extrai com muito mais qualidade que o Tesseract.
        
        # Parse usando a mesma lógica (ou adaptada)
        from app.core.ocr.parser import ReceiptParser
        parser = ReceiptParser()
        
        # O parser espera string, o Google já devolve string limpa
        return parser.parse(raw_text)
