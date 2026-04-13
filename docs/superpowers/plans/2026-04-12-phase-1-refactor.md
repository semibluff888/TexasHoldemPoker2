# Phase 1 Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract pure rule logic and state factories from the monolithic browser script, switch the app entry to native ES modules, and add regression coverage for hand evaluation and pot settlement without changing visible gameplay behavior.

**Architecture:** Keep `game.js` as the orchestration layer for this phase, but remove embedded pure rule/state definitions by importing them from focused modules under `src/`. Move startup and DOM binding into `src/main.js`, while pure modules stay DOM-free and are covered by Node's built-in test runner.

**Tech Stack:** Vanilla JavaScript, native browser ES modules, Node built-in test runner, Docker Compose for static HTTP smoke checks

---

### Task 1: Enable ESM and Extract Card Utilities

**Files:**
- Create: `src/core/cards.js`
- Create: `tests/core/cards.test.js`
- Modify: `package.json:1-12`
- Test: `tests/core/cards.test.js`

- [ ] **Step 1: Write the failing card utility tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SUITS,
    VALUES,
    createDeck,
    shuffleDeck,
    getCardValue
} from '../../src/core/cards.js';

test('createDeck returns 52 unique cards', () => {
    const deck = createDeck();

    assert.equal(deck.length, 52);
    assert.deepEqual(deck[0], { suit: '\u2660', value: '2' });
    assert.deepEqual(deck.at(-1), { suit: '\u2663', value: 'A' });

    const keys = new Set(deck.map(card => `${card.value}${card.suit}`));
    assert.equal(keys.size, 52);
});

test('shuffleDeck preserves the exact card set', () => {
    const orderedDeck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            orderedDeck.push({ suit, value });
        }
    }

    const shuffledDeck = shuffleDeck([...orderedDeck]);

    assert.deepEqual(orderedDeck[0], { suit: SUITS[0], value: VALUES[0] });
    const orderedKeys = orderedDeck.map(card => `${card.value}${card.suit}`).sort();
    const shuffledKeys = shuffledDeck.map(card => `${card.value}${card.suit}`).sort();

    assert.deepEqual(shuffledKeys, orderedKeys);
});

test('getCardValue maps face cards and numeric cards', () => {
    assert.equal(getCardValue('2'), 2);
    assert.equal(getCardValue('10'), 10);
    assert.equal(getCardValue('J'), 11);
    assert.equal(getCardValue('Q'), 12);
    assert.equal(getCardValue('K'), 13);
    assert.equal(getCardValue('A'), 14);
});
```

- [ ] **Step 2: Run the new test to confirm the current package is not ready for ESM modules**

Run: `node --test tests/core/cards.test.js`
Expected: FAIL with an ESM parsing error or `ERR_MODULE_NOT_FOUND`, because `package.json` is still CommonJS-oriented and `src/core/cards.js` does not exist yet

- [ ] **Step 3: Add ESM support and implement `src/core/cards.js`**

`package.json`

```json
{
  "name": "texas-holdem-poker",
  "version": "1.0.0",
  "description": "Texas Hold'em Poker Game",
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "@vercel/kv": "^1.0.1",
    "redis": "^5.10.0"
  }
}
```

`src/core/cards.js`

```js
export const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck() {
    const deck = [];

    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }

    return deck;
}

export function shuffleDeck(deck) {
    const shuffledDeck = [...deck];

    for (let index = shuffledDeck.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffledDeck[index], shuffledDeck[swapIndex]] = [shuffledDeck[swapIndex], shuffledDeck[index]];
    }

    return shuffledDeck;
}

export function getCardValue(value) {
    const valueMap = { J: 11, Q: 12, K: 13, A: 14 };
    return valueMap[value] || Number.parseInt(value, 10);
}
```

- [ ] **Step 4: Run the card tests and make sure they pass**

Run: `node --test tests/core/cards.test.js`
Expected: PASS with 3 passing tests and exit code `0`

- [ ] **Step 5: Commit the ESM/card utility foundation**

```bash
git add package.json src/core/cards.js tests/core/cards.test.js
git commit -m "refactor: extract card utilities"
```

### Task 2: Extract Hand Evaluation Into a Pure Module

**Files:**
- Create: `src/core/hand-evaluator.js`
- Create: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/hand-evaluator.test.js`

