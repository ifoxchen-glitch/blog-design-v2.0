#!/bin/bash
# Legacy deployment helper
#
# This script is kept only as a historical/local reference.
# It is NOT the official production deployment path anymore.
#
# Official production path:
# 1. Push code to GitHub
# 2. GitHub Actions publishes the blog image to GHCR
# 3. Unraid pulls the image through the Unraid template
# 4. open-webui runs as a separate container

set -euo pipefail

echo "This script is deprecated."
echo "Use the Unraid production flow instead:"
echo "  - unraid-template.xml"
echo "  - deploy-unraid.sh"
echo "  - OPEN_WEBUI_URL=http://192.168.3.100:8080"
exit 1
