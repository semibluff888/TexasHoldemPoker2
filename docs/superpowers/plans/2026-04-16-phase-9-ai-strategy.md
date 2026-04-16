# Phase 9 AI Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract AI strategy and opponent-profile logic from `game.js` into a focused `src/ai/` module while preserving live gameplay behavior and existing UI/audio/history side effects.

**Architecture:** Add `src/ai/game-ai.js` as a pure decision module that imports only core/state helpers and returns plain action descriptors instead of mutating the game directly. Keep `game.js` as the orchestration layer: it will import `decideAIAction()` and `getOpponentProfile()`, execute the returned action through existing `player*` functions, and continue injecting `getOpponentProfile()` into the existing UI/language modules.

**Tech Stack:** Vanilla JavaScript ES modules, Node built-in test runner, Node `assert/strict`, existing `src/core` and `src/state` modules, manual browser smoke verification over static HTTP.

---

## File Structure

- Create: `src/ai/game-ai.js`
  - Pure AI helpers and decision engine.
  - Imports only `src/core/cards.js`, `src/core/hand-evaluator.js`, and `src/state/game-state.js`.
  - Exports deterministic, testable strategy helpers plus `decideAIAction()` and `getOpponentProfile()`.

- Create: `tests/ai/game-ai.test.js`
  - Node tests for hand notation, bucket classification, draw evaluation, opponent profiling, bet sizing, and representative easy/enhanced AI decisions.
  - Uses injected random sequences so decision-branch tests stay deterministic.

- Modify: `game.js`
  - Replace in-file AI constants and AI helper functions with imports from `src/ai/game-ai.js`.
  - Add one small `executeAIAction()` adapter that maps returned descriptors to the existing `playerFold()`, `playerCheck()`, `playerCall()`, and `playerRaise()` functions.
  - Keep all side effects and orchestration in place.

### Task 1: Add the Pure AI Module and Its Deterministic Node Tests

**Files:**
- Create: `src/ai/game-ai.js`
- Create: `tests/ai/game-ai.test.js`
- Test: `tests/ai/game-ai.test.js`

- [ ] **Step 1: Write the failing AI module tests**

Create `tests/ai/game-ai.test.js` with the following content:

```js
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
```

- [ ] **Step 2: Run the new test file and verify it fails before implementation**

Run:

```bash
node --test tests/ai/game-ai.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `src/ai/game-ai.js` does not exist yet.

- [ ] **Step 3: Implement the new AI module**

Create `src/ai/game-ai.js` with the following content:

```js
import { BIG_BLIND } from '../state/game-state.js';
import { getCardValue } from '../core/cards.js';
import { evaluateHand } from '../core/hand-evaluator.js';

const BUCKET_PREMIUM = [
    'AA', 'KK', 'QQ', 'JJ', 'TT',
    'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs',
    'AKo', 'AQo'
];

const BUCKET_STRONG = [
    '99', '88', '77', '66',
    'T9s', '98s', '87s', 'JTs', 'QTs', 'KTs',
    'A5s', 'A4s', 'A3s',
    'AJo', 'KQo'
];

const BUCKET_SPECULATIVE = [
    '55', '44', '33', '22',
    'A9s', 'A8s', 'A7s', 'A6s', 'A2s',
    'K9s', 'K8s', 'Q9s', 'J9s', 'T8s', '97s', '86s', '75s', '76s', '65s',
    'ATo', 'KTo', 'QTo', 'JTo', 'A9o', 'KJo', 'QJo',
    'T9o', '98o', 'J9o'
];

const BUCKET_WEAK = [
    'K7s', 'K6s', 'K5s', 'K4s', 'K3s',
    'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s',
    'J8s', 'J7s', 'J6s', 'J5s',
    'T7s', 'T6s', '96s', '85s', '74s', '64s', '63s', '53s', '54s', '43s',
    'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o',
    'K9o', 'K8o', 'K7o', 'K6o',
    'Q9o', 'Q8o', 'Q7o', 'J8o',
    'T8o', 'T7o', '97o', '87o', '86o', '76o', '75o', '65o'
];