- [ ] **Step 1: Write the failing hand evaluation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    evaluateHand,
    evaluateFiveCards
} from '../../src/core/hand-evaluator.js';

test('evaluateFiveCards recognizes a royal flush', () => {
    const result = evaluateFiveCards([
        { suit: '\u2660', value: 'A' },
        { suit: '\u2660', value: 'K' },
        { suit: '\u2660', value: 'Q' },
        { suit: '\u2660', value: 'J' },
        { suit: '\u2660', value: '10' }
    ]);

    assert.equal(result.name, 'Royal Flush');
    assert.equal(result.rank, 10);
});

test('evaluateHand chooses the best five cards out of seven', () => {
    const result = evaluateHand([
        { suit: '\u2660', value: 'A' },
        { suit: '\u2660', value: 'K' },
        { suit: '\u2660', value: 'Q' },
        { suit: '\u2660', value: 'J' },
        { suit: '\u2660', value: '10' },
        { suit: '\u2666', value: '2' },
        { suit: '\u2663', value: '3' }
    ]);

    assert.equal(result.name, 'Royal Flush');
    assert.equal(result.bestCards.length, 5);
});

test('evaluateHand treats A-2-3-4-5 as a five-high straight', () => {
    const result = evaluateHand([
        { suit: '\u2660', value: 'A' },
        { suit: '\u2665', value: '2' },
        { suit: '\u2666', value: '3' },
        { suit: '\u2663', value: '4' },
        { suit: '\u2660', value: '5' },
        { suit: '\u2665', value: '9' },
        { suit: '\u2666', value: 'K' }
    ]);

    assert.equal(result.name, 'Straight');
    assert.equal(result.score, 5000005);
});

test('pair scoring respects kicker order', () => {
    const stronger = evaluateFiveCards([
        { suit: '\u2660', value: 'A' },
        { suit: '\u2665', value: 'A' },
        { suit: '\u2666', value: 'K' },
        { suit: '\u2663', value: '10' },
        { suit: '\u2660', value: '4' }
    ]);

    const weaker = evaluateFiveCards([
        { suit: '\u2660', value: 'A' },
        { suit: '\u2665', value: 'A' },
        { suit: '\u2666', value: 'Q' },
        { suit: '\u2663', value: '10' },
        { suit: '\u2660', value: '4' }
    ]);

    assert.equal(stronger.name, 'One Pair');
    assert.equal(weaker.name, 'One Pair');
    assert.ok(stronger.score > weaker.score);
});
```

- [ ] **Step 2: Run the new test file to confirm it fails before extraction**

Run: `node --test tests/core/hand-evaluator.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`, because `src/core/hand-evaluator.js` does not exist yet

- [ ] **Step 3: Implement the pure hand evaluator module**

`src/core/hand-evaluator.js`

```js
import { getCardValue } from './cards.js';

export function evaluateHand(cards) {
    if (cards.length < 5) {
        return { rank: 0, name: 'Incomplete', highCards: [], bestCards: [] };
    }

    const combinations = getCombinations(cards, 5);
    let bestHand = { rank: 0, name: 'High Card', highCards: [], score: 0, bestCards: [] };

    for (const combo of combinations) {
        const hand = evaluateFiveCards(combo);
        hand.bestCards = combo;

        if (hand.score > bestHand.score) {
            bestHand = hand;
        }
    }

    return bestHand;
}

export function getCombinations(arr, size) {
    const result = [];

    function combine(start, combo) {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }

        for (let index = start; index < arr.length; index++) {
            combo.push(arr[index]);
            combine(index + 1, combo);
            combo.pop();
        }
    }

    combine(0, []);
    return result;
}

