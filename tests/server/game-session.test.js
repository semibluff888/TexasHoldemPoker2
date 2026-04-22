import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

import { createDeck } from '../../src/core/cards.js';
import { GameSession } from '../../server/rooms/game-session.js';
import {
    FakeSocket,
    card,
    createHeadsUpDeck
} from '../../test-support/server-test-helpers.js';

function createSession(config = {}) {
    return new GameSession({
        roomId: 'room-1',
        config: {
            name: 'Heads Up',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20,
            startingChips: 1000,
            deckFactory: () => createHeadsUpDeck(),
            autoStartMinPlayers: 2,
            autoRestartDelayMs: 0,
            ...config
        }
    });
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
        card('A', '\u2660'),
        card('K', '\u2660'),
        card('Q', '\u2660'),
        card('A', '\u2665'),
        card('K', '\u2665'),
        card('Q', '\u2665'),
        card('2', '\u2660'),
        card('7', '\u2665'),
        card('8', '\u2666'),
        card('9', '\u2663'),
        card('3', '\u2660'),
        card('J', '\u2665'),
        card('4', '\u2666'),
        card('5', '\u2663')
    ]);
}

function createTimerHarness() {
    const scheduledCalls = [];
    const timers = new Map();
    let nextTimerId = 1;

    function setTimeoutMock(callback, delay = 0, ...args) {
        const timerId = nextTimerId++;
        timers.set(timerId, {
            callback,
            delay,
            args,
            cleared: false
        });
        scheduledCalls.push({
            type: 'set',
            timerId,
            delay
        });
        return timerId;
    }

    function clearTimeoutMock(timerId) {
        scheduledCalls.push({
            type: 'clear',
            timerId
        });

        const timer = timers.get(timerId);
        if (timer) {
            timer.cleared = true;
        }
    }

    return {
        setTimeout: setTimeoutMock,
        clearTimeout: clearTimeoutMock,
        getSetCalls(delay) {
            return scheduledCalls.filter(call => call.type === 'set' && call.delay === delay);
        },
        wasCleared(timerId) {
            return scheduledCalls.some(call => call.type === 'clear' && call.timerId === timerId);
        },
        run(timerId) {
            const timer = timers.get(timerId);
            assert.ok(timer, `Unknown timer ${timerId}`);
            assert.equal(timer.cleared, false, `Timer ${timerId} was already cleared`);
            timer.cleared = true;
            timer.callback(...timer.args);
        }
    };
}

test('GameSession.join assigns seats, auto-starts a hand, and sends personalized HAND_START payloads', () => {
    const session = createSession();
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    const aliceJoin = session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    const bobJoin = session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    assert.equal(aliceJoin.seat, 0);
    assert.equal(bobJoin.seat, 1);

    assert.deepEqual(aliceSocket.getMessages('ROOM_JOINED')[0], {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 0,
        players: [{
            id: 'guest-alice',
            username: 'Alice',
            chips: 1000,
            seat: 0
        }]
    });
    assert.deepEqual(bobSocket.getMessages('ROOM_JOINED')[0], {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 1,
        players: [
            {
                id: 'guest-alice',
                username: 'Alice',
                chips: 1000,
                seat: 0
            },
            {
                id: 'guest-bob',
                username: 'Bob',
                chips: 1000,
                seat: 1
            }
        ]
    });

    const aliceHandStart = aliceSocket.getMessages('HAND_START').at(-1);
    const bobHandStart = bobSocket.getMessages('HAND_START').at(-1);

    assert.deepEqual(aliceHandStart.data.yourCards, [
        card('A', '♠'),
        card('A', '♥')
    ]);
    assert.deepEqual(bobHandStart.data.yourCards, [
        card('K', '♠'),
        card('K', '♥')
    ]);
    assert.equal(aliceHandStart.data.players.length, 2);
    assert.equal(bobHandStart.data.players.length, 2);
    assert.equal(aliceSocket.getMessages('BLINDS').length, 1);
    assert.deepEqual(aliceSocket.getMessages('YOUR_TURN').at(-1).data.validActions, [
        'fold',
        'call',
        'raise',
        'allin'
    ]);
    assert.equal(bobSocket.getMessages('YOUR_TURN').length, 0);
});

