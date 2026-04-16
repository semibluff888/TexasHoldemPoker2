# Phase 8 Language UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract browser-side language state and language-refresh orchestration from `game.js` into a focused UI module while preserving translation behavior, visible UI text, gameplay flow, and online-count polling behavior.

**Architecture:** Introduce `src/ui/game-language-ui.js` as a browser-side orchestration module that owns `currentLanguage`, translator creation, `toggleLanguage()`, and the existing `updateLanguageUI()` DOM-refresh flow. Keep `src/i18n/game-translations.js` as the pure translation layer, keep `game.js` as the gameplay/orchestration entry point, and leave `/api/heartbeat` polling in `game.js` while allowing the new module to refresh the already-cached online-count label text.

**Tech Stack:** Vanilla JavaScript ES modules, browser DOM APIs, existing `src/ui/` modules, Node built-in test runner via `node --test`, `node --check`, `npm test`, manual browser verification over static HTTP

---

## File Structure

- `src/ui/game-language-ui.js`
  Responsibility: Own live language state, translator helper creation, language-toggle persistence, and translated DOM refresh orchestration while delegating subsystem-specific refresh work to existing UI modules.
- `tests/ui/game-language-ui.test.js`
  Responsibility: Cover the new language UI module in Node using lightweight DOM and `localStorage` stubs, including initial language loading, direct label refresh, player/history/cursor/stats refresh, best-hand label refresh, cached online-count refresh, and toggle persistence.
- `game.js`
  Responsibility after this phase: Keep gameplay, AI, betting, showdown, and heartbeat polling orchestration; instantiate the language UI module; keep using `t()`, `translateHandName()`, and `getTranslatedPlayerName()` for gameplay text; stop owning `currentLanguage`, `toggleLanguage()`, and `updateLanguageUI()`.

No new DOM-test framework is introduced in this phase. Verification remains targeted `node --test`, `node --check`, the existing `npm test` suite, and manual browser smoke verification over static HTTP.

### Task 1: Add the Game Language UI Module and Its Node Tests

**Files:**
- Create: `src/ui/game-language-ui.js`
- Create: `tests/ui/game-language-ui.test.js`
- Test: `tests/ui/game-language-ui.test.js`
- Test: `src/ui/game-language-ui.js`

- [ ] **Step 1: Write the failing language-UI test file**

Create `tests/ui/game-language-ui.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { TRANSLATIONS } from '../../src/i18n/game-translations.js';
import { gameHistory } from '../../src/ui/game-history.js';
import { createGameLanguageUI } from '../../src/ui/game-language-ui.js';

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

function restoreGlobal(name, originalValue) {
    if (originalValue === undefined) {
        delete globalThis[name];
        return;
    }

    globalThis[name] = originalValue;
}

function createClassListHarness(initialClasses = []) {
    const classes = new Set(initialClasses);

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

function createBasicElement({ classes = [] } = {}) {
    return {
        textContent: '',
        innerHTML: '',
        title: '',
        disabled: false,
        value: '',
        dataset: {},
        classList: createClassListHarness(classes)
    };
}

function createStorageHarness(initialValues = {}) {
    const store = new Map(Object.entries(initialValues));

    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        }
    };
}

function createCardElement(card) {
    return {
        classList: createClassListHarness(),
        querySelector(selector) {
            if (selector === '.card-value') {
                return { textContent: card.value };
            }

            if (selector === '.card-suit') {
                return { textContent: card.suit };
            }

            return null;
        }
    };
}

function createCardContainer(cards) {
    const cardElements = cards.map(createCardElement);

    return {
        cards: cardElements,
        handRankName: null,
        querySelectorAll(selector) {
            if (selector === '.card') {
                return cardElements;
            }

            return [];
        },
        appendChild(node) {
            node.parentNode = this;
            if (node.className === 'hand-rank-name') {
                this.handRankName = node;
            }
        }
    };
}

function createDocumentHarness({
    callAmount = '25',
    onlineCount = '7',
    newGameCooldown = false
} = {}) {
    const titleEl = createBasicElement();
    const newGameBtn = createBasicElement({
        classes: newGameCooldown ? ['cooldown'] : []
    });
    const langBtn = createBasicElement();
    const foldBtn = createBasicElement();
    const checkBtn = createBasicElement();
    const callBtn = createBasicElement();
    const callAmountEl = createBasicElement();
    callAmountEl.textContent = callAmount;
    const raiseBtn = createBasicElement();
    const allInBtn = createBasicElement();
    const continueBtn = createBasicElement();
    const potLabel = createBasicElement();
    const historyTitle = createBasicElement();
    const tableTitle = createBasicElement();
    const helpTitle = createBasicElement();
    const helpSubtitle = createBasicElement();
    const helpOkBtn = createBasicElement();
    const prevBtn = createBasicElement();
    const returnBtn = createBasicElement();
    const nextBtn = createBasicElement();
    const halfPotBtn = createBasicElement();
    const onePotBtn = createBasicElement();
    const twoPotBtn = createBasicElement();
    const panelHandNumber = createBasicElement();
    const modeBtn = createBasicElement();
    const onlineCountEl = createBasicElement();
    onlineCountEl.dataset.count = onlineCount;
    const stats0 = createBasicElement();
    const stats1 = createBasicElement();

    const handNameEls = Array.from({ length: 10 }, () => createBasicElement());
    const handDescEls = Array.from({ length: 10 }, () => createBasicElement());

    const playerNameEls = new Map([
        [0, createBasicElement()],
        [1, createBasicElement()]
    ]);
    const levelEls = new Map([
        [1, createBasicElement()]
    ]);
    const removeBtns = new Map([
        [1, createBasicElement()]
    ]);
    const plusSigns = new Map([
        [1, createBasicElement()]
    ]);

    const cursorOptions = [
        { value: 'sparkle', textContent: '' },
        { value: 'comet', textContent: '' },
        { value: 'bubble', textContent: '' },
        { value: 'none', textContent: '' }
    ];

    const cursorSelect = {
        ...createBasicElement(),
        value: 'sparkle',
        querySelectorAll(selector) {
            return selector === 'option' ? cursorOptions : [];
        }
    };

    const humanCardsEl = createCardContainer([
        { value: 'A', suit: 'S' },
        { value: 'A', suit: 'H' }
    ]);
    const communityCardsEl = createCardContainer([
        { value: 'A', suit: 'D' },
        { value: 'K', suit: 'C' },
        { value: 'Q', suit: 'S' }
    ]);

    const byId = {
        'btn-language': langBtn,
        'btn-new-game': newGameBtn,
        'btn-fold': foldBtn,
        'btn-check': checkBtn,
        'btn-call': callBtn,
        'call-amount': callAmountEl,
        'btn-raise': raiseBtn,
        'btn-allin': allInBtn,
        'btn-continue': continueBtn,
        'btn-help-ok': helpOkBtn,
        'btn-prev-hand': prevBtn,
        'btn-return-hand': returnBtn,
        'btn-next-hand': nextBtn,
        'btn-half-pot': halfPotBtn,
        'btn-one-pot': onePotBtn,
        'btn-two-pot': twoPotBtn,
        'panel-hand-number': panelHandNumber,
        'btn-mode': modeBtn,
        'cursor-select': cursorSelect,
        'online-count': onlineCountEl,
        'stats-0': stats0,
        'stats-1': stats1,
        'level-1': levelEls.get(1),
        'cards-0': humanCardsEl,
        'community-cards': communityCardsEl
    };

    return {
        titleEl,
        newGameBtn,
        langBtn,
        callBtn,
        callAmountEl,
        historyTitle,
        helpTitle,
        helpSubtitle,
        helpOkBtn,
        prevBtn,
        returnBtn,
        nextBtn,
        panelHandNumber,
        cursorOptions,
        modeBtn,
        onlineCountEl,
        stats0,
        stats1,
        playerNameEls,
        levelEls,
        removeBtns,
        plusSigns,
        humanCardsEl,
        communityCardsEl,
        getElementById(id) {
            return byId[id] || null;
        },
        querySelector(selector) {
            if (selector === '.game-header h1') return titleEl;
            if (selector === '.pot-label') return potLabel;
            if (selector === '.panel-header') return historyTitle;
            if (selector === '.table-title') return tableTitle;
            if (selector === '.help-content h2') return helpTitle;
            if (selector === '.help-subtitle') return helpSubtitle;
            if (selector === '.hand-rank-name') return communityCardsEl.handRankName;

            let match = selector.match(/^#player-(\d+) \.player-name$/);
            if (match) {
                return playerNameEls.get(Number(match[1])) || null;
            }

            match = selector.match(/^#player-(\d+) \.btn-remove$/);
            if (match) {
                return removeBtns.get(Number(match[1])) || null;
            }

            match = selector.match(/^#player-(\d+) \.player-add-plus$/);
            if (match) {
                return plusSigns.get(Number(match[1])) || null;
            }

            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.hand-rankings-table .hand-name') {
                return handNameEls;
            }

            if (selector === '.hand-rankings-table .hand-desc') {
                return handDescEls;
            }

            if (selector === '.card.highlight') {
                return [...humanCardsEl.cards, ...communityCardsEl.cards].filter(card =>
                    card.classList.contains('highlight')
                );
            }

            return [];
        },
        createElement(tagName) {
            assert.equal(tagName, 'div');

            return {
                className: '',
                textContent: '',
                parentNode: null,
                remove() {
                    if (this.parentNode && this.parentNode.handRankName === this) {
                        this.parentNode.handRankName = null;
                    }

                    this.parentNode = null;
                }
            };
        }
    };
}

function createGameStateHarness() {
    return {
        phase: 'flop',
        communityCards: [
            { value: 'A', suit: 'D' },
            { value: 'K', suit: 'C' },
            { value: 'Q', suit: 'S' }
        ],
        players: [
            {
                id: 0,
                isAI: false,
                isRemoved: false,
                folded: false,
                aiLevel: null,
                cards: [
                    { value: 'A', suit: 'S' },
                    { value: 'A', suit: 'H' }
                ],
                stats: { handsPlayed: 12 }
            },
            {
                id: 1,
                isAI: true,
                isRemoved: false,
                folded: false,
                aiLevel: 'medium',
                cards: [
                    { value: 'K', suit: 'S' },
                    { value: 'Q', suit: 'D' }
                ],
                stats: { handsPlayed: 9 }
            }
        ]
    };
}

function createOpponentProfile() {
    return {
        vpip: 0.25,
        pfr: 0.2,
        threeBet: 0.1,
        cBet: 0.5,
        foldToCBet: 0.4,
        showdownRate: 0.3
    };
}

test('createGameLanguageUI() loads the stored language and exposes translator helpers', () => {
    const originalLocalStorage = globalThis.localStorage;

    try {
        globalThis.localStorage = createStorageHarness({
            pokerLanguage: 'zh'
        });

        const gameLanguageUI = createGameLanguageUI({
            getGameState: () => createGameStateHarness(),
            getGameMode: () => 'fast',
            getOpponentProfile: createOpponentProfile
        });

        assert.equal(gameLanguageUI.getCurrentLanguage(), 'zh');
        assert.equal(gameLanguageUI.t('newGame'), TRANSLATIONS.zh.newGame);
        assert.equal(gameLanguageUI.translateHandName('Royal Flush'), TRANSLATIONS.zh.royalFlush);
        assert.equal(
            gameLanguageUI.getTranslatedPlayerName({ id: 3 }),
            `${TRANSLATIONS.zh.aiPlayer} 3`
        );
    } finally {
        restoreGlobal('localStorage', originalLocalStorage);
    }
});

test('syncUI() refreshes direct labels and preserves the current call amount and cached online count', () => {
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalHistoryState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness({
        callAmount: '25',
        onlineCount: '7'
    });

    try {
        globalThis.document = documentHarness;
        globalThis.localStorage = createStorageHarness({
            pokerLanguage: 'en'
        });

        gameHistory.handNumber = 0;
        gameHistory.handHistories = [];
        gameHistory.currentViewingHand = 0;

        const gameLanguageUI = createGameLanguageUI({
            getGameState: () => createGameStateHarness(),
            getGameMode: () => 'fast',
            getOpponentProfile: createOpponentProfile
        });

        gameLanguageUI.syncUI();

        assert.equal(documentHarness.langBtn.textContent, '\u4e2d\u6587');
        assert.equal(documentHarness.newGameBtn.textContent, TRANSLATIONS.en.newGame);
        assert.equal(
            documentHarness.callBtn.innerHTML,
            `${TRANSLATIONS.en.call} $<span id="call-amount">25</span>`
        );
        assert.equal(documentHarness.historyTitle.textContent, TRANSLATIONS.en.actionHistory);
        assert.equal(documentHarness.helpTitle.textContent, TRANSLATIONS.en.helpTitle);
        assert.equal(documentHarness.prevBtn.textContent, TRANSLATIONS.en.previous);
        assert.equal(documentHarness.modeBtn.textContent, TRANSLATIONS.en.fastMode);
        assert.equal(
            documentHarness.onlineCountEl.textContent,
            `\uD83D\uDFE2 ${TRANSLATIONS.en.onlineUsers}: 7`
        );
    } finally {
        restoreGlobal('document', originalDocument);
        restoreGlobal('localStorage', originalLocalStorage);
        restoreGameHistoryState(originalHistoryState);
    }
});

test('syncUI() refreshes player labels, history panel text, cursor labels, stats, and the best-hand label', () => {
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalHistoryState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness();

    try {
        globalThis.document = documentHarness;
        globalThis.localStorage = createStorageHarness({
            pokerLanguage: 'en'
        });

        gameHistory.handNumber = 3;
        gameHistory.handHistories = [[], [], []];
        gameHistory.currentViewingHand = 2;

        const gameLanguageUI = createGameLanguageUI({
            getGameState: () => createGameStateHarness(),
            getGameMode: () => 'fast',
            getOpponentProfile: createOpponentProfile
        });

        gameLanguageUI.syncUI();

        assert.equal(documentHarness.playerNameEls.get(0).textContent, TRANSLATIONS.en.you);
        assert.equal(documentHarness.playerNameEls.get(1).textContent, `${TRANSLATIONS.en.aiPlayer} 1`);
        assert.equal(documentHarness.levelEls.get(1).textContent, `(${TRANSLATIONS.en.medium})`);
        assert.equal(documentHarness.levelEls.get(1).title, TRANSLATIONS.en.changeDifficulty);
        assert.equal(documentHarness.removeBtns.get(1).title, TRANSLATIONS.en.removeAI);
        assert.equal(documentHarness.plusSigns.get(1).title, TRANSLATIONS.en.addAI);
        assert.equal(documentHarness.panelHandNumber.textContent, 'Hand #2 of 3');
        assert.equal(documentHarness.cursorOptions[0].textContent, TRANSLATIONS.en.cursorSparkle);
        assert.equal(documentHarness.stats1.innerHTML.includes(TRANSLATIONS.en.statsHands), true);
        assert.equal(documentHarness.communityCardsEl.handRankName.textContent, TRANSLATIONS.en.threeOfAKind);
    } finally {
        restoreGlobal('document', originalDocument);
        restoreGlobal('localStorage', originalLocalStorage);
        restoreGameHistoryState(originalHistoryState);
    }
});

test('toggleLanguage() persists the next language and updates live translator helpers without recreating the module', () => {
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalHistoryState = snapshotGameHistoryState();
    const documentHarness = createDocumentHarness({
        onlineCount: '9'
    });

    try {
        globalThis.document = documentHarness;
        globalThis.localStorage = createStorageHarness({
            pokerLanguage: 'en'
        });

        gameHistory.handNumber = 1;
        gameHistory.handHistories = [[]];
        gameHistory.currentViewingHand = 1;

        const gameLanguageUI = createGameLanguageUI({
            getGameState: () => createGameStateHarness(),
            getGameMode: () => 'fast',
            getOpponentProfile: createOpponentProfile
        });

        gameLanguageUI.toggleLanguage();

        assert.equal(gameLanguageUI.getCurrentLanguage(), 'zh');
        assert.equal(globalThis.localStorage.getItem('pokerLanguage'), 'zh');
        assert.equal(gameLanguageUI.t('newGame'), TRANSLATIONS.zh.newGame);
        assert.equal(gameLanguageUI.translateHandName('Royal Flush'), TRANSLATIONS.zh.royalFlush);
        assert.equal(
            gameLanguageUI.getTranslatedPlayerName({ id: 2 }),
            `${TRANSLATIONS.zh.aiPlayer} 2`
        );
        assert.equal(documentHarness.langBtn.textContent, 'EN');
        assert.equal(
            documentHarness.onlineCountEl.textContent,
            `\uD83D\uDFE2 ${TRANSLATIONS.zh.onlineUsers}: 9`
        );
    } finally {
        restoreGlobal('document', originalDocument);
        restoreGlobal('localStorage', originalLocalStorage);
        restoreGameHistoryState(originalHistoryState);
    }
});
```

