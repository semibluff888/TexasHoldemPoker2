import test from 'node:test';
import assert from 'node:assert/strict';

import { GameSession } from '../../server/rooms/game-session.js';
import {
    FakeSocket,
    card,
    createHeadsUpDeck
} from '../../test-support/server-test-helpers.js';

function createSession() {
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
            autoRestartDelayMs: 0
        }
    });
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
