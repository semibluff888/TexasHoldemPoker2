# 账户系统设计

> 创建日期: 2026-04-19
> 状态: 待定（阶段 B 实施）

## 概述

提供用户注册、登录、个人资料管理功能。使用 JWT 进行无状态认证。

## 数据库设计

使用 SQLite 存储用户数据。

### users 表

```sql
CREATE TABLE users (
    id          TEXT PRIMARY KEY,           -- UUID
    username    TEXT NOT NULL UNIQUE,        -- 用户名 (3-20 字符)
    password    TEXT NOT NULL,               -- bcrypt 哈希
    display_name TEXT,                       -- 显示昵称 (可选)
    avatar      TEXT DEFAULT 'default',     -- 头像标识 (预设头像名)
    total_chips INTEGER DEFAULT 0,          -- 累计筹码变动
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);
```

### player_stats 表

```sql
CREATE TABLE player_stats (
    user_id         TEXT PRIMARY KEY REFERENCES users(id),
    hands_played    INTEGER DEFAULT 0,
    hands_won       INTEGER DEFAULT 0,
    biggest_pot     INTEGER DEFAULT 0,
    total_winnings  INTEGER DEFAULT 0,
    total_losses    INTEGER DEFAULT 0,
    vpip_count      INTEGER DEFAULT 0,
    pfr_count       INTEGER DEFAULT 0,
    showdown_count  INTEGER DEFAULT 0,
    updated_at      TEXT DEFAULT (datetime('now'))
);
```

### game_history 表 (可选，阶段 D)

```sql
CREATE TABLE game_history (
    id          TEXT PRIMARY KEY,
    room_id     TEXT NOT NULL,
    hand_number INTEGER NOT NULL,
    players     TEXT NOT NULL,              -- JSON: 参与玩家 ID 列表
    winner_ids  TEXT NOT NULL,              -- JSON: 赢家 ID 列表
    pot_total   INTEGER NOT NULL,
    community   TEXT NOT NULL,              -- JSON: 公共牌
    played_at   TEXT DEFAULT (datetime('now'))
);
```

## 认证流程

### 注册

```
POST /api/auth/register
Content-Type: application/json

{
    "username": "player1",
    "password": "securepass123",
    "displayName": "Player One"       // 可选
}

→ 200 OK
{
    "token": "eyJhbGci...",
    "user": {
        "id": "uuid-001",
        "username": "player1",
        "displayName": "Player One"
    }
}

→ 409 Conflict
{ "error": "Username already taken" }

→ 400 Bad Request
{ "error": "Username must be 3-20 characters" }
```

### 登录

```
POST /api/auth/login
Content-Type: application/json

{
    "username": "player1",
    "password": "securepass123"
}

→ 200 OK
{
    "token": "eyJhbGci...",
    "user": {
        "id": "uuid-001",
        "username": "player1",
        "displayName": "Player One",
        "totalChips": 5000
    }
}

→ 401 Unauthorized
{ "error": "Invalid credentials" }
```

### WebSocket 认证

WebSocket 连接建立后，客户端必须在 5 秒内发送 AUTH 消息，否则服务端主动关闭连接。

```
ws.connect()
→ Client sends: { "type": "AUTH", "token": "eyJhbGci..." }
← Server sends: { "type": "AUTH_OK", "user": { ... } }
```

## JWT 设计

### Token 结构

```javascript
{
    "sub": "uuid-001",          // 用户 ID
    "username": "player1",
    "iat": 1713520000,          // 签发时间
    "exp": 1713606400           // 过期时间 (24 小时)
}
```

### 密钥管理

- JWT 密钥从环境变量 `JWT_SECRET` 读取
- 开发环境使用默认值，生产环境必须设置
- Token 有效期: 24 小时

## 密码安全

| 措施 | 说明 |
|------|------|
| 哈希算法 | bcrypt (cost factor = 10) |
| 最小长度 | 8 字符 |
| 传输加密 | HTTPS (生产环境) |
| 速率限制 | 登录接口限制 5 次/分钟/IP |

## 实现清单

### server/auth/jwt-utils.js

```javascript
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const EXPIRES_IN = '24h';

export function signToken(user) {
    return jwt.sign(
        { sub: user.id, username: user.username },
        SECRET,
        { expiresIn: EXPIRES_IN }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET);
    } catch {
        return null;
    }
}
```

### server/auth/user-store.js

```javascript
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export class UserStore {
    constructor(db) {
        this.db = db;
    }

    async register(username, password, displayName) {
        // 验证用户名格式
        // 检查用户名唯一性
        // bcrypt 哈希密码
        // 插入数据库
        // 创建 player_stats 记录
    }

    async login(username, password) {
        // 查找用户
        // bcrypt 比对密码
        // 返回用户信息
    }

    async getProfile(userId) {
        // 查询用户 + 统计数据
    }

    async updateStats(userId, stats) {
        // 更新 player_stats
    }
}
```

### server/auth/auth-handler.js

```javascript
import { Router } from 'express';

export function createAuthRouter(userStore) {
    const router = Router();

    router.post('/register', async (req, res) => { ... });
    router.post('/login', async (req, res) => { ... });
    router.get('/profile', authMiddleware, async (req, res) => { ... });

    return router;
}
```

## 依赖

```json
{
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "better-sqlite3": "^11.0.0",
    "uuid": "^10.0.0"
}
```
