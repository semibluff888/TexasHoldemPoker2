# Phase 7 Game History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the hand-history and action-log subsystem from `game.js` into a focused UI module while preserving history navigation behavior, translated log content, showdown detail logging, and gameplay behavior.

**Architecture:** Introduce `src/ui/game-history.js` as a stateful browser-side module that owns hand-history state, generic log-entry creation, showdown-detail entry creation, and history navigation. Keep `game.js` as the orchestration layer for gameplay, AI, betting, showdown settlement, and language-refresh sequencing, with the history module receiving translated strings and already-computed gameplay results as inputs.

**Tech Stack:** Vanilla JavaScript ES modules, browser DOM APIs, existing `src/ui/game-shell-renderer.js` helpers, Node built-in test runner via `node --test`, `node --check`, `npm test`, manual browser verification over static HTTP

---

## File Structure

- `src/ui/game-history.js`
  Responsibility: Own hand-history state (`handNumber`, `handHistories`, `currentViewingHand`), generic log-entry HTML construction, showdown-detail/fold-win log-entry construction, and history navigation while delegating DOM rendering to `src/ui/game-shell-renderer.js`.
- `tests/ui/game-history.test.js`
  Responsibility: Cover the new history module in Node with lightweight DOM stubs, including pre-hand messaging, current-hand append behavior, past-hand viewing behavior, navigation state transitions, fold-win detail rendering, and showdown-detail rendering.
- `game.js`
  Responsibility after this phase: Keep gameplay orchestration and translated message decisions, import `gameHistory`, delegate log/history state changes to it, and stop owning the history arrays plus inline history-entry HTML builders.

No new DOM-test framework is introduced in this phase. Verification remains targeted `node --test`, syntax checks, the existing `npm test` suite, and manual browser smoke verification.

### Task 1: Add the Game History Module and Its Node Tests

**Files:**
- Create: `src/ui/game-history.js`
- Create: `tests/ui/game-history.test.js`
- Test: `tests/ui/game-history.test.js`
- Test: `src/ui/game-history.js`

- [ ] **Step 1: Write the failing history-module test file**