test('GameSession.handlePlayerAction broadcasts ACTION events and COMMUNITY updates with external player ids', () => {
    const session = createSession();
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();

    session.handlePlayerAction('guest-alice', { type: 'call' });

    const aliceAction = aliceSocket.getMessages('ACTION').at(-1);
    const bobAction = bobSocket.getMessages('ACTION').at(-1);

    assert.equal(aliceAction.data.playerId, 'guest-alice');
    assert.equal(bobAction.data.playerId, 'guest-alice');
    assert.equal(aliceAction.data.action.type, 'call');
    assert.equal(bobSocket.getMessages('YOUR_TURN').at(-1).data.callAmount, 0);

    session.handlePlayerAction('guest-bob', { type: 'check' });

    const community = aliceSocket.getMessages('COMMUNITY').at(-1);
    assert.equal(community.data.phase, 'flop');
    assert.equal(community.data.cards.length, 3);
});

test('GameSession starts a turn timeout for the acting player and auto-folds through ACTION when they are facing a bet', async () => {
    const timers = createTimerHarness();
    const session = createSession({
        actionTimeoutMs: 25,
        autoRestartDelayMs: 1000,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout
    });
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    const timeoutId = timers.getSetCalls(25).at(-1)?.timerId;

    assert.ok(timeoutId);

    aliceSocket.clearMessages();
    bobSocket.clearMessages();

    timers.run(timeoutId);

    assert.deepEqual(aliceSocket.getMessages('ACTION').at(-1), {
        type: 'ACTION',
        data: {
            playerId: 'guest-alice',
            action: { type: 'fold' },
            chips: 990,
            pot: 30,
            currentBet: 20
        }
    });
    assert.deepEqual(bobSocket.getMessages('ACTION').at(-1), {
        type: 'ACTION',
        data: {
            playerId: 'guest-alice',
            action: { type: 'fold' },
            chips: 990,
            pot: 30,
            currentBet: 20
        }
    });
});

test('GameSession clears the old turn timeout, schedules the next one, and auto-checks when the timed player can check', async () => {
    const timers = createTimerHarness();
    const session = createSession({
        actionTimeoutMs: 25,
        autoRestartDelayMs: 1000,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout
    });
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    const aliceTimeoutId = timers.getSetCalls(25).at(-1)?.timerId;

    assert.ok(aliceTimeoutId);

    aliceSocket.clearMessages();
    bobSocket.clearMessages();

    session.handlePlayerAction('guest-alice', { type: 'call' });

    assert.equal(timers.wasCleared(aliceTimeoutId), true);

    const bobTimeoutId = timers.getSetCalls(25).at(-1)?.timerId;

    assert.ok(bobTimeoutId);
    assert.notEqual(bobTimeoutId, aliceTimeoutId);

    timers.run(bobTimeoutId);

    assert.deepEqual(bobSocket.getMessages('ACTION').at(-1), {
        type: 'ACTION',
        data: {
            playerId: 'guest-bob',
            action: { type: 'check' },
            chips: 980,
            pot: 40,
            currentBet: 20
        }
    });
    assert.equal(aliceSocket.getMessages('COMMUNITY').at(-1).data.phase, 'flop');
    assert.equal(timers.getSetCalls(25).length, 3);
});

test('GameSession routes validation errors back to the acting player socket', () => {
    const session = createSession();
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();

    session.handlePlayerAction('guest-bob', { type: 'call' });

    assert.deepEqual(bobSocket.getMessages('ERROR').at(-1), {
        type: 'ERROR',
        message: 'Not your turn'
    });
    assert.equal(aliceSocket.getMessages('ERROR').length, 0);
});

test('GameSession.leave broadcasts PLAYER_LEFT and reports when the room becomes empty', () => {
    const session = createSession();
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();

    const firstLeave = session.leave('guest-alice', 'left');

    assert.equal(firstLeave.becameEmpty, false);
    assert.deepEqual(bobSocket.getMessages('PLAYER_LEFT').at(-1), {
        type: 'PLAYER_LEFT',
        data: {
            playerId: 'guest-alice',
            reason: 'left'
        }
    });

    const secondLeave = session.leave('guest-bob', 'disconnect');

    assert.equal(secondLeave.becameEmpty, true);
    assert.equal(session.isEmpty(), true);
});

test('GameSession clears the acting player timeout when that player leaves the room', async () => {
    const timers = createTimerHarness();
    const session = createSession({
        actionTimeoutMs: 25,
        autoRestartDelayMs: 1000,
        setTimeout: timers.setTimeout,
        clearTimeout: timers.clearTimeout
    });
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    const timeoutId = timers.getSetCalls(25).at(-1)?.timerId;

    assert.ok(timeoutId);

    session.leave('guest-alice', 'disconnect');

    assert.equal(timers.wasCleared(timeoutId), true);
});

