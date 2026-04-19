# Phase A Game JS Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the obsolete browser-side game-flow logic from `game.js` and move the remaining AI seat-management controls onto explicit `GameEngine` APIs.

**Architecture:** Keep `GameEngine` as the single source of truth for gameplay and mutable player seat state. `game.js` should remain a UI/event consumer that submits commands, reacts to engine events, and owns only presentation-specific behavior such as animations, sounds, history, and DOM updates.

**Tech Stack:** Vanilla JavaScript ES modules, Node.js built-in test runner, existing browser UI modules

---

### Task 1: Lock the cleanup scope with failing regression tests

**Files:**
- Modify: `j:/AntigravityProject/TexasHoldemPoker2/tests/refactor/game-engine-wiring.test.js`
- Create: `j:/AntigravityProject/TexasHoldemPoker2/tests/engine/game-engine-player-management.test.js`
- Test: `j:/AntigravityProject/TexasHoldemPoker2/tests/refactor/game-engine-wiring.test.js`
- Test: `j:/AntigravityProject/TexasHoldemPoker2/tests/engine/game-engine-player-management.test.js`

- [ ] **Step 1: Write the failing cleanup assertions for `game.js`**

```javascript
assert.doesNotMatch(source, /function playerFold\(/);
assert.doesNotMatch(source, /function runBettingRound\(/);
assert.match(source, /engine\.removePlayer\(/);
assert.match(source, /engine\.restorePlayer\(/);
assert.match(source, /engine\.cycleAILevel\(/);
```

- [ ] **Step 2: Run the cleanup wiring test to verify it fails**

Run: `node --test tests/refactor/game-engine-wiring.test.js`
Expected: FAIL because the old local rule functions still exist and the AI controls do not use engine APIs yet

- [ ] **Step 3: Write the failing engine player-management tests**

```javascript
test('removePlayer marks the seat removed and folds it during a live hand', () => {
    const engine = createEngine();
    engine.startHand();
    engine.removePlayer(1);
    const player = engine.getFullState().players[1];
    assert.equal(player.isRemoved, true);
    assert.equal(player.folded, true);
});

test('restorePlayer reopens a removed AI seat for the next hand', () => {
    const engine = createEngine();
    engine.removePlayer(1);
    engine.restorePlayer({ id: 1, name: 'AI Player 1', isAI: true });
    const player = engine.getFullState().players[1];
    assert.equal(player.isRemoved, false);
    assert.equal(player.isPendingJoin, true);
});

test('cycleAILevel rotates easy, medium, hard for active AI seats only', () => {
    const engine = createEngine();
    engine.cycleAILevel(1);
    assert.equal(engine.getFullState().players[1].aiLevel, 'hard');
});
```

- [ ] **Step 4: Run the engine player-management tests to verify they fail**

Run: `node --test tests/engine/game-engine-player-management.test.js`
Expected: FAIL because `restorePlayer()` and `cycleAILevel()` do not exist yet

### Task 2: Add explicit player-management APIs to `GameEngine`

**Files:**
- Modify: `j:/AntigravityProject/TexasHoldemPoker2/src/engine/game-engine.js`
- Test: `j:/AntigravityProject/TexasHoldemPoker2/tests/engine/game-engine-player-management.test.js`

- [ ] **Step 1: Implement minimal engine APIs for AI seat control**

```javascript
removePlayer(playerId) { /* mark removed, fold, emit player_removed */ }

restorePlayer({ id, name, isAI, aiLevel, chips }) { /* reopen seat for next hand */ }

cycleAILevel(playerId) { /* easy -> medium -> hard -> easy */ }
```

- [ ] **Step 2: Emit stable events for UI refresh after seat changes**

```javascript
this.emit('player_removed', { playerId });
this.emit('player_restored', { player: clonePlayer(player) });
this.emit('player_updated', { player: clonePlayer(player) });
```

- [ ] **Step 3: Run the engine player-management tests to verify they pass**

Run: `node --test tests/engine/game-engine-player-management.test.js`
Expected: PASS

### Task 3: Remove dead local rule flow from `game.js`

**Files:**
- Modify: `j:/AntigravityProject/TexasHoldemPoker2/game.js`
- Test: `j:/AntigravityProject/TexasHoldemPoker2/tests/refactor/game-engine-wiring.test.js`

- [ ] **Step 1: Replace AI seat controls with engine commands**

```javascript
function toggleAILevel(playerId) {
    engine.cycleAILevel(playerId);
    refreshTableUI();
}

function removeAIPlayer(playerId) {
    engine.removePlayer(playerId);
}

function addAIPlayer(playerId) {
    engine.restorePlayer({ id: playerId, name: `AI Player ${playerId}`, isAI: true });
}
```

- [ ] **Step 2: Delete obsolete gameplay functions now replaced by engine flow**

```javascript
function dealCard() {}
function getDealingOrder() {}
async function dealHoleCards() {}
function playerFold() {}
function playerCheck() {}
function playerCall() {}
function playerRaise() {}
function playerAllIn() {}
function executeAIAction() {}
function nextPlayer() {}
async function runBettingRound() {}
function waitForPlayerAction() {}
function resolvePlayerAction() {}
function getNextActivePlayer() {}
function postBlind() {}
async function dealFlop() {}
async function dealTurn() {}
async function dealRiver() {}
async function showdown() {}
```

- [ ] **Step 3: Keep only the UI helpers that still belong in the browser layer**

```javascript
function getPlayersInHand() {
    return gameState.players.filter(player => player && !player.folded && !player.isRemoved);
}
```

- [ ] **Step 4: Run the cleanup wiring test to verify it passes**

Run: `node --test tests/refactor/game-engine-wiring.test.js`
Expected: PASS

### Task 4: Verify the full Phase A cleanup regression surface

**Files:**
- Modify: `j:/AntigravityProject/TexasHoldemPoker2/game.js`
- Modify: `j:/AntigravityProject/TexasHoldemPoker2/src/engine/game-engine.js`
- Test: `j:/AntigravityProject/TexasHoldemPoker2/tests/engine/game-engine.test.js`
- Test: `j:/AntigravityProject/TexasHoldemPoker2/tests/engine/game-engine-player-management.test.js`
- Test: `j:/AntigravityProject/TexasHoldemPoker2/tests/refactor/game-engine-wiring.test.js`

- [ ] **Step 1: Run the engine-focused suite**

Run: `node --test tests/engine/game-engine.test.js tests/engine/game-engine-player-management.test.js`
Expected: PASS

- [ ] **Step 2: Run the full repo test suite**

Run: `npm test`
Expected: PASS with `0` failures

- [ ] **Step 3: Syntax-check the browser entry after cleanup**

Run: `node --check game.js`
Expected: exit code `0`
