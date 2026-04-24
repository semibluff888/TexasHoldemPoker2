# WebSocket 协议规范

> 创建日期: 2026-04-19
> 版本: 1.0

## 通信格式

所有消息使用 JSON 格式，每条消息必须包含 `type` 字段。

## 客户端 → 服务端 (Commands)

### 认证

```json
{
  "type": "AUTH",
  "token": "eyJhbGciOiJIUzI1NiJ9...."
}
```

### 大厅

```json
{ "type": "LIST_ROOMS" }

{ "type": "CREATE_ROOM", "config": {
    "name": "My Room",
    "maxPlayers": 6,
    "smallBlind": 10,
    "bigBlind": 20
}}

{ "type": "JOIN_ROOM", "roomId": "abc123" }

{ "type": "QUICK_MATCH" }
```

### 游戏操作

```json
{ "type": "PLAYER_ACTION", "action": { "type": "fold" } }
{ "type": "PLAYER_ACTION", "action": { "type": "check" } }
{ "type": "PLAYER_ACTION", "action": { "type": "call" } }
{ "type": "PLAYER_ACTION", "action": { "type": "raise", "totalBet": 100 } }
{ "type": "PLAYER_ACTION", "action": { "type": "allin" } }
```

### 房间管理

```json
{ "type": "LEAVE_ROOM" }
{ "type": "CHAT", "message": "gg" }
```

### 重连

```json
{ "type": "RECONNECT", "token": "...", "roomId": "abc123" }
```

---

## 服务端 → 客户端 (Events)

### 认证响应

```json
{ "type": "AUTH_OK", "user": {
    "id": "user_001",
    "username": "player1",
    "totalChips": 5000
}}

{ "type": "AUTH_ERROR", "message": "Invalid token" }
```

### 大厅响应

> `ROOM_LIST` 既可以作为 `LIST_ROOMS` 的响应返回，也可以在房间状态发生变化后由服务端主动推送最新快照。

```json
{ "type": "ROOM_LIST", "rooms": [
    {
        "roomId": "abc123",
        "name": "My Room",
        "playerCount": 3,
        "maxPlayers": 6,
        "smallBlind": 10,
        "bigBlind": 20,
        "status": "waiting"
    }
]}

{ "type": "ROOM_CREATED", "roomId": "abc123" }

{ "type": "ROOM_JOINED", "roomId": "abc123", "seat": 2, "players": [
    { "id": "user_001", "username": "player1", "chips": 1000, "seat": 0 },
    { "id": "user_002", "username": "player2", "chips": 1000, "seat": 1 },
    { "id": "self",     "username": "you",     "chips": 1000, "seat": 2 }
]}

{ "type": "ROOM_ERROR", "message": "Room is full" }
```

### 游戏事件

#### 新一手牌开始

```json
{ "type": "HAND_START", "data": {
    "handNumber": 5,
    "dealerIndex": 2,
    "players": [
        { "id": "user_001", "username": "player1", "chips": 950, "seat": 0 },
        { "id": "user_002", "username": "player2", "chips": 1100, "seat": 1 },
        { "id": "self",     "username": "you",     "chips": 980, "seat": 2 }
    ],
    "yourCards": [
        { "suit": "♠", "value": "A" },
        { "suit": "♥", "value": "K" }
    ]
}}
```

#### 盲注

```json
{ "type": "BLINDS", "data": {
    "smallBlind": { "playerId": "user_001", "amount": 10 },
    "bigBlind": { "playerId": "user_002", "amount": 20 },
    "pot": 30
}}
```

#### 轮到你的回合

```json
{ "type": "YOUR_TURN", "data": {
    "validActions": ["fold", "call", "raise", "allin"],
    "callAmount": 20,
    "minRaise": 40,
    "maxBet": 980,
    "pot": 30,
    "currentBet": 20,
    "timeLimit": 30
}}
```

#### 玩家回合开始 (广播给非行动玩家)

用于让同桌其他客户端同步显示行动玩家的倒计时，不启用本地操作控件。

```json
{ "type": "TURN_STARTED", "data": {
    "playerId": "user_001",
    "timeLimit": 30
}}
```

#### 玩家行动 (广播)

```json
{ "type": "ACTION", "data": {
    "playerId": "user_001",
    "action": { "type": "raise", "totalBet": 60 },
    "chips": 890,
    "pot": 90,
    "currentBet": 60
}}
```

#### 公共牌

```json
{ "type": "COMMUNITY", "data": {
    "phase": "flop",
    "cards": [
        { "suit": "♠", "value": "10" },
        { "suit": "♥", "value": "7" },
        { "suit": "♦", "value": "3" }
    ]
}}
```

#### 摊牌

```json
{ "type": "SHOWDOWN", "data": {
    "players": [
        {
            "id": "user_001",
            "cards": [{ "suit": "♠", "value": "Q" }, { "suit": "♣", "value": "J" }],
            "handName": "Two Pair",
            "handRank": 3
        },
        {
            "id": "self",
            "cards": [{ "suit": "♠", "value": "A" }, { "suit": "♥", "value": "K" }],
            "handName": "One Pair",
            "handRank": 2
        }
    ],
    "communityCards": [...],
    "pots": [
        {
            "name": "Main Pot",
            "amount": 200,
            "winners": [{ "playerId": "user_001", "amount": 200, "handName": "Two Pair" }]
        }
    ]
}}
```

#### 手牌结束

```json
{ "type": "HAND_COMPLETE", "data": {
    "winners": [
        { "playerId": "user_001", "amount": 200, "handName": "Two Pair" }
    ],
    "players": [
        { "id": "user_001", "chips": 1090 },
        { "id": "self", "chips": 880 }
    ],
    "nextHandIn": 5000
}}
```

### 玩家进出

```json
{ "type": "PLAYER_JOINED", "data": {
    "player": { "id": "user_003", "username": "newplayer", "chips": 1000, "seat": 3 }
}}

{ "type": "PLAYER_LEFT", "data": {
    "playerId": "user_002",
    "reason": "left"
}}
```

### 聊天

```json
{ "type": "CHAT_MESSAGE", "data": {
    "playerId": "user_001",
    "username": "player1",
    "message": "gg",
    "timestamp": 1713520103000
}}
```

### 错误

```json
{ "type": "ERROR", "message": "Not your turn" }
{ "type": "ERROR", "message": "Invalid action" }
```

### 断线重连

```json
{ "type": "RECONNECTED", "data": {
    "roomId": "abc123",
    "gameState": { ... },
    "yourCards": [...]
}}
```

---

## 消息时序图

### 正常手牌流程

```
Server                      Client A             Client B
  |                            |                     |
  |── HAND_START ──────────────|── HAND_START ────────|
  |── BLINDS ──────────────────|── BLINDS ───────────|
  |                            |                     |
  |── YOUR_TURN ───────────────|                     |
  |                            |── PLAYER_ACTION ──→ |
  |── ACTION (broadcast) ──────|── ACTION ───────────|
  |                            |                     |
  |── YOUR_TURN ──────────────────────────────────── |
  |                            |                     |── PLAYER_ACTION ──→
  |── ACTION (broadcast) ──────|── ACTION ───────────|
  |                            |                     |
  |── COMMUNITY (flop) ────────|── COMMUNITY ────────|
  |  ...                       |                     |
  |── SHOWDOWN ────────────────|── SHOWDOWN ─────────|
  |── HAND_COMPLETE ───────────|── HAND_COMPLETE ────|
```
