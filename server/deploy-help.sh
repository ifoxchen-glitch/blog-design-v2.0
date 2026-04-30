# 简化的部署脚本
# 在服务器上创建此文件并运行

# 1. 创建临时目录
mkdir -p /tmp/blog-deploy
cd /tmp/blog-deploy

# 2. 下载修改的文件（需要通过其他方式复制过来）
# 或者使用 git clone / rsync 等

# 3. 复制文件
echo "复制文件到正确位置..."

# 停止旧容器
docker stop blog 2>/dev/null || true
docker rm blog 2>/dev/null || true

# 复制修改的文件覆盖现有代码
# cp -r server/src/* /app/server/src/
# cp -r server/views/* /app/server/views/
# cp -r css/* /app/css/
# cp -r js/* /app/js/
# cp *.html /app/

# 或者重新构建镜像
echo "构建新镜像..."
docker build -t blog-design .

echo "启动新容器..."
docker run -d --name blog \
    -p 8787:8787 \
    -v /app/server/db:/app/server/db \
    -v /app/server/public/uploads:/app/server/public/uploads \
    -e SESSION_SECRET=test-secret-123 \
    -e ADMIN_EMAIL=admin@example.com \
    -e ADMIN_PASSWORD=admin \
    blog-design

echo "完成! 测试: http://localhost:8787"