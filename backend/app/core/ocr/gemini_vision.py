from google import genai
from google.genai import types
import json
from app.models.receipt import ReceiptData, ReceiptItem
import os

class GeminiVisionExtractor:
    """Extrator de notas fiscais usando Gemini Vision API (nova SDK)."""
    
    def __init__(self):
        # Configurar API key do Gemini
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY ou GEMINI_API_KEY não configurado")
        
        self.client = genai.Client(api_key=api_key)
    
    def extract(self, image_path: str) -> ReceiptData:
        """
        Extrai dados estruturados de uma nota fiscal usando Gemini Vision.
        
        Args:
            image_path: Caminho para a imagem da nota fiscal
            
        Returns:
            ReceiptData com itens extraídos
        """
        # Ler imagem
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # Criar prompt estruturado
        prompt = """
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
        
        # Fazer chamada ao Gemini com a nova API (modelo estável com quota maior)
        response = self.client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                prompt,
                types.Part(
                    inline_data=types.Blob(
                        mime_type="image/jpeg",
                        data=image_data
                    )
                )
            ]
        )
        
        # Extrair JSON da resposta
        response_text = response.text.strip()
        
        # Remover markdown code blocks se existirem
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
            subtotal=data.get("subtotal", sum(i.total_price for i in items)),
            total=data.get("total", sum(i.total_price for i in items)),
            confidence_score=0.98,
            establishment_name=est_name,
            date=date_str
        )