Create `tests/ui/game-history.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { gameHistory } from '../../src/ui/game-history.js';

function snapshotGameHistoryState() {
    return {
        handNumber: gameHistory.handNumber,
        handHistories: gameHistory.handHistories.map(entries => [...entries]),
        currentViewingHand: gameHistory.currentViewingHand
    };
}

function restoreGameHistoryState(snapshot) {
    gameHistory.handNumber = snapshot.handNumber;
    gameHistory.handHistories = snapshot.handHistories.map(entries => [...entries]);
    gameHistory.currentViewingHand = snapshot.currentViewingHand;
}

function restoreDocument(originalDocument) {
    if (originalDocument === undefined) {
        delete globalThis.document;
        return;
    }

    globalThis.document = originalDocument;
}

function createClassListHarness() {
    const classes = new Set();

    return {
        add(className) {
            classes.add(className);
        },
        remove(className) {
            classes.delete(className);
        },
        toggle(className, force) {
            if (force === undefined) {
                if (classes.has(className)) {
                    classes.delete(className);
                    return false;
                }

                classes.add(className);
                return true;
            }

            if (force) {
                classes.add(className);
                return true;
            }

            classes.delete(className);
            return false;
        },
        contains(className) {
            return classes.has(className);
        }
    };
}

function createHistoryElement() {
    return {
        innerHTML: '',
        scrollTop: 0,
        scrollHeight: 0,
        insertAdjacentHTML(position, html) {
            assert.equal(position, 'beforeend');
            this.innerHTML += html;
            this.scrollHeight = this.innerHTML.length;
            this.scrollTop = this.scrollHeight;
        }
    };
}

function createDocumentHarness() {
    const historyElement = createHistoryElement();
    const prevButton = { disabled: false };
    const nextButton = { disabled: false };
    const returnButton = { disabled: false };
    const panelHandNumber = {
        textContent: '',
        classList: createClassListHarness()
    };

    return {
        historyElement,
        prevButton,
        nextButton,
        returnButton,
        panelHandNumber,
        getElementById(id) {
            switch (id) {
                case 'action-history':
                    return historyElement;
                case 'btn-prev-hand':
                    return prevButton;
                case 'btn-next-hand':
                    return nextButton;
                case 'btn-return-hand':
                    return returnButton;
                case 'panel-hand-number':
                    return panelHandNumber;
                default:
                    return null;
            }
        }
    };
}

function createTranslator() {
    return key => {
        const translations = {
            start: 'START',
            showdown: 'SHOWDOWN',
            everyoneFolded: 'EVERYONE FOLDED',
            winnersHoleCards: 'Winner Hole Cards',
            winnerLabel: 'Winner',
            result: 'Result',
            prize: 'Prize',
            communityCards: 'Community Cards',
            playersHoleCards: 'Players Hole Cards',
            winningHand: 'Winning Hand',
            best5Cards: 'Best 5 Cards',
            hand: 'Hand',
            of: 'of',
            handSuffix: ''
        };

        return translations[key] || key;
    };
}

test('showMessage() appends to the history panel before the first hand starts', () => {
    const originalDocument = globalThis.document;
    const originalState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness();

    try {
        globalThis.document = documentHarness;

        gameHistory.handNumber = 0;
        gameHistory.handHistories = [];
        gameHistory.currentViewingHand = 0;

        gameHistory.showMessage({
            message: 'Welcome to the table',
            phaseKey: 'start',
            t: createTranslator(),
            now: new Date('2026-04-16T12:34:56Z')
        });

        assert.equal(gameHistory.handNumber, 0);
        assert.deepEqual(gameHistory.handHistories, []);
        assert.equal(documentHarness.historyElement.innerHTML.includes('Welcome to the table'), true);
        assert.equal(documentHarness.historyElement.innerHTML.includes('START'), true);
    } finally {
        restoreDocument(originalDocument);
        restoreGameHistoryState(originalState);
    }
});

test('startHand() initializes history state and current-hand panel state', () => {
    const originalDocument = globalThis.document;
    const originalState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness();

    try {
        globalThis.document = documentHarness;

        gameHistory.handNumber = 0;
        gameHistory.handHistories = [];
        gameHistory.currentViewingHand = 0;

        gameHistory.startHand({
            currentLanguage: 'en',
            t: createTranslator()
        });

        assert.equal(gameHistory.handNumber, 1);
        assert.equal(gameHistory.currentViewingHand, 1);
        assert.deepEqual(gameHistory.handHistories, [[]]);
        assert.equal(documentHarness.historyElement.innerHTML, '');
        assert.equal(documentHarness.panelHandNumber.textContent, 'Hand #1');
        assert.equal(documentHarness.panelHandNumber.classList.contains('viewing-past'), false);
        assert.equal(documentHarness.prevButton.disabled, true);
        assert.equal(documentHarness.nextButton.disabled, true);
        assert.equal(documentHarness.returnButton.disabled, true);
    } finally {
        restoreDocument(originalDocument);
        restoreGameHistoryState(originalState);
    }
});

test('showMessage() stores current-hand entries without disrupting a viewed past hand', () => {
    const originalDocument = globalThis.document;
    const originalState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness();
    const t = createTranslator();

    try {
        globalThis.document = documentHarness;

        gameHistory.handNumber = 0;
        gameHistory.handHistories = [];
        gameHistory.currentViewingHand = 0;

        gameHistory.startHand({ currentLanguage: 'en', t });
        gameHistory.showMessage({
            message: 'Hand 1 entry',
            phaseKey: 'start',
            t,
            now: new Date('2026-04-16T12:34:56Z')
        });

        gameHistory.startHand({ currentLanguage: 'en', t });
        gameHistory.showMessage({
            message: 'Hand 2 live entry',
            phaseKey: 'showdown',
            t,
            now: new Date('2026-04-16T12:35:56Z')
        });

        gameHistory.navigate(-1, {
            currentLanguage: 'en',
            t
        });

        assert.equal(documentHarness.historyElement.innerHTML.includes('Hand 1 entry'), true);
        assert.equal(documentHarness.historyElement.innerHTML.includes('Hand 2 live entry'), false);

        gameHistory.showMessage({
            message: 'Hand 2 hidden entry',
            phaseKey: 'showdown',
            t,
            now: new Date('2026-04-16T12:36:56Z')
        });

        assert.equal(documentHarness.historyElement.innerHTML.includes('Hand 2 hidden entry'), false);
        assert.equal(gameHistory.handHistories[1].length, 2);

        gameHistory.returnToCurrent({
            currentLanguage: 'en',
            t
        });

        assert.equal(gameHistory.currentViewingHand, 2);
        assert.equal(documentHarness.historyElement.innerHTML.includes('Hand 2 live entry'), true);
        assert.equal(documentHarness.historyElement.innerHTML.includes('Hand 2 hidden entry'), true);
        assert.equal(documentHarness.returnButton.disabled, true);
    } finally {
        restoreDocument(originalDocument);
        restoreGameHistoryState(originalState);
    }
});

test('logFoldWin() renders translated showdown details for an everyone-folded result', () => {
    const originalDocument = globalThis.document;
    const originalState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness();
    const t = createTranslator();

    try {
        globalThis.document = documentHarness;

        gameHistory.handNumber = 0;
        gameHistory.handHistories = [];
        gameHistory.currentViewingHand = 0;
        gameHistory.startHand({ currentLanguage: 'en', t });

        gameHistory.logFoldWin({
            winner: {
                id: 2,
                cards: [
                    { value: 'A', suit: 'S' },
                    { value: 'K', suit: 'S' }
                ]
            },
            winAmount: 150,
            t,
            getTranslatedPlayerName: player => `Player ${player.id}`,
            now: new Date('2026-04-16T12:37:56Z')
        });

        assert.equal(documentHarness.historyElement.innerHTML.includes('EVERYONE FOLDED'), true);
        assert.equal(documentHarness.historyElement.innerHTML.includes('Player 2'), true);
        assert.equal(documentHarness.historyElement.innerHTML.includes('AS KS'), true);
        assert.equal(documentHarness.historyElement.innerHTML.includes('$150'), true);
    } finally {
        restoreDocument(originalDocument);
        restoreGameHistoryState(originalState);
    }
});

test('logShowdown() renders sorted showdown details from supplied hand results', () => {
    const originalDocument = globalThis.document;
    const originalState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness();
    const t = createTranslator();

    try {
        globalThis.document = documentHarness;

        gameHistory.handNumber = 0;
        gameHistory.handHistories = [];
        gameHistory.currentViewingHand = 0;
        gameHistory.startHand({ currentLanguage: 'en', t });

        const playersInHand = [
            {
                id: 1,
                cards: [
                    { value: 'A', suit: 'H' },
                    { value: 'A', suit: 'D' }
                ],
                handResult: {
                    score: 200,
                    name: 'One Pair',
                    bestCards: [
                        { value: 'A', suit: 'H' },
                        { value: 'A', suit: 'D' },
                        { value: 'K', suit: 'C' },
                        { value: 'Q', suit: 'S' },
                        { value: '9', suit: 'H' }
                    ]
                }
            },
            {
                id: 3,
                cards: [
                    { value: 'K', suit: 'S' },
                    { value: 'K', suit: 'D' }
                ],
                handResult: {
                    score: 700,
                    name: 'Full House',
                    bestCards: [
                        { value: 'K', suit: 'S' },
                        { value: 'K', suit: 'D' },
                        { value: 'K', suit: 'C' },
                        { value: '9', suit: 'S' },
                        { value: '9', suit: 'D' }
                    ]
                }
            }
        ];

        gameHistory.logShowdown({
            playersInHand,
            winners: [playersInHand[1]],
            communityCards: [
                { value: 'K', suit: 'C' },
                { value: 'Q', suit: 'S' },
                { value: '9', suit: 'H' },
                { value: '9', suit: 'S' },
                { value: '9', suit: 'D' }
            ],
            totalWinAmounts: {
                3: 320
            },
            t,
            translateHandName: handName => `Translated ${handName}`,
            getTranslatedPlayerName: player => `Player ${player.id}`,
            now: new Date('2026-04-16T12:38:56Z')
        });

        const html = documentHarness.historyElement.innerHTML;
        assert.equal(html.includes('SHOWDOWN'), true);
        assert.equal(html.includes('KC QS 9H 9S 9D'), true);
        assert.equal(html.includes('Translated Full House'), true);
        assert.equal(html.includes('Player 3: $320'), true);
        assert.equal(html.indexOf('Player 3') < html.indexOf('Player 1:'), true);
    } finally {
        restoreDocument(originalDocument);
        restoreGameHistoryState(originalState);
    }
});
```

