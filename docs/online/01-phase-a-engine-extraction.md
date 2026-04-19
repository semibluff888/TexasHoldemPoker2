# 阶段 A：游戏引擎提取

> 创建日期: 2026-04-19
> 状态: 待执行
> 优先级: 最高（所有后续阶段依赖此阶段）

## 目标

从 `game.js`（1979 行）中提取出一个**纯逻辑游戏引擎** `GameEngine`，使其：

1. **不依赖任何 DOM / 浏览器 API** — 可在 Node.js 服务端直接运行
2. **通过命令模式接受输入** — 替代当前的直接函数调用
3. **通过事件发射输出** — 替代当前的直接 DOM 更新
4. **完全覆盖现有游戏规则** — 包括盲注、下注轮、底池分配、showdown、统计追踪
5. **引擎提取后，客户端适配为引擎的消费者** — `game.js` 改为监听引擎事件并驱动 UI

## 当前 game.js 问题诊断

### 函数职责混合分析

以下是 `game.js` 中每个主要函数的当前职责和迁移目标：

| 函数名 | 行数 | 当前职责 | 问题 | 迁移目标 |
|--------|------|----------|------|----------|
| `initPlayers()` | L77-85 | 创建 5 个玩家 | 硬编码玩家数 | → Engine: `addPlayer()` |
| `dealCard()` | L94-96 | 从牌堆弹出一张牌 | 纯逻辑 | → Engine |
| `getDealingOrder()` | L99-113 | 计算发牌顺序 | 纯逻辑 | → Engine |
| `dealHoleCards()` | L116-170 | 发牌 + 动画 + 音效 | 混合 | → Engine (逻辑) + Client (动画) |
| `showAction()` | L172-191 | 显示动作 + 日志 | DOM | → Client only |
| `playerFold()` | L194-224 | 状态变更 + 音效 + UI | 混合 | → Engine (状态) + Client (UI) |
| `playerCheck()` | L293-310 | 状态变更 + 音效 + UI | 混合 | → Engine + Client |
| `playerCall()` | L312-353 | 状态变更 + 统计 + 音效 + UI | 混合 | → Engine + Client |
| `playerRaise()` | L355-434 | 状态变更 + 统计 + 音效 + UI | 深度混合 | → Engine + Client |
| `playerAllIn()` | L436-468 | 状态变更 + 音效 + UI | 混合 | → Engine + Client |
| `executeAIAction()` | L470-491 | AI 行为路由 | 纯逻辑 | → Engine |
| `runBettingRound()` | L742-891 | 下注轮循环 + 统计 + UI | 最复杂 | → Engine (循环) + Client (UI) |
| `startNewGame()` | L1040-1192 | 初始化 + 盲注 + 发牌 + 循环 | 核心编排 | → Engine |
| `showdown()` | L1341-1544 | 胜负判定 + 动画 + 日志 | 混合 | → Engine (判定) + Client (动画) |
| `postBlind()` | L1207-1222 | 强制下注 | 纯逻辑 | → Engine |
| `getNextActivePlayer()` | L1194-1205 | 找下一个活跃玩家 | 纯逻辑 | → Engine |
| `animateFoldCards()` | L227-291 | 弃牌飞行动画 | 纯 DOM | → Client only |
| `animateBetsToPot()` | L655-712 | 筹码飞入底池动画 | 纯 DOM | → Client only |
| `animatePotToWinners()` | L1693-1754 | 底池飞向赢家动画 | 纯 DOM | → Client only |
| `resetBets()` | L714-740 | 重置下注 + 动画 | 混合 | → Engine (重置) + Client (动画) |
| `startCountdown()` / `clearCountdown()` | L990-1007 | 计时器控制 | 可分离 | → Engine (超时事件) + Client (UI) |
| `toggleAILevel()` | L493-513 | 切换 AI 难度 | 混合 | → Engine (状态) + Client (UI) |
| `removeAIPlayer()` | L515-573 | 移除 AI | 混合 | → Engine + Client |
| `addAIPlayer()` | L577-615 | 添加 AI | 混合 | → Engine + Client |

## 设计方案

### 核心类: GameEngine

```
src/engine/
├── game-engine.js         # 主引擎类
├── event-emitter.js       # 轻量事件发射器 (同构，浏览器/Node 通用)
├── action-validator.js    # 玩家行为验证
└── timer-manager.js       # 超时管理 (可选，阶段 B 使用)
```