const BET_SIZES = { HALF: 0.5, POT: 1.0, DOUBLE: 2.0 };

export function getHandNotation(card1, card2) {
    const v1 = card1.value === '10' ? 'T' : card1.value;
    const v2 = card2.value === '10' ? 'T' : card2.value;
    const val1 = getCardValue(card1.value);
    const val2 = getCardValue(card2.value);

    const [high, low] = val1 >= val2 ? [v1, v2] : [v2, v1];
    const suited = card1.suit === card2.suit;

    if (high === low) {
        return high + low;
    }

    return high + low + (suited ? 's' : 'o');
}

export function getHandBucket(card1, card2) {
    const notation = getHandNotation(card1, card2);

    if (BUCKET_PREMIUM.includes(notation)) return 'premium';
    if (BUCKET_STRONG.includes(notation)) return 'strong';
    if (BUCKET_SPECULATIVE.includes(notation)) return 'speculative';
    if (BUCKET_WEAK.includes(notation)) return 'weak';
    return 'trash';
}

export function getPosition({ players, dealerIndex, playerId }) {
    const seatedPlayers = players.filter(player => !player.isRemoved);
    const numSeated = seatedPlayers.length;
    const dealerSeatedIndex = seatedPlayers.findIndex(player => player.id === dealerIndex);
    const targetSeatedIndex = seatedPlayers.findIndex(player => player.id === playerId);

    if (dealerSeatedIndex === -1 || targetSeatedIndex === -1) {
        return 'late';
    }

    const posFromDealer =
        (targetSeatedIndex - dealerSeatedIndex + numSeated) % numSeated;

    if (numSeated <= 3) {
        if (posFromDealer === 0) return 'late';
        return 'blinds';
    }

    if (posFromDealer === 0) return 'late';
    if (posFromDealer <= 2) return 'blinds';
    if (posFromDealer === 3) return 'early';
    if (posFromDealer === 4) return 'middle';
    return 'late';
}

export function evaluateDraws(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const draws = {
        flushDraw: false,
        openEndedStraight: false,
        gutshot: false,
        backdoorFlush: false,
        outs: 0
    };

    if (communityCards.length < 3) return draws;

    const suitCounts = {};
    for (const card of allCards) {
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }

    for (const count of Object.values(suitCounts)) {
        if (count === 4) {
            draws.flushDraw = true;
            draws.outs += 9;
        } else if (count === 3 && communityCards.length === 3) {
            draws.backdoorFlush = true;
            draws.outs += 1.5;
        }
    }

    const values = allCards.map(card => getCardValue(card.value));
    const uniqueValues = [...new Set(values)].sort((left, right) => left - right);

    for (let index = 0; index <= uniqueValues.length - 4; index++) {
        const span = uniqueValues[index + 3] - uniqueValues[index];

        if (span === 3) {
            if (uniqueValues[index] > 2 && uniqueValues[index + 3] < 14) {
                draws.openEndedStraight = true;
                draws.outs += 8;
            } else {
                draws.gutshot = true;
                draws.outs += 4;
            }
            break;
        }

        if (span === 4) {
            draws.gutshot = true;
            draws.outs += 4;
            break;
        }
    }

    return draws;
}

export function evaluateAIHand({ player, communityCards }) {
    const allCards = [...player.cards, ...communityCards];

    if (allCards.length < 2) return 0.3;

    if (communityCards.length === 0) {
        const values = player.cards
            .map(card => getCardValue(card.value))
            .sort((left, right) => right - left);
        const suited = player.cards[0].suit === player.cards[1].suit;
        const paired = values[0] === values[1];

        let strength = 0.2;

        if (paired) {
            strength = 0.4 + (values[0] / 14) * 0.4;
        } else if (values[0] >= 12 && values[1] >= 10) {
            strength = 0.5 + (suited ? 0.1 : 0);
        } else if (values[0] >= 10) {
            strength = 0.35 + (suited ? 0.1 : 0);
        } else if (suited && Math.abs(values[0] - values[1]) <= 2) {
            strength = 0.35;
        }

        return strength;
    }

    const hand = evaluateHand(allCards);
    return hand.rank / 10;
}

