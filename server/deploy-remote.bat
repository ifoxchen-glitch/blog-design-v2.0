@echo off
echo ========================================
echo    Server Deployment Script
echo ========================================
echo.
echo This script will:
echo 1. Copy updated files to server
echo 2. Rebuild and restart Docker container
echo.
echo Starting deployment...

REM Copy updated source files
echo [1/4] Copying files to server...
scp server\src\db.js root@192.168.3.100:/opt/blog/server/src/
scp server\src\index.js root@192.168.3.100:/opt/blog/server/src/
scp server\views\edit.ejs root@192.168.3.100:/opt/blog/server/views/
scp js\blog.js root@192.168.3.100:/opt/blog/js/
scp *.html root@192.168.3.100:/opt/blog/

echo [2/4] Restarting Docker container...
ssh root@192.168.3.100 "cd /opt/blog && docker rm -f blog && docker build -t blog . && docker run -d --name blog -p 8787:8787 -v /opt/blog/server/db:/app/server/db -v /opt/blog/server/public/uploads:/app/server/public/uploads -e SESSION_SECRET=change-me -e ADMIN_EMAIL=admin -e ADMIN_PASSWORD=admin blog"

echo [3/4] Checking health...
timeout /t 5 /nobreak >nul
curl -s http://192.168.3.100:8787/health

echo [4/4] Testing categories API...
curl -s http://192.168.3.100:8787/api/categories

echo.
echo ========================================
echo    Deployment Complete!
echo ========================================
pause