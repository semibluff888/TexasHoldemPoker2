# 阶段 B：服务端构建

> 创建日期: 2026-04-19
> 状态: 待定（依赖阶段 A 完成）

## 目标

构建 Node.js 服务端，运行 GameEngine，管理多个房间，通过 WebSocket 与客户端实时通信。

## 技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 运行时 | Node.js 20+ | LTS，原生 ES modules |
| HTTP 框架 | Express 5 | 轻量，成熟 |
| WebSocket | ws (v8+) | 原生协议，无额外封装开销 |
| 数据库 | SQLite (better-sqlite3) | 单机部署，零运维，适合初期 |
| 缓存 | 内存 Map | 房间/会话状态，重启后重建 |
| 认证 | JWT | 无状态令牌 |

> 如果后续用户量增长，可将 SQLite 迁移到 PostgreSQL，内存 Map 迁移到 Redis。

## 服务端目录结构

```
server/
├── index.js                # 入口：创建 HTTP + WebSocket 服务
├── config.js               # 服务器配置 (端口, JWT 密钥等)
├── auth/
│   ├── auth-handler.js     # 注册/登录 REST 路由
│   ├── jwt-utils.js        # JWT 签发/验证
│   └── user-store.js       # 用户 CRUD (SQLite)
├── rooms/
│   ├── room-manager.js     # 房间生命周期管理
│   └── game-session.js     # 单个房间的 GameEngine 封装
├── ws/
│   └── ws-handler.js       # WebSocket 消息路由
└── db/
    ├── schema.sql           # 数据库建表
    └── database.js          # SQLite 连接
```

## 核心模块设计

### RoomManager

```javascript
class RoomManager {
    constructor() {
        this.rooms = new Map();  // roomId → GameSession
    }

    createRoom(hostPlayerId, config) {
        // 创建房间，返回 roomId
        // config: { maxPlayers, blinds, name }
    }

    joinRoom(roomId, player) {
        // 加入房间，返回座位信息
        // 如果房间已满，返回错误
    }

    leaveRoom(roomId, playerId) {
        // 离开房间
        // 如果房间空了，销毁房间
    }

    listRooms() {
        // 返回可加入的房间列表
        // { roomId, name, playerCount, maxPlayers, blinds, status }
    }

    quickMatch(playerId) {
        // 快速匹配：找一个有空位的房间
        // 如果没有，自动创建一个
    }
}
```

### GameSession

```javascript
class GameSession {
    constructor(roomId, config) {
        this.roomId = roomId;
        this.engine = new GameEngine(config);
        this.connections = new Map();  // playerId → ws
        this.aiPlayers = [];           // AI 填充的玩家 ID 列表

        // 监听引擎事件，转发给相应客户端
        this.engine.on('action_required', (data) => {
            if (data.playerId 是 AI) {
                this._handleAITurn(data);
            } else {
                this._sendToPlayer(data.playerId, {
                    type: 'YOUR_TURN',
                    validActions: data.validActions,
                    timeLimit: data.timeLimit
                });
            }
        });

        this.engine.on('action_executed', (data) => {
            this._broadcast({
                type: 'ACTION',
                ...data
            });
        });

        // ... 其他事件转发
    }

    addHumanPlayer(playerId, ws) { ... }
    addAIPlayer() { ... }
    removePlayer(playerId) { ... }
    startGame() { ... }

    _handleAITurn(data) {
        // 服务端执行 AI 决策
        const action = decideAIAction({ gameState: this.engine.state, playerId: data.playerId });
        // 添加随机延迟模拟思考
        setTimeout(() => {
            this.engine.submitAction(data.playerId, action);
        }, 500 + Math.random() * 1500);
    }

    _sendToPlayer(playerId, message) {
        const ws = this.connections.get(playerId);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }

    _broadcast(message) {
        for (const [playerId, ws] of this.connections) {
            // 为每个玩家定制消息 (隐藏他人手牌)
            const playerMessage = this._personalizeMessage(playerId, message);
            this._sendToPlayer(playerId, playerMessage);
        }
    }
}
```

### WebSocket 消息路由

```javascript
// server/ws/ws-handler.js

export function handleWebSocket(ws, req, roomManager) {
    let authenticatedUser = null;
    let currentRoomId = null;

    ws.on('message', (raw) => {
        const msg = JSON.parse(raw);

        switch (msg.type) {
            case 'AUTH':
                authenticatedUser = verifyToken(msg.token);
                ws.send(JSON.stringify({ type: 'AUTH_OK', user: authenticatedUser }));
                break;

            case 'CREATE_ROOM':
                const room = roomManager.createRoom(authenticatedUser.id, msg.config);
                currentRoomId = room.id;
                room.addHumanPlayer(authenticatedUser.id, ws);
                ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomId: room.id }));
                break;

            case 'JOIN_ROOM':
                currentRoomId = msg.roomId;
                roomManager.joinRoom(msg.roomId, authenticatedUser.id, ws);
                break;

            case 'QUICK_MATCH':
                const matched = roomManager.quickMatch(authenticatedUser.id, ws);
                currentRoomId = matched.roomId;
                break;

            case 'PLAYER_ACTION':
                if (currentRoomId) {
                    const session = roomManager.getRoom(currentRoomId);
                    session.engine.submitAction(authenticatedUser.id, msg.action);
                }
                break;

            case 'LEAVE_ROOM':
                if (currentRoomId) {
                    roomManager.leaveRoom(currentRoomId, authenticatedUser.id);
                    currentRoomId = null;
                }
                break;

            case 'LIST_ROOMS':
                ws.send(JSON.stringify({
                    type: 'ROOM_LIST',
                    rooms: roomManager.listRooms()
                }));
                break;
        }
    });

    ws.on('close', () => {
        if (currentRoomId) {
            roomManager.handleDisconnect(currentRoomId, authenticatedUser?.id);
        }
    });
}
```

## REST API

除 WebSocket 外，以下功能通过 HTTP REST API 提供：

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/auth/register` | POST | 注册 |
| `/api/auth/login` | POST | 登录，返回 JWT |
| `/api/auth/profile` | GET | 获取用户信息 |
| `/api/rooms` | GET | 房间列表 |
| `/api/leaderboard` | GET | 排行榜 |

## 安全考虑

| 措施 | 说明 |
|------|------|
| 服务端权威 | 所有游戏逻辑在服务端执行，客户端只发送命令 |
| 行为验证 | `ActionValidator` 拒绝非法操作 |
| 手牌隐藏 | `getPlayerView()` 只返回该玩家可见的信息 |
| 限速 | WebSocket 消息频率限制防止滥用 |
| JWT 验证 | 每个 WebSocket 连接必须先通过认证 |