- [ ] **Step 2: Run the targeted test to verify it fails before the module exists**

Run: `node --test tests/ui/game-language-ui.test.js`
Expected: FAIL with an `ERR_MODULE_NOT_FOUND` error for `src/ui/game-language-ui.js`

- [ ] **Step 3: Create `src/ui/game-language-ui.js` with live language state, translator wiring, and UI sync orchestration**

Create `src/ui/game-language-ui.js` with this exact content:

```js
import {
    clearHighlightHumanBestHand,
    highlightHumanBestHand
} from './game-table-renderer.js';
import {
    updateGameModeButton,
    updateAllPlayerStatsDisplays
} from './game-shell-renderer.js';
import { gameCursorEffects } from './game-cursor-effects.js';
import { gameHistory } from './game-history.js';
import { createGameTranslator } from '../i18n/game-translations.js';

const LANGUAGE_STORAGE_KEY = 'pokerLanguage';

export function createGameLanguageUI({
    getGameState,
    getGameMode,
    getOpponentProfile
}) {
    let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';

    const {
        t,
        translateHandName,
        getTranslatedPlayerName
    } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    function getCurrentLanguage() {
        return currentLanguage;
    }

    function syncUI() {
        const gameState = getGameState();
        const gameMode = getGameMode();

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

        handNames.forEach((element, index) => {
            if (handKeys[index]) {
                element.textContent = t(handKeys[index]);
            }
        });
        handDescs.forEach((element, index) => {
            if (handKeys[index]) {
                element.textContent = t(`${handKeys[index]}Desc`);
            }
        });

        for (let index = 0; index < gameState.players.length; index++) {
            const player = gameState.players[index];
            const nameEl = document.querySelector(`#player-${index} .player-name`);

            if (nameEl) {
                nameEl.textContent = getTranslatedPlayerName(player);
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

        gameCursorEffects.syncLabels({ t });

        const btnHalfPot = document.getElementById('btn-half-pot');
        const btnOnePot = document.getElementById('btn-one-pot');
        const btnTwoPot = document.getElementById('btn-two-pot');
        if (btnHalfPot) btnHalfPot.textContent = t('halfPot');
        if (btnOnePot) btnOnePot.textContent = t('onePot');
        if (btnTwoPot) btnTwoPot.textContent = t('twoPot');

        updateGameModeButton({ gameMode, t });
        gameHistory.syncPanel({ currentLanguage, t });
        updateAllPlayerStatsDisplays({
            players: gameState.players,
            t,
            getOpponentProfile
        });

        clearHighlightHumanBestHand();
        highlightHumanBestHand(gameState, { translateHandName });

        const onlineCountEl = document.getElementById('online-count');
        if (onlineCountEl && onlineCountEl.dataset.count) {
            onlineCountEl.textContent = `\uD83D\uDFE2 ${t('onlineUsers')}: ${onlineCountEl.dataset.count}`;
        }
    }

    function toggleLanguage() {
        currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
        localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
        syncUI();
    }

    return {
        t,
        translateHandName,
        getTranslatedPlayerName,
        getCurrentLanguage,
        toggleLanguage,
        syncUI
    };
}
```

- [ ] **Step 4: Run syntax and the targeted Node test after creating the module**

Run: `node --check src/ui/game-language-ui.js`
Expected: PASS with no output

Run: `node --test tests/ui/game-language-ui.test.js`
Expected: PASS with `4` passing tests

- [ ] **Step 5: Commit the new language UI module and its tests**

```bash
git add src/ui/game-language-ui.js tests/ui/game-language-ui.test.js
git commit -m "refactor: add game language ui module"
```

### Task 2: Wire `game.js` to the Language UI Module and Run Full Verification

**Files:**
- Modify: `game.js`
- Test: `game.js`
- Test: `src/ui/game-language-ui.js`
- Test: `src/main.js`
- Test: `src/ui/game-history.js`
- Test: `src/ui/game-cursor-effects.js`
- Test: `src/ui/game-shell-renderer.js`
- Test: `src/ui/game-table-renderer.js`
- Test: `tests/ui/game-language-ui.test.js`
- Test: `tests/ui/game-history.test.js`
- Test: `tests/ui/game-cursor-effects.test.js`
- Test: `tests/i18n/game-translations.test.js`
- Test: `tests/ui/game-audio.test.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Replace the inline translation-state import and add the new UI-module import**

