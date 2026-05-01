# 更新远程服务器流程

## 项目源路径
本地项目路径：`C:\Users\陈科\MyProject\blog-design-v2.0`


## 目标服务器
- IP: 192.168.3.100
- 用户: root
- SSH 密钥: `C:/Users/陈科/.ssh/blog_deploy`

## 使用 SSH 密钥部署

### 连接测试
```bash
ssh -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" root@192.168.3.100 "whoami"
```

### 复制文件（从本地路径）
```bash
# 创建目录结构
ssh -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" root@192.168.3.100 "mkdir -p /opt/blog/server/src /opt/blog/server/views /opt/blog/server/public/uploads /opt/blog/js /opt/blog/css"

# 复制项目文件（使用本地路径）
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/server/package.json" root@192.168.3.100:/opt/blog/server/
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/server/package-lock.json" root@192.168.3.100:/opt/blog/server/
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/server/src/*" root@192.168.3.100:/opt/blog/server/src/
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/server/views/*" root@192.168.3.100:/opt/blog/server/views/
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/*.html" root@192.168.3.100:/opt/blog/
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/js/*" root@192.168.3.100:/opt/blog/js/
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/css/*" root@192.168.3.100:/opt/blog/css/

# 复制环境变量文件（如果存在）
scp -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" "C:/Users/陈科/MyProject/blog-design-v2.0/server/.env" root@192.168.3.100:/opt/blog/server/ 2>/dev/null || echo "警告: .env文件不存在，请在服务器上手动创建"
```


### 构建 Docker
```bash
ssh -o StrictHostKeyChecking=no -i "C:/Users/陈科/.ssh/blog_deploy" root@192.168.3.100 "cd /opt/blog && docker rm -f blog && docker build -t blog . && docker run -d --name blog -p 8787:8787 -v /opt/blog/server/db:/app/server/db -v /opt/blog/server/public/uploads:/app/server/public/uploads -v /opt/blog/server/.env:/app/server/.env blog"
```

### 测试
```bash
powershell -Command "Invoke-RestMethod http://192.168.3.100:8787/api/categories"
powershell -Command "Invoke-RestMethod http://192.168.3.100:8787/"
```

## 注意事项

- 必须重新构建 Docker 镜像，只重启容器不会加载新代码
- 挂载的目录（server/db, server/public/uploads）数据会保留