### GameEngine 类设计

```javascript
// src/engine/game-engine.js

import { EventEmitter } from './event-emitter.js';
import { createDeck, shuffleDeck } from '../core/cards.js';
import { evaluateHand } from '../core/hand-evaluator.js';
import { calculatePots, splitPot } from '../core/pot-settlement.js';
import {
    SMALL_BLIND, BIG_BLIND, STARTING_CHIPS,
    createPlayer, createInitialGameState, resetPlayersForNewHand
} from '../state/game-state.js';
import { decideAIAction } from '../ai/game-ai.js';

export class GameEngine extends EventEmitter {

    constructor(config = {}) {
        super();
        this.config = {
            maxPlayers: 6,
            smallBlind: SMALL_BLIND,
            bigBlind: BIG_BLIND,
            startingChips: STARTING_CHIPS,
            actionTimeoutMs: 30000,     // 30 秒行动超时
            ...config,
        };
        this.state = createInitialGameState();
        this.state.players = [];
        this._waitingForAction = null;  // { playerId, validActions, timeoutId }
    }

    // ─── 玩家管理 ───

    addPlayer({ id, name, isAI = false, aiLevel = 'medium' }) { ... }
    removePlayer(playerId) { ... }

    // ─── 游戏流程 ───

    startHand() { ... }          // 初始化一手牌: 洗牌/盲注/发牌
    
    // ─── 命令入口 (唯一的外部输入点) ───

    submitAction(playerId, action) {
        // action: { type: 'fold'|'check'|'call'|'raise'|'allin', totalBet? }
        // 1. 验证是否轮到该玩家
        // 2. 验证行为是否合法
        // 3. 执行行为 (修改状态)
        // 4. 发射 'action_executed' 事件
        // 5. 推进游戏 (下一个玩家 / 下一阶段)
    }

    // ─── 内部逻辑 (不对外暴露) ───

    _postBlinds() { ... }
    _dealHoleCards() { ... }
    _dealCommunityCards(count) { ... }
    _advancePhase() { ... }      // preflop → flop → turn → river → showdown
    _advanceTurn() { ... }       // 切换到下一个玩家
    _checkBettingRoundComplete() { ... }
    _resolveShowdown() { ... }
    _applyAction(playerId, action) { ... }
    _requestAction(playerId) { ... }  // 发射 'action_required' 事件
    _handleAIAction(playerId) { ... } // 调用 decideAIAction 并 submitAction
    _trackStats(playerId, action) { ... }

    // ─── 状态查询 ───

    getPlayerView(playerId) { ... }   // 某玩家视角的状态 (隐藏他人手牌)
    getFullState() { ... }            // 完整状态 (showdown 或调试用)
    getPlayersInHand() { ... }
    getActivePlayers() { ... }
}
```

### 事件清单

引擎通过 `emit()` 向外部发射以下事件，客户端（或服务端 WebSocket 层）监听这些事件来驱动 UI 或推送消息：

| 事件名 | 数据 | 触发时机 |
|--------|------|----------|
| `player_added` | `{ player }` | 玩家加入 |
| `player_removed` | `{ playerId }` | 玩家离开 |
| `hand_start` | `{ dealerIndex, players, handNumber }` | 新一手牌开始 |
| `blinds_posted` | `{ smallBlind: { playerId, amount }, bigBlind: { playerId, amount } }` | 盲注发出 |
| `hole_cards_dealt` | `{ playerId, cards }` | 底牌发出 (每个玩家单独发射) |
| `action_required` | `{ playerId, validActions, timeLimit }` | 轮到某玩家行动 |
| `action_executed` | `{ playerId, action, playerState, pot, currentBet }` | 玩家完成行动 |
| `phase_changed` | `{ phase, communityCards }` | 阶段切换 (flop/turn/river) |
| `betting_round_end` | `{ phase }` | 一轮下注结束 |
| `showdown` | `{ results, pots, winners }` | 摊牌 |
| `hand_complete` | `{ winners, amounts, players }` | 一手牌结束 |
| `action_timeout` | `{ playerId, defaultAction }` | 玩家超时 |
| `error` | `{ playerId, message }` | 非法操作 |
| `game_over` | `{ winner }` | 只剩一人有筹码 |

### EventEmitter 实现

