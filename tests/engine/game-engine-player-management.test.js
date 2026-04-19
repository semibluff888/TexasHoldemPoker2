import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '../../src/engine/game-engine.js';

function createEngine() {
    const engine = new GameEngine();
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
