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
