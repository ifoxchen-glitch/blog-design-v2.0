#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# alert-5xx.sh — Nginx 5xx 错误率检查 & 报警
#
# 用法:
#   chmod +x scripts/alert-5xx.sh
#   ./scripts/alert-5xx.sh              # 检查最近 5 分钟
#   ./scripts/alert-5xx.sh --webhook    # 发送企业微信通知
#
# 建议: 加入 cron（每 5 分钟）
#   */5 * * * * /path/to/scripts/alert-5xx.sh --webhook
# ---------------------------------------------------------------------------
set -euo pipefail

THRESHOLD_PCT=1    # 错误率阈值 1%
WEBHOOK_URL="${WEBHOOK_URL:-}"
NGINX_LOG="${NGINX_LOG:-/var/log/nginx/access.log}"

# 取最近 5 分钟的日志
since=$(date -d '5 minutes ago' '+%d/%b/%Y:%H:%M:%S')
total=$(awk -v since="$since" '$4 ~ "^\\["substr(since,1,11) && $4 >= "["since' "$NGINX_LOG" 2>/dev/null | wc -l)
errors=$(awk -v since="$since" '$4 ~ "^\\["substr(since,1,11) && $4 >= "["since && $9 ~ /^5[0-9][0-9]$/' "$NGINX_LOG" 2>/dev/null | wc -l)

if [ "$total" -eq 0 ]; then
  echo "OK: 最近 5 分钟无请求"
  exit 0
fi

pct=$(echo "scale=2; $errors * 100 / $total" | bc)
msg="[blog] 5xx 告警: 错误率 ${pct}%（阈值 ${THRESHOLD_PCT}%），最近 5 分钟 ${total} 次请求中 ${errors} 次 5xx"

if (( $(echo "$pct >= $THRESHOLD_PCT" | bc -l) )); then
  echo "WARNING: $msg"

  if [ "${1:-}" = "--webhook" ] && [ -n "$WEBHOOK_URL" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"$msg\"}}" \
      > /dev/null
  fi
  exit 1
fi

echo "OK: 5xx 错误率 ${pct}%（阈值 ${THRESHOLD_PCT}%）"
exit 0
