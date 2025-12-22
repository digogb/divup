#!/bin/bash

# Script de Configuração Inicial para VM (Ubuntu/Debian/Oracle Linux 8+)
# Instala Docker, Git e Docker Compose

echo "🚀 Iniciando setup do servidor DivUp..."

# Detecção básica de OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
elif type lsb_release >/dev/null 2>&1; then
    OS=$(lsb_release -si)
else
    OS=$(uname -s)
fi

echo "🖥️  Sistema detectado: $OS"

if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    # Ubuntu/Debian
    echo "📦 Atualizando pacotes (apt)..."
    sudo apt-get update
    
    echo "🐳 Instalando Docker e Git..."
    sudo apt-get install -y docker.io docker-compose git
    
elif [[ "$OS" == *"Oracle"* ]] || [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"Fedora"* ]]; then
    # Oracle Linux / RHEL / CentOS
    echo "📦 Atualizando pacotes (yum/dnf)..."
    sudo dnf update -y
    
    echo "🐳 Instalando Docker e Git..."
    sudo dnf install -y docker-engine docker-cli git
    
    # Em algumas distros RHEL, o docker-compose deve ser baixado manualmente
    if ! command -v docker-compose &> /dev/null; then
        echo "📥 Baixando Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
    fi
    
    echo "🔧 Iniciando serviço Docker..."
    sudo systemctl enable docker
    sudo systemctl start docker
else
    echo "⚠️  Sistema operacional não suportado automaticamente por este script."
    echo "Por favor instale Docker e Git manualmente."
    exit 1
fi

# Configurar permissões do usuário atual (para não precisar de sudo no docker)
echo "👤 Adicionando usuário '$USER' ao grupo docker..."
sudo usermod -aG docker $USER

echo "✅ Instalação concluída!"
echo "⚠️  IMPORTANTE: Faça logoff e login novamente (ou reinicie a VM) para que as permissões do Docker tenham efeito."
echo "Depois disso, você poderá rodar 'scripts/deploy.sh' ou usar docker-compose normalmente."
