# Phase 2 Game Table UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the main game-table renderer and main game-table event binding from `game.js` into focused UI modules while preserving current gameplay behavior and DOM structure.

**Architecture:** Keep `game.js` as the orchestration layer for gameplay state, round progression, AI, and non-table UI. Introduce `src/ui/game-table-renderer.js` for player/community/pot/control rendering and `src/ui/game-table-events.js` for the main control-area listeners, with `game.js` composing both modules.

**Tech Stack:** Vanilla JavaScript ES modules, browser DOM APIs, Node built-in test runner, `node --check`, manual browser verification over static HTTP

---

Implementation should run in a fresh project-local worktree branched from the
current `main`.

### Task 1: Create the Game Table Renderer Module

**Files:**
- Create: `src/ui/game-table-renderer.js`
- Test: `src/ui/game-table-renderer.js`

- [ ] **Step 1: Run a module syntax check before the file exists**

Run: `node --check src/ui/game-table-renderer.js`
Expected: FAIL with a missing-file error because the renderer module does not exist yet

- [ ] **Step 2: Create `src/ui/game-table-renderer.js` and move the card/highlight helpers into it**

Create `src/ui/game-table-renderer.js` with this import block and public
surface:

```js
import { evaluateHand } from '../core/hand-evaluator.js';

function getCardHTML(card, isHidden = false, animate = true) {
    const animClass = animate ? ' dealing' : '';
    if (isHidden) {
        return `<div class="card card-back${animClass}"></div>`;
    }

    const isRed = card.suit === '♥' || card.suit === '♦';
    return `
        <div class="card card-face ${isRed ? 'red' : 'black'}${animClass}">
            <span class="card-value">${card.value}</span>
            <span class="card-suit">${card.suit}</span>
        </div>
    `;
}

function animateCardFromDealer(cardElement) {
    const dealerGif = document.getElementById('dealer-gif');
    if (!dealerGif || !cardElement) return;

    cardElement.classList.remove('dealing');

    const dealerRect = dealerGif.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    const offsetX = dealerRect.left + dealerRect.width / 2 - cardRect.left - cardRect.width / 2;
    const offsetY = dealerRect.top + dealerRect.height / 2 - cardRect.top - cardRect.height / 2;

    cardElement.style.setProperty('--deal-start-x', `${offsetX}px`);
    cardElement.style.setProperty('--deal-start-y', `${offsetY}px`);

    cardElement.offsetHeight;
    cardElement.classList.add('dealing');

    cardElement.addEventListener('animationend', function handleAnimationEnd() {
        cardElement.classList.remove('dealing');
        cardElement.removeEventListener('animationend', handleAnimationEnd);
    });
}

export function updatePlayerCards(gameState, playerId, { isHidden = false } = {}) {
    const player = gameState.players[playerId];
    const cardsContainer = document.getElementById(`cards-${playerId}`);

    if (player.cards.length === 0 || (player.folded && player.isAI)) {
        cardsContainer.innerHTML = `
            <div class="card card-placeholder"></div>
            <div class="card card-placeholder"></div>
        `;
        return;
    }

    const hidden = isHidden && player.isAI && gameState.phase !== 'showdown';
    const existingCards = cardsContainer.querySelectorAll('.card-face');

    if (existingCards.length === player.cards.length && !hidden && !player.folded) {
        let allMatch = true;
        existingCards.forEach((el, index) => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (!valueEl || !suitEl ||
                valueEl.textContent !== player.cards[index].value ||
                suitEl.textContent !== player.cards[index].suit) {
                allMatch = false;
            }
        });
        if (allMatch) return;
    }

    cardsContainer.innerHTML = player.cards
        .map(card => getCardHTML(card, hidden, false))
        .join('');
}

export function updatePlayerCardsAnimated(gameState, playerId) {
    const player = gameState.players[playerId];
    const cardsContainer = document.getElementById(`cards-${playerId}`);
    const hidden = player.isAI;

    let html = '';
    for (let index = 0; index < 2; index++) {
        if (index < player.cards.length) {
            const shouldAnimate = index === player.cards.length - 1;
            html += `<div class="card-slot">
                <div class="card card-placeholder"></div>
                ${getCardHTML(player.cards[index], hidden, shouldAnimate)}
            </div>`;
        } else {
            html += '<div class="card-slot"><div class="card card-placeholder"></div></div>';
        }
    }

    cardsContainer.innerHTML = html;

    const dealingCard = cardsContainer.querySelector('.card.dealing');
    if (dealingCard) {
        animateCardFromDealer(dealingCard);
    }
}

export function clearHighlightHumanBestHand() {
    document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));
    const existingName = document.querySelector('.hand-rank-name');
    if (existingName) existingName.remove();
}
```

