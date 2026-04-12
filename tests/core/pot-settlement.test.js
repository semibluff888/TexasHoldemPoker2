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
