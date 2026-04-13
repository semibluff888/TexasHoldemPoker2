# Phase 3 Game Shell UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the non-table shell UI renderer and shell event binding from `game.js` into focused browser modules while preserving current gameplay behavior, DOM structure, translation ownership, and shell-state ownership.

**Architecture:** Keep `game.js` as the orchestration layer for gameplay state, translation data, shell-state arrays, and shell preference mutation. Introduce `src/ui/game-shell-renderer.js` for history/stats/help/mode DOM updates and `src/ui/game-shell-events.js` for shell-area listeners, with `game.js` composing both modules and continuing to call them from existing flow-control paths.

**Tech Stack:** Vanilla JavaScript ES modules, browser DOM APIs, existing Node built-in test runner via `npm test`, `node --check`, manual browser verification over static HTTP

---

## File Structure

- `src/ui/game-shell-renderer.js`
  Responsibility: Own DOM reads/writes for shell UI that is not part of the main table, including action-history rendering, hand-history navigation state, panel hand-number display, help-popup visibility, mode/stats shell controls, and stats tooltip rendering.
- `src/ui/game-shell-events.js`
  Responsibility: Bind shell-area events only, translating clicks into handlers provided by `game.js` without importing `gameState` or mutating DOM state directly beyond event translation.
- `game.js`
  Responsibility after this phase: Keep orchestration, translation ownership, shell-state arrays (`handHistories`, `handNumber`, `currentViewingHand`), and browser preferences in place while routing shell DOM updates and shell event binding through the new UI modules.

No new DOM-test framework is introduced in this phase. Verification remains the existing `npm test` suite plus `node --check` for changed browser modules and a manual browser smoke over HTTP.

### Task 1: Create the Game Shell Renderer Module

**Files:**
- Create: `src/ui/game-shell-renderer.js`
- Test: `src/ui/game-shell-renderer.js`

- [ ] **Step 1: Run a module syntax check before the file exists**

Run: `node --check src/ui/game-shell-renderer.js`
Expected: FAIL with a missing-file error because the shell renderer module does not exist yet

- [ ] **Step 2: Create `src/ui/game-shell-renderer.js` with history, help-popup, and shell-control helpers**

Create `src/ui/game-shell-renderer.js` with this public surface:

```js
function getHistoryElement() {
    return document.getElementById('action-history');
}

export function renderHistoryEntries(entries) {
    const history = getHistoryElement();
    if (!history) return;

    history.innerHTML = Array.isArray(entries) && entries.length > 0
        ? entries.join('')
        : '';
}

export function appendHistoryEntry(entryHTML) {
    const history = getHistoryElement();
    if (!history) return;

    history.insertAdjacentHTML('beforeend', entryHTML);
    history.scrollTop = history.scrollHeight;
}

export function updateHistoryNavigation({ currentViewingHand, handNumber }) {
    const prevBtn = document.getElementById('btn-prev-hand');
    const nextBtn = document.getElementById('btn-next-hand');
    const returnBtn = document.getElementById('btn-return-hand');

    if (prevBtn) {
        prevBtn.disabled = currentViewingHand <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = currentViewingHand >= handNumber;
    }

    if (returnBtn) {
        returnBtn.disabled = currentViewingHand >= handNumber;
    }
}

export function updatePanelHandNumber({
    currentLanguage,
    currentViewingHand,
    handNumber,
    t
}) {
    const panelHandNumber = document.getElementById('panel-hand-number');
    if (!panelHandNumber) return;

    if (handNumber <= 0) {
        panelHandNumber.textContent = '';
        panelHandNumber.classList.remove('viewing-past');
        return;
    }

    if (currentViewingHand === handNumber) {
        if (currentLanguage === 'zh') {
            panelHandNumber.textContent = `${t('hand')}${handNumber}${t('handSuffix') || ''}`;
        } else {
            panelHandNumber.textContent = `${t('hand')} #${handNumber}`;
        }

        panelHandNumber.classList.remove('viewing-past');
        return;
    }

    if (currentLanguage === 'zh') {
        panelHandNumber.textContent =
            `${t('hand')}${currentViewingHand}${t('handSuffix') || ''} / ${t('of')}${handNumber}${t('handSuffix') || ''}`;
    } else {
        panelHandNumber.textContent = `${t('hand')} #${currentViewingHand} ${t('of')} ${handNumber}`;
    }

    panelHandNumber.classList.add('viewing-past');
}