- [ ] **Step 3: Add the community-card and best-hand helpers to the renderer**

Append these exports to `src/ui/game-table-renderer.js` and adapt the moved
logic so it reads from the `gameState` argument instead of the global:

```js
export function updateCommunityCards(gameState) {
    const container = document.getElementById('community-cards');
    const existingFaceCards = container.querySelectorAll('.card-face');

    if (existingFaceCards.length === gameState.communityCards.length &&
        gameState.displayedCommunityCards === gameState.communityCards.length) {
        let allMatch = true;
        existingFaceCards.forEach((el, index) => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (!valueEl || !suitEl ||
                valueEl.textContent !== gameState.communityCards[index].value ||
                suitEl.textContent !== gameState.communityCards[index].suit) {
                allMatch = false;
            }
        });
        if (allMatch) return;
    }

    clearHighlightHumanBestHand();

    let html = '';
    for (let index = 0; index < 5; index++) {
        if (index < gameState.communityCards.length) {
            const shouldAnimate = index >= gameState.displayedCommunityCards;
            html += `<div class="card-slot community-slot">
                <div class="card card-placeholder"></div>
                ${getCardHTML(gameState.communityCards[index], false, shouldAnimate)}
            </div>`;
        } else {
            html += '<div class="card-slot community-slot"><div class="card card-placeholder"></div></div>';
        }
    }

    container.innerHTML = html;

    const dealingCards = container.querySelectorAll('.card.dealing');
    dealingCards.forEach(card => animateCardFromDealer(card));

    gameState.displayedCommunityCards = gameState.communityCards.length;
}

export function highlightHumanBestHand(gameState, { translateHandName }) {
    const validPhases = ['flop', 'turn', 'river'];
    if (!validPhases.includes(gameState.phase)) return;

    const humanPlayer = gameState.players[0];
    if (humanPlayer.folded || humanPlayer.isRemoved) {
        clearHighlightHumanBestHand();
        return;
    }

    const allCards = [...humanPlayer.cards, ...gameState.communityCards];
    if (allCards.length < 5) return;

    const handResult = evaluateHand(allCards);

    const existingName = document.querySelector('.hand-rank-name');
    if (existingName) existingName.remove();

    if (handResult.name === 'High Card') {
        document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));
        return;
    }

    const handNameEl = document.createElement('div');
    handNameEl.className = 'hand-rank-name';
    handNameEl.textContent = translateHandName(handResult.name);

    const communityCardsEl = document.getElementById('community-cards');
    if (communityCardsEl) {
        communityCardsEl.appendChild(handNameEl);
    }

    document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));

    let cardsToHighlight = [];
    const bestCards = handResult.bestCards;

    if (handResult.name === 'One Pair') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const pairValue = Object.keys(valueCounts).find(value => valueCounts[value] === 2);
        cardsToHighlight = bestCards.filter(card => card.value === pairValue);
    } else if (handResult.name === 'Two Pair') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const pairValues = Object.keys(valueCounts).filter(value => valueCounts[value] === 2);
        cardsToHighlight = bestCards.filter(card => pairValues.includes(card.value));
    } else if (handResult.name === 'Three of a Kind') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const tripsValue = Object.keys(valueCounts).find(value => valueCounts[value] === 3);
        cardsToHighlight = bestCards.filter(card => card.value === tripsValue);
    } else if (handResult.name === 'Four of a Kind') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const quadsValue = Object.keys(valueCounts).find(value => valueCounts[value] === 4);
        cardsToHighlight = bestCards.filter(card => card.value === quadsValue);
    } else {
        cardsToHighlight = bestCards;
    }

    const highlightCardInContainer = (containerId, card) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const cardEls = container.querySelectorAll('.card');
        cardEls.forEach(el => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (valueEl && suitEl &&
                valueEl.textContent === card.value &&
                suitEl.textContent === card.suit) {
                el.classList.add('highlight');
            }
        });
    };

    cardsToHighlight.forEach(card => {
        highlightCardInContainer('cards-0', card);
        highlightCardInContainer('community-cards', card);
    });
}
```

- [ ] **Step 4: Add the main table refresh helpers to the same module**

Finish `src/ui/game-table-renderer.js` by adding the pre-game visibility, winner
cleanup, and high-level table refresh entrypoint:

```js
function updateBetDisplay(gameState, playerId) {
    const player = gameState.players[playerId];
    const betDisplay = document.getElementById(`bet-${playerId}`);
    const betAmount = betDisplay.querySelector('.bet-amount');

    if (player.bet > 0) {
        betAmount.textContent = `$${player.bet}`;
        betDisplay.classList.add('visible');
    } else {
        betDisplay.classList.remove('visible');
    }
}

function updateControls(gameState, { gameMode }) {
    const controls = document.getElementById('controls');
    const player = gameState.players[0];

    controls.classList.remove('hidden');

    const isUserTurn = gameState.currentPlayerIndex === 0;
    const canAct = gameState.phase !== 'idle' &&
        gameState.phase !== 'showdown' &&
        !player.folded &&
        !player.allIn;
    const isActive = isUserTurn && canAct;

    controls.classList.toggle('disabled', !isActive);
    controls.classList.toggle('active', isActive);

    const callAmount = gameState.currentBet - player.bet;
    const canCheck = callAmount === 0;

    document.getElementById('btn-check').style.display = canCheck ? 'block' : 'none';
    document.getElementById('btn-call').style.display = canCheck ? 'none' : 'block';
    document.getElementById('call-amount').textContent = Math.min(callAmount, player.chips);

    const slider = document.getElementById('raise-slider');
    const minRaise = gameState.currentBet + gameState.minRaise;
    slider.min = minRaise;
    slider.max = player.chips + player.bet;
    slider.value = minRaise;
    document.getElementById('raise-amount').textContent = minRaise;

    const allButtons = controls.querySelectorAll('.btn');
    allButtons.forEach(btn => btn.disabled = !isActive);

    if (isActive) {
        document.getElementById('btn-raise').disabled = player.chips <= callAmount;
    }

    slider.disabled = !isActive;
}

export function hideGameElements() {
    const playerInfos = document.querySelectorAll('.player-info');
    playerInfos.forEach(info => {
        info.classList.add('pre-game-hidden');
        info.classList.remove('game-started');
    });

    const controls = document.getElementById('controls');
    if (controls) {
        controls.classList.add('pre-game-hidden');
        controls.classList.remove('game-started');
    }
}

export function showGameElements() {
    const playerInfos = document.querySelectorAll('.player-info');
    playerInfos.forEach(info => {
        info.classList.remove('pre-game-hidden');
        info.classList.add('game-started');
    });

    const controls = document.getElementById('controls');
    if (controls) {
        controls.classList.remove('pre-game-hidden');
        controls.classList.add('game-started');
    }
}

export function clearWinnerHighlights() {
    document.querySelectorAll('.player.winner').forEach(el => {
        el.classList.remove('winner');
    });

    document.querySelectorAll('.hand-rank-badge').forEach(el => {
        el.remove();
    });

    document.querySelectorAll('.card.winning-card').forEach(el => {
        el.classList.remove('winning-card');
    });
}

export function updateUI(gameState, {
    gameMode,
    t,
    translateHandName,
    onToggleAILevel,
    onRemoveAIPlayer,
    onAddAIPlayer
}) {
    document.getElementById('pot-amount').textContent = `$${gameState.pot}`;

    const potChip = document.querySelector('.pot-chip');
    if (potChip) {
        potChip.style.display = gameState.pot > 0 ? 'block' : 'none';
    }

    for (const player of gameState.players) {
        document.getElementById(`chips-${player.id}`).textContent = player.chips;

        const playerEl = document.getElementById(`player-${player.id}`);
        playerEl.classList.toggle('folded', player.folded);
        playerEl.classList.toggle('removed', !!player.isRemoved);

        const isActivePlayer = gameState.phase !== 'idle' &&
            gameState.currentPlayerIndex === player.id &&
            !player.folded &&
            !player.allIn;
        playerEl.classList.toggle('active', isActivePlayer);
        playerEl.classList.toggle('fast-mode', gameMode === 'fast');
        playerEl.classList.toggle('slow-mode', gameMode === 'slow');

        const dealerChip = document.getElementById(`dealer-${player.id}`);
        dealerChip.classList.toggle('visible', gameState.dealerIndex === player.id && !player.isRemoved);

        updatePlayerCards(gameState, player.id, { isHidden: true });
        updateBetDisplay(gameState, player.id);

        if (player.isAI) {
            const levelEl = document.getElementById(`level-${player.id}`);
            const avatarContainer = document.getElementById(`avatar-${player.id}`);

            let removeBtn = playerEl.querySelector('.btn-remove');
            if (!removeBtn) {
                removeBtn = document.createElement('button');
                removeBtn.className = 'btn-remove';
                removeBtn.innerHTML = '✕';
                removeBtn.title = t('removeAI');
                removeBtn.onclick = event => {
                    event.stopPropagation();
                    onRemoveAIPlayer(player.id);
                };
                playerEl.querySelector('.player-info').appendChild(removeBtn);
            }
            removeBtn.style.display = player.isRemoved ? 'none' : 'block';

            let plusSign = playerEl.querySelector('.player-add-plus');
            if (!plusSign) {
                plusSign = document.createElement('div');
                plusSign.className = 'player-add-plus';
                plusSign.innerHTML = '+';
                plusSign.title = t('addAI');
                plusSign.onclick = event => {
                    event.stopPropagation();
                    onAddAIPlayer(player.id);
                };
                playerEl.querySelector('.player-info').appendChild(plusSign);
            }
            plusSign.style.display = player.isRemoved ? 'flex' : 'none';

            if (levelEl) {
                levelEl.textContent = `(${t(player.aiLevel)})`;
                levelEl.title = t('changeDifficulty');
                levelEl.className = `player-level ${player.aiLevel}`;
                levelEl.style.display = player.isRemoved ? 'none' : 'block';
                levelEl.onclick = event => {
                    event.stopPropagation();
                    onToggleAILevel(player.id);
                };
            }

            const nameEl = playerEl.querySelector('.player-name');
            const chipsEl = playerEl.querySelector('.player-chips');
            if (nameEl) nameEl.style.display = player.isRemoved ? 'none' : 'block';
            if (chipsEl) chipsEl.style.display = player.isRemoved ? 'none' : 'block';
            if (avatarContainer) avatarContainer.style.display = player.isRemoved ? 'none' : 'flex';
        }
    }

    updateCommunityCards(gameState);
    updateControls(gameState, { gameMode });
    highlightHumanBestHand(gameState, { translateHandName });
}
```