At the top of `game.js`, replace the current table-renderer import block:

```js
import {
    updatePlayerCards,
    updatePlayerCardsAnimated,
    updateCommunityCards,
    clearHighlightHumanBestHand,
    highlightHumanBestHand,
    updateUI,
    clearWinnerHighlights,
    hideGameElements,
    showGameElements
} from './src/ui/game-table-renderer.js';
```

with:

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

Replace the current shell-renderer import block:

```js
import {
    setHelpPopupVisible,
    updateGameModeButton,
    updateStatsToggleButton,
    updateAllPlayerStatsDisplays
} from './src/ui/game-shell-renderer.js';
```

with:

```js
import {
    setHelpPopupVisible,
    updateStatsToggleButton
} from './src/ui/game-shell-renderer.js';
```

Then replace:

```js
import { createGameTranslator } from './src/i18n/game-translations.js';
```

with:

```js
import { createGameLanguageUI } from './src/ui/game-language-ui.js';
```

This keeps only the imports still owned by `game.js` after the language UI
module takes over the refresh orchestration.

- [ ] **Step 2: Remove the inline language system block and instantiate the language UI module next to game-state setup**

Delete this entire block from `game.js`:

```js
// ===== Language System =====
let currentLanguage = localStorage.getItem('pokerLanguage') || 'en';

const {
    t,
    translateHandName,
    getTranslatedPlayerName
} = createGameTranslator({
    getLanguage: () => currentLanguage
});

// Switch language
function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
    localStorage.setItem('pokerLanguage', currentLanguage);
    updateLanguageUI();
}

// Update all UI text to current language
function updateLanguageUI() {
    // Update language button
    const langBtn = document.getElementById('btn-language');
    if (langBtn) {
        langBtn.textContent = currentLanguage === 'en' ? '\u4e2d\u6587' : 'EN';
    }

    // Update title
    const title = document.querySelector('.game-header h1');
    if (title) title.textContent = t('title');

    // Update NEW GAME button
    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn && !newGameBtn.classList.contains('cooldown')) {
        newGameBtn.textContent = t('newGame');
    }

    // Update betting buttons
    document.getElementById('btn-fold').textContent = t('fold');
    document.getElementById('btn-check').textContent = t('check');
    document.getElementById('btn-raise').textContent = t('raise');
    document.getElementById('btn-allin').textContent = t('allIn');

    // Call button has dynamic amount
    const callBtn = document.getElementById('btn-call');
    const callAmount = document.getElementById('call-amount').textContent;
    callBtn.innerHTML = `${t('call')} $<span id="call-amount">${callAmount}</span>`;

    // Update Continue button
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) continueBtn.textContent = t('continue');

    // Update pot label
    const potLabel = document.querySelector('.pot-label');
    if (potLabel) potLabel.textContent = t('pot');

    // Update action history title
    const historyTitle = document.querySelector('.panel-header');
    if (historyTitle) historyTitle.textContent = t('actionHistory');

    // Update table title
    const tableTitle = document.querySelector('.table-title');
    if (tableTitle) tableTitle.textContent = t('tableTitle');

    // Update help popup
    const helpTitle = document.querySelector('.help-content h2');
    if (helpTitle) helpTitle.textContent = t('helpTitle');

    const helpSubtitle = document.querySelector('.help-subtitle');
    if (helpSubtitle) helpSubtitle.textContent = t('helpSubtitle');

    const helpOkBtn = document.getElementById('btn-help-ok');
    if (helpOkBtn) helpOkBtn.textContent = t('helpOk');

    // Update help popup hand rankings table
    const handNames = document.querySelectorAll('.hand-rankings-table .hand-name');
    const handDescs = document.querySelectorAll('.hand-rankings-table .hand-desc');
    const handKeys = ['royalFlush', 'straightFlush', 'fourOfAKind', 'fullHouse', 'flush', 'straight', 'threeOfAKind', 'twoPair', 'onePair', 'highCard'];

    handNames.forEach((el, i) => {
        if (handKeys[i]) el.textContent = t(handKeys[i]);
    });
    handDescs.forEach((el, i) => {
        if (handKeys[i]) el.textContent = t(handKeys[i] + 'Desc');
    });

    // Update player names
    for (let i = 0; i < gameState.players.length; i++) {
        const player = gameState.players[i];
        const nameEl = document.querySelector(`#player-${i} .player-name`);
        if (nameEl) {
            nameEl.textContent = getTranslatedPlayerName(player);
        }

        // Update level label if it's an AI
        if (player.isAI) {
            const levelEl = document.getElementById(`level-${player.id}`);
            if (levelEl) {
                levelEl.textContent = `(${t(player.aiLevel)})`;
                levelEl.title = t('changeDifficulty');
            }

            // Update Remove AI button tooltip
            const removeBtn = document.querySelector(`#player-${player.id} .btn-remove`);
            if (removeBtn) removeBtn.title = t('removeAI');

            // Update Add AI plus sign tooltip
            const plusSign = document.querySelector(`#player-${player.id} .player-add-plus`);
            if (plusSign) plusSign.title = t('addAI');
        }
    }

    // Update action history navigation buttons
    const btnPrev = document.getElementById('btn-prev-hand');
    const btnReturn = document.getElementById('btn-return-hand');
    const btnNext = document.getElementById('btn-next-hand');
    if (btnPrev) btnPrev.textContent = t('previous');
    if (btnReturn) btnReturn.textContent = t('returnText');
    if (btnNext) btnNext.textContent = t('next');

    // Update cursor effect dropdown
    gameCursorEffects.syncLabels({ t });

    // Update pot preset buttons
    const btnHalfPot = document.getElementById('btn-half-pot');
    const btnOnePot = document.getElementById('btn-one-pot');
    const btnTwoPot = document.getElementById('btn-two-pot');
    if (btnHalfPot) btnHalfPot.textContent = t('halfPot');
    if (btnOnePot) btnOnePot.textContent = t('onePot');
    if (btnTwoPot) btnTwoPot.textContent = t('twoPot');

    updateGameModeButton({ gameMode, t });
    gameHistory.syncPanel({ currentLanguage, t });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });

    // Update hand rank name display (for best hand highlight)
    clearHighlightHumanBestHand();
    highlightHumanBestHand(gameState, { translateHandName });

    // Update online count text
    const onlineCountEl = document.getElementById('online-count');
    if (onlineCountEl && onlineCountEl.dataset.count) {
        onlineCountEl.textContent = `\uD83D\uDFE2 ${t('onlineUsers')}: ${onlineCountEl.dataset.count}`;
    }
}
```

Then insert this exact block immediately after:

```js
let gameState = createInitialGameState();
```

Insert:

```js
const gameLanguageUI = createGameLanguageUI({
    getGameState: () => gameState,
    getGameMode: () => gameMode,
    getOpponentProfile
});