test('GameSession.leave does not include a departed player in subsequent HAND_COMPLETE snapshots', () => {
    const session = createSession();
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();

    session.leave('guest-alice', 'left');

    assert.deepEqual(bobSocket.getMessages('HAND_COMPLETE').at(-1), {
        type: 'HAND_COMPLETE',
        data: {
            winners: [{
                playerId: 'guest-bob',
                amount: 30
            }],
            players: [{
                id: 'guest-bob',
                chips: 1010
            }],
            nextHandIn: 0
        }
    });
});

test('GameSession still reaches showdown when a departed player already contributed chips', () => {
    const session = new GameSession({
        roomId: 'room-removed-showdown',
        config: {
            name: 'Three Seat Table',
            maxPlayers: 3,
            smallBlind: 10,
            bigBlind: 20,
            startingChips: 1000,
            deckFactory: () => createThreePlayerDeck(),
            autoStartMinPlayers: 3,
            autoRestartDelayMs: 1000
        }
    });
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();
    const caraSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    session.engine.state.dealerIndex = 0;

    session.join({
        userId: 'guest-cara',
        username: 'Cara',
        socket: caraSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();
    caraSocket.clearMessages();

    session.handlePlayerAction('guest-alice', { type: 'call' });
    session.leave('guest-bob', 'left');
    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.handlePlayerAction('guest-alice', { type: 'check' });
    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.handlePlayerAction('guest-alice', { type: 'check' });
    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.handlePlayerAction('guest-alice', { type: 'check' });

    assert.equal(aliceSocket.getMessages('ERROR').length, 0);
    assert.equal(caraSocket.getMessages('ERROR').length, 0);
    assert.equal(bobSocket.getMessages('SHOWDOWN').length, 0);

    const showdown = aliceSocket.getMessages('SHOWDOWN').at(-1);

    assert.ok(showdown);
    assert.deepEqual(
        showdown.data.players.map(player => player.id),
        ['guest-alice', 'guest-cara']
    );
    assert.equal(showdown.data.communityCards.length, 5);
    assert.deepEqual(
        showdown.data.pots.map(pot => pot.amount),
        [30, 20]
    );
    assert.equal(
        showdown.data.pots.every(
            pot => pot.winners.length === 1 &&
                pot.winners[0].playerId === 'guest-cara' &&
                pot.winners[0].amount === 50
        ),
        true
    );

    assert.deepEqual(caraSocket.getMessages('HAND_COMPLETE').at(-1), {
        type: 'HAND_COMPLETE',
        data: {
            winners: [{
                playerId: 'guest-cara',
                amount: 50
            }],
            players: [
                {
                    id: 'guest-alice',
                    chips: 980
                },
                {
                    id: 'guest-cara',
                    chips: 1030
                }
            ],
            nextHandIn: 1000
        }
    });
});

test('GameSession.join preserves a returning player stack and committed chips during an active hand', () => {
    const session = new GameSession({
        roomId: 'room-returning-player',
        config: {
            name: 'Three Seat Table',
            maxPlayers: 3,
            smallBlind: 10,
            bigBlind: 20,
            startingChips: 1000,
            deckFactory: () => createThreePlayerDeck(),
            autoStartMinPlayers: 3,
            autoRestartDelayMs: 1000
        }
    });
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();
    const caraSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    session.engine.state.dealerIndex = 0;

    session.join({
        userId: 'guest-cara',
        username: 'Cara',
        socket: caraSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();
    caraSocket.clearMessages();

    session.handlePlayerAction('guest-alice', { type: 'call' });
    session.handlePlayerAction('guest-bob', { type: 'call' });
    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.leave('guest-bob', 'left');

    const bobReturnSocket = new FakeSocket();
    const bobRejoin = session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobReturnSocket
    });

    assert.equal(bobRejoin.seat, 1);
    assert.deepEqual(bobReturnSocket.getMessages('ROOM_JOINED').at(-1), {
        type: 'ROOM_JOINED',
        roomId: 'room-returning-player',
        seat: 1,
        players: [
            {
                id: 'guest-alice',
                username: 'Alice',
                chips: 980,
                seat: 0
            },
            {
                id: 'guest-bob',
                username: 'Bob',
                chips: 980,
                seat: 1
            },
            {
                id: 'guest-cara',
                username: 'Cara',
                chips: 980,
                seat: 2
            }
        ]
    });

    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.handlePlayerAction('guest-alice', { type: 'check' });
    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.handlePlayerAction('guest-alice', { type: 'check' });
    session.handlePlayerAction('guest-cara', { type: 'check' });
    session.handlePlayerAction('guest-alice', { type: 'check' });

    const showdown = aliceSocket.getMessages('SHOWDOWN').at(-1);

    assert.ok(showdown);
    assert.deepEqual(
        showdown.data.players.map(player => player.id),
        ['guest-alice', 'guest-cara']
    );
    assert.deepEqual(
        showdown.data.pots,
        [{
            name: 'Main Pot',
            amount: 60,
            winners: [{
                playerId: 'guest-cara',
                amount: 60
            }]
        }]
    );

    assert.deepEqual(bobReturnSocket.getMessages('HAND_COMPLETE').at(-1), {
        type: 'HAND_COMPLETE',
        data: {
            winners: [{
                playerId: 'guest-cara',
                amount: 60
            }],
            players: [
                {
                    id: 'guest-alice',
                    chips: 980
                },
                {
                    id: 'guest-bob',
                    chips: 980
                },
                {
                    id: 'guest-cara',
                    chips: 1040
                }
            ],
            nextHandIn: 1000
        }
    });
});

test('GameSession.join keeps a mid-hand newcomer out of the current betting turn order until the next hand', () => {
    const session = new GameSession({
        roomId: 'room-join-pending',
        config: {
            name: 'Three Seat Table',
            maxPlayers: 3,
            smallBlind: 10,
            bigBlind: 20,
            startingChips: 1000,
            deckFactory: () => createHeadsUpDeck(),
            autoStartMinPlayers: 2,
            autoRestartDelayMs: 0
        }
    });
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();
    const charlieSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });
    session.join({
        userId: 'guest-charlie',
        username: 'Charlie',
        socket: charlieSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();
    charlieSocket.clearMessages();

    session.handlePlayerAction('guest-alice', { type: 'call' });
    session.handlePlayerAction('guest-bob', { type: 'check' });

    const charlieState = session.engine.getFullState().players[2];

    assert.equal(session.engine.state.phase, 'flop');
    assert.equal(session.engine.state.currentPlayerIndex, 1);
    assert.equal(charlieState.isPendingJoin, true);
    assert.equal(charlieState.cards.length, 0);
    assert.equal(bobSocket.getMessages('YOUR_TURN').length, 2);
    assert.equal(charlieSocket.getMessages('YOUR_TURN').length, 0);
    assert.equal(charlieSocket.getMessages('COMMUNITY').length, 1);
    assert.equal(bobSocket.getMessages('COMMUNITY').length, 1);
});

test('GameSession sends HAND_START before BLINDS when auto-starting the next hand', async () => {
    const session = createSession();
    const aliceSocket = new FakeSocket();
    const bobSocket = new FakeSocket();

    session.join({
        userId: 'guest-alice',
        username: 'Alice',
        socket: aliceSocket
    });
    session.join({
        userId: 'guest-bob',
        username: 'Bob',
        socket: bobSocket
    });

    aliceSocket.clearMessages();
    bobSocket.clearMessages();

    session.handlePlayerAction('guest-alice', { type: 'fold' });
    await delay(10);

    const aliceTypes = aliceSocket.sent.map(message => message.type);
    const bobTypes = bobSocket.sent.map(message => message.type);
    const aliceSecondHandStart = aliceTypes.lastIndexOf('HAND_START');
    const aliceSecondHandBlinds = aliceTypes.lastIndexOf('BLINDS');
    const bobSecondHandStart = bobTypes.lastIndexOf('HAND_START');
    const bobSecondHandBlinds = bobTypes.lastIndexOf('BLINDS');

    assert.ok(aliceSecondHandStart > aliceTypes.indexOf('HAND_COMPLETE'));
    assert.ok(bobSecondHandStart > bobTypes.indexOf('HAND_COMPLETE'));
    assert.ok(aliceSecondHandStart < aliceSecondHandBlinds);
    assert.ok(bobSecondHandStart < bobSecondHandBlinds);
    assert.ok(bobSecondHandBlinds < bobTypes.lastIndexOf('YOUR_TURN'));
});