- [ ] **Step 2: Run the targeted test to verify it fails before the module exists**

Run: `node --test tests/ui/game-history.test.js`
Expected: FAIL with an `ERR_MODULE_NOT_FOUND` error for `src/ui/game-history.js`

- [ ] **Step 3: Create `src/ui/game-history.js` with history state, log builders, and navigation helpers**

Create `src/ui/game-history.js` with this exact content:

```js
import {
    renderHistoryEntries,
    appendHistoryEntry,
    updateHistoryNavigation,
    updatePanelHandNumber,
    clearPanelHandNumber
} from './game-shell-renderer.js';

function formatLogTime(now) {
    return now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
}

function formatCardsText(cards) {
    return cards.map(card => `${card.value}${card.suit}`).join(' ');
}

function getHandEntries(handHistories, handNumber) {
    return handHistories[handNumber - 1] || [];
}

export const gameHistory = {
    handNumber: 0,
    handHistories: [],
    currentViewingHand: 0,

    startHand({ currentLanguage, t }) {
        this.handNumber += 1;
        this.currentViewingHand = this.handNumber;
        this.handHistories[this.handNumber - 1] = [];

        renderHistoryEntries([]);
        this.syncPanel({ currentLanguage, t });
    },

    resetGame() {
        this.handNumber = 0;
        this.handHistories = [];
        this.currentViewingHand = 0;

        renderHistoryEntries([]);
        clearPanelHandNumber();
        updateHistoryNavigation({
            currentViewingHand: this.currentViewingHand,
            handNumber: this.handNumber
        });
    },

    syncPanel({ currentLanguage, t }) {
        if (this.handNumber <= 0) {
            clearPanelHandNumber();
            updateHistoryNavigation({
                currentViewingHand: this.currentViewingHand,
                handNumber: this.handNumber
            });
            return;
        }

        updatePanelHandNumber({
            currentLanguage,
            currentViewingHand: this.currentViewingHand,
            handNumber: this.handNumber,
            t
        });
        updateHistoryNavigation({
            currentViewingHand: this.currentViewingHand,
            handNumber: this.handNumber
        });
    },

    appendToCurrentHand(entryHTML) {
        if (this.handNumber <= 0) {
            if (this.currentViewingHand <= 0) {
                appendHistoryEntry(entryHTML);
            }
            return;
        }

        if (!this.handHistories[this.handNumber - 1]) {
            this.handHistories[this.handNumber - 1] = [];
        }

        this.handHistories[this.handNumber - 1].push(entryHTML);

        if (this.currentViewingHand === this.handNumber) {
            appendHistoryEntry(entryHTML);
        }
    },

    showMessage({ message, phaseKey, t, now = new Date() }) {
        if (!message) return;

        const time = formatLogTime(now);
        const phase = t(phaseKey) || phaseKey.toUpperCase();

        const entryHTML = `
        <div class="log-entry">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${phase}</span>
            </div>
            <div class="log-content">${message}</div>
        </div>
    `;

        this.appendToCurrentHand(entryHTML);
    },

    logAction({
        player,
        action,
        chipsBeforeAction = null,
        phaseKey,
        t,
        getTranslatedPlayerName,
        now = new Date()
    }) {
        const chipAmount = chipsBeforeAction !== null ? chipsBeforeAction : player.chips;
        const name = getTranslatedPlayerName(player);

        this.showMessage({
            message: `${name}($${chipAmount}): ${action}`,
            phaseKey,
            t,
            now
        });
    },

    logFoldWin({ winner, winAmount, t, getTranslatedPlayerName, now = new Date() }) {
        const time = formatLogTime(now);
        const winnerName = getTranslatedPlayerName(winner);

        const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('everyoneFolded')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('winnersHoleCards')}</strong>
                    <div class="player-hand winner-hand">
                        ${winnerName} \u2B50 ${formatCardsText(winner.cards)}
                    </div>
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerName}
                    <br><strong>${t('result')}</strong> ${t('everyoneFolded')}
                    <br><strong>${t('prize')}</strong> $${winAmount}
                </div>
            </div>
        </div>
    `;

        this.appendToCurrentHand(entryHTML);
    },

    logShowdown({
        playersInHand,
        winners,
        communityCards,
        totalWinAmounts,
        t,
        translateHandName,
        getTranslatedPlayerName,
        now = new Date()
    }) {
        const time = formatLogTime(now);
        const playersWithHands = [...playersInHand]
            .filter(player => player.handResult)
            .sort((a, b) => b.handResult.score - a.handResult.score);

        let playerCardsHTML = '';
        for (const player of playersWithHands) {
            const isWinner = winners.some(winner => winner.id === player.id);
            const winnerMark = isWinner ? ' \u2B50' : '';
            const playerName = getTranslatedPlayerName(player);
            const handName = translateHandName(player.handResult.name);

            playerCardsHTML += `
            <div class="player-hand ${isWinner ? 'winner-hand' : ''}">
                ${playerName}${winnerMark}: ${formatCardsText(player.cards)} (${handName})
            </div>
        `;
        }

        const winnersCardsInfo = winners.map(winner => {
            const bestCards = winner.handResult && winner.handResult.bestCards
                ? formatCardsText(winner.handResult.bestCards)
                : 'N/A';
            const winnerName = getTranslatedPlayerName(winner);
            return `${bestCards}(${winnerName})`;
        }).join('<br>');

        const prizeInfo = winners.map(winner => {
            const winAmount = totalWinAmounts[winner.id] || 0;
            const winnerName = getTranslatedPlayerName(winner);
            return `${winnerName}: $${winAmount}`;
        }).join('<br>');

        const winningHandsList = winners.map(winner => {
            const winnerName = getTranslatedPlayerName(winner);
            const translatedHand = winner.handResult
                ? translateHandName(winner.handResult.name)
                : '';
            return `${winnerName}: ${translatedHand}`;
        }).join('<br>');

        const winnerNames = winners.map(winner => getTranslatedPlayerName(winner)).join(' & ');

        const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('showdown')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('communityCards')}</strong> ${formatCardsText(communityCards)}
                </div>
                <div class="showdown-section">
                    <strong>${t('playersHoleCards')}</strong>
                    ${playerCardsHTML}
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerNames}
                    <br><strong>${t('winningHand')}</strong><br>${winningHandsList}
                    <br><strong>${t('best5Cards')}</strong><br>${winnersCardsInfo}
                    <br><strong>${t('prize')}</strong><br>${prizeInfo}
                </div>
            </div>
        </div>
    `;

        this.appendToCurrentHand(entryHTML);
    },

    navigate(direction, { currentLanguage, t }) {
        let targetHand = this.currentViewingHand + direction;

        if (targetHand < 1) targetHand = 1;
        if (targetHand > this.handNumber) targetHand = this.handNumber;
        if (targetHand === this.currentViewingHand) return;

        this.currentViewingHand = targetHand;

        renderHistoryEntries(getHandEntries(this.handHistories, targetHand));
        this.syncPanel({ currentLanguage, t });
    },

    returnToCurrent({ currentLanguage, t }) {
        if (this.currentViewingHand === this.handNumber) return;

        this.currentViewingHand = this.handNumber;

        renderHistoryEntries(getHandEntries(this.handHistories, this.handNumber));
        this.syncPanel({ currentLanguage, t });
    }
};
```

