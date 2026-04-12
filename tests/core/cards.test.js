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
