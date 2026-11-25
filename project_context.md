# DivUp Project Context

## 1. Visão Geral do Projeto
**DivUp** é uma aplicação para facilitar a divisão de contas (restaurantes, bares, mercados) através do escaneamento de notas fiscais.
O fluxo principal consiste em:
1. O usuário tira uma foto da nota fiscal pela PWA (https://divup.rglabs.tech) ou pelo App Android.
2. A imagem é enviada para o Backend.
3. O Backend utiliza IA Generativa (Google Gemini Vision) para transcrever e estruturar os itens, além de identificar o estabelecimento e a data.
4. O App exibe os itens, permite seleção individual, ajuste de quantidades, divisão de um item entre pessoas, serviço (0/10/15% ou valor personalizado) e correção/adição de itens.
5. O usuário compartilha o resumo final formatado via WhatsApp (opcionalmente com chave Pix).

## 2. Tech Stack

### Backend (`/backend`)
- **Linguagem**: Python 3.10+
- **Framework**: FastAPI
- **AI Engine**: Google Gemini, modelo em `GEMINI_MODEL` (padrão `gemini-3.5-flash-lite`; o `gemini-2.5-flash` é desligado em 2026-12-01), via `google-genai` SDK
- **Containerização**: Docker & Docker Compose
- **Formato de Dados**: JSON
- **Principais Bibliotecas**:
    - `fastapi`, `uvicorn`: Servidor Web
    - `google-genai`: Integração com LLM
    - `pydantic`: Validação de dados

### PWA (`/pwa`) — frontend principal (iOS e Android)
- HTML/CSS/JS puro, sem build. Servida pelo próprio FastAPI.
- `js/app.js`: estado e eventos. Dentro da tela de divisão, só o card tocado e os totais são atualizados (não redesenhar a tela inteira, senão a lista perde a rolagem).
- `js/components.js`: funções que geram HTML. Todo texto vindo da nota passa por `Fmt.esc()`.
- `js/api.js`: comprime a foto no navegador (1600px, JPEG 0.8) antes do upload.
- Design "Recibo": base neutra, um único acento verde (`#0A7C5A` claro / `#3DD39A` escuro), Space Grotesk + Inter, números tabulares, tema claro/escuro pelo sistema.
- Ícones em `pwa/assets/icons/` (fonte: `icon.svg`). Ao mudar arquivos da PWA, subir `CACHE_NAME` em `sw.js`.

### Mobile Android (`/android`)
- **Linguagem**: Kotlin
- **UI Toolkit**: Jetpack Compose (Material 3)
- **Arquitetura**: MVVM com Clean Architecture (Data/Domain/Presentation)
- **Injeção de Dependência**: Hilt
- **Networking**: Retrofit + OkHttp
- **Imagens**: Coil
- **Câmera**: CameraX
- **Animações**: Lottie
- **Design System**: ainda no visual antigo (roxo/glassmorphism); não recebeu o redesign da PWA.
- **API**: aponta para `http://164.152.197.117:8001/` (`build.gradle.kts`).

## 3. Estrutura de Pastas Fundamental

### Raiz
- `docker-compose.yml`: Orquestração dos serviços (`api` em 8001 e `cloudflared`, o túnel HTTPS).
- `.env`: Variáveis de ambiente globais.

### Backend (`backend/app`)
- `main.py`: Entrypoint da API.
- `api/routes/receipt.py`: Endpoint `POST /api/v1/receipt/process` que recebe a imagem (rota síncrona `def`, roda em threadpool), mais `device_id` e `casa` (bar parceiro). Verifica os limites antes da IA e registra a leitura depois.
- `core/usage.py`: limites do uso gratuito e registro de leituras (tabela `reads`). Regras: teto do mês (R$ 100) só deixa bar parceiro ler; teto rígido (R$ 150) bloqueia tudo; fora de parceiro, 3 leituras/mês por aparelho (IP com teto 10× por causa do CGNAT); 20 tentativas/hora por IP. Valores na tabela `settings`, com padrão no `.env`.
- `api/routes/casa.py`: `GET /api/v1/casa/{slug}` confirma o bar do QR Code.
- `api/routes/admin.py`: API da área de admin (`/api/v1/admin/*`: resumo, bares, QR Code em PNG, lugares para visitar, limites). Exige e-mail em `ADMIN_EMAILS`.
- `core/pricing.py`: custo estimado de cada leitura a partir dos tokens.
- `core/ocr/gemini_vision.py`: **Core Logic**. Contém o prompt enviado ao Gemini para extração JSON (Itens, Data, Local).
- `api/routes/auth.py` / `history.py`: login com Google (ID token verificado no servidor, sessão em cookie assinado) e histórico pessoal (CRUD).
- `core/db.py`: SQLite em `DATA_DIR`; `core/auth.py`: sessão HMAC.
- `models/receipt.py`: Modelos Pydantic (`ReceiptData` com novos campos `establishment_name`, `date`).

### Android (`android/app/src/main/java/com/divup/app`)
- `di/`: Módulos Hilt.
- `data/`: Repositórios e Data Sources.
- `domain/`: UseCases e Modelos de Domínio.
- `presentation/`: ViewModels e Telas (Screens).
    - `camera/`: Tela de captura da foto.
    - `receipt/`: Tela de listagem e seleção.
        - Inclui componentes: `SelectionButtons`, `QuantitySelector`, `TipSelector` (Dialog), `ReceiptHeaderCard` e lógica de `Share`.
- `ui/theme/`: Definições de Cor (`Color.kt`), Tipografia e Formas.

## 4. Fluxo de Dados (Data Flow)
1. **Captura**: Android captura imagem via CameraX.
2. **Envio**: Retrofit envia `Multipart/Form-Data` para a API.
3. **Processamento**:
    - FastAPI recebe os bytes da imagem (sem gravar em disco).
    - `GeminiVisionExtractor` corrige orientação e reduz para 1600px.
    - Envia o prompt ao `GEMINI_MODEL` com `response_mime_type=application/json`. Nos modelos 2.x manda `thinking_budget=0` (o 3.5-flash-lite recusa esse parâmetro com 400). Respostas 500/503 ganham duas novas tentativas. ~3s por nota; custo medido ≈ R$ 0,011–0,013 por nota (log `💰` e tabela `reads`).
    - Resposta é parseada e convertida para objetos Python.
4. **Retorno**: JSON contendo lista de itens, preços, subtotal, total, nome do local e data.
5. **Exibição**: App renderiza lista interativa e permite compartilhamento do resumo calculado.

## 5. Variáveis de Ambiente Importantes
Necessárias no `.env` da raiz ou backend:
- `GOOGLE_API_KEY`: Chave da API do Google AI Studio (Gemini).
- `ENVIRONMENT`: `development` ou `production`.
- `LOG_LEVEL`: Nível de log (ex: `DEBUG`).
- `CLOUDFLARE_TUNNEL_TOKEN`: token do túnel (só no `.env` do servidor).
- `GEMINI_MODEL`: modelo da leitura (padrão `gemini-3.5-flash-lite`). `scripts/compare_models.py` compara modelos nas mesmas fotos.
- `PRICE_IN_USD_PER_M`, `PRICE_OUT_USD_PER_M`, `USD_BRL`: preço do modelo e câmbio, para o custo por leitura.
- `ADMIN_EMAILS`: e-mails (separados por vírgula) com acesso a `/admin`.
- `SESSION_SECRET`: além da sessão, é o sal dos hashes de aparelho e IP. Se mudar, as cotas do mês recomeçam.
- `MONTHLY_BUDGET_BRL`, `HARD_BUDGET_BRL`, `FREE_READS_PER_MONTH`, `CASA_READS_PER_MONTH`, `IP_READS_PER_HOUR`: padrões dos limites (o admin sobrescreve).

## 6. Diretrizes de Desenvolvimento
- **Design**: seguir o sistema "Recibo" da PWA — clareza acima de efeitos; sem gradientes, glassmorphism ou emojis; alvos de toque ≥ 44px; contraste ≥ 4,5:1.
- **Resiliência de OCR**: O prompt do Gemini deve ser robusto para corrigir falhas comuns de leitura de notas (ex: juntar linhas quebradas).
- **Performance**: O processamento da imagem deve ser o mais rápido possível (uso de modelos Flash).

## 7. Bares parceiros e área de admin
- QR Code na mesa → `https://divup.rglabs.tech/?casa=<slug>`. A PWA (`captureCasa` em `js/app.js`) guarda o bar por 6 horas em `localStorage` (`divup.casa`) e limpa a URL na hora, para que um link salvo não leve o código a outro bar. Enquanto o bar está ativo, a home mostra "Cortesia de <bar>".
- `/admin` (`pwa/admin.html`, `js/admin.js`, `css/admin.css`): página para celular com Resumo, Bares (cadastro, QR Code, enviar ao dono), Visitar (lugares lidos fora dos parceiros) e Limites. Fica fora do cache do service worker. O link aparece na folha "Conta" para quem é admin.
- O cartão do QR Code é gerado no servidor com `qrcode` + Pillow, com a fonte DejaVu (`fonts-dejavu-core` no Dockerfile).
- Testes: `docker compose run --rm --no-deps -v "$PWD/backend/tests:/app/tests:ro" api sh -c "pip install -q pytest && python -m pytest -q tests"`.