export function evaluateFiveCards(cards) {
    const values = cards.map(card => getCardValue(card.value)).sort((left, right) => right - left);
    const suits = cards.map(card => card.suit);

    const valueCounts = {};
    for (const value of values) {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
    }

    const counts = Object.values(valueCounts).sort((left, right) => right - left);
    const uniqueValues = [...new Set(values)].sort((left, right) => right - left);

    const isFlush = suits.every(suit => suit === suits[0]);
    const isStraight = checkStraight(uniqueValues);
    const isAceLowStraight = JSON.stringify(uniqueValues) === JSON.stringify([14, 5, 4, 3, 2]);

    function getKickers(excludeValues) {
        return values.filter(value => !excludeValues.includes(value));
    }

    if (isFlush && isStraight && values[0] === 14 && values[1] === 13) {
        return { rank: 10, name: 'Royal Flush', highCards: values, score: 10000000 };
    }

    if (isFlush && (isStraight || isAceLowStraight)) {
        return {
            rank: 9,
            name: 'Straight Flush',
            highCards: values,
            score: 9000000 + (isAceLowStraight ? 5 : values[0])
        };
    }

    if (counts[0] === 4) {
        const quadValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 4), 10);
        const kicker = getKickers([quadValue])[0];

        return {
            rank: 8,
            name: 'Four of a Kind',
            highCards: values,
            score: 8000000 + quadValue * 15 + kicker
        };
    }

    if (counts[0] === 3 && counts[1] === 2) {
        const tripValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 3), 10);
        const pairValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 2), 10);

        return {
            rank: 7,
            name: 'Full House',
            highCards: values,
            score: 7000000 + tripValue * 15 + pairValue
        };
    }

    if (isFlush) {
        return {
            rank: 6,
            name: 'Flush',
            highCards: values,
            score: 6000000 + values[0] * 50625 + values[1] * 3375 + values[2] * 225 + values[3] * 15 + values[4]
        };
    }

    if (isStraight || isAceLowStraight) {
        return {
            rank: 5,
            name: 'Straight',
            highCards: values,
            score: 5000000 + (isAceLowStraight ? 5 : values[0])
        };
    }

    if (counts[0] === 3) {
        const tripValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 3), 10);
        const kickers = getKickers([tripValue]);

        return {
            rank: 4,
            name: 'Three of a Kind',
            highCards: values,
            score: 4000000 + tripValue * 3375 + kickers[0] * 225 + kickers[1] * 15
        };
    }

    if (counts[0] === 2 && counts[1] === 2) {
        const pairs = Object.keys(valueCounts)
            .filter(key => valueCounts[key] === 2)
            .map(Number)
            .sort((left, right) => right - left);
        const kicker = getKickers(pairs)[0];

        return {
            rank: 3,
            name: 'Two Pair',
            highCards: values,
            score: 3000000 + pairs[0] * 3375 + pairs[1] * 225 + kicker * 15
        };
    }

    if (counts[0] === 2) {
        const pairValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 2), 10);
        const kickers = getKickers([pairValue]);

        return {
            rank: 2,
            name: 'One Pair',
            highCards: values,
            score: 2000000 + pairValue * 3375 + kickers[0] * 225 + kickers[1] * 15 + kickers[2]
        };
    }

    return {
        rank: 1,
        name: 'High Card',
        highCards: values,
        score: 1000000 + values[0] * 50625 + values[1] * 3375 + values[2] * 225 + values[3] * 15 + values[4]
    };
}

export function checkStraight(values) {
    if (values.length !== 5) {
        return false;
    }

    for (let index = 0; index < values.length - 1; index++) {
        if (values[index] - values[index + 1] !== 1) {
            return false;
        }
    }

    return true;
}
```

- [ ] **Step 4: Run the card and hand-evaluator tests together**

Run: `node --test tests/core/cards.test.js tests/core/hand-evaluator.test.js`
Expected: PASS with 7 passing tests and exit code `0`

- [ ] **Step 5: Commit the hand evaluator extraction**

```bash
git add src/core/hand-evaluator.js tests/core/hand-evaluator.test.js
git commit -m "refactor: extract hand evaluator"
```

### Task 3: Extract Pot Settlement and Fix Side-Pot/Odd-Chip Logic

**Files:**
- Create: `src/core/pot-settlement.js`
- Create: `tests/core/pot-settlement.test.js`
- Test: `tests/core/pot-settlement.test.js`

- [ ] **Step 1: Write the failing pot settlement tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    calculatePots,
    splitPot
} from '../../src/core/pot-settlement.js';

test('calculatePots keeps a folded main-pot contribution in the main pot only', () => {
    const pots = calculatePots([
        { id: 0, folded: false, totalContribution: 100 },
        { id: 1, folded: true, totalContribution: 100 },
        { id: 2, folded: false, totalContribution: 300 }
    ]);

    assert.deepEqual(pots, [
        { amount: 300, eligiblePlayerIds: [0, 2], level: 100 },
        { amount: 200, eligiblePlayerIds: [2], level: 300 }
    ]);
});

test('calculatePots keeps a folded side-pot contribution attached to the higher level', () => {
    const pots = calculatePots([
        { id: 0, folded: false, totalContribution: 100 },
        { id: 1, folded: true, totalContribution: 300 },
        { id: 2, folded: false, totalContribution: 300 }
    ]);

    assert.deepEqual(pots, [
        { amount: 300, eligiblePlayerIds: [0, 2], level: 100 },
        { amount: 400, eligiblePlayerIds: [2], level: 300 }
    ]);
});

test('splitPot conserves chips and gives odd chips by seating order', () => {
    const payouts = splitPot(101, [3, 1], [1, 3]);

    assert.deepEqual(payouts, [
        { playerId: 1, amount: 51 },
        { playerId: 3, amount: 50 }
    ]);

    assert.equal(payouts.reduce((sum, payout) => sum + payout.amount, 0), 101);
});

test('splitPot rejects seating orders that omit a winner', () => {
    assert.throws(
        () => splitPot(100, [1, 2], [2]),
        /seating order must contain every winner/i
    );
});
```