const {
    t,
    translateHandName,
    getTranslatedPlayerName,
    getCurrentLanguage
} = gameLanguageUI;
```

This keeps the translator helper names stable for the rest of `game.js`, while
moving language-state ownership out of the file.

- [ ] **Step 3: Replace the remaining `currentLanguage` / language-refresh call sites with the new module surface**

Make these exact replacements in `game.js`.

Inside `startNewGame()`, replace:

```js
    gameHistory.startHand({ currentLanguage, t });
```

with:

```js
    gameHistory.startHand({
        currentLanguage: getCurrentLanguage(),
        t
    });
```

Inside `bindGameShellEvents(...)`, replace:

```js
        onNavigateHistory: direction => {
            gameHistory.navigate(direction, { currentLanguage, t });
        },
        onReturnToCurrentHand: () => {
            gameHistory.returnToCurrent({ currentLanguage, t });
        },
```

with:

```js
        onNavigateHistory: direction => {
            gameHistory.navigate(direction, {
                currentLanguage: getCurrentLanguage(),
                t
            });
        },
        onReturnToCurrentHand: () => {
            gameHistory.returnToCurrent({
                currentLanguage: getCurrentLanguage(),
                t
            });
        },
```

In the same `bindGameShellEvents(...)` call, replace:

```js
        onToggleLanguage: toggleLanguage,