需要一个同构的（浏览器 + Node 通用）轻量事件发射器：

```javascript
// src/engine/event-emitter.js

export class EventEmitter {
    constructor() {
        this._listeners = new Map();
    }

    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
        return this;
    }

    off(event, callback) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            this._listeners.set(event, listeners.filter(cb => cb !== callback));
        }
        return this;
    }

    emit(event, data) {
        const listeners = this._listeners.get(event);
        if (listeners) {
            for (const cb of listeners) {
                cb(data);
            }
        }
        return this;
    }

    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }
}
```

### ActionValidator 实现

```javascript
// src/engine/action-validator.js

export function validateAction(gameState, playerId, action) {
    const player = gameState.players.find(p => p.id === playerId);
    
    if (!player) return { valid: false, reason: 'Player not found' };
    if (player.folded) return { valid: false, reason: 'Player already folded' };
    if (player.allIn) return { valid: false, reason: 'Player is all-in' };
    if (gameState.currentPlayerIndex !== playerId) {
        return { valid: false, reason: 'Not your turn' };
    }

    const callAmount = gameState.currentBet - player.bet;
    const minRaise = gameState.currentBet + gameState.minRaise;
    const maxBet = player.chips + player.bet;

    switch (action.type) {
        case 'fold':
            return { valid: true };
        
        case 'check':
            if (callAmount > 0) {
                return { valid: false, reason: 'Cannot check when facing a bet' };
            }
            return { valid: true };
        
        case 'call':
            if (callAmount <= 0) {
                return { valid: false, reason: 'Nothing to call' };
            }
            return { valid: true };
        
        case 'raise':
            if (!action.totalBet || action.totalBet < minRaise) {
                return { valid: false, reason: `Raise must be at least ${minRaise}` };
            }
            if (action.totalBet > maxBet) {
                return { valid: false, reason: 'Not enough chips' };
            }
            return { valid: true };
        
        case 'allin':
            return { valid: true };
        
        default:
            return { valid: false, reason: `Unknown action type: ${action.type}` };
    }
}

export function getValidActions(gameState, playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.folded || player.allIn) return [];

    const callAmount = gameState.currentBet - player.bet;
    const minRaise = gameState.currentBet + gameState.minRaise;
    const maxBet = player.chips + player.bet;
    const actions = ['fold'];

    if (callAmount <= 0) {
        actions.push('check');
    } else {
        actions.push('call');
    }

    if (maxBet > gameState.currentBet && maxBet >= minRaise) {
        actions.push('raise');
    }

    actions.push('allin');
    return actions;
}
```

## 客户端适配方案

提取引擎后，`game.js` 需要改造为引擎的**事件消费者**。改造后的名称建议为 `game-client.js`。

### 改造前后对比

**改造前** (`game.js` 中 `playerFold` 的写法):

```javascript
function playerFold(playerId) {
    const player = gameState.players[playerId];
    // 状态修改 (应属于引擎)
    if (gameState.cBetActive) player.stats.foldToCBetCount++;
    player.folded = true;
    // UI 更新 (属于客户端)
    animateFoldCards(playerId);
    showAction(playerId, t('actionFold'), chipsBeforeAction);
    gameAudio.playFold();
    updateUI(gameState, { ... });
}
```

**改造后** (分离为引擎 + 客户端):

```javascript
// 引擎内部 (GameEngine._applyAction)
_applyFold(playerId) {
    const player = this.state.players.find(p => p.id === playerId);
    if (this.state.cBetActive) player.stats.foldToCBetCount++;
    player.folded = true;
    this.emit('action_executed', {
        playerId,
        action: { type: 'fold' },
        playerState: { folded: true, chips: player.chips },
        pot: this.state.pot,
    });
}

// 客户端 (game-client.js)
engine.on('action_executed', ({ playerId, action, playerState, pot }) => {
    if (action.type === 'fold') {
        if (gameState.players[playerId].isAI) {
            animateFoldCards(playerId);
        }
        showAction(playerId, t('actionFold'), playerState.chips);
        gameAudio.playFold();
        updateUI(engine.getFullState(), { ... });
    }
});
```

### runBettingRound 改造

这是最复杂的改造。当前 `runBettingRound()` 是一个大的 `while (true)` 循环，使用 `await waitForPlayerAction()` 挂起等待人类玩家。

