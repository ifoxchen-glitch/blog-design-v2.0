#!/bin/bash
# Deploy blog to remote server via Docker

REMOTE_HOST=${1:-192.168.3.100}
IMAGE=blog
CONTAINER=blog
PORT=8787
HOST_PATH=/opt/blog
SSH_KEY="C:/Users/陈科/.ssh/blog_deploy"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -i $SSH_KEY"

echo "Deploying to $REMOTE_HOST..."

# Create remote directories
ssh $SSH_OPTS root@$REMOTE_HOST "mkdir -p $HOST_PATH/server/src $HOST_PATH/server/views $HOST_PATH/server/public/uploads $HOST_PATH/server/db $HOST_PATH/js $HOST_PATH/css"

# Upload files
scp $SSH_OPTS server/src/* root@$REMOTE_HOST:$HOST_PATH/server/src/
scp $SSH_OPTS server/views/* root@$REMOTE_HOST:$HOST_PATH/server/views/
scp $SSH_OPTS -r server/public/* root@$REMOTE_HOST:$HOST_PATH/server/public/
scp $SSH_OPTS js/* root@$REMOTE_HOST:$HOST_PATH/js/
scp $SSH_OPTS css/* root@$REMOTE_HOST:$HOST_PATH/css/
scp $SSH_OPTS *.html root@$REMOTE_HOST:$HOST_PATH/
scp $SSH_OPTS Dockerfile .dockerignore root@$REMOTE_HOST:$HOST_PATH/
scp $SSH_OPTS server/package.json server/package-lock.json root@$REMOTE_HOST:$HOST_PATH/server/

# Upload .env if exists
scp $SSH_OPTS server/.env root@$REMOTE_HOST:$HOST_PATH/server/.env 2>/dev/null

# Fix permissions (container runs as node uid=1000)
ssh $SSH_OPTS root@$REMOTE_HOST "chown -R 1000:1000 $HOST_PATH/server/db $HOST_PATH/server/public/uploads"

# Build and run
ssh $SSH_OPTS root@$REMOTE_HOST "
  cd $HOST_PATH
  docker rm -f $CONTAINER 2>/dev/null || true
  docker build -t $IMAGE .
  docker run -d --name $CONTAINER \
    -p $PORT:$PORT \
    -v $HOST_PATH/server/db:/app/server/db \
    -v $HOST_PATH/server/public/uploads:/app/server/public/uploads \
    $IMAGE
"

echo "Done! http://$REMOTE_HOST:$PORT"