export function clearPanelHandNumber() {
    const panelHandNumber = document.getElementById('panel-hand-number');
    if (!panelHandNumber) return;

    panelHandNumber.textContent = '';
    panelHandNumber.classList.remove('viewing-past');
}

export function setHelpPopupVisible(isVisible) {
    const helpPopup = document.getElementById('help-popup');
    if (!helpPopup) return;

    helpPopup.classList.toggle('visible', isVisible);
}

export function updateGameModeButton({ gameMode, t }) {
    const modeBtn = document.getElementById('btn-mode');
    if (!modeBtn) return;

    modeBtn.textContent = gameMode === 'fast' ? t('fastMode') : t('slowMode');
    modeBtn.classList.toggle('fast-active', gameMode === 'fast');
}

export function updateStatsToggleButton({ showAllStats }) {
    document.body.classList.toggle('show-all-stats', showAllStats);

    const statsToggleBtn = document.getElementById('btn-stats-toggle');
    if (statsToggleBtn) {
        statsToggleBtn.classList.toggle('active', showAllStats);
    }
}
```

- [ ] **Step 3: Add the stats-rendering helpers to the same module**

Append these functions to `src/ui/game-shell-renderer.js`:

```js
function updatePlayerStatsDisplay({ player, t, getOpponentProfile }) {
    if (!player) return;

    const statsEl = document.getElementById(`stats-${player.id}`);
    if (!statsEl) return;

    const profile = getOpponentProfile(player);
    const hands = player.stats.handsPlayed;

    statsEl.innerHTML = `
        <div class="stat-row"><span class="stat-label">${t('statsHands')}</span><span class="stat-value">${hands}</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsVPIP')}</span><span class="stat-value">${(profile.vpip * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsPFR')}</span><span class="stat-value">${(profile.pfr * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('stats3Bet')}</span><span class="stat-value">${(profile.threeBet * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsCBet')}</span><span class="stat-value">${(profile.cBet * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsFoldToCBet')}</span><span class="stat-value">${(profile.foldToCBet * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsShowdown')}</span><span class="stat-value">${(profile.showdownRate * 100).toFixed(0)}%</span></div>
    `;
}

export function updateAllPlayerStatsDisplays({ players, t, getOpponentProfile }) {
    for (const player of players) {
        updatePlayerStatsDisplay({ player, t, getOpponentProfile });
    }
}
```

- [ ] **Step 4: Run a syntax check on the new shell renderer module**

Run: `node --check src/ui/game-shell-renderer.js`
Expected: PASS with no output

- [ ] **Step 5: Commit the shell renderer module**

```bash
git add src/ui/game-shell-renderer.js
git commit -m "refactor: extract game shell renderer"
```

### Task 2: Wire the Shell Renderer Back Into `game.js`

**Files:**
- Modify: `game.js`
- Test: `src/ui/game-shell-renderer.js`
- Test: `game.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Import the shell renderer helpers into `game.js`**

Add this import block near the existing table UI imports:

```js
import {
    renderHistoryEntries,
    appendHistoryEntry,
    updateHistoryNavigation,
    updatePanelHandNumber,
    clearPanelHandNumber,
    setHelpPopupVisible,
    updateGameModeButton,
    updateStatsToggleButton,
    updateAllPlayerStatsDisplays
} from './src/ui/game-shell-renderer.js';
```

- [ ] **Step 2: Route the history-panel DOM updates through the shell renderer**

Replace the relevant `game.js` sections with these versions:

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

// Inside startNewGame(), replace the hand-history reset section with:
handNumber++;
currentViewingHand = handNumber;
handHistories[handNumber - 1] = [];