- [ ] **Step 4: Run syntax and the targeted Node test after creating the module**

Run: `node --check src/ui/game-history.js`
Expected: PASS with no output

Run: `node --test tests/ui/game-history.test.js`
Expected: PASS with `5` passing tests

- [ ] **Step 5: Commit the new history module and its tests**

```bash
git add src/ui/game-history.js tests/ui/game-history.test.js
git commit -m "refactor: add game history module"
```

### Task 2: Wire History State, Generic Logging, and Navigation Through `game.js`

**Files:**
- Modify: `game.js`
- Test: `game.js`
- Test: `src/ui/game-history.js`
- Test: `src/main.js`
- Test: `tests/ui/game-history.test.js`

- [ ] **Step 1: Import the history module and replace the remaining history state ownership**

Replace the existing `src/ui/game-shell-renderer.js` import block with:

```js
import {
    setHelpPopupVisible,
    updateGameModeButton,
    updateStatsToggleButton,
    updateAllPlayerStatsDisplays
} from './src/ui/game-shell-renderer.js';
```

Add this import next to the other `src/ui/` imports near the top of `game.js`:

```js
import { gameHistory } from './src/ui/game-history.js';
```

Then delete these local state variables from `game.js`:

```js
let handNumber = 0; // Current hand number
let handHistories = []; // Array to store history for each hand
let currentViewingHand = 0; // Which hand history we're currently viewing
```

