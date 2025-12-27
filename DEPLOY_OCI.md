# Guia de Deploy na Oracle Cloud (OCI) ☁️

Este guia descreve como colocar o Backend do DivUp em produção numa VM da Oracle Cloud.

## 1. Acesso à VM

Acesse sua instância via SSH (usando PuTTY ou Terminal):
```bash
ssh -i sua_chave_privada.key ubuntu@ip-da-vm
# ou opc@ip-da-vm se for Oracle Linux
```

## 2. Instalação (Primeira vez)

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/digogb/divup.git
   cd divup
   ```

2. **Execute o script de configuração:**
   Dê permissão de execução e rode o script que instala Docker e Git.
   ```bash
   chmod +x scripts/setup_server.sh
   ./scripts/setup_server.sh
   ```
   > ⚠️ **Atenção**: Após rodar esse script, você precisará sair (`exit`) e entrar novamente no SSH para que as permissões do Docker funcionem.

## 3. Configuração de Variáveis

Crie o arquivo `.env` na raiz do projeto (`~/divup/.env`) com suas credenciais de produção. Use o nano ou vim:

```bash
cd ~/divup
nano .env
```

**Conteúdo do .env:**
```ini
ENVIRONMENT=production
# Chave da API do Google (Gemini)
GOOGLE_API_KEY=AIzaSy...SUA_CHAVE_AQUI...
# Diretório de uploads (deve bater com o docker-compose)
UPLOAD_DIR=/app/uploads
LOG_LEVEL=INFO
```
Salve com `Ctrl+O`, `Enter`, e saia com `Ctrl+X`.

## 4. Subindo o Container 🚀

Ainda na pasta `divup`:

```bash
docker-compose up -d --build
```
Isso vai construir a imagem e iniciar o serviço na porta `8001`.

> **📱 Android + 🍎 iOS**: O servidor agora serve tanto a API (para o app Android em `/api/v1/...`) quanto a PWA (para iOS em `/`). Acesse `http://IP:8001` no Safari do iPhone para usar o DivUp!

## 5. Liberar Porta no Firewall (Importante!) 🔥

Na Oracle Cloud, você precisa liberar o tráfego em dois lugares:

### A. Na Lista de Segurança da VCN (Painel da Oracle)
1. Vá em **Networking** > **Virtual Cloud Networks**.
2. Clique na sua VCN e depois em **Security Lists** (geralmente `Default Security List`).
3. Adicione uma **Ingress Rule**:
   - **Source CIDR**: `0.0.0.0/0` (ou restrinja ao seu IP se preferir)
   - **Protocol**: TCP
   - **Destination Port Range**: `8001`

### B. No Firewall interno da VM (iptables/firewalld)
Muitas imagens da Oracle vêm com firewall ativado bloqueando tudo.

**Para Ubuntu:**
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 8001 -j ACCEPT
sudo netfilter-persistent save
```

**Para Oracle Linux:**
```bash
sudo firewall-cmd --permanent --add-port=8001/tcp
sudo firewall-cmd --reload
```

## 6. Testando

No seu navegador ou Postman, acesse:
`http://IP_DA_SUA_VM:8001/docs`

Se ver a documentação do Swagger, parabéns! O DivUp está online. 🎉

---

## 🔄 Atualizando o Código

Para atualizar a versão em produção no futuro:

```bash
cd ~/divup
git pull
docker-compose up -d --build
```
