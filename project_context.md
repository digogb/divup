# DivUp Project Context

## 1. Visão Geral do Projeto
**DivUp** é uma aplicação para facilitar a divisão de contas (restaurantes, bares, mercados) através do escaneamento de notas fiscais.
O fluxo principal consiste em:
1. O usuário tira uma foto da nota fiscal pelo App Android.
2. A imagem é enviada para o Backend.
3. O Backend utiliza IA Generativa (Google Gemini Vision) para transcrever e estruturar os itens da nota.
4. O App recebe os itens estruturados e permite ao usuário selecionar o que consumiu para calcular sua parte.

## 2. Tech Stack

### Backend (`/backend`)
- **Linguagem**: Python 3.10+
- **Framework**: FastAPI
- **AI Engine**: Google Gemini 2.5 Flash (via `google-genai` SDK)
- **Containerização**: Docker & Docker Compose
- **Formato de Dados**: JSON
- **Principais Bibliotecas**:
    - `fastapi`, `uvicorn`: Servidor Web
    - `google-genai`: Integração com LLM
    - `pydantic`: Validação de dados

### Mobile Android (`/android`)
- **Linguagem**: Kotlin
- **UI Toolkit**: Jetpack Compose (Material 3)
- **Arquitetura**: MVVM com Clean Architecture (Data/Domain/Presentation)
- **Injeção de Dependência**: Hilt
- **Networking**: Retrofit + OkHttp
- **Imagens**: Coil
- **Câmera**: CameraX
- **Animações**: Lottie
- **Design System**: Foco em UI "Premium", Cores Vibrantes, Glassmorphism, Dark Mode nativo.

## 3. Estrutura de Pastas Fundamental

### Raiz
- `docker-compose.yml`: Orquestração dos serviços (API em 8001).
- `.env`: Variáveis de ambiente globais.

### Backend (`backend/app`)
- `main.py`: Entrypoint da API.
- `api/routes/receipt.py`: Endpoint `POST /api/v1/receipts/process` que recebe a imagem.
- `core/ocr/gemini_vision.py`: **Core Logic**. Contém o prompt enviado ao Gemini para extração JSON.
- `models/receipt.py`: Modelos Pydantic (`ReceiptData`, `ReceiptItem`).

### Android (`android/app/src/main/java/com/divup/app`)
- `di/`: Módulos Hilt.
- `data/`: Repositórios e Data Sources.
- `domain/`: UseCases e Modelos de Domínio.
- `presentation/`: ViewModels e Telas (Screens).
    - `camera/`: Tela de captura da foto.
    - `receipt/`: Tela de listagem e seleção de itens.
- `ui/theme/`: Definições de Cor (`Color.kt`), Tipografia e Formas.

## 4. Fluxo de Dados (Data Flow)
1. **Captura**: Android captura imagem via CameraX.
2. **Envio**: Retrofit envia `Multipart/Form-Data` para a API.
3. **Processamento**:
    - FastAPI recebe arquivo temporário.
    - `GeminiVisionExtractor` converte imagem em bytes.
    - Envia prompt específico para o modelo `gemini-2.5-flash` pedindo JSON estrito.
    - Resposta é parseada e convertida para objetos Python.
4. **Retorno**: JSON contendo lista de itens, preços unitários e totais retorna ao App.
5. **Exibição**: App renderiza lista interativa.

## 5. Variáveis de Ambiente Importantes
Necessárias no `.env` da raiz ou backend:
- `GOOGLE_API_KEY`: Chave da API do Google AI Studio (Gemini).
- `ENVIRONMENT`: `development` ou `production`.
- `LOG_LEVEL`: Nível de log (ex: `DEBUG`).

## 6. Diretrizes de Desenvolvimento
- **Design "UAU"**: O frontend deve priorizar estética de alta qualidade (animações suaves, feedback tátil, gradientes).
- **Resiliência de OCR**: O prompt do Gemini deve ser robusto para corrigir falhas comuns de leitura de notas (ex: juntar linhas quebradas).
- **Performance**: O processamento da imagem deve ser o mais rápido possível (uso de modelos Flash).
