import test from 'node:test';
import assert from 'node:assert/strict';

import { createPlayer } from '../../src/state/game-state.js';
import {
    getValidActions,
    validateAction
} from '../../src/engine/action-validator.js';

function createGameState(overrides = {}) {
    return {
        currentPlayerIndex: 1,
        currentBet: 40,
        minRaise: 20,
        players: [
            createPlayer({ id: 0, isAI: false }),
            createPlayer({ id: 1, isAI: true, chips: 200, bet: 20 }),
            createPlayer({ id: 2, isAI: true, chips: 180, bet: 40 })
        ],
        ...overrides
    };
}

test('validateAction rejects actions from players whose turn has not started', () => {
    const gameState = createGameState();

    const result = validateAction(gameState, 2, { type: 'call' });

    assert.deepEqual(result, { valid: false, reason: 'Not your turn' });
});

test('validateAction rejects checking when the player is facing a bet', () => {
    const gameState = createGameState();

    const result = validateAction(gameState, 1, { type: 'check' });

    assert.deepEqual(result, {
        valid: false,
        reason: 'Cannot check when facing a bet'
    });
});

test('validateAction enforces minimum raises and stack caps', () => {
    const gameState = createGameState();

    assert.deepEqual(
        validateAction(gameState, 1, { type: 'raise', totalBet: 50 }),
        { valid: false, reason: 'Raise must be at least 60' }
    );

    assert.deepEqual(
        validateAction(gameState, 1, { type: 'raise', totalBet: 300 }),
        { valid: false, reason: 'Not enough chips' }
    );

    assert.deepEqual(
        validateAction(gameState, 1, { type: 'raise', totalBet: 80 }),
        { valid: true }
    );
});

test('getValidActions returns check branches and removes raises when the stack is too short', () => {
    const checkingState = createGameState({
        currentBet: 20
    });

    assert.deepEqual(
        getValidActions(checkingState, 1),
        ['fold', 'check', 'raise', 'allin']
    );

    const shortStackState = createGameState({
        players: [
            createPlayer({ id: 0, isAI: false }),
            createPlayer({ id: 1, isAI: true, chips: 10, bet: 20 }),
            createPlayer({ id: 2, isAI: true, chips: 180, bet: 40 })
        ]
    });

    assert.deepEqual(
        getValidActions(shortStackState, 1),
        ['fold', 'call', 'allin']
    );
});