改造后，引擎不再使用 `async/await` 循环，而是采用**事件驱动状态机**：

```
Engine.startHand()
  → postBlinds  → emit('blinds_posted')
  → dealCards   → emit('hole_cards_dealt')
  → requestNextAction() → emit('action_required', { playerId, validActions })
                               ↑
Client 收到 'action_required'  |
  → 如果是 AI: 调用 decideAIAction() → engine.submitAction()
  → 如果是人类: 启用 UI 控件，等待点击 → engine.submitAction()
                               |
Engine.submitAction()          |
  → 验证 → 执行 → emit('action_executed')
  → 检查轮次是否结束
    → 未结束: requestNextAction() ──→ (回到上面)
    → 已结束: advancePhase()
      → 下一阶段: emit('phase_changed') → requestNextAction()
      → showdown: emit('showdown') → emit('hand_complete')
```

## 实施步骤

### Step 1: 创建 EventEmitter (30 min)

- 创建 `src/engine/event-emitter.js`
- 编写单元测试 `tests/engine/event-emitter.test.js`
- 方法: `on`, `off`, `emit`, `once`

### Step 2: 创建 ActionValidator (30 min)

- 创建 `src/engine/action-validator.js`
- 编写单元测试 `tests/engine/action-validator.test.js`
- 函数: `validateAction`, `getValidActions`

### Step 3: 创建 GameEngine 核心 (2-3 hours)

- 创建 `src/engine/game-engine.js`
- 实现玩家管理: `addPlayer`, `removePlayer`
- 实现手牌流程: `startHand`, `_postBlinds`, `_dealHoleCards`
- 实现行为执行: `submitAction`, `_applyAction` (fold/check/call/raise/allin)
- 实现轮次控制: `_advanceTurn`, `_checkBettingRoundComplete`
- 实现阶段推进: `_advancePhase`, `_dealCommunityCards`
- 实现摊牌: `_resolveShowdown`
- 实现统计追踪: `_trackStats` (VPIP, PFR, 3-Bet, C-Bet, Fold-to-CBet)
- 实现状态查询: `getPlayerView`, `getFullState`

### Step 4: 引擎单元测试 (1-2 hours)

- 创建 `tests/engine/game-engine.test.js`
- 测试完整手牌流程 (preflop → flop → turn → river → showdown)
- 测试各种行为验证边界情况
- 测试侧池计算
- 测试统计追踪
- 测试只剩一人时提前结束
- 测试 All-in 场景

### Step 5: 客户端适配 (2-3 hours)

- 将 `game.js` 改造为引擎的事件消费者
- 保留所有现有 UI/动画/音效逻辑
- 引擎事件 → UI 更新的映射
- AI 决策的客户端驱动 (本阶段 AI 仍在客户端执行)
- 确保所有现有功能正常工作

### Step 6: 回归测试 (1 hour)

- 运行 `node --test` 确保现有测试通过
- 手动测试完整游戏流程
- 验证所有动画、音效、语言切换正常

## 测试策略

### 引擎核心测试用例

```javascript
// tests/engine/game-engine.test.js

describe('GameEngine', () => {
    // 基础流程
    test('complete hand: preflop → fold wins');
    test('complete hand: preflop → flop → turn → river → showdown');
    test('complete hand: all-in preflop');

    // 行为验证
    test('rejects action from wrong player');
    test('rejects check when facing a bet');
    test('rejects raise below minimum');
    test('accepts fold at any time');

    // 底池
    test('calculates main pot correctly');
    test('calculates side pots with multiple all-ins');
    test('splits pot on tie');

    // 统计
    test('tracks VPIP for voluntary preflop actions');
    test('tracks PFR for preflop raises');
    test('tracks C-bet on flop');

    // 边界
    test('heads-up blind posting');
    test('all players all-in, no further actions');
    test('player removed mid-hand');
});
```

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|------|------|------|------|
| 引擎与客户端状态不同步 | 中 | 高 | 客户端始终从引擎读取状态，不维护自己的副本 |
| 动画时序问题 | 高 | 中 | 引擎发事件时不关心动画，客户端用 Promise 链串行播放 |
| AI 执行时机 | 中 | 中 | AI 行为立即同步执行，客户端添加延迟动画 |
| 现有测试兼容性 | 低 | 中 | 现有 core/state/ai 测试不受影响 |