Add this helper near the other small orchestration helpers:

```js
function getCurrentLogPhaseKey() {
    return gameState.phase === 'idle' ? 'start' : gameState.phase;
}
```

Inside `updateLanguageUI()`, replace:

```js
    updatePanelHandNumber({
        currentLanguage,
        currentViewingHand,
        handNumber,
        t
    });
```

with:

```js
    gameHistory.syncPanel({ currentLanguage, t });
```

- [ ] **Step 2: Route seat-action logging, new-hand startup, reset, and history navigation through `gameHistory`**

Replace `showAction()` with:

```js
function showAction(playerId, action, chipsBeforeAction = null) {
    const actionEl = document.getElementById(`action-${playerId}`);
    actionEl.textContent = action;
    actionEl.classList.add('visible');

    setTimeout(() => {
        actionEl.classList.remove('visible');
    }, 2000);

    const player = gameState.players[playerId];
    gameHistory.logAction({
        player,
        action,
        chipsBeforeAction,
        phaseKey: getCurrentLogPhaseKey(),
        t,
        getTranslatedPlayerName
    });
}
```

Delete these functions entirely from `game.js`:

```js
function appendToCurrentHandHistory(entryHTML) {
    if (!handHistories[handNumber - 1]) {
        handHistories[handNumber - 1] = [];
    }

    handHistories[handNumber - 1].push(entryHTML);

    if (currentViewingHand === handNumber) {
        appendHistoryEntry(entryHTML);
    }
}

function navigateToHand(direction) {
    let targetHand = currentViewingHand + direction;

    if (targetHand < 1) targetHand = 1;
    if (targetHand > handNumber) targetHand = handNumber;
    if (targetHand === currentViewingHand) return;

    currentViewingHand = targetHand;

    renderHistoryEntries(handHistories[targetHand - 1] || []);
    updatePanelHandNumber({
        currentLanguage,
        currentViewingHand,
        handNumber,
        t
    });
    updateHistoryNavigation({ currentViewingHand, handNumber });
}

function returnToCurrentHand() {
    if (currentViewingHand === handNumber) return;

    currentViewingHand = handNumber;

    renderHistoryEntries(handHistories[handNumber - 1] || []);
    updatePanelHandNumber({
        currentLanguage,
        currentViewingHand,
        handNumber,
        t
    });
    updateHistoryNavigation({ currentViewingHand, handNumber });
}
```