- [ ] **Step 2: Run the pot-settlement test file and confirm it fails**

Run: `node --test tests/core/pot-settlement.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`, because `src/core/pot-settlement.js` does not exist yet

- [ ] **Step 3: Implement `calculatePots()` and `splitPot()` as pure helpers**

`src/core/pot-settlement.js`

```js
export function calculatePots(players) {
    const contributionLevels = [...new Set(
        players
            .map(player => player.totalContribution)
            .filter(totalContribution => totalContribution > 0)
    )].sort((left, right) => left - right);

    const pots = [];
    let previousLevel = 0;

    for (const level of contributionLevels) {
        const contributors = players.filter(player => player.totalContribution >= level);
        const eligiblePlayerIds = players
            .filter(player => !player.folded && player.totalContribution >= level)
            .map(player => player.id);

        if (contributors.length === 0 || eligiblePlayerIds.length === 0) {
            previousLevel = level;
            continue;
        }

        pots.push({
            amount: (level - previousLevel) * contributors.length,
            eligiblePlayerIds,
            level
        });

        previousLevel = level;
    }

    return pots;
}

export function splitPot(amount, winnerIds, seatingOrder) {
    const uniqueWinnerIds = [...new Set(winnerIds)];

    if (uniqueWinnerIds.length === 0) {
        return [];
    }

    const orderedWinnerIds = seatingOrder.filter(playerId => uniqueWinnerIds.includes(playerId));

    if (orderedWinnerIds.length !== uniqueWinnerIds.length) {
        throw new Error('splitPot seating order must contain every winner exactly once');
    }

    const baseShare = Math.floor(amount / orderedWinnerIds.length);
    let remainder = amount % orderedWinnerIds.length;

    return orderedWinnerIds.map(playerId => {
        const extraChip = remainder > 0 ? 1 : 0;
        remainder -= extraChip;

        return {
            playerId,
            amount: baseShare + extraChip
        };
    });
}
```

- [ ] **Step 4: Run all pure-module tests**

Run: `node --test tests/core/cards.test.js tests/core/hand-evaluator.test.js tests/core/pot-settlement.test.js`
Expected: PASS with 11 passing tests and exit code `0`

- [ ] **Step 5: Commit the pot settlement extraction**

```bash
git add src/core/pot-settlement.js tests/core/pot-settlement.test.js
git commit -m "refactor: extract pot settlement"
```

### Task 4: Wire Extracted Rule Modules Back Into `game.js`

**Files:**
- Modify: `game.js:1-10`
- Modify: `game.js:860-870`
- Modify: `game.js:1463-1592`
- Modify: `game.js:3224-3445`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`

- [ ] **Step 1: Replace in-file deck and hand rule definitions with imports**

At the top of `game.js`, replace the local card/rule declarations with this import block and keep the blind constants in place for now:

```js
import { SUITS, VALUES, createDeck, shuffleDeck } from './src/core/cards.js';
import { evaluateHand } from './src/core/hand-evaluator.js';
import { calculatePots, splitPot } from './src/core/pot-settlement.js';

