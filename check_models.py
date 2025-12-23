import os
from google import genai

# Defina sua chave aqui ou garanta que a variável de ambiente esteja setada
api_key = os.environ.get("GOOGLE_API_KEY")

client = genai.Client(api_key=api_key)

print(f"Verificando modelos disponíveis para a chave...")

try:
    # Pega a lista de modelos
    pager = client.models.list(config={"page_size": 100})
    
    found_any = False
    for model in pager:
        # Filtra apenas modelos que geram conteúdo (ignora embeddings por enquanto)
        if "generateContent" in model.supported_generation_methods:
            print(f"✅ Disponível: {model.name}")
            found_any = True
            
    if not found_any:
        print("❌ Nenhum modelo de geração de conteúdo encontrado. Verifique as permissões da API Key.")

except Exception as e:
    print(f"❌ Erro ao listar modelos: {e}")