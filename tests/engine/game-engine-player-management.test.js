import test from 'node:test';
import assert from 'node:assert/strict';

import { createDeck } from '../../src/core/cards.js';
import { GameEngine } from '../../src/engine/game-engine.js';

function card(value, suit) {
    return { value, suit };
}

function cardKey({ value, suit }) {
    return `${value}${suit}`;
}

function buildDeck(drawOrder) {
    const reserved = new Set(drawOrder.map(cardKey));
    const remainder = createDeck().filter(deckCard => !reserved.has(cardKey(deckCard)));
    return [...remainder, ...drawOrder.slice().reverse()];
}

function createEngine(config = {}) {
    const engine = new GameEngine(config);
    engine.addPlayer({ id: 0, name: 'You', isAI: false });
    engine.addPlayer({ id: 1, name: 'AI Player 1', isAI: true });
    engine.addPlayer({ id: 2, name: 'AI Player 2', isAI: true });
    return engine;
}

test('removePlayer marks an occupied seat removed and folded', () => {
    const engine = createEngine();

    engine.removePlayer(1);

    const state = engine.getFullState();
    assert.equal(state.players[1].isRemoved, true);
    assert.equal(state.players[1].folded, true);
});

test('restorePlayer reopens a removed AI seat for the next hand', () => {
    const engine = createEngine();

    engine.removePlayer(1);
    engine.restorePlayer({ id: 1, name: 'AI Player 1', isAI: true });

    const state = engine.getFullState();
    assert.equal(state.players[1].isRemoved, false);
    assert.equal(state.players[1].isPendingJoin, true);
    assert.equal(state.players[1].folded, true);
    assert.equal(state.players[1].chips, engine.config.startingChips);
});

test('cycleAILevel rotates active AI seats through medium, hard, easy', () => {
    const engine = createEngine();

    engine.cycleAILevel(1);
    assert.equal(engine.getFullState().players[1].aiLevel, 'hard');

    engine.cycleAILevel(1);
    assert.equal(engine.getFullState().players[1].aiLevel, 'easy');

    engine.cycleAILevel(1);
    assert.equal(engine.getFullState().players[1].aiLevel, 'medium');
});

test('removePlayer advances the hand when the removed AI had the current turn', () => {
    const engine = createEngine();
    const requiredActions = [];

    engine.on('action_required', payload => {
        requiredActions.push(payload);
    });

    engine.state.dealerIndex = 1;
    engine.startHand();
    engine.removePlayer(1);

    const state = engine.getFullState();
    assert.equal(state.currentPlayerIndex, 2);
    assert.equal(requiredActions.at(-1).playerId, 2);
});

test('removePlayer re-settles an already-resolved all-in showdown as a fold and keeps the removed chips in the pot', () => {
    const deck = buildDeck([
        card('A', '♠'),
        card('K', '♣'),
        card('A', '♥'),
        card('K', '♦'),
        card('2', '♣'),
        card('7', '♦'),
        card('8', '♠'),
        card('9', '♣'),
        card('3', '♥'),
        card('J', '♠'),
        card('4', '♦'),
        card('5', '♣')
    ]);
    const engine = new GameEngine({
        deckFactory: () => deck,
        smallBlind: 10,
        bigBlind: 20
    });
    const handCompletions = [];

    engine.addPlayer({ id: 0, name: 'Human', isAI: false, chips: 4000 });
    engine.addPlayer({ id: 1, name: 'Short Stack AI', isAI: true, chips: 1000 });
    engine.on('hand_complete', payload => {
        handCompletions.push(payload);
    });

    engine.state.dealerIndex = 0;
    engine.startHand();
    engine.submitAction(0, { type: 'allin' });
    engine.submitAction(1, { type: 'call' });

    assert.equal(handCompletions.at(-1).amounts[0], 3000);
    assert.equal(handCompletions.at(-1).amounts[1], 2000);

    engine.removePlayer(1);

    const state = engine.getFullState();
    const latestCompletion = handCompletions.at(-1);

    assert.equal(handCompletions.length, 2);
    assert.deepEqual(latestCompletion.winners, [0]);
    assert.deepEqual(latestCompletion.amounts, { 0: 5000 });
    assert.equal(state.players[0].chips, 5000);
    assert.equal(state.players[1].chips, 0);
    assert.equal(state.players[1].folded, true);
    assert.equal(state.players[1].isRemoved, true);
    assert.equal(state.players[0].stats.showdownCount, 0);
    assert.equal(state.players[1].stats.showdownCount, 0);
    assert.equal(state.players[0].handResult, undefined);
    assert.equal(state.players[1].handResult, undefined);
});