export function getOpponentProfile(player) {
    const stats = player.stats;
    const hands = Math.max(1, stats.handsPlayed);

    return {
        vpip: stats.vpipCount / hands,
        pfr: stats.pfrCount / hands,
        threeBet: stats.threeBetCount / Math.max(1, stats.facedOpenRaiseCount),
        cBet: stats.cBetCount / Math.max(1, stats.cBetOpportunityCount),
        foldToCBet: stats.foldToCBetCount / Math.max(1, stats.cBetFaced),
        showdownRate: stats.showdownCount / hands,
        isTight: stats.vpipCount / hands < 0.20,
        isLoose: stats.vpipCount / hands > 0.40,
        isAggressive: stats.pfrCount / hands > 0.25
    };
}

export function calculateBetAmount({ gameState, playerId, multiplier }) {
    const player = gameState.players[playerId];
    const betAmount = Math.floor(gameState.pot * multiplier);
    const minBet = gameState.currentBet + gameState.minRaise;
    const maxBet = player.chips + player.bet;

    return Math.min(maxBet, Math.max(minBet, betAmount));
}

export function calculateWinProbability({
    player,
    communityCards,
    phase,
    random = Math.random
}) {
    if (phase === 'preflop') {
        const bucket = getHandBucket(player.cards[0], player.cards[1]);

        switch (bucket) {
            case 'premium':
                return 0.75 + random() * 0.1;
            case 'strong':
                return 0.55 + random() * 0.1;
            case 'speculative':
                return 0.40 + random() * 0.1;
            case 'weak':
                return 0.30 + random() * 0.05;
            default:
                return 0.20 + random() * 0.05;
        }
    }

    const allCards = [...player.cards, ...communityCards];
    const hand = evaluateHand(allCards);
    const madeHandStrength = hand.rank / 10;
    const draws = evaluateDraws(player.cards, communityCards);

    let drawEquity = 0;
    const cardsToCome = phase === 'flop' ? 2 : (phase === 'turn' ? 1 : 0);

    if (cardsToCome > 0) {
        drawEquity = Math.min(0.45, (draws.outs * 2 * cardsToCome) / 100);
    }

    return Math.min(0.95, madeHandStrength + drawEquity * (1 - madeHandStrength));
}

function getMainOpponent(gameState, playerId) {
    const opponents = gameState.players.filter(
        player => player.id !== playerId && !player.folded && !player.isRemoved
    );

    return opponents[0] || gameState.players[0];
}

function decideEasyAction({ gameState, playerId, random }) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const handStrength = evaluateAIHand({
        player,
        communityCards: gameState.communityCards
    });
    const decisionRoll = random();

    if (handStrength > 0.7) {
        if (decisionRoll > 0.3) {
            const totalBet = Math.min(
                gameState.currentBet + gameState.minRaise + Math.floor(random() * 50),
                player.chips + player.bet
            );

            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'call' };
        }

        return { type: 'call' };
    }

    if (handStrength > 0.4) {
        if (callAmount === 0) {
            return { type: 'check' };
        }

        if (callAmount <= player.chips * 0.2 || decisionRoll > 0.3) {
            return { type: 'call' };
        }

        return { type: 'fold' };
    }

    if (handStrength > 0.2) {
        if (callAmount === 0) {
            if (decisionRoll > 0.7) {
                const totalBet = gameState.currentBet + gameState.minRaise;

                return totalBet <= player.chips + player.bet
                    ? { type: 'raise', totalBet }
                    : { type: 'check' };
            }

            return { type: 'check' };
        }

        if (callAmount <= player.chips * 0.1) {
            return { type: 'call' };
        }

        return { type: 'fold' };
    }

    if (callAmount === 0) {
        return { type: 'check' };
    }

    if (callAmount <= player.chips * 0.05 && decisionRoll > 0.5) {
        return { type: 'call' };
    }

    return { type: 'fold' };
}

