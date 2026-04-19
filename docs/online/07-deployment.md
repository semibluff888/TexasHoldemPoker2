# VPS 部署方案

> 创建日期: 2026-04-19
> 状态: 待定（阶段 B 实施时启动）

## 概述

从当前的 nginx 静态文件部署迁移为 Node.js 应用部署。

## 当前部署方式

```yaml
# 当前 docker-compose.yml
services:
  poker:
    image: nginx:alpine
    container_name: texas-holdem-poker
    ports:
      - "1234:80"
    volumes:
      - ./:/usr/share/nginx/html:ro
```

**问题**: nginx 只能服务静态文件，无法运行 Node.js 后端和 WebSocket。

## 目标部署方式

### Docker 架构

```
                 ┌─────────────────────────────┐
                 │         VPS Server           │
                 │                               │
  Internet ─────→ Nginx (反向代理) :80/:443     │
                 │    │                          │
                 │    ├── /           → Node.js :3000 (静态文件 + API)
                 │    ├── /api/*     → Node.js :3000
                 │    └── /ws        → Node.js :3000 (WebSocket upgrade)
                 │                               │
                 │  ┌──────────────┐             │
                 │  │  SQLite DB   │             │
                 │  │ /data/poker.db│             │
                 │  └──────────────┘             │
                 └─────────────────────────────┘
```

### Dockerfile

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --production

# 复制应用代码
COPY server/ ./server/
COPY src/ ./src/
COPY public/ ./public/

# 创建数据目录
RUN mkdir -p /data

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/poker.db
ENV JWT_SECRET=change-this-in-production

EXPOSE 3000

CMD ["node", "server/index.js"]
```

### docker-compose.yml (新版)

```yaml
services:
  poker:
    build: .
    container_name: texas-holdem-poker
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - poker-data:/data
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
      - DB_PATH=/data/poker.db

volumes:
  poker-data:
    driver: local
```

### Nginx 反向代理配置 (可选)

如果 VPS 上还运行其他服务，使用 Nginx 做反向代理：

```nginx
# /etc/nginx/conf.d/poker.conf

server {
    listen 80;
    server_name poker.yourdomain.com;

    # 重定向到 HTTPS (如果有证书)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

> **关键**: `proxy_set_header Upgrade` 和 `Connection "upgrade"` 对 WebSocket 至关重要。

### 可选 HTTPS 配置

使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 获取证书
certbot --nginx -d poker.yourdomain.com

# 自动续期 (已自动配置 cron)
```

## 部署步骤

### 首次部署

```bash
# 1. SSH 到 VPS
ssh root@your-server-ip

# 2. 克隆仓库
cd /root
git clone https://github.com/semibluff888/TexasHoldemPoker2.git
cd TexasHoldemPoker2

# 3. 创建环境变量
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env

# 4. 构建并启动
docker compose up -d --build

# 5. 检查日志
docker compose logs -f
```

### 更新部署

```bash
cd /root/TexasHoldemPoker2
git pull
docker compose up -d --build
```

### 数据备份

数据库存储在 Docker volume `poker-data` 中：

```bash
# 备份
docker compose exec poker cp /data/poker.db /data/poker.db.bak
docker cp texas-holdem-poker:/data/poker.db ./backups/poker-$(date +%Y%m%d).db

# 恢复
docker cp ./backups/poker-20260419.db texas-holdem-poker:/data/poker.db
docker compose restart
```

## 监控

### 健康检查

```javascript
// server/index.js 中添加
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeRooms: roomManager.rooms.size,
        connectedPlayers: roomManager.getConnectedPlayerCount(),
        timestamp: Date.now()
    });
});
```

### Docker 健康检查

```yaml
# docker-compose.yml 中添加
services:
  poker:
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### 日志

```bash
# 实时查看日志
docker compose logs -f --tail 100

# 日志持久化 (docker-compose.yml 中配置)
services:
  poker:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

## 资源需求

| 资源 | 最低要求 | 建议配置 |
|------|----------|----------|
| CPU | 1 核 | 2 核 |
| 内存 | 512MB | 1GB |
| 磁盘 | 1GB | 5GB |
| 带宽 | 不限制 | 不限制 |

> Node.js WebSocket 单实例可以轻松支持数百个并发连接。对于一个私人/小规模应用，1 核 512MB 的 VPS 绑绰有余。

## 环境变量清单

| 变量 | 必须 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | 否 | 3000 | HTTP/WebSocket 监听端口 |
| `NODE_ENV` | 否 | development | 运行环境 |
| `JWT_SECRET` | 是 (生产) | dev-secret | JWT 签名密钥 |
| `DB_PATH` | 否 | ./data/poker.db | SQLite 数据库路径 |
| `CORS_ORIGIN` | 否 | * | 允许的跨域来源 |
