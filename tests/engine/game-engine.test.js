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

function createThreePlayerDeck() {
    return buildDeck([
        card('A', '♠'),
        card('K', '♠'),
        card('Q', '♠'),
        card('A', '♥'),
        card('K', '♥'),
        card('Q', '♥'),
        card('2', '♣'),
        card('7', '♣'),
        card('8', '♦'),
        card('9', '♥'),
        card('3', '♣'),
        card('J', '♣'),
        card('4', '♦'),
        card('5', '♠')
    ]);
}

function createEngine({ deck = createThreePlayerDeck() } = {}) {
    const engine = new GameEngine({
        deckFactory: () => deck,
        smallBlind: 10,
        bigBlind: 20
    });

    engine.addPlayer({ id: 0, name: 'You', isAI: false });
    engine.addPlayer({ id: 1, name: 'AI 1', isAI: true });
    engine.addPlayer({ id: 2, name: 'AI 2', isAI: true });

    return engine;
}

function createHeadsUpDeck() {
    return buildDeck([
        card('K', '♠'),
        card('A', '♠'),
        card('K', '♥'),
        card('A', '♥'),
        card('2', '♣'),
        card('7', '♣'),
        card('8', '♦'),
        card('9', '♥'),
        card('3', '♣'),
        card('J', '♣'),
        card('4', '♦'),
        card('5', '♠')
    ]);
}

function createHeadsUpEngine({ deck = createHeadsUpDeck() } = {}) {
    const engine = new GameEngine({
        deckFactory: () => deck,
        smallBlind: 10,
        bigBlind: 20
    });

    engine.addPlayer({ id: 0, name: 'You', isAI: false });
    engine.addPlayer({ id: 1, name: 'AI 1', isAI: true });

    return engine;
}

test('GameEngine.startHand posts blinds, deals cards, and requests the first preflop action', () => {
    const engine = createEngine();
    const requiredActions = [];

    engine.on('action_required', payload => {
        requiredActions.push(payload);
    });

    engine.state.dealerIndex = 0;
    engine.startHand();

    const state = engine.getFullState();

    assert.equal(state.phase, 'preflop');
    assert.equal(state.pot, 30);
    assert.equal(state.currentBet, 20);
    assert.equal(state.players[1].bet, 10);
    assert.equal(state.players[2].bet, 20);
    assert.deepEqual(state.players[0].cards, [
        card('Q', '♠'),
        card('Q', '♥')
    ]);
    assert.deepEqual(state.players[1].cards, [
        card('A', '♠'),
        card('A', '♥')
    ]);
    assert.deepEqual(state.players[2].cards, [
        card('K', '♠'),
        card('K', '♥')
    ]);
    assert.equal(state.currentPlayerIndex, 0);
    assert.equal(requiredActions.length, 1);
    assert.equal(requiredActions[0].playerId, 0);
    assert.deepEqual(requiredActions[0].validActions, ['fold', 'call', 'raise', 'allin']);
});

test('GameEngine.submitAction rejects illegal actions and emits an error event', () => {
    const engine = createEngine();
    const errors = [];

    engine.on('error', payload => {
        errors.push(payload);
    });

    engine.state.dealerIndex = 0;
    engine.startHand();

    const result = engine.submitAction(1, { type: 'call' });
    const state = engine.getFullState();

    assert.deepEqual(result, { ok: false, reason: 'Not your turn' });
    assert.equal(errors.length, 1);
    assert.deepEqual(errors[0], { playerId: 1, message: 'Not your turn' });
    assert.equal(state.pot, 30);
    assert.equal(state.currentPlayerIndex, 0);
    assert.equal(state.players[1].chips, 990);
});

test('GameEngine.submitAction emits action_executed with chipsBeforeAction for an all-in', () => {
    const engine = createEngine();
    const executedActions = [];

    engine.on('action_executed', payload => {
        executedActions.push(payload);
    });

    engine.state.dealerIndex = 0;
    engine.startHand();
    engine.submitAction(0, { type: 'fold' });
    engine.submitAction(1, { type: 'allin' });

    assert.equal(executedActions.length, 2);
    assert.equal(executedActions[1].playerId, 1);
    assert.equal(executedActions[1].action.type, 'allin');
    assert.equal(executedActions[1].action.totalBet, 1000);
    assert.equal(executedActions[1].chipsBeforeAction, 990);
    assert.equal(executedActions[1].playerState.chips, 0);
    assert.equal(executedActions[1].playerState.bet, 1000);
});