function decideEnhancedPreflopAction({ gameState, playerId, random }) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const bucket = getHandBucket(player.cards[0], player.cards[1]);
    const position = getPosition({
        players: gameState.players,
        dealerIndex: gameState.dealerIndex,
        playerId
    });
    const decisionRoll = random();
    const opponentProfile = getOpponentProfile(getMainOpponent(gameState, playerId));
    const positionBonus =
        position === 'blinds' ? 0.15 : (position === 'late' ? 0.1 : (position === 'middle' ? 0.025 : 0));
    const stealMore = opponentProfile.isTight ? 0.1 : 0;
    const trapMore = opponentProfile.isAggressive ? 0.15 : 0;

    if (bucket === 'premium') {
        if (decisionRoll < 0.20 + trapMore && callAmount > 0) {
            return { type: 'call' };
        }

        const sizeMult = opponentProfile.isLoose ? BET_SIZES.POT : BET_SIZES.HALF;
        const totalBet = calculateBetAmount({
            gameState,
            playerId,
            multiplier: sizeMult
        });

        return totalBet > gameState.currentBet
            ? { type: 'raise', totalBet }
            : { type: 'call' };
    }

    if (bucket === 'strong') {
        if (callAmount === 0) {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.HALF
            });

            if (decisionRoll < 0.75 + positionBonus && totalBet > gameState.currentBet) {
                return { type: 'raise', totalBet };
            }

            return { type: 'check' };
        }

        if (callAmount <= Math.max(player.chips * 0.15, BIG_BLIND)) {
            if (decisionRoll < 0.25) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.POT
                });

                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'call' };
            }

            return { type: 'call' };
        }

        return decisionRoll < 0.6 ? { type: 'call' } : { type: 'fold' };
    }

    if (bucket === 'speculative') {
        if (callAmount === 0) {
            if (decisionRoll < 0.4 + positionBonus + stealMore) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.HALF
                });

                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'check' };
            }

            return { type: 'check' };
        }

        if (callAmount <= Math.max(player.chips * 0.08, BIG_BLIND)) {
            return decisionRoll < 0.85 ? { type: 'call' } : { type: 'fold' };
        }

        if (callAmount <= Math.max(player.chips * 0.15, BIG_BLIND)) {
            return decisionRoll < 0.5 ? { type: 'call' } : { type: 'fold' };
        }

        return decisionRoll < 0.25 ? { type: 'call' } : { type: 'fold' };
    }

    if (bucket === 'weak') {
        if (callAmount === 0 && decisionRoll < 0.25 + stealMore && position === 'late') {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.HALF
            });

            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'check' };
        }

        if (callAmount === 0) {
            return { type: 'check' };
        }

        if (callAmount <= Math.max(player.chips * 0.05, BIG_BLIND)) {
            return decisionRoll < 0.5 ? { type: 'call' } : { type: 'fold' };
        }

        if (callAmount <= Math.max(player.chips * 0.1, BIG_BLIND)) {
            return decisionRoll < 0.25 ? { type: 'call' } : { type: 'fold' };
        }

        return { type: 'fold' };
    }

    if (callAmount === 0) {
        return { type: 'check' };
    }

    if (callAmount <= Math.max(player.chips * 0.03, BIG_BLIND)) {
        return decisionRoll < 0.2 ? { type: 'call' } : { type: 'fold' };
    }

    return { type: 'fold' };
}