- [ ] **Step 5: Run a syntax check on the new renderer module**

Run: `node --check src/ui/game-table-renderer.js`
Expected: PASS with no output

- [ ] **Step 6: Commit the renderer module**

```bash
git add src/ui/game-table-renderer.js
git commit -m "refactor: extract game table renderer"
```

### Task 2: Wire the Renderer Back Into `game.js`

**Files:**
- Modify: `game.js`
- Test: `src/ui/game-table-renderer.js`
- Test: `game.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Import the renderer helpers into `game.js`**

Add this import block near the existing `src/core` and `src/state` imports:

```js
import {
    updatePlayerCards,
    updatePlayerCardsAnimated,
    updateCommunityCards,
    clearHighlightHumanBestHand,
    updateUI,
    clearWinnerHighlights,
    hideGameElements,
    showGameElements
} from './src/ui/game-table-renderer.js';
```

- [ ] **Step 2: Update the callsites in `game.js` to use the renderer signatures**

Replace the existing direct calls with the renderer-aware argument forms:

```js
updatePlayerCardsAnimated(gameState, playerId);
updatePlayerCards(gameState, player.id, { isHidden: true });
updatePlayerCards(gameState, player.id, { isHidden: false });
updateCommunityCards(gameState);
updateUI(gameState, {
    gameMode,
    t,
    translateHandName,
    onToggleAILevel: toggleAILevel,
    onRemoveAIPlayer: removeAIPlayer,
    onAddAIPlayer: addAIPlayer
});
```

Keep the existing orchestration flow unchanged; only the UI helper boundary
should move.

- [ ] **Step 3: Remove the local renderer implementations from `game.js`**

Delete these local function bodies after the imports and callsites are wired:

```js
function getCardHTML(card, isHidden = false, animate = true) {}
function animateCardFromDealer(cardElement) {}
function updatePlayerCards(playerId, isHidden = false) {}
function updatePlayerCardsAnimated(playerId) {}
function updateCommunityCards() {}
function clearHighlightHumanBestHand() {}
function highlightHumanBestHand() {}
function updateUI() {}
function updateBetDisplay(playerId) {}
function updateControls() {}
function clearWinnerHighlights() {}
function hideGameElements() {}
function showGameElements() {}
```

Leave `setPotPreset(multiplier)` and `resetAndStartNewGame()` in `game.js` for
now; the events task will compose them next.

- [ ] **Step 4: Run automated verification after wiring the renderer**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-table-renderer.js`
Expected: PASS with no output

