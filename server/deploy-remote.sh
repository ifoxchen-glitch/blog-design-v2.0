#!/bin/bash
# Deploy Blog to Remote Docker Host (192.168.3.100)
# Run on the remote server

set -e

echo "=== Deploying Blog to 192.168.3.100 ==="

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# Install Docker if needed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker root
fi

# Create app directory
mkdir -p /app
cd /app

# Copy files (if mounted or via other means)
echo "Please copy blog-deploy.zip to /app and run:"
echo "  unzip -o blog-deploy.zip"
echo "  cd app/server && npm install"
echo "  cd .. && node server/src/index.js"