function decideEnhancedPostflopAction({ gameState, playerId, random }) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const winProb = calculateWinProbability({
        player,
        communityCards: gameState.communityCards,
        phase: gameState.phase,
        random
    });
    const position = getPosition({
        players: gameState.players,
        dealerIndex: gameState.dealerIndex,
        playerId
    });
    const decisionRoll = random();
    const opponentProfile = getOpponentProfile(getMainOpponent(gameState, playerId));
    const potOdds = callAmount > 0 ? callAmount / (gameState.pot + callAmount) : 0;
    const hasGoodOdds = winProb > potOdds;
    const positionBonus = position === 'late' ? 0.08 : 0;
    const bluffMore = opponentProfile.foldToCBet > 0.6 ? 0.15 : 0;
    const trapMore = opponentProfile.isAggressive ? 0.12 : 0;
    const valueOnly = opponentProfile.showdownRate > 0.35;
    const draws = evaluateDraws(player.cards, gameState.communityCards);
    const hasStrongDraw = draws.flushDraw || draws.openEndedStraight;

    if (winProb >= 0.7) {
        if (decisionRoll < 0.20 + trapMore && callAmount > 0) {
            return { type: 'call' };
        }

        if (callAmount === 0) {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: decisionRoll < 0.5 ? BET_SIZES.HALF : BET_SIZES.POT
            });

            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'check' };
        }

        if (decisionRoll < 0.6) {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.POT
            });

            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'call' };
        }

        return { type: 'call' };
    }

    if (winProb >= 0.4 || hasStrongDraw) {
        if (callAmount === 0) {
            const betChance = hasStrongDraw ? 0.5 : 0.25;

            if (decisionRoll < betChance + positionBonus + bluffMore) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.HALF
                });

                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'check' };
            }

            return { type: 'check' };
        }

        if (hasGoodOdds || hasStrongDraw) {
            if (decisionRoll < 0.15 && hasStrongDraw) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.POT
                });

                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'call' };
            }

            return { type: 'call' };
        }

        return decisionRoll < 0.3 ? { type: 'call' } : { type: 'fold' };
    }

    if (winProb >= 0.2) {
        if (callAmount === 0) {
            const bluffChance = valueOnly ? 0.02 : (0.08 + positionBonus + bluffMore);

            if (decisionRoll < bluffChance) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.HALF
                });

                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'check' };
            }

            return { type: 'check' };
        }

        if (hasGoodOdds && callAmount <= player.chips * 0.1) {
            return decisionRoll < 0.4 ? { type: 'call' } : { type: 'fold' };
        }

        return { type: 'fold' };
    }

    if (callAmount === 0) {
        const bluffChance = valueOnly ? 0 : (0.03 + bluffMore);

        if (decisionRoll < bluffChance && position === 'late') {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.HALF
            });

            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'check' };
        }

        return { type: 'check' };
    }

    return { type: 'fold' };
}