```

with:

```js
        onToggleLanguage: gameLanguageUI.toggleLanguage,
```

Inside `bootGame()`, replace:

```js
    updateLanguageUI();
```

with:

```js
    gameLanguageUI.syncUI();
```

Do not change `initOnlineCount()` in this phase. It should keep using the live
`t()` helper returned by the new module.

- [ ] **Step 4: Run syntax checks and the targeted language-module test after wiring `game.js`**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-language-ui.js`
Expected: PASS with no output

Run: `node --check src/main.js`
Expected: PASS with no output

Run: `node --check src/ui/game-history.js`
Expected: PASS with no output

Run: `node --check src/ui/game-cursor-effects.js`
Expected: PASS with no output

Run: `node --check src/ui/game-shell-renderer.js`
Expected: PASS with no output

Run: `node --check src/ui/game-table-renderer.js`
Expected: PASS with no output

Run: `node --test tests/ui/game-language-ui.test.js`
Expected: PASS with `4` passing tests

- [ ] **Step 5: Run the full automated suite**

Run: `npm test`
Expected: PASS with `35` passing tests

- [ ] **Step 6: Perform manual browser verification over HTTP**

Run: `python -m http.server 8000`
Expected: a local static server starts at `http://localhost:8000`

Manual checklist:

1. Load `http://localhost:8000` and confirm the page initializes without module import errors.
2. Confirm the initial language still matches the current `localStorage` value for `pokerLanguage`.
3. Click the language toggle before starting a hand and confirm the header, action-history labels, help text, pot controls, and stats labels refresh together.
4. Start a hand and confirm translated player names, AI level labels, and add/remove AI tooltips still refresh correctly after a language toggle.
5. Navigate to a past hand and confirm the panel hand-number text still refreshes in the active language.
6. Confirm the cursor-effect dropdown labels still change language correctly.
7. Reach a visible post-flop best-hand highlight and confirm the hand-rank label refreshes in the active language.
8. Confirm the online-count label changes language while keeping the same numeric count and without triggering visible heartbeat regressions.

- [ ] **Step 7: Commit the `game.js` wiring**

```bash
git add game.js
git commit -m "refactor: wire game language ui"
```
