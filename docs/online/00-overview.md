# Texas Hold'em Poker — 在线多人模式总体设计

> 创建日期: 2026-04-19
> 状态: 规划中

## 项目目标

将现有的单人浏览器德州扑克游戏，迁移为**全在线模式**的多人对局系统。

- **单人模式** = 在线房间 + AI 填充空位（不再有离线模式）
- **多人模式** = 真人玩家实时对局，空位由 AI 补齐
- **最大玩家数**: 单桌 6 人
- **部署目标**: VPS（自有服务器）
- **认证方式**: 账户系统（注册/登录）

## 核心决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 离线/在线 | 全在线 (Mode B) | 统一架构，避免维护两套逻辑 |
| 单桌人数 | 最多 6 人 | 标准短桌 (6-max)，UI 布局适中 |
| 部署 | VPS + Docker | 完全控制，可运行 Node.js + WebSocket |
| 认证 | JWT + 账户系统 | 支持持久化玩家数据、排行榜 |
| 通信 | WebSocket (ws) | 原生高性能，VPS 无限制 |

## 实施阶段

```
阶段 A ──→ 阶段 B ──→ 阶段 C ──→ 阶段 D
引擎提取    服务端构建   客户端适配   增强功能
```

| 阶段 | 核心目标 | 详细文档 |
|------|----------|----------|
| **A: 引擎提取** | 从 game.js 中分离纯游戏引擎 | [01-phase-a-engine-extraction.md](01-phase-a-engine-extraction.md) |
| **B: 服务端构建** | Node.js + WebSocket + 房间管理 | [02-phase-b-server.md](02-phase-b-server.md) |
| **C: 客户端适配** | 大厅 UI + 动态座位 + 在线通信 | [03-phase-c-client.md](03-phase-c-client.md) |
| **D: 增强功能** | 断线重连 / 观战 / 排行 / 聊天 | [04-phase-d-enhancements.md](04-phase-d-enhancements.md) |

## 辅助设计文档

| 文档 | 内容 |
|------|------|
| [05-websocket-protocol.md](05-websocket-protocol.md) | WebSocket 消息协议规范 |
| [06-account-system.md](06-account-system.md) | 账户系统设计 |
| [07-deployment.md](07-deployment.md) | VPS 部署方案 |

## 当前可复用模块

以下模块在重构中已经完全从 DOM 解耦，可以零修改用于服务端：

| 模块 | 路径 | 描述 |
|------|------|------|
| 牌组操作 | `src/core/cards.js` | 创建/洗牌/牌值 |
| 手牌评估 | `src/core/hand-evaluator.js` | 5 张最佳手牌评估 |
| 底池结算 | `src/core/pot-settlement.js` | 主池/边池计算与分配 |
| 状态工厂 | `src/state/game-state.js` | 创建玩家/初始状态/重置 |
| AI 策略 | `src/ai/game-ai.js` | 纯函数决策树 |

## 目标文件结构 (最终状态)

```
TexasHoldemPoker2/
├── server/                      # 服务端 (新增)
│   ├── index.js                 # Express + WebSocket 入口
│   ├── config.js                # 服务端配置
│   ├── auth/                    # 认证模块
│   │   ├── auth-handler.js
│   │   ├── jwt-utils.js
│   │   └── user-store.js
│   ├── rooms/                   # 房间管理
│   │   ├── room-manager.js
│   │   └── game-session.js
│   └── ws/                      # WebSocket 处理
│       └── ws-handler.js
│
├── src/
│   ├── engine/                  # 纯游戏引擎 (新增，从 game.js 提取)
│   │   ├── game-engine.js       # 核心引擎类
│   │   ├── event-emitter.js     # 轻量事件系统
│   │   ├── action-validator.js  # 行为验证
│   │   └── game-loop.js         # 游戏阶段推进
│   ├── core/                    # 已有，不变
│   ├── state/                   # 已有，不变
│   ├── ai/                      # 已有，不变
│   ├── i18n/                    # 已有，不变
│   ├── ui/                      # 已有，需适配
│   ├── net/                     # 网络客户端 (新增)
│   │   ├── ws-client.js
│   │   └── online-game-client.js
│   └── main.js                  # 入口，连接 WebSocket
│
├── public/                      # 静态资源 (从根目录整理)
│   ├── index.html
│   ├── lobby.html               # 大厅页面 (新增)
│   ├── styles.css
│   ├── pic/
│   └── sound/
│
├── game.js → 删除或仅做兼容层
├── docker-compose.yml           # 迁移为 Node.js 部署
├── Dockerfile                   # 新增
└── docs/online/                 # 本文档目录
```