// ===== Texas Hold'em Poker Game =====

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const STARTING_CHIPS = 1000;
```

Any runtime callsite that currently expects `createDeck()` to return a shuffled
deck must be updated to call `shuffleDeck(createDeck())` instead. In the current
code, that specifically includes the `startNewGame()` assignment that initializes
`gameState.deck`.

Then delete these local function bodies completely from `game.js`, because the imported modules now own them:

```js
function createDeck() {}
function shuffleDeck(deck) {}
function getCardValue(value) {}
function evaluateHand(cards) {}
function getCombinations(arr, size) {}
function evaluateFiveCards(cards) {}
function checkStraight(values) {}
function calculatePots(allPlayers) {}
```

- [ ] **Step 2: Add seat-order helper and change showdown payouts to use `splitPot()`**

Add this helper near the showdown/pot-settlement section:

```js
function getSeatOrderFromDealer(playerIds) {
    const orderedIds = [];

    for (let offset = 1; offset <= gameState.players.length; offset++) {
        const playerId = (gameState.dealerIndex + offset) % gameState.players.length;

        if (playerIds.includes(playerId)) {
            orderedIds.push(playerId);
        }
    }

    return orderedIds;
}
```

Then replace the current payout block inside `showdown()` with this version:

```js
        for (let i = 0; i < pots.length; i++) {
            const pot = pots[i];
            const eligiblePlayers = pot.eligiblePlayerIds
                .map(playerId => gameState.players.find(player => player.id === playerId))
                .filter(Boolean);

            let bestScore = -1;
            let potWinners = [];

            for (const player of eligiblePlayers) {
                if (player.handResult.score > bestScore) {
                    bestScore = player.handResult.score;
                    potWinners = [player];
                } else if (player.handResult.score === bestScore) {
                    potWinners.push(player);
                }
            }

            const payouts = splitPot(
                pot.amount,
                potWinners.map(winner => winner.id),
                getSeatOrderFromDealer(potWinners.map(winner => winner.id))
            );
            const handName = potWinners[0].handResult.name;

            if (i === 0) {
                firstHandName = handName;
            }

            for (const payout of payouts) {
                const winner = gameState.players.find(player => player.id === payout.playerId);

                if (!allWinners.includes(winner)) {
                    allWinners.push(winner);
                }

                totalWinAmounts[winner.id] = (totalWinAmounts[winner.id] || 0) + payout.amount;
                winner.chips += payout.amount;
            }

            const translatedPotName = i === 0 ? t('mainPot') : `${t('sidePot')} ${i}`;
            const translatedWinnerNames = potWinners.map(winner => getTranslatedPlayerName(winner)).join(' & ');
            const translatedHandName = translateHandName(handName);
            const displayAmount = potWinners.length === 1 ? payouts[0].amount : pot.amount;

            const message = t('potWinMessage')
                .replace('{pot}', translatedPotName)
                .replace('{winner}', translatedWinnerNames)
                .replace('{amount}', displayAmount)
                .replace('{hand}', translatedHandName);

            showMessage(message);
        }
