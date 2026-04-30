@echo off
echo === Blog Docker Deploy Script ===
echo.

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Please run as Administrator!
    pause
    exit /b 1
)

echo [1/4] Stopping old container...
docker rm -f blog 2>nul

echo [2/4] Building new image...
docker build -t blog-design .

echo [3/4] Starting new container...
docker run -d --name blog ^
    -p 8787:8787 ^
    -v "%CD%\server\db:C:\app\server\db" ^
    -v "%CD%\server\public\uploads:C:\app\server\public\uploads" ^
    -e SESSION_SECRET=change-me ^
    -e ADMIN_EMAIL=admin@example.com ^
    -e ADMIN_PASSWORD=admin ^
    blog-design

echo [4/4] Checking health...
timeout /t 3 /nobreak >nul
curl -s http://localhost:8787/health
echo.
echo.
echo === Done! ===
echo Access at: http://localhost:8787
pause