renderHistoryEntries([]);
updatePanelHandNumber({
    currentLanguage,
    currentViewingHand,
    handNumber,
    t
});
updateHistoryNavigation({ currentViewingHand, handNumber });

// Later in the same function, replace the stats refresh call with:
updateAllPlayerStatsDisplays({
    players: gameState.players,
    t,
    getOpponentProfile
});

function resetAndStartNewGame() {
    const now = Date.now();
    if (now - lastNewGameClickTime < NEW_GAME_DEBOUNCE_MS) {
        return;
    }
    lastNewGameClickTime = now;

    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) {
        newGameBtn.classList.add('cooldown');

        let secondsRemaining = Math.ceil(NEW_GAME_DEBOUNCE_MS / 1000);
        newGameBtn.textContent = `${t('newGame')} (${secondsRemaining})`;

        if (cooldownIntervalId) {
            clearInterval(cooldownIntervalId);
        }

        cooldownIntervalId = setInterval(() => {
            secondsRemaining--;
            if (secondsRemaining > 0) {
                newGameBtn.textContent = `${t('newGame')} (${secondsRemaining})`;
            } else {
                newGameBtn.textContent = t('newGame');
                newGameBtn.classList.remove('cooldown');
                clearInterval(cooldownIntervalId);
                cooldownIntervalId = null;
            }
        }, 1000);
    }

    document.getElementById('winner-popup').classList.remove('visible');
    for (const player of gameState.players) {
        player.chips = STARTING_CHIPS;
    }

    handNumber = 0;
    handHistories = [];
    currentViewingHand = 0;

    renderHistoryEntries([]);
    clearPanelHandNumber();

    randomizeAIPortraits();
    showGameElements();
    startNewGame(true);
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

- [ ] **Step 3: Route stats, help-popup, and mode-button updates through the shell renderer**

Replace the relevant `game.js` sections with these versions, then delete the old local DOM helpers they replace:

```js
function updateLanguageUI() {
    const langBtn = document.getElementById('btn-language');
    if (langBtn) {
        langBtn.textContent = currentLanguage === 'en' ? '\u4e2d\u6587' : 'EN';
    }

    const title = document.querySelector('.game-header h1');
    if (title) title.textContent = t('title');

    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn && !newGameBtn.classList.contains('cooldown')) {
        newGameBtn.textContent = t('newGame');
    }

    document.getElementById('btn-fold').textContent = t('fold');
    document.getElementById('btn-check').textContent = t('check');
    document.getElementById('btn-raise').textContent = t('raise');
    document.getElementById('btn-allin').textContent = t('allIn');

    const callBtn = document.getElementById('btn-call');
    const callAmount = document.getElementById('call-amount').textContent;
    callBtn.innerHTML = `${t('call')} $<span id="call-amount">${callAmount}</span>`;

    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) continueBtn.textContent = t('continue');

    const potLabel = document.querySelector('.pot-label');
    if (potLabel) potLabel.textContent = t('pot');

    const historyTitle = document.querySelector('.panel-header');
    if (historyTitle) historyTitle.textContent = t('actionHistory');

    const tableTitle = document.querySelector('.table-title');
    if (tableTitle) tableTitle.textContent = t('tableTitle');

    const helpTitle = document.querySelector('.help-content h2');
    if (helpTitle) helpTitle.textContent = t('helpTitle');

    const helpSubtitle = document.querySelector('.help-subtitle');
    if (helpSubtitle) helpSubtitle.textContent = t('helpSubtitle');

    const helpOkBtn = document.getElementById('btn-help-ok');
    if (helpOkBtn) helpOkBtn.textContent = t('helpOk');

    const handNames = document.querySelectorAll('.hand-rankings-table .hand-name');
    const handDescs = document.querySelectorAll('.hand-rankings-table .hand-desc');
    const handKeys = ['royalFlush', 'straightFlush', 'fourOfAKind', 'fullHouse', 'flush', 'straight', 'threeOfAKind', 'twoPair', 'onePair', 'highCard'];

    handNames.forEach((el, i) => {
        if (handKeys[i]) el.textContent = t(handKeys[i]);
    });

    handDescs.forEach((el, i) => {
        if (handKeys[i]) el.textContent = t(handKeys[i] + 'Desc');
    });

    for (let i = 0; i < gameState.players.length; i++) {
        const player = gameState.players[i];
        const nameEl = document.querySelector(`#player-${i} .player-name`);
        if (nameEl) {
            nameEl.textContent = i === 0 ? t('you') : `${t('aiPlayer')} ${i}`;
        }

        if (player.isAI) {
            const levelEl = document.getElementById(`level-${player.id}`);
            if (levelEl) {
                levelEl.textContent = `(${t(player.aiLevel)})`;
                levelEl.title = t('changeDifficulty');
            }

            const removeBtn = document.querySelector(`#player-${player.id} .btn-remove`);
            if (removeBtn) removeBtn.title = t('removeAI');

            const plusSign = document.querySelector(`#player-${player.id} .player-add-plus`);
            if (plusSign) plusSign.title = t('addAI');
        }
    }

    const btnPrev = document.getElementById('btn-prev-hand');
    const btnReturn = document.getElementById('btn-return-hand');
    const btnNext = document.getElementById('btn-next-hand');
    if (btnPrev) btnPrev.textContent = t('previous');
    if (btnReturn) btnReturn.textContent = t('returnText');
    if (btnNext) btnNext.textContent = t('next');

    const cursorSelect = document.getElementById('cursor-select');
    if (cursorSelect) {
        const options = cursorSelect.querySelectorAll('option');
        options.forEach(option => {
            const value = option.value;
            const key = 'cursor' + value.charAt(0).toUpperCase() + value.slice(1);
            option.textContent = t(key);
        });
    }

    const btnHalfPot = document.getElementById('btn-half-pot');
    const btnOnePot = document.getElementById('btn-one-pot');
    const btnTwoPot = document.getElementById('btn-two-pot');
    if (btnHalfPot) btnHalfPot.textContent = t('halfPot');
    if (btnOnePot) btnOnePot.textContent = t('onePot');
    if (btnTwoPot) btnTwoPot.textContent = t('twoPot');

    updateGameModeButton({ gameMode, t });
    updatePanelHandNumber({
        currentLanguage,
        currentViewingHand,
        handNumber,
        t
    });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });

    clearHighlightHumanBestHand();
    highlightHumanBestHand(gameState, { translateHandName });

    const onlineCountEl = document.getElementById('online-count');
    if (onlineCountEl && onlineCountEl.dataset.count) {
        onlineCountEl.textContent = `\uD83D\uDC65 ${t('onlineUsers')}: ${onlineCountEl.dataset.count}`;
    }
}

function toggleShowAllStats() {
    showAllStats = !showAllStats;
    localStorage.setItem('showAllStats', showAllStats);
    updateStatsToggleButton({ showAllStats });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });
}

function toggleGameMode() {
    gameMode = gameMode === 'fast' ? 'slow' : 'fast';
    localStorage.setItem('pokerGameMode', gameMode);
    updateGameModeButton({ gameMode, t });
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
}

export function bootGame() {
    if (hasGameBooted) {
        return;
    }

    initPlayers();
    SoundManager.init();
    initOnlineCount();
    hideGameElements();
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    updateLanguageUI();
    showMessage(t('startMessage'));
    updateStatsToggleButton({ showAllStats });

    hasGameBooted = true;
}
```

Delete these replaced local DOM helpers from `game.js` once the imports and callsites are wired:

```js
function updateHandNumberDisplay() {}
function updatePlayerStatsDisplay(playerId) {}
function updateAllPlayerStatsDisplays() {}
function updateHistoryNavigation() {}
function updateGameModeUI() {}
```

Keep `getOpponentProfile()` in `game.js`; the renderer should receive it as a callback, not own AI/stats logic.

- [ ] **Step 4: Run automated verification after wiring the shell renderer**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-shell-renderer.js`
Expected: PASS with no output

Run: `npm test`
Expected: PASS with the current 16 passing tests

- [ ] **Step 5: Commit the shell renderer wiring**

