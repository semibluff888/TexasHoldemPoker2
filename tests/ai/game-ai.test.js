import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BIG_BLIND,
    createDefaultStats,
    createPlayer
} from '../../src/state/game-state.js';
import {
    calculateBetAmount,
    decideAIAction,
    evaluateDraws,
    getHandBucket,
    getHandNotation,
    getOpponentProfile
} from '../../src/ai/game-ai.js';

function createRandomSequence(values) {
    let index = 0;

    return () => {
        const safeIndex = Math.min(index, values.length - 1);
        const value = values[safeIndex];
        index += 1;
        return value;
    };
}

function createGameState(overrides = {}) {
    return {
        phase: 'preflop',
        currentBet: BIG_BLIND,
        minRaise: BIG_BLIND,
        pot: BIG_BLIND * 2,
        dealerIndex: 0,
        communityCards: [],
        players: [],
        ...overrides
    };
}

test('getHandNotation normalizes pairs, suited hands, and offsuit hands', () => {
    assert.equal(
        getHandNotation(
            { value: 'A', suit: '\u2660' },
            { value: 'K', suit: '\u2660' }
        ),
        'AKs'
    );
    assert.equal(
        getHandNotation(
            { value: 'Q', suit: '\u2660' },
            { value: 'J', suit: '\u2665' }
        ),
        'QJo'
    );
    assert.equal(
        getHandNotation(
            { value: '10', suit: '\u2660' },
            { value: '10', suit: '\u2665' }
        ),
        'TT'
    );
});

test('getHandBucket classifies known ranges and falls back to trash', () => {
    assert.equal(
        getHandBucket(
            { value: 'A', suit: '\u2660' },
            { value: 'K', suit: '\u2660' }
        ),
        'premium'
    );
    assert.equal(
        getHandBucket(
            { value: 'K', suit: '\u2660' },
            { value: 'Q', suit: '\u2665' }
        ),
        'strong'
    );
    assert.equal(
        getHandBucket(
            { value: '7', suit: '\u2660' },
            { value: '6', suit: '\u2660' }
        ),
        'speculative'
    );
    assert.equal(
        getHandBucket(
            { value: 'K', suit: '\u2660' },
            { value: '7', suit: '\u2665' }
        ),
        'weak'
    );
    assert.equal(
        getHandBucket(
            { value: '7', suit: '\u2660' },
            { value: '2', suit: '\u2665' }
        ),
        'trash'
    );
});

test('evaluateDraws recognizes flush draws and open-ended straight draws', () => {
    const draws = evaluateDraws(
        [
            { value: '8', suit: '\u2665' },
            { value: '7', suit: '\u2665' }
        ],
        [
            { value: '6', suit: '\u2665' },
            { value: '5', suit: '\u2663' },
            { value: 'K', suit: '\u2665' }
        ]
    );

    assert.equal(draws.flushDraw, true);
    assert.equal(draws.openEndedStraight, true);
    assert.equal(draws.gutshot, false);
    assert.equal(draws.outs, 17);
});

test('getOpponentProfile derives ratios and style flags from accumulated stats', () => {
    const player = createPlayer({
        id: 3,
        stats: {
            ...createDefaultStats(),
            handsPlayed: 10,
            vpipCount: 5,
            pfrCount: 3,
            threeBetCount: 1,
            facedOpenRaiseCount: 2,
            cBetCount: 2,
            cBetOpportunityCount: 4,
            foldToCBetCount: 1,
            cBetFaced: 2,
            showdownCount: 4
        }
    });

    const profile = getOpponentProfile(player);

    assert.equal(profile.vpip, 0.5);
    assert.equal(profile.pfr, 0.3);
    assert.equal(profile.threeBet, 0.5);
    assert.equal(profile.cBet, 0.5);
    assert.equal(profile.foldToCBet, 0.5);
    assert.equal(profile.showdownRate, 0.4);
    assert.equal(profile.isTight, false);
    assert.equal(profile.isLoose, true);
    assert.equal(profile.isAggressive, true);
});

