from google import genai
from google.genai import types
from PIL import Image, ImageOps
import io
import json
from app.models.receipt import ReceiptData, ReceiptItem
import os

# Lado maior máximo enviado ao Gemini. Suficiente para ler notas fiscais
# e reduz drasticamente o payload de fotos de celular (12MP+).
MAX_IMAGE_SIDE = 1600
JPEG_QUALITY = 85

PROMPT = """
Analise esta nota fiscal e extraia os itens, o nome do estabelecimento e a data.

Para cada item, retorne:
- name: Nome completo do item (junte linhas fragmentadas)
- quantity: Quantidade (número inteiro)
- unit_price: Preço unitário (número decimal)
- total_price: Preço total (número decimal)

Também extraia:
- establishment_name: Nome do restaurante/mercado (topo da nota)
- date: Data da compra (formato DD/MM/AAAA)

IMPORTANTE:
- Junte nomes fragmentados em múltiplas linhas (ex: "CLASSIC" + "BURGUER" = "CLASSIC BURGUER")
- Ignore linhas de cabeçalho, rodapé, totais gerais
- Retorne APENAS itens de consumo
- Use números decimais com ponto (ex: 31.00, não 31,00)

Retorne APENAS um JSON válido no formato:
{
  "establishment_name": "Nome do Local",
  "date": "23/12/2025",
  "items": [
    {
      "name": "NOME DO ITEM",
      "quantity": 1,
      "unit_price": 10.50,
      "total_price": 10.50
    }
  ],
  "subtotal": 100.00,
  "total": 110.00
}
"""


def prepare_image(image_bytes: bytes) -> bytes:
    """Corrige orientação EXIF, reduz resolução e recomprime como JPEG."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE), Image.LANCZOS)
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
        return out.getvalue()


class GeminiVisionExtractor:
    """Extrator de notas fiscais usando Gemini Vision API (nova SDK)."""

    def __init__(self):
        # Configurar API key do Gemini
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY ou GEMINI_API_KEY não configurado")

        self.client = genai.Client(api_key=api_key)

    def extract(self, image_bytes: bytes) -> ReceiptData:
        """
        Extrai dados estruturados de uma nota fiscal usando Gemini Vision.

        Args:
            image_bytes: Conteúdo da imagem (JPEG ou PNG)

        Returns:
            ReceiptData com itens extraídos
        """
        original_size = len(image_bytes)
        image_data = prepare_image(image_bytes)
        print(f"🖼️  Imagem: {original_size // 1024} KB -> {len(image_data) // 1024} KB")

        response = self.client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                PROMPT,
                types.Part(
                    inline_data=types.Blob(
                        mime_type="image/jpeg",
                        data=image_data
                    )
                )
            ],
            config=types.GenerateContentConfig(
                # Leitura de nota não precisa de "raciocínio"; o thinking
                # ligado por padrão no 2.5-flash adiciona vários segundos.
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                # Força saída JSON pura (sem ```json ... ```)
                response_mime_type="application/json",
                temperature=0,
            ),
        )

        response_text = (response.text or "").strip()

        # Fallback: remover markdown code blocks se ainda vierem
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        response_text = response_text.strip()

        # Parse JSON
        try:
            data = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"❌ Erro ao fazer parse do JSON retornado pelo Gemini:")
            print(response_text)
            raise ValueError(f"Gemini retornou JSON inválido: {e}")

        # Converter para ReceiptData
        items = []
        for item_data in data.get("items", []):
            item = ReceiptItem(
                name=item_data["name"],
                quantity=int(item_data["quantity"]),
                unit_price=float(item_data["unit_price"]),
                total_price=float(item_data["total_price"])
            )
            items.append(item)

        est_name = data.get("establishment_name", "Estabelecimento Desconhecido")
        date_str = data.get("date", "")

        print(f"✅ Gemini extraiu {len(items)} itens da nota de '{est_name}' ({date_str}).")

        return ReceiptData(
            raw_text=response_text,
            items=items,
            subtotal=data.get("subtotal") or sum(i.total_price for i in items),
            total=data.get("total") or sum(i.total_price for i in items),
            confidence_score=0.98,
            establishment_name=est_name,
            date=date_str
        )
