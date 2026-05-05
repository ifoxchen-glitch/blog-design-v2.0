#!/bin/bash
# Unraid 部署脚本 - 绕过 UI 环境变量丢失问题
# 用法：在 Unraid 终端执行 bash /mnt/user/appdata/blog/deploy-unraid.sh

set -e

CONTAINER_NAME="blog-design-v2"
IMAGE="ghcr.io/ifoxchen-glitch/blog-design-v2.0:latest"

# 配置区（按需修改）
IP="192.168.3.160"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

DATA_DIR="/mnt/user/appdata/blog"
mkdir -p "$DATA_DIR/db" "$DATA_DIR/uploads"

echo "Pulling latest image..."
docker pull "$IMAGE"

echo "Stopping existing container..."
docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "Starting container..."
docker run -d \
  --name="$CONTAINER_NAME" \
  --net='br0' \
  --ip="$IP" \
  --pids-limit 2048 \
  -e TZ="Asia/Shanghai" \
  -e NODE_ENV="production" \
  -e PORT="8787" \
  -e ADMIN_PORT="3000" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e SESSION_SECRET="$SESSION_SECRET" \
  -e ADMIN_EMAIL="$ADMIN_EMAIL" \
  -e ADMIN_PASSWORD="$ADMIN_PASSWORD" \
  -v "$DATA_DIR/db:/app/server/db:rw" \
  -v "$DATA_DIR/uploads:/app/server/public/uploads:rw" \
  "$IMAGE"

echo ""
echo "========================================"
echo "Deployed successfully!"
echo "Front blog : http://$IP:8787"
echo "Admin SPA  : http://$IP:3000"
echo "Email      : $ADMIN_EMAIL"
echo "Password   : $ADMIN_PASSWORD"
echo "JWT_SECRET : $JWT_SECRET"
echo "========================================"
echo ""
echo "View logs: docker logs -f $CONTAINER_NAME"