Inside `startNewGame()`, replace the hand-history reset block:

```js
    // Increment hand counter (previous hand's history is already saved in array)
    handNumber++;
    currentViewingHand = handNumber;

    // Initialize new hand's history array
    handHistories[handNumber - 1] = [];

    renderHistoryEntries([]);
    updatePanelHandNumber({
        currentLanguage,
        currentViewingHand,
        handNumber,
        t
    });
    updateHistoryNavigation({ currentViewingHand, handNumber });
```

with:

```js
    gameHistory.startHand({ currentLanguage, t });
```

Inside `resetAndStartNewGame()`, replace:

```js
    handNumber = 0;
    handHistories = [];
    currentViewingHand = 0;

    renderHistoryEntries([]);
    clearPanelHandNumber();
```

with:

```js
    gameHistory.resetGame();
```

Inside `bindGameShellEvents(...)`, replace the history handlers with:

```js
    bindGameShellEvents({
        onNavigateHistory: direction => {
            gameHistory.navigate(direction, { currentLanguage, t });
        },
        onReturnToCurrentHand: () => {
            gameHistory.returnToCurrent({ currentLanguage, t });
        },
        onOpenHelp: () => {
            setHelpPopupVisible(true);
        },
        onCloseHelp: () => {
            setHelpPopupVisible(false);
        },
        onToggleLanguage: toggleLanguage,
        onToggleGameMode: toggleGameMode,
        onToggleStats: toggleShowAllStats
    });
```