```bash
git add game.js
git commit -m "refactor: wire game shell renderer"
```

### Task 3: Extract Shell Event Binding

**Files:**
- Create: `src/ui/game-shell-events.js`
- Modify: `game.js`
- Test: `src/ui/game-shell-events.js`
- Test: `src/ui/game-shell-renderer.js`
- Test: `game.js`
- Test: `src/main.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Run a syntax check before the events file exists**

Run: `node --check src/ui/game-shell-events.js`
Expected: FAIL with a missing-file error because the shell events module does not exist yet

- [ ] **Step 2: Create `src/ui/game-shell-events.js`**

Create the file with this exact public interface:

```js
export function bindGameShellEvents({
    onNavigateHistory,
    onReturnToCurrentHand,
    onOpenHelp,
    onCloseHelp,
    onToggleLanguage,
    onToggleGameMode,
    onToggleStats
}) {
    document.getElementById('btn-prev-hand').addEventListener('click', () => {
        onNavigateHistory(-1);
    });

    document.getElementById('btn-next-hand').addEventListener('click', () => {
        onNavigateHistory(1);
    });

    document.getElementById('btn-return-hand').addEventListener('click', onReturnToCurrentHand);

    document.getElementById('help-link').addEventListener('click', event => {
        event.preventDefault();
        onOpenHelp();
    });

    document.getElementById('btn-help-ok').addEventListener('click', onCloseHelp);

    document.getElementById('help-popup').addEventListener('click', event => {
        if (event.target.id === 'help-popup') {
            onCloseHelp();
        }
    });

    document.getElementById('btn-language').addEventListener('click', onToggleLanguage);
    document.getElementById('btn-mode').addEventListener('click', onToggleGameMode);
    document.getElementById('btn-stats-toggle').addEventListener('click', onToggleStats);
}
```

- [ ] **Step 3: Compose the new shell event module from `bindGameEventListeners()` in `game.js`**

Add this import:

```js
import { bindGameShellEvents } from './src/ui/game-shell-events.js';
```

Then replace the inline shell-area bindings in `bindGameEventListeners()` with:

```js
export function bindGameEventListeners() {
    if (areGameEventListenersBound) {
        return;
    }

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

    bindGameShellEvents({
        onNavigateHistory: direction => {
            navigateToHand(direction);
        },
        onReturnToCurrentHand: returnToCurrentHand,
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

    cursorTrailContainer = document.getElementById('cursor-trail');

    const cursorSelect = document.getElementById('cursor-select');
    if (cursorSelect) {
        cursorSelect.value = currentCursorEffect;
        cursorSelect.addEventListener('change', event => {
            currentCursorEffect = event.target.value;
            localStorage.setItem('cursorEffect', currentCursorEffect);
            if (cursorTrailContainer) {
                cursorTrailContainer.innerHTML = '';
            }
            particleCount = 0;
        });
    }

    document.addEventListener('mousemove', handleCursorMouseMove);

    areGameEventListenersBound = true;
}
```

Keep cursor-select binding and global mousemove binding inline in `game.js` for this phase.

- [ ] **Step 4: Run automated verification after extracting the shell events module**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-shell-renderer.js`
Expected: PASS with no output

Run: `node --check src/ui/game-shell-events.js`
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
3. Confirm hole-card dealing, community-card dealing, and table controls still behave as they did after phase 2.
4. Confirm action-history entries still append while viewing the current hand.
5. Confirm `Previous`, `Next`, and `Return` still navigate history correctly.
6. Confirm the panel hand-number display switches correctly between current-hand and past-hand formats.
7. Confirm the help popup still opens from the help link and closes from both the `OK` button and overlay click.
8. Confirm language toggle still updates shell text, stats tooltip labels, and the panel hand-number display.
9. Confirm mode toggle still updates the mode button and player mode classes.
10. Confirm stats toggle still updates the button active state and stats tooltip content.

- [ ] **Step 6: Commit the shell event extraction**

```bash
git add game.js src/ui/game-shell-events.js
git commit -m "refactor: extract game shell events"
```