test('calculateBetAmount clamps pot sizing between the minimum raise and the stack cap', () => {
    const gameState = createGameState({
        currentBet: 80,
        minRaise: 40,
        pot: 20,
        players: [
            createPlayer({ id: 0 }),
            createPlayer({ id: 1, chips: 120, bet: 20, isAI: true })
        ]
    });

    assert.equal(
        calculateBetAmount({
            gameState,
            playerId: 1,
            multiplier: 0.5
        }),
        120
    );

    gameState.pot = 1000;

    assert.equal(
        calculateBetAmount({
            gameState,
            playerId: 1,
            multiplier: 2
        }),
        140
    );
});

test('decideAIAction returns a bounded easy-mode raise for premium preflop strength', () => {
    const gameState = createGameState({
        phase: 'preflop',
        currentBet: 40,
        minRaise: 20,
        players: [
            createPlayer({ id: 0, isAI: false }),
            createPlayer({
                id: 1,
                isAI: true,
                aiLevel: 'easy',
                chips: 200,
                bet: 0,
                cards: [
                    { value: 'A', suit: '\u2660' },
                    { value: 'A', suit: '\u2665' }
                ]
            })
        ]
    });

    const action = decideAIAction({
        gameState,
        playerId: 1,
        random: createRandomSequence([0.9, 0.4])
    });

    assert.deepEqual(action, { type: 'raise', totalBet: 80 });
});

test('decideAIAction slow-plays premium preflop hands against aggressive opponents in enhanced mode', () => {
    const gameState = createGameState({
        phase: 'preflop',
        currentBet: 60,
        minRaise: 20,
        players: [
            createPlayer({
                id: 0,
                isAI: false,
                stats: {
                    ...createDefaultStats(),
                    handsPlayed: 10,
                    pfrCount: 4
                }
            }),
            createPlayer({
                id: 1,
                isAI: true,
                aiLevel: 'medium',
                chips: 300,
                bet: 0,
                cards: [
                    { value: 'A', suit: '\u2660' },
                    { value: 'A', suit: '\u2665' }
                ]
            })
        ]
    });

    const action = decideAIAction({
        gameState,
        playerId: 1,
        random: createRandomSequence([0.1])
    });

    assert.deepEqual(action, { type: 'call' });
});

test('decideAIAction semi-bluff raises strong draws postflop in enhanced mode', () => {
    const gameState = createGameState({
        phase: 'flop',
        currentBet: 60,
        minRaise: 20,
        pot: 200,
        dealerIndex: 0,
        communityCards: [
            { value: '6', suit: '\u2665' },
            { value: '5', suit: '\u2663' },
            { value: 'K', suit: '\u2665' }
        ],
        players: [
            createPlayer({ id: 0, isAI: false }),
            createPlayer({
                id: 1,
                isAI: true,
                aiLevel: 'hard',
                chips: 400,
                bet: 20,
                cards: [
                    { value: '8', suit: '\u2665' },
                    { value: '7', suit: '\u2665' }
                ]
            })
        ]
    });

    const action = decideAIAction({
        gameState,
        playerId: 1,
        random: createRandomSequence([0.1])
    });

    assert.deepEqual(action, { type: 'raise', totalBet: 200 });
});

test('decideAIAction returns null for folded or all-in players', () => {
    const foldedState = createGameState({
        players: [
            createPlayer({ id: 0, isAI: false }),
            createPlayer({
                id: 1,
                isAI: true,
                aiLevel: 'easy',
                folded: true,
                cards: [
                    { value: 'A', suit: '\u2660' },
                    { value: 'K', suit: '\u2660' }
                ]
            })
        ]
    });

    const allInState = createGameState({
        players: [
            createPlayer({ id: 0, isAI: false }),
            createPlayer({
                id: 1,
                isAI: true,
                aiLevel: 'medium',
                allIn: true,
                cards: [
                    { value: 'A', suit: '\u2660' },
                    { value: 'K', suit: '\u2660' }
                ]
            })
        ]
    });

    assert.equal(decideAIAction({ gameState: foldedState, playerId: 1 }), null);
    assert.equal(decideAIAction({ gameState: allInState, playerId: 1 }), null);
});
