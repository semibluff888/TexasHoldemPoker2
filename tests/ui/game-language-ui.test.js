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
