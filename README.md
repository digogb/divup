# DivUp 🧾✨

**DivUp** é a maneira mais inteligente e elegante de dividir contas em restaurantes, bares e encontros com amigos. Esqueça a calculadora: basta apontar a câmera, e nossa IA cuida do resto.

> **Status**: Em desenvolvimento ativo 🚧

## 🚀 Funcionalidades

- **📸 Scan Inteligente**: Aponte a câmera para a nota fiscal e deixe a mágica acontecer.
- **🤖 I.A. de Ponta**: Utilizamos o Google Gemini Vision (Flash 2.5) para ler e entender até as notas mais amassadas.
- **👆 Seleção Intuitiva**: Toque nos itens que você consumiu. O app calcula sua parte automaticamente.
- **🎨 Design Premium**: Interface moderna, fluida e com animações que encantam (Glassmorphism + Material 3).
- **🌗 Dark Mode**: Totalmente otimizado para ambientes com pouca luz (como aquele barzinho sábado à noite).

## 🛠️ Tecnologias

### Backend 🐍
- **FastAPI**: Performance extrema para nossa API.
- **Google Gemini Vision**: O cérebro por trás da leitura das notas.
- **Docker**: Containerização para rodar em qualquer lugar.

### Mobile (Android) 📱
- **Kotlin & Jetpack Compose**: O que há de mais moderno em desenvolvimento Android nativo.
- **CameraX**: Captura de imagem rápida e estável.
- **Retrofit & Coil**: Comunicação eficiente e carregamento de imagens.

## 🏁 Como Rodar

### Pré-requisitos
- Docker & Docker Compose
- Android Studio (para o App)
- API Key do Google Gemini

### 1. Configurando o Backend

1. Clone o repositório:
   ```bash
   git clone https://github.com/digogb/divup.git
   cd divup
   ```

2. Crie seu arquivo `.env` na raiz (ou edite o `docker-compose.yml`):
   ```properties
   GOOGLE_API_KEY=sua_chave_aqui
   ENVIRONMENT=development
   ```

3. Suba o servidor:
   ```bash
   docker-compose up --build
   ```
   O backend estará rodando em `http://localhost:8001`.

### 2. Rodando o App Android

1. Abra a pasta `android` no **Android Studio**.
2. Aguarde a sincronização do Gradle.
3. Conecte seu dispositivo ou inicie um emulador.
4. Execute o app (Run 'app').
   > **Nota**: Se estiver usando emulador, o backend deve estar acessível via `10.0.2.2`. Se estiver usando dispositivo físico, certifique-se de que ambos estão na mesma Wi-Fi e atualize o IP no `build.gradle.kts`.

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir Issues ou Pull Requests.

## 📄 Licença

Este projeto está sob a licença MIT.