export function decideAIAction({
    gameState,
    playerId,
    random = Math.random
}) {
    const player = gameState.players[playerId];

    if (!player || player.folded || player.allIn || player.isRemoved) {
        return null;
    }

    if (player.aiLevel === 'easy') {
        return decideEasyAction({ gameState, playerId, random });
    }

    if (gameState.phase === 'preflop') {
        return decideEnhancedPreflopAction({ gameState, playerId, random });
    }

    return decideEnhancedPostflopAction({ gameState, playerId, random });
}
```

- [ ] **Step 4: Run the AI tests again and verify they pass**

Run:

```bash
node --test tests/ai/game-ai.test.js
```

Expected: PASS with 9 green tests in `tests/ai/game-ai.test.js`.

- [ ] **Step 5: Commit the new module and tests**

Run:

```bash
git add src/ai/game-ai.js tests/ai/game-ai.test.js
git commit -m "feat: add pure game ai module"
```

Expected: a new commit containing only the new AI module and its tests.

### Task 2: Wire `game.js` to the Extracted AI Module and Verify the Existing Runtime Path

**Files:**
- Modify: `game.js:1-95`
- Modify: `game.js:253-257`
- Modify: `game.js:339-343`
- Modify: `game.js:382-386`
- Modify: `game.js:463-467`
- Modify: `game.js:497-500`
- Modify: `game.js:504-1219`
- Modify: `game.js:1399-1418`
- Modify: `game.js:1684-1688`
- Modify: `game.js:1955-1960`
- Test: `tests/ai/game-ai.test.js`
- Test: `game.js`

- [ ] **Step 1: Replace the in-file AI block in `game.js` with imports plus a tiny execution adapter**

Update the import section near the top of `game.js` to remove `getCardValue` and add the AI module import:

```js
import { createDeck, shuffleDeck } from './src/core/cards.js';
import { evaluateHand } from './src/core/hand-evaluator.js';
import { calculatePots, splitPot } from './src/core/pot-settlement.js';
import {
    SMALL_BLIND,
    BIG_BLIND,
    STARTING_CHIPS,
    createDefaultStats,
    createPlayer,
    createInitialGameState,
    resetPlayersForNewHand
} from './src/state/game-state.js';
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
import { bindGameTableEvents } from './src/ui/game-table-events.js';
import {
    setHelpPopupVisible,
    updateGameModeButton,
    updateStatsToggleButton,
    updateAllPlayerStatsDisplays
} from './src/ui/game-shell-renderer.js';
import { bindGameShellEvents } from './src/ui/game-shell-events.js';
import { gameAudio } from './src/ui/game-audio.js';
import { gameCursorEffects } from './src/ui/game-cursor-effects.js';
import { gameHistory } from './src/ui/game-history.js';
import { createGameLanguageUI } from './src/ui/game-language-ui.js';
import {
    decideAIAction,
    getOpponentProfile
} from './src/ai/game-ai.js';
```

Delete the in-file AI constants and AI helper block currently spanning:

- the bucket constants at `game.js:41-76`
- the AI functions at `game.js:504-1219`

Add this new helper immediately after `playerAllIn()`:

```js
function executeAIAction(playerId, action) {
    if (!action) {
        return;
    }

    switch (action.type) {
        case 'fold':
            playerFold(playerId);
            return;
        case 'check':
            playerCheck(playerId);
            return;
        case 'call':
            playerCall(playerId);
            return;
        case 'raise':
            playerRaise(playerId, action.totalBet);
            return;
        default:
            throw new Error(`Unknown AI action type: ${action.type}`);
    }
}
```

Replace the AI-turn branch inside `runBettingRound()`:

```js
if (player.isAI) {
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    await delay(800);
    if (currentGameId !== thisGameId) return;

    const action = decideAIAction({
        gameState,
        playerId: player.id
    });

    executeAIAction(player.id, action);
} else {
    gameAudio.playYourTurn();
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    startCountdown();
    await waitForPlayerAction();
    if (currentGameId !== thisGameId) return;
}
```

Keep all existing `updateAllPlayerStatsDisplays({ players: gameState.players, t, getOpponentProfile })` calls unchanged so the imported profile helper continues to feed the shell UI and language UI.

- [ ] **Step 2: Run syntax checks on the touched runtime files**

Run:

```bash
node --check src/ai/game-ai.js
node --check game.js
node --check src/main.js
```

Expected: no output and exit code `0` for all three commands.

- [ ] **Step 3: Run the full automated suite**

Run:

```bash
npm test
```

Expected: PASS with 44 total green tests.

- [ ] **Step 4: Perform the browser smoke verification over static HTTP**

Run:

```bash
python -m http.server 8000
```

Expected: `Serving HTTP on 0.0.0.0 port 8000 ...`

Then verify in the browser at `http://127.0.0.1:8000`:

- start a new game and confirm AI players still act without freezing the hand
- confirm easy AI still produces a visibly simpler mix of folds/checks/calls
- confirm medium/hard AI still produce calls and raises during normal play
- confirm AI actions still create history entries and play the same sounds
- confirm the stats panel still renders values for VPIP/PFR/3-Bet/C-Bet/Fold to CBet/Showdown
- confirm language toggle still refreshes the stats labels correctly after the extraction

- [ ] **Step 5: Commit the wiring change**

Run:

```bash
git add game.js
git commit -m "refactor: extract ai strategy module"
```

Expected: a second commit that removes the in-file AI block from `game.js` and wires the extracted module into the existing runtime path.
