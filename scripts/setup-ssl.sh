#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# setup-ssl.sh — 一键申请 & 自动续期 Let's Encrypt SSL 证书
#
# 用法:
#   chmod +x scripts/setup-ssl.sh
#   sudo ./scripts/setup-ssl.sh
#
# 前置条件:
#   1. 域名 DNS 已指向本机公网 IP
#   2. Nginx 已安装且端口 80 / 443 未被占用
#   3. Certbot 已安装: sudo apt install certbot python3-certbot-nginx
# ---------------------------------------------------------------------------
set -euo pipefail

DOMAIN="ifoxchen.com"
EMAIL="ifoxchen@gmail.com"

echo "=== 申请 SSL 证书: $DOMAIN ==="
sudo certbot --nginx \
  --domain "$DOMAIN" \
  --domain "www.$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive \
  --redirect

echo "=== 测试证书自动续期 ==="
sudo certbot renew --dry-run

echo "=== 完成 ==="
echo "证书路径: /etc/letsencrypt/live/$DOMAIN/"
echo "自动续期由 systemd timer (certbot.timer) 管理，无需额外配置。"
