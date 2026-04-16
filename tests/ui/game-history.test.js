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
