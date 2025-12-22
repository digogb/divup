import requests
import json
import os

# Caminho da imagem (ajuste conforme necessário)
image_path = "nota_teste.jpg"
api_url = "http://localhost:8001/api/v1/receipt/process"

if not os.path.exists(image_path):
    print(f"Erro: Imagem não encontrada em {image_path}")
    exit(1)

print(f"Enviando {image_path} para {api_url}...")

with open(image_path, "rb") as f:
    files = {"file": ("receipt.jpg", f, "image/jpeg")}
    try:
        response = requests.post(api_url, files=files)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                receipt = data["receipt"]
                print("\n✅ SUCESSO! Nota processada.")
                print("-" * 50)
                print(f"Estabelecimento (Raw): {receipt['raw_text'][:50]}...")
                print("-" * 50)
                print("ITENS IDENTIFICADOS:")
                print(f"{'ITEM':<30} | {'QTD':<5} | {'UNIT':<10} | {'TOTAL':<10}")
                print("-" * 65)
                for item in receipt["items"]:
                    print(f"{item['name']:<30} | {item['quantity']:<5} | {item['unit_price']:<10.2f} | {item['total_price']:<10.2f}")
                print("-" * 65)
                print(f"TOTAL DETECTADO: R$ {receipt['total']:.2f}")
                print("-" * 50)
            else:
                print("❌ Erro no processamento:", data.get("error"))
        else:
            print(f"❌ Erro na requisição: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Exceção: {e}")
