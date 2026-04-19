# 阶段 C：客户端适配

> 创建日期: 2026-04-19
> 状态: 待定（依赖阶段 B 完成）

## 目标

将客户端从"直接运行引擎"改为"通过 WebSocket 接收服务端状态"，新增大厅 UI 和动态座位系统。

## 页面结构

全在线模式下，客户端有三个页面状态：

```
登录/注册页 ──→ 大厅 ──→ 牌桌 (游戏中)
                 ↑          |
                 └──────────┘ (离开房间)
```

### 登录/注册页

- 简洁的表单：用户名 + 密码
- 注册 / 登录切换
- 登录成功后获取 JWT，存入 localStorage
- 自动跳转至大厅

### 大厅页面 (新增)

| 组件 | 功能 |
|------|------|
| 房间列表 | 显示所有可加入的房间 (名称/人数/盲注/状态) |
| 快速匹配按钮 | 自动加入或创建房间 |
| 创建房间表单 | 房间名 / 最大人数 (2-6) / 盲注级别 |
| 个人信息面板 | 头像 / 昵称 / 总筹码 / 胜率 |
| 排行榜入口 | 查看全局排名 |

### 牌桌页面 (改造)

保留现有牌桌 UI 的视觉效果，但做以下改造：

| 改造项 | 当前 | 改造后 |
|--------|------|--------|
| 玩家座位 | 5 个固定 HTML 元素 | 动态生成，支持 2-6 人 |
| 玩家信息 | 固定 "AI Player N" | 显示真实用户昵称 |
| 操作控件 | 始终显示，JS 控制启用/禁用 | 只在 `YOUR_TURN` 事件时启用 |
| 游戏状态 | 客户端本地 gameState | 从服务端 WebSocket 接收 |
| AI 控制 | 客户端按钮切换难度 | 由服务端自动管理 |
| 计时器 | 客户端 setTimeout | 服务端倒计时，客户端同步显示 |

## 动态座位系统

### 椭圆布局算法

替代当前 hardcoded 的 `player-bottom-left`, `player-top-left` 等 CSS 类：

```javascript
// src/ui/seat-layout.js

/**
 * 在椭圆上均匀分布座位，当前玩家始终在底部中央 (6 点钟位置)
 */
export function calculateSeatPositions(totalSeats, myIndex) {
    const positions = [];

    for (let i = 0; i < totalSeats; i++) {
        // 计算相对于当前玩家的偏移
        const seatOffset = (i - myIndex + totalSeats) % totalSeats;

        // 角度: 从底部 (π/2) 开始，顺时针分布
        const angle = (Math.PI / 2) + (2 * Math.PI * seatOffset) / totalSeats;

        positions.push({
            seatIndex: i,
            // CSS 百分比定位 (相对于牌桌容器)
            left: `${50 + 42 * Math.cos(angle)}%`,
            top: `${50 - 38 * Math.sin(angle)}%`,
            // 当前玩家固定在底部
            isCurrentPlayer: seatOffset === 0,
        });
    }

    return positions;
}
```

### 动态渲染玩家元素

```javascript
// src/ui/game-table-renderer.js (改造)

export function renderPlayers(players, myPlayerId) {
    const table = document.querySelector('.poker-table');
    // 清除旧的动态玩家元素
    table.querySelectorAll('.player-seat').forEach(el => el.remove());

    const myIndex = players.findIndex(p => p.id === myPlayerId);
    const positions = calculateSeatPositions(players.length, myIndex);

    players.forEach((player, i) => {
        const pos = positions[i];
        const el = createPlayerElement(player, pos.isCurrentPlayer);
        el.style.left = pos.left;
        el.style.top = pos.top;
        el.classList.add('player-seat');
        table.appendChild(el);
    });
}
```

## WebSocket 客户端

```javascript
// src/net/ws-client.js

export class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.listeners = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect(token) {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.reconnectAttempts = 0;
            // 首先发送认证
            this.send({ type: 'AUTH', token });
        };

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            this._dispatch(msg.type, msg);
        };

        this.ws.onclose = () => {
            this._handleDisconnect();
        };
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    on(type, callback) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type).push(callback);
    }

    _dispatch(type, data) {
        const cbs = this.listeners.get(type) || [];
        for (const cb of cbs) cb(data);
    }

    _handleDisconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            setTimeout(() => this.connect(this.lastToken), delay);
        }
    }
}
```

## OnlineGameClient

将 WebSocket 事件映射到现有 UI 更新：

```javascript
// src/net/online-game-client.js

export class OnlineGameClient {
    constructor(wsClient, uiAdapter) {
        this.ws = wsClient;
        this.ui = uiAdapter;

        // 服务端事件 → UI 更新映射
        this.ws.on('HAND_START', (data) => {
            this.ui.onHandStart(data);
        });

        this.ws.on('YOUR_TURN', (data) => {
            this.ui.onYourTurn(data);     // 启用控件 + 开始倒计时
        });

        this.ws.on('ACTION', (data) => {
            this.ui.onAction(data);       // 播放动画 + 音效 + 更新状态
        });

        this.ws.on('COMMUNITY', (data) => {
            this.ui.onCommunityCards(data); // 翻牌动画
        });

        this.ws.on('SHOWDOWN', (data) => {
            this.ui.onShowdown(data);      // 摊牌动画
        });

        this.ws.on('PLAYER_JOINED', (data) => {
            this.ui.onPlayerJoined(data);
        });

        this.ws.on('PLAYER_LEFT', (data) => {
            this.ui.onPlayerLeft(data);
        });
    }

    // 人类玩家操作 → 发送到服务端
    fold()  { this.ws.send({ type: 'PLAYER_ACTION', action: { type: 'fold' } }); }
    check() { this.ws.send({ type: 'PLAYER_ACTION', action: { type: 'check' } }); }
    call()  { this.ws.send({ type: 'PLAYER_ACTION', action: { type: 'call' } }); }
    raise(totalBet) {
        this.ws.send({ type: 'PLAYER_ACTION', action: { type: 'raise', totalBet } });
    }
    allIn() { this.ws.send({ type: 'PLAYER_ACTION', action: { type: 'allin' } }); }
}
```

## UI 适配工作清单

- [ ] 新增 登录/注册页面 (`login.html` + `login.css`)
- [ ] 新增 大厅页面 (`lobby.html` + `lobby.css`)
- [ ] 改造 `index.html` 移除硬编码玩家元素
- [ ] 实现 `seat-layout.js` 动态座位
- [ ] 改造 `game-table-renderer.js` 支持动态玩家渲染
- [ ] 实现 `ws-client.js` WebSocket 客户端
- [ ] 实现 `online-game-client.js` 在线适配层
- [ ] 改造操作控件为事件驱动 (只在 YOUR_TURN 时启用)
- [ ] 添加 "离开房间" 按钮
- [ ] 添加房间内聊天面板 (可选, 可推迟至阶段 D)