- [ ] **Step 3: Replace direct generic `showMessage()` usage with `gameHistory.showMessage()` and remove the inline HTML builder**

Delete the entire `showMessage()` function from `game.js`:

```js
function showMessage(message, phaseOverride = null) {
    if (!message) return;

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });

    const phaseKey = phaseOverride || (gameState.phase === 'idle' ? 'start' : gameState.phase);
    const phase = t(phaseKey) || phaseKey.toUpperCase();

    const entryHTML = `
        <div class="log-entry">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${phase}</span>
            </div>
            <div class="log-content">${message}</div>
        </div>
    `;

    appendToCurrentHandHistory(entryHTML);
}
```

Replace the remaining direct `showMessage(...)` calls with these exact blocks:

```js
        gameHistory.showMessage({
            message: t('minAiRequired'),
            phaseKey: getCurrentLogPhaseKey(),
            t
        });
```

```js
    gameHistory.showMessage({
        message: t('aiLeft').replace('{name}', name),
        phaseKey: getCurrentLogPhaseKey(),
        t
    });
```

```js
    gameHistory.showMessage({
        message: t('aiJoined').replace('{name}', name),
        phaseKey: getCurrentLogPhaseKey(),
        t
    });
```

```js
        gameHistory.showMessage({
            message: 'Game Over! ' + (playersWithChips[0]?.name || 'No one') + ' wins!',
            phaseKey: getCurrentLogPhaseKey(),
            t
        });
```

```js
        gameHistory.showMessage({
            message: t('potWinMessage')
                .replace('{pot}', t('mainPot') || 'Main Pot')
                .replace('{winner}', getTranslatedPlayerName(winner))
                .replace('{amount}', winAmount)
                .replace('{hand}', t('everyoneFolded')),
            phaseKey: 'everyoneFolded',
            t
        });
```

```js
            gameHistory.showMessage({
                message,
                phaseKey: getCurrentLogPhaseKey(),
                t
            });
```

```js
    gameHistory.showMessage({
        message: t('startMessage'),
        phaseKey: 'start',
        t
    });
```

- [ ] **Step 4: Run syntax checks and the targeted history tests after the generic wiring**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-history.js`
Expected: PASS with no output

Run: `node --check src/main.js`
Expected: PASS with no output

Run: `node --test tests/ui/game-history.test.js`
Expected: PASS with `5` passing tests

- [ ] **Step 5: Commit the generic history wiring**

```bash
git add game.js
git commit -m "refactor: wire game history state"
```

### Task 3: Route Showdown Detail Logging to the History Module and Run Full Verification

**Files:**
- Modify: `game.js`
- Test: `game.js`
- Test: `src/ui/game-history.js`
- Test: `src/main.js`
- Test: `src/ui/game-shell-renderer.js`
- Test: `tests/ui/game-history.test.js`
- Test: `tests/ui/game-audio.test.js`
- Test: `tests/ui/game-cursor-effects.test.js`
- Test: `tests/i18n/game-translations.test.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Delegate fold-win and showdown-detail history entries to `gameHistory`**

Inside `showdown()`, replace:

```js
        // Log fold win details in showdown style
        logFoldWinDetails(winner, winAmount);
```

with:

```js
        gameHistory.logFoldWin({
            winner,
            winAmount,
            t,
            getTranslatedPlayerName
        });
```

Later in the same function, replace:

```js
        // Log showdown details to action history (pass individual win amounts)
        logShowdownDetails(playersInHand, allWinners, firstHandName, totalWinAmounts);
```

with:

```js
        gameHistory.logShowdown({
            playersInHand,
            winners: allWinners,
            communityCards: gameState.communityCards,
            totalWinAmounts,
            t,
            translateHandName,
            getTranslatedPlayerName
        });
```

Delete the now-unused showdown bookkeeping lines:

```js
        let firstHandName = '';
```

```js
            if (i === 0) firstHandName = handName;
```

Delete these helper functions entirely from `game.js`:

```js
function formatCardsText(cards) {
    return cards.map(card => `${card.value}${card.suit}`).join(' ');
}

function logFoldWinDetails(winner, winAmount) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
    const winnerName = getTranslatedPlayerName(winner);

    const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('everyoneFolded')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('winnersHoleCards')}</strong>
                    <div class="player-hand winner-hand">
                        ${winnerName} \u2B50 ${formatCardsText(winner.cards)}
                    </div>
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerName}
                    <br><strong>${t('result')}</strong> ${t('everyoneFolded')}
                    <br><strong>${t('prize')}</strong> $${winAmount}
                </div>
            </div>
        </div>
    `;

    appendToCurrentHandHistory(entryHTML);
}