```

- [ ] **Step 3: Run the test suite and syntax-check the wired runtime**

Run: `node --test`
Expected: PASS with the same 11 passing tests from the extracted modules

Run: `node --check game.js`
Expected: no output and exit code `0`

- [ ] **Step 4: Commit the runtime wiring for extracted rule modules**

```bash
git add game.js
git commit -m "refactor: wire pure rule modules into game runtime"
```

### Task 5: Extract State Factories and Hand Reset Helpers

**Files:**
- Create: `src/state/game-state.js`
- Create: `tests/state/game-state.test.js`
- Modify: `game.js:1-10`
- Modify: `game.js:781-850`
- Modify: `game.js:2913-3005`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Write the failing state helper tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BIG_BLIND,
    SMALL_BLIND,
    STARTING_CHIPS,
    createDefaultStats,
    createPlayer,
    createInitialGameState,
    resetPlayersForNewHand
} from '../../src/state/game-state.js';

test('createDefaultStats returns a fresh stats object each time', () => {
    const first = createDefaultStats();
    const second = createDefaultStats();

    first.handsPlayed = 99;
    assert.equal(second.handsPlayed, 0);
});

test('createPlayer applies overrides without losing defaults', () => {
    const player = createPlayer({ id: 3, name: 'AI Player 3', isAI: true });

    assert.equal(player.id, 3);
    assert.equal(player.name, 'AI Player 3');
    assert.equal(player.chips, STARTING_CHIPS);
    assert.equal(player.aiLevel, 'medium');
    assert.equal(player.stats.handsPlayed, 0);
});

test('createInitialGameState sets the blind-sensitive defaults', () => {
    const gameState = createInitialGameState();

    assert.equal(gameState.phase, 'idle');
    assert.equal(gameState.currentBet, 0);
    assert.equal(gameState.minRaise, BIG_BLIND);
    assert.deepEqual(gameState.players, []);
});

test('resetPlayersForNewHand clears transient state and increments active hands only', () => {
    const players = [
        createPlayer({
            id: 0,
            name: 'You',
            isAI: false,
            aiLevel: null,
            cards: [{ suit: '\u2660', value: 'A' }],
            bet: SMALL_BLIND,
            totalContribution: SMALL_BLIND,
            folded: false,
            allIn: true,
            isPendingJoin: true,
            stats: {
                ...createDefaultStats(),
                handsPlayed: 4,
                vpipCountedThisHand: true
            }
        }),
        createPlayer({
            id: 1,
            name: 'AI Player 1',
            isAI: true,
            chips: 0,
            folded: false,
            stats: {
                ...createDefaultStats(),
                handsPlayed: 2
            }
        }),
        createPlayer({
            id: 2,
            name: 'AI Player 2',
            isAI: true,
            isRemoved: true,
            folded: false,
            stats: {
                ...createDefaultStats(),
                handsPlayed: 7
            }
        })
    ];

    const resetPlayers = resetPlayersForNewHand(players);

    assert.equal(resetPlayers[0].cards.length, 0);
    assert.equal(resetPlayers[0].bet, 0);
    assert.equal(resetPlayers[0].totalContribution, 0);
    assert.equal(resetPlayers[0].allIn, false);
    assert.equal(resetPlayers[0].isPendingJoin, false);
    assert.equal(resetPlayers[0].stats.handsPlayed, 5);
    assert.equal(resetPlayers[0].stats.vpipCountedThisHand, false);

    assert.equal(resetPlayers[1].chips, 0);
    assert.equal(resetPlayers[1].folded, true);
    assert.equal(resetPlayers[1].stats.handsPlayed, 2);

    assert.equal(resetPlayers[2].folded, true);
    assert.equal(resetPlayers[2].stats.handsPlayed, 7);
});
```

- [ ] **Step 2: Run the state test file and confirm it fails**

Run: `node --test tests/state/game-state.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`, because `src/state/game-state.js` does not exist yet

- [ ] **Step 3: Implement the state module**

`src/state/game-state.js`

```js
export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const STARTING_CHIPS = 1000;

export function createDefaultStats() {
    return {
        handsPlayed: 0,
        vpipCount: 0,
        vpipCountedThisHand: false,
        pfrCount: 0,
        pfrCountedThisHand: false,
        threeBetCount: 0,
        threeBetCountedThisHand: false,
        facedOpenRaiseCount: 0,
        facedOpenRaiseCountedThisHand: false,
        cBetCount: 0,
        cBetCountedThisHand: false,
        cBetOpportunityCount: 0,
        cBetOpportunityCountedThisHand: false,
        cBetFaced: 0,
        cBetFacedCountedThisHand: false,
        foldToCBetCount: 0,
        showdownCount: 0
    };
}

export function createPlayer(overrides = {}) {
    return {
        id: -1,
        name: '',
        chips: STARTING_CHIPS,
        cards: [],
        bet: 0,
        totalContribution: 0,
        folded: false,
        isAI: false,
        allIn: false,
        aiLevel: 'medium',
        isRemoved: false,
        isPendingJoin: false,
        stats: createDefaultStats(),
        ...overrides
    };
}

export function createInitialGameState() {
    return {
        deck: [],
        players: [],
        communityCards: [],
        pot: 0,
        currentBet: 0,
        dealerIndex: 0,
        currentPlayerIndex: 0,
        phase: 'idle',
        minRaise: BIG_BLIND,
        displayedCommunityCards: 0,
        preflopRaiseCount: 0,
        preflopAggressorId: null,
        cBetActive: false
    };
}

export function resetPlayersForNewHand(players) {
    return players.map(player => {
        const nextPlayer = {
            ...player,
            cards: [],
            bet: 0,
            totalContribution: 0,
            folded: player.isRemoved,
            allIn: false,
            isPendingJoin: false,
            stats: {
                ...player.stats,
                vpipCountedThisHand: false,
                pfrCountedThisHand: false,
                threeBetCountedThisHand: false,
                facedOpenRaiseCountedThisHand: false,
                cBetCountedThisHand: false,
                cBetOpportunityCountedThisHand: false,
                cBetFacedCountedThisHand: false
            }
        };

        if (!nextPlayer.isRemoved && nextPlayer.chips <= 0) {
            nextPlayer.chips = 0;
            nextPlayer.folded = true;
        }

        if (!nextPlayer.folded) {
            nextPlayer.stats.handsPlayed += 1;
        }

        return nextPlayer;
    });
}
```

