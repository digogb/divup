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
- unit_price: Preço unitário de tabela, ANTES de descontos (número decimal)
- discount: Valor total do desconto aplicado a ESTE item, como número positivo (0 se não houver)
- total_price: Valor final pago por este item = quantity × unit_price − discount

Também extraia:
- establishment_name: Nome do restaurante/mercado (topo da nota)
- date: Data da compra (formato DD/MM/AAAA)
- discount: Desconto aplicado à conta inteira que NÃO pertence a nenhum item
  (ex.: cupom ou desconto no total), como número positivo. Não repita aqui
  descontos que já foram atribuídos aos itens. 0 se não houver.
- subtotal: Soma dos itens já com descontos, antes de taxa de serviço/gorjeta
- total: Valor final a pagar impresso na nota (ex.: "VALOR A PAGAR", "TOTAL A PAGAR")

DESCONTOS (MUITO IMPORTANTE — nunca ignore):
- Linhas como "desconto sobre item", "desconto", "desc", "promoção" ou valores
  negativos logo abaixo ou ao lado de um item pertencem a esse item: some-as
  em "discount" do item.
- Linhas de desconto NÃO são itens: não as liste em "items".
- Valores entre parênteses que representam tributos aproximados
  (ex.: colunas "(VLTR R$)", "Lei 12.741", "trib. aprox.") NÃO são preços nem descontos: ignore-os.

IMPORTANTE:
- Junte nomes fragmentados em múltiplas linhas (ex: "CLASSIC" + "BURGUER" = "CLASSIC BURGUER")
- Ignore cabeçalho, rodapé, formas de pagamento e troco
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
      "discount": 0.00,
      "total_price": 10.50
    }
  ],
  "discount": 0.00,
  "subtotal": 100.00,
  "total": 110.00
}
"""


def prepare_image(image_bytes: bytes) -> bytes:
    """Corrige orientação EXIF, reduz resolução e recomprime como JPEG."""
    with Image.open(io.BytesIO(image_bytes)) as img:
        # Já é um JPEG pequeno e sem rotação (ex.: comprimido pela PWA): envia como está
        if (img.format == "JPEG" and max(img.size) <= MAX_IMAGE_SIDE
                and img.getexif().get(0x0112, 1) == 1):
            return image_bytes
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

        items = [parse_item(item_data) for item_data in data.get("items", [])]
        items = [i for i in items if i is not None]

        est_name = data.get("establishment_name") or "Estabelecimento Desconhecido"
        date_str = data.get("date") or ""
        net_sum = round(sum(i.total_price for i in items), 2)
        bill_discount = min(abs(to_float(data.get("discount"))), net_sum)

        print(f"✅ Gemini extraiu {len(items)} itens da nota de '{est_name}' ({date_str}). "
              f"Descontos: itens R${sum(i.discount for i in items):.2f}, conta R${bill_discount:.2f}")

        return ReceiptData(
            raw_text=response_text,
            items=items,
            subtotal=to_float(data.get("subtotal")) or round(net_sum - bill_discount, 2),
            total=to_float(data.get("total")) or round(net_sum - bill_discount, 2),
            discount=round(bill_discount, 2),
            confidence_score=0.98,
            establishment_name=est_name,
            date=date_str
        )


def to_float(value) -> float:
    """Converte números do Gemini (ou strings "1.234,56") para float; 0 se inválido."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace("R$", "").replace(" ", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_item(item_data: dict):
    """Normaliza um item, garantindo que total_price = qtd × unitário − desconto."""
    name = str(item_data.get("name") or "").strip()
    if not name:
        return None
    quantity = max(1, int(round(to_float(item_data.get("quantity")) or 1)))
    unit_price = abs(to_float(item_data.get("unit_price")))
    discount = abs(to_float(item_data.get("discount")))
    total_raw = item_data.get("total_price")
    total = abs(to_float(total_raw)) if total_raw is not None else None

    if not unit_price and total:
        unit_price = round((total + discount) / quantity, 2)
    gross = round(quantity * unit_price, 2)

    if discount:
        # Confia nas partes (unitário e desconto); o Gemini às vezes repete o bruto em total_price
        total = gross - discount
    elif total is not None and total < gross - 0.01:
        # Total menor que o bruto sem desconto declarado: a diferença é desconto
        discount = gross - total
    else:
        total = gross

    discount = round(min(discount, gross), 2)
    return ReceiptItem(
        name=name,
        quantity=quantity,
        unit_price=unit_price,
        discount=discount,
        total_price=round(max(0.0, gross - discount), 2),
    )