function logShowdownDetails(playersInHand, winners, handName, totalWinAmounts) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });

    const playersWithHands = playersInHand.map(player => {
        const allCards = [...player.cards, ...gameState.communityCards];
        const handResult = evaluateHand(allCards);
        return { player, handResult };
    }).sort((a, b) => b.handResult.score - a.handResult.score);

    let playerCardsHTML = '';
    for (const { player, handResult } of playersWithHands) {
        const isWinner = winners.some(w => w.id === player.id);
        const winnerMark = isWinner ? ' \u2B50' : '';
        const playerName = getTranslatedPlayerName(player);
        const handName = translateHandName(handResult.name);
        playerCardsHTML += `
            <div class="player-hand ${isWinner ? 'winner-hand' : ''}">
                ${playerName}${winnerMark}: ${formatCardsText(player.cards)} (${handName})
            </div>
        `;
    }

    const winnersCardsInfo = winners.map(w => {
        const bestCards = w.handResult && w.handResult.bestCards ? formatCardsText(w.handResult.bestCards) : 'N/A';
        const winnerName = getTranslatedPlayerName(w);
        return `${bestCards}(${winnerName})`;
    }).join('<br>');

    const prizeInfo = winners.map(w => {
        const winAmount = totalWinAmounts[w.id] || 0;
        const winnerName = getTranslatedPlayerName(w);
        return `${winnerName}: $${winAmount}`;
    }).join('<br>');

    const winningHandsList = winners.map(w => {
        const winnerName = getTranslatedPlayerName(w);
        const translatedHand = w.handResult ? translateHandName(w.handResult.name) : translateHandName(handName);
        return `${winnerName}: ${translatedHand}`;
    }).join('<br>');

    const winnerNames = winners.map(w => getTranslatedPlayerName(w)).join(' & ');

    const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('showdown')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('communityCards')}</strong> ${formatCardsText(gameState.communityCards)}
                </div>
                <div class="showdown-section">
                    <strong>${t('playersHoleCards')}</strong>
                    ${playerCardsHTML}
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerNames}
                    <br><strong>${t('winningHand')}</strong><br>${winningHandsList}
                    <br><strong>${t('best5Cards')}</strong><br>${winnersCardsInfo}
                    <br><strong>${t('prize')}</strong><br>${prizeInfo}
                </div>
            </div>
        </div>
    `;

    appendToCurrentHandHistory(entryHTML);
}
```

- [ ] **Step 2: Run syntax checks, targeted history tests, and the full automated suite**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-history.js`
Expected: PASS with no output

Run: `node --check src/main.js`
Expected: PASS with no output

Run: `node --check src/ui/game-shell-renderer.js`
Expected: PASS with no output

Run: `node --test tests/ui/game-history.test.js`
Expected: PASS with `5` passing tests

Run: `npm test`
Expected: PASS with `31` passing tests

- [ ] **Step 3: Perform manual browser verification over HTTP**

Run: `python -m http.server 8000`
Expected: a local static server starts at `http://localhost:8000`

Manual checklist:

1. Load `http://localhost:8000` and confirm the page initializes without import errors.
2. Before starting a hand, confirm the initial translated start message still appears in the history panel.
3. Start a new hand and confirm the history panel clears for the new hand.
4. Play a hand and confirm action-history entries still append during live play.
5. Navigate to a past hand and confirm new current-hand entries do not overwrite the viewed history.
6. Use `Previous`, `Next`, and `Return` and confirm panel hand-number text and button disabled states still work.
7. Reach an everyone-folded result and confirm the fold-win detail block still renders correctly.
8. Reach a showdown and confirm community cards, player hole cards, winner labels, translated hand names, best 5 cards, and prize details still render correctly.
9. Toggle the language and confirm the panel hand-number display still refreshes correctly.

- [ ] **Step 4: Commit the showdown-history wiring**

```bash
git add game.js
git commit -m "refactor: wire game history module"
```