Run: `npm test`
Expected: PASS with the current 16 passing tests

- [ ] **Step 5: Commit the renderer wiring**

```bash
git add game.js
git commit -m "refactor: wire game table renderer"
```

### Task 3: Extract Main Game Table Event Binding

**Files:**
- Create: `src/ui/game-table-events.js`
- Modify: `game.js`
- Test: `src/ui/game-table-events.js`
- Test: `game.js`
- Test: `src/ui/game-table-renderer.js`
- Test: `src/main.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Run a syntax check before the events file exists**

Run: `node --check src/ui/game-table-events.js`
Expected: FAIL with a missing-file error because the events module does not exist yet

- [ ] **Step 2: Create `src/ui/game-table-events.js`**

Create the file with this exact public interface:

```js
export function bindGameTableEvents({
    onFold,
    onCheck,
    onCall,
    onRaise,
    onAllIn,
    onSetPotPreset,
    onResetAndStartNewGame
}) {
    document.getElementById('btn-fold').addEventListener('click', onFold);
    document.getElementById('btn-check').addEventListener('click', onCheck);
    document.getElementById('btn-call').addEventListener('click', onCall);

    document.getElementById('btn-raise').addEventListener('click', () => {
        const raiseAmount = Number.parseInt(document.getElementById('raise-slider').value, 10);
        onRaise(raiseAmount);
    });

    document.getElementById('btn-allin').addEventListener('click', onAllIn);

    document.getElementById('raise-slider').addEventListener('input', event => {
        document.getElementById('raise-amount').textContent = event.target.value;
    });

    document.getElementById('btn-half-pot').addEventListener('click', () => {
        onSetPotPreset(0.5);
    });

    document.getElementById('btn-one-pot').addEventListener('click', () => {
        onSetPotPreset(1);
    });

    document.getElementById('btn-two-pot').addEventListener('click', () => {
        onSetPotPreset(2);
    });

    document.getElementById('btn-new-game').addEventListener('click', onResetAndStartNewGame);
    document.getElementById('btn-continue').addEventListener('click', onResetAndStartNewGame);
}
```

- [ ] **Step 3: Compose the new event module from `bindGameEventListeners()` in `game.js`**

Add this import:

```js
import { bindGameTableEvents } from './src/ui/game-table-events.js';
```

Then replace the inline main-table bindings in `bindGameEventListeners()` with:

```js
    bindGameTableEvents({
        onFold: () => {
            playerFold(0);
            resolvePlayerAction();
        },
        onCheck: () => {
            playerCheck(0);
            resolvePlayerAction();
        },
        onCall: () => {
            playerCall(0);
            resolvePlayerAction();
        },
        onRaise: raiseAmount => {
            playerRaise(0, raiseAmount);
            resolvePlayerAction();
        },
        onAllIn: () => {
            playerAllIn(0);
            resolvePlayerAction();
        },
        onSetPotPreset: multiplier => {
            setPotPreset(multiplier);
        },
        onResetAndStartNewGame: resetAndStartNewGame
    });
```

Keep these listeners inline in `bindGameEventListeners()` for this phase:

- history navigation
- help popup
- language toggle
- mode toggle
- stats toggle
- cursor selector and mousemove binding

- [ ] **Step 4: Run automated verification after extracting the event module**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-table-renderer.js`
Expected: PASS with no output

Run: `node --check src/ui/game-table-events.js`
Expected: PASS with no output

Run: `node --check src/main.js`
Expected: PASS with no output

Run: `npm test`
Expected: PASS with the current 16 passing tests

- [ ] **Step 5: Perform manual browser verification over HTTP**

Run: `python -m http.server 8000`
Expected: a local static server starts at `http://localhost:8000`

Manual checklist:

1. Load `http://localhost:8000` and confirm the page initializes without import errors.
2. Click `NEW GAME` and confirm the first hand starts normally.
3. Confirm hole-card dealing animation still works.
4. Confirm flop, turn, and river still render correctly.
5. Confirm pot amount, player bet bubbles, dealer marker, active-player state,
   fold state, and all-in state still refresh correctly.
6. Confirm `FOLD`, `CHECK`, `CALL`, `RAISE`, and `ALL IN` still work.
7. Confirm the raise slider and `1/2 POT`, `1 POT`, `2 POT` buttons still work.
8. Play to showdown and confirm winner highlights appear and are cleared on the
   next hand.

- [ ] **Step 6: Commit the event extraction**

```bash
git add game.js src/ui/game-table-events.js
git commit -m "refactor: extract game table events"
```