- [ ] **Step 4: Replace local state literals in `game.js` with imports and helpers**

Update the `game.js` import block to include state helpers:

```js
import { SUITS, VALUES, createDeck, shuffleDeck } from './src/core/cards.js';
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
```

Replace the inline state and player factory sections with these versions:

```js
let gameState = createInitialGameState();

function initPlayers() {
    gameState.players = [
        createPlayer({ id: 0, name: 'You', isAI: false, aiLevel: null }),
        createPlayer({ id: 1, name: 'AI Player 1', isAI: true }),
        createPlayer({ id: 2, name: 'AI Player 2', isAI: true }),
        createPlayer({ id: 3, name: 'AI Player 3', isAI: true }),
        createPlayer({ id: 4, name: 'AI Player 4', isAI: true })
    ];
}

function resetPlayerStats(player) {
    player.stats = createDefaultStats();
}
```

Replace the per-hand reset block in `startNewGame()` with:

```js
    if (randomizeDealer) {
        for (const player of gameState.players) {
            resetPlayerStats(player);
        }
    }

    gameState.players = resetPlayersForNewHand(gameState.players);
```

- [ ] **Step 5: Run the full test suite and syntax-check the state-integrated runtime**

Run: `node --test`
Expected: PASS with all tests from `tests/core` and `tests/state`

Run: `node --check game.js`
Expected: no output and exit code `0`

- [ ] **Step 6: Commit the state extraction**

```bash
git add src/state/game-state.js tests/state/game-state.test.js game.js
git commit -m "refactor: extract game state factories"
```

### Task 6: Move Startup and DOM Binding to `src/main.js`

**Files:**
- Create: `src/main.js`
- Modify: `game.js:3787-4244`
- Modify: `index.html:338`
- Modify: `README.md:62-105`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Convert the top-level event listeners and initialization block in `game.js` into exported functions**

Near the cursor-trail declarations, replace the current top-level DOM lookup with mutable setup owned by the binder:

```js
let cursorTrailContainer = null;
let particleCount = 0;
const MAX_PARTICLES = 50;
let currentCursorEffect = localStorage.getItem('cursorEffect') || 'sparkle';
let lastMouseX = 0;
let lastMouseY = 0;

function handleCursorMouseMove(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    if (currentCursorEffect === 'none' || particleCount >= MAX_PARTICLES) {
        return;
    }

    createCursorParticle(e.clientX, e.clientY, e.movementX, e.movementY);
}
```

Delete the existing top-level `cursorSelect` initialization block and the
existing top-level `document.addEventListener('mousemove', ...)` call when this
replacement goes in, so cursor behavior is bound exactly once from
`bindGameEventListeners()`.

Then replace the bottom startup/event-listener block with these exports:

```js
export function bindGameEventListeners() {
    document.getElementById('btn-fold').addEventListener('click', () => {
        playerFold(0);
        resolvePlayerAction();
    });

    document.getElementById('btn-check').addEventListener('click', () => {
        playerCheck(0);
        resolvePlayerAction();
    });

    document.getElementById('btn-call').addEventListener('click', () => {
        playerCall(0);
        resolvePlayerAction();
    });

    document.getElementById('btn-raise').addEventListener('click', () => {
        const raiseAmount = Number.parseInt(document.getElementById('raise-slider').value, 10);
        playerRaise(0, raiseAmount);
        resolvePlayerAction();
    });

    document.getElementById('btn-allin').addEventListener('click', () => {
        playerAllIn(0);
        resolvePlayerAction();
    });

    document.getElementById('raise-slider').addEventListener('input', event => {
        document.getElementById('raise-amount').textContent = event.target.value;
    });

    document.getElementById('btn-half-pot').addEventListener('click', () => setPotPreset(0.5));
    document.getElementById('btn-one-pot').addEventListener('click', () => setPotPreset(1));
    document.getElementById('btn-two-pot').addEventListener('click', () => setPotPreset(2));
    document.getElementById('btn-new-game').addEventListener('click', resetAndStartNewGame);
    document.getElementById('btn-continue').addEventListener('click', resetAndStartNewGame);
    document.getElementById('btn-prev-hand').addEventListener('click', () => navigateToHand(-1));
    document.getElementById('btn-next-hand').addEventListener('click', () => navigateToHand(1));
    document.getElementById('btn-return-hand').addEventListener('click', returnToCurrentHand);

    document.getElementById('help-link').addEventListener('click', event => {
        event.preventDefault();
        document.getElementById('help-popup').classList.add('visible');
    });

    document.getElementById('btn-help-ok').addEventListener('click', () => {
        document.getElementById('help-popup').classList.remove('visible');
    });

    document.getElementById('help-popup').addEventListener('click', event => {
        if (event.target.id === 'help-popup') {
            document.getElementById('help-popup').classList.remove('visible');
        }
    });

    document.getElementById('btn-language').addEventListener('click', toggleLanguage);
    document.getElementById('btn-mode').addEventListener('click', toggleGameMode);
    document.getElementById('btn-stats-toggle').addEventListener('click', toggleShowAllStats);

    cursorTrailContainer = document.getElementById('cursor-trail');
    const cursorSelect = document.getElementById('cursor-select');
    if (cursorSelect) {
        cursorSelect.value = currentCursorEffect;
        cursorSelect.addEventListener('change', event => {
            currentCursorEffect = event.target.value;
            localStorage.setItem('cursorEffect', currentCursorEffect);
            cursorTrailContainer.innerHTML = '';
            particleCount = 0;
        });
    }

    document.addEventListener('mousemove', handleCursorMouseMove);
}

export function bootGame() {
    initPlayers();
    SoundManager.init();
    initOnlineCount();
    hideGameElements();
    updateUI();
    updateLanguageUI();
    updateGameModeUI();
    showMessage(t('startMessage'));

    if (showAllStats) {
        document.body.classList.add('show-all-stats');
        document.getElementById('btn-stats-toggle').classList.add('active');
    }

    updateAllPlayerStatsDisplays();
}
```

- [ ] **Step 2: Add the module entry point and switch the HTML entry script**

`src/main.js`

```js
import { bindGameEventListeners, bootGame } from '../game.js';

bindGameEventListeners();
bootGame();
```

Update the bottom of `index.html` to load the module entry:

```html
    <script type="module" src="src/main.js"></script>
```

- [ ] **Step 3: Update the README so local usage matches module-based loading**

Replace the current local-installation instructions with:

~~~~md
### Local Installation

```bash
git clone https://github.com/semibluff888/TexasHoldemPoker2.git
cd TexasHoldemPoker2
```

Serve the project over HTTP before opening it in the browser.

Examples:

```bash
# Python 3
python -m http.server 8000

# Docker Compose
docker compose up -d
```

Then visit one of these URLs:

```text
http://localhost:8000
http://localhost:1234
```
~~~~

- [ ] **Step 4: Run the full automated verification and syntax checks**

Run: `node --test`
Expected: PASS with all tests from `tests/core` and `tests/state`

Run: `node --check game.js`
Expected: no output and exit code `0`

Run: `node --check src/main.js`
Expected: no output and exit code `0`

- [ ] **Step 5: Run a static HTTP smoke check and verify the module entry in the browser**

Run: `docker compose up -d`
Expected: the `texas-holdem-poker` container starts without errors

Run: `docker compose ps`
Expected: `texas-holdem-poker` shows status `running` or `Up`

Manual browser check at `http://localhost:1234`:

```text
1. Load the page and confirm there are no module import errors in DevTools.
2. Click NEW GAME and confirm a hand starts normally.
3. Play through at least one round to showdown.
4. Confirm action buttons, help popup, language toggle, mode toggle, and history navigation still respond.
5. Confirm the online-count fallback still displays a value even without a live /api/heartbeat backend.
```

- [ ] **Step 6: Commit the module entry migration**

```bash
git add game.js index.html README.md src/main.js
git commit -m "refactor: add module entrypoint"
```
