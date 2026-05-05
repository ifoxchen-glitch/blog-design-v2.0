#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# alert-disk.sh — 磁盘使用率检查 & 报警
#
# 用法:
#   chmod +x scripts/alert-disk.sh
#   ./scripts/alert-disk.sh              # 检查并输出
#   ./scripts/alert-disk.sh --webhook    # 发送企业微信通知
#
# 建议: 加入 cron（每 6 小时）
#   0 */6 * * * /path/to/scripts/alert-disk.sh --webhook
# ---------------------------------------------------------------------------
set -euo pipefail

THRESHOLD=85
WEBHOOK_URL="${WEBHOOK_URL:-}"

# 获取根分区使用率（取整数）
usage=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')

if [ "$usage" -ge "$THRESHOLD" ]; then
  msg="[blog] 磁盘告警: 使用率 ${usage}%（阈值 ${THRESHOLD}%）"
  echo "WARNING: $msg"
  df -h / | head -2

  # 企业微信通知
  if [ "${1:-}" = "--webhook" ] && [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$msg\"}}" \
      > /dev/null
  fi
  exit 1
fi

echo "OK: 磁盘使用率 ${usage}%（阈值 ${THRESHOLD}%）"
exit 0