test('GameEngine.submitAction advances to the flop once every active player has matched the bet', () => {
    const engine = createEngine();
    const phaseChanges = [];
    const requiredActions = [];

    engine.on('phase_changed', payload => {
        phaseChanges.push(payload);
    });

    engine.on('action_required', payload => {
        requiredActions.push(payload);
    });

    engine.state.dealerIndex = 0;
    engine.startHand();
    engine.submitAction(0, { type: 'call' });
    engine.submitAction(1, { type: 'call' });
    engine.submitAction(2, { type: 'check' });

    const state = engine.getFullState();

    assert.equal(state.phase, 'flop');
    assert.equal(state.currentBet, 0);
    assert.equal(state.players[0].bet, 0);
    assert.equal(state.players[1].bet, 0);
    assert.equal(state.players[2].bet, 0);
    assert.deepEqual(state.communityCards, [
        card('7', '♣'),
        card('8', '♦'),
        card('9', '♥')
    ]);
    assert.equal(state.currentPlayerIndex, 1);
    assert.equal(phaseChanges.length, 1);
    assert.equal(phaseChanges[0].phase, 'flop');
    assert.equal(requiredActions.at(-1).playerId, 1);
    assert.deepEqual(requiredActions.at(-1).validActions, ['fold', 'check', 'raise', 'allin']);
});

test('GameEngine.submitAction ends the hand immediately when every other player folds', () => {
    const engine = createEngine();
    let handComplete = null;

    engine.on('hand_complete', payload => {
        handComplete = payload;
    });

    engine.state.dealerIndex = 0;
    engine.startHand();
    engine.submitAction(0, { type: 'fold' });
    engine.submitAction(1, { type: 'fold' });

    const state = engine.getFullState();

    assert.deepEqual(handComplete?.winners, [2]);
    assert.equal(handComplete?.amounts[2], 30);
    assert.equal(state.phase, 'showdown');
    assert.equal(state.pot, 0);
    assert.equal(state.players[2].chips, 1010);
});

test('GameEngine.getPlayerView hides other players hole cards before showdown', () => {
    const engine = createEngine();

    engine.state.dealerIndex = 0;
    engine.startHand();

    const playerView = engine.getPlayerView(0);

    assert.deepEqual(playerView.players[0].cards, [
        card('Q', '♠'),
        card('Q', '♥')
    ]);
    assert.deepEqual(playerView.players[1].cards, []);
    assert.deepEqual(playerView.players[2].cards, []);
});

test('GameEngine uses heads-up blind order with the dealer posting the small blind', () => {
    const engine = createHeadsUpEngine();

    engine.state.dealerIndex = 0;
    engine.startHand();

    const state = engine.getFullState();

    assert.equal(state.players[0].bet, 10);
    assert.equal(state.players[1].bet, 20);
    assert.equal(state.currentPlayerIndex, 0);
});

test('GameEngine resolves a heads-up showdown and awards the full pot to the best hand', () => {
    const engine = createHeadsUpEngine();
    let handComplete = null;

    engine.on('hand_complete', payload => {
        handComplete = payload;
    });

    engine.state.dealerIndex = 0;
    engine.startHand();

    engine.submitAction(0, { type: 'call' });
    engine.submitAction(1, { type: 'check' });
    engine.submitAction(1, { type: 'check' });
    engine.submitAction(0, { type: 'check' });
    engine.submitAction(1, { type: 'check' });
    engine.submitAction(0, { type: 'check' });
    engine.submitAction(1, { type: 'check' });
    engine.submitAction(0, { type: 'check' });

    const state = engine.getFullState();

    assert.equal(state.phase, 'showdown');
    assert.equal(state.pot, 0);
    assert.deepEqual(handComplete?.winners, [0]);
    assert.equal(handComplete?.amounts[0], 40);
    assert.equal(state.players[0].chips, 1020);
    assert.equal(state.players[1].chips, 980);
});

test('GameEngine keeps sparse seat ids aligned with their array positions across hand resets', () => {
    const engine = new GameEngine({
        deckFactory: () => createThreePlayerDeck(),
        smallBlind: 10,
        bigBlind: 20
    });

    engine.addPlayer({ id: 0, name: 'Seat 0', isAI: false });
    engine.addPlayer({ id: 2, name: 'Seat 2', isAI: true });
    engine.addPlayer({ id: 5, name: 'Seat 5', isAI: true });

    engine.state.dealerIndex = 0;
    engine.startHand();

    const state = engine.getFullState();

    assert.equal(state.players[0].id, 0);
    assert.equal(state.players[2].id, 2);
    assert.equal(state.players[5].id, 5);
    assert.equal(state.players[1], undefined);
    assert.equal(state.players[3], undefined);
    assert.equal(state.players[4], undefined);
});

test('GameEngine leaves displayedCommunityCards for the client reveal animation to advance', () => {
    const engine = createEngine();

    engine.state.dealerIndex = 0;
    engine.startHand();
    engine.submitAction(0, { type: 'call' });
    engine.submitAction(1, { type: 'call' });
    engine.submitAction(2, { type: 'check' });

    const state = engine.getFullState();

    assert.equal(state.phase, 'flop');
    assert.equal(state.communityCards.length, 3);
    assert.equal(state.displayedCommunityCards, 0);
});
