import test from 'node:test';
import assert from 'node:assert/strict';

import { EventEmitter } from '../../src/engine/event-emitter.js';
import { OnlineGameClient } from '../../src/net/online-game-client.js';

function card(value, suit) {
    return { value, suit };
}

class FakeWsClient extends EventEmitter {
    constructor() {
        super();
        this.sent = [];
        this.connectCalls = [];
    }

    connect(options = {}) {
        this.connectCalls.push(options);
        return Promise.resolve(this);
    }

    send(message) {
        this.sent.push(message);
        return this;
    }
}

function createClient() {
    const wsClient = new FakeWsClient();
    const client = new OnlineGameClient({
        wsClient,
        maxSupportedPlayers: 5,
        defaultBigBlind: 20
    });

    wsClient.emit('AUTH_OK', {
        type: 'AUTH_OK',
        user: {
            id: 'guest-self',
            username: 'Alice'
        }
    });

    return { client, wsClient };
}

test('OnlineGameClient forwards connect and lobby commands through the websocket client', async () => {
    const { client, wsClient } = createClient();
    const roomLists = [];

    client.on('room_list', payload => roomLists.push(payload.rooms));

    await client.connect({ token: 'placeholder-token' });
    client.listRooms();
    client.createRoom({
        name: 'Heads Up',
        maxPlayers: 2,
        smallBlind: 10,
        bigBlind: 20
    });
    client.joinRoom('room-7');
    client.leaveRoom();

    wsClient.emit('ROOM_LIST', {
        type: 'ROOM_LIST',
        rooms: [{
            roomId: 'room-7',
            name: 'Heads Up',
            playerCount: 1,
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20,
            status: 'waiting'
        }]
    });

    assert.deepEqual(wsClient.connectCalls, [{
        token: 'placeholder-token'
    }]);
    assert.deepEqual(wsClient.sent, [
        { type: 'LIST_ROOMS' },
        {
            type: 'CREATE_ROOM',
            config: {
                name: 'Heads Up',
                maxPlayers: 2,
                smallBlind: 10,
                bigBlind: 20
            }
        },
        { type: 'JOIN_ROOM', roomId: 'room-7' },
        { type: 'LEAVE_ROOM' }
    ]);
    assert.equal(client.user.username, 'Alice');
    assert.equal(client.rooms[0].roomId, 'room-7');
    assert.equal(roomLists[0][0].name, 'Heads Up');
});

test('OnlineGameClient maps room and hand events into a local mirrored table state with self at seat 0', () => {
    const { client, wsClient } = createClient();
    const handStarts = [];
    const blinds = [];
    const holeCardDeals = [];
    const turns = [];

    client.on('hand_start', payload => handStarts.push(payload));
    client.on('blinds_posted', payload => blinds.push(payload));
    client.on('hole_cards_dealt', payload => holeCardDeals.push(payload.playerId));
    client.on('action_required', payload => turns.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 1,
        players: [
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 0 },
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('BLINDS', {
        type: 'BLINDS',
        data: {
            smallBlind: { playerId: 'guest-self', amount: 10 },
            bigBlind: { playerId: 'guest-other', amount: 20 },
            pot: 30
        }
    });

    wsClient.emit('HAND_START', {
        type: 'HAND_START',
        data: {
            handNumber: 3,
            dealerIndex: 1,
            players: [
                { id: 'guest-other', username: 'Bob', chips: 980, seat: 0 },
                { id: 'guest-self', username: 'Alice', chips: 990, seat: 1 }
            ],
            yourCards: [
                card('A', 'S'),
                card('A', 'H')
            ]
        }
    });

    wsClient.emit('YOUR_TURN', {
        type: 'YOUR_TURN',
        data: {
            validActions: ['fold', 'call', 'raise', 'allin'],
            callAmount: 10,
            minRaise: 40,
            maxBet: 1000,
            pot: 30,
            currentBet: 20,
            timeLimit: 30
        }
    });

    assert.equal(client.currentRoomId, 'room-1');
    assert.equal(client.state.handNumber, 3);
    assert.equal(client.state.players[0].name, 'Alice');
    assert.equal(client.state.players[1].name, 'Bob');
    assert.deepEqual(client.state.players[0].cards, [
        card('A', 'S'),
        card('A', 'H')
    ]);
    assert.equal(client.state.players[1].cards.length, 2);
    assert.equal(handStarts.length, 1);
    assert.equal(blinds.length, 1);
    assert.deepEqual(blinds[0], {
        smallBlind: { playerId: 0, amount: 10 },
        bigBlind: { playerId: 1, amount: 20 }
    });
    assert.deepEqual(holeCardDeals, [0, 1]);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].playerId, 0);
    assert.equal(client.state.currentPlayerIndex, 0);
});

test('OnlineGameClient applies ACTION, COMMUNITY, and HAND_COMPLETE updates to the mirrored state', () => {
    const { client, wsClient } = createClient();
    const actions = [];
    const phases = [];
    const completions = [];

    client.on('action_executed', payload => actions.push(payload));
    client.on('phase_changed', payload => phases.push(payload));
    client.on('hand_complete', payload => completions.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 1,
        players: [
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 0 },
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('HAND_START', {
        type: 'HAND_START',
        data: {
            handNumber: 4,
            dealerIndex: 1,
            players: [
                { id: 'guest-other', username: 'Bob', chips: 980, seat: 0 },
                { id: 'guest-self', username: 'Alice', chips: 990, seat: 1 }
            ],
            yourCards: [
                card('A', 'S'),
                card('A', 'H')
            ]
        }
    });

    wsClient.emit('BLINDS', {
        type: 'BLINDS',
        data: {
            smallBlind: { playerId: 'guest-self', amount: 10 },
            bigBlind: { playerId: 'guest-other', amount: 20 },
            pot: 30
        }
    });

    wsClient.emit('ACTION', {
        type: 'ACTION',
        data: {
            playerId: 'guest-self',
            action: { type: 'call', amount: 10 },
            chips: 980,
            pot: 40,
            currentBet: 20
        }
    });

    wsClient.emit('ACTION', {
        type: 'ACTION',
        data: {
            playerId: 'guest-other',
            action: { type: 'check' },
            chips: 980,
            pot: 40,
            currentBet: 20
        }
    });

    wsClient.emit('COMMUNITY', {
        type: 'COMMUNITY',
        data: {
            phase: 'flop',
            cards: [
                card('2', 'C'),
                card('7', 'D'),
                card('9', 'H')
            ]
        }
    });

    wsClient.emit('SHOWDOWN', {
        type: 'SHOWDOWN',
        data: {
            players: [
                {
                    id: 'guest-self',
                    cards: [card('A', 'S'), card('A', 'H')],
                    handName: 'One Pair',
                    handRank: 2
                },
                {
                    id: 'guest-other',
                    cards: [card('K', 'S'), card('Q', 'S')],
                    handName: 'High Card',
                    handRank: 1
                }
            ],
            communityCards: [
                card('2', 'C'),
                card('7', 'D'),
                card('9', 'H'),
                card('J', 'C'),
                card('3', 'S')
            ],
            pots: []
        }
    });

    wsClient.emit('HAND_COMPLETE', {
        type: 'HAND_COMPLETE',
        data: {
            winners: [{ playerId: 'guest-self', amount: 40 }],
            players: [
                { id: 'guest-self', chips: 1020 },
                { id: 'guest-other', chips: 980 }
            ],
            nextHandIn: 0
        }
    });

    assert.equal(actions.length, 2);
    assert.equal(actions[0].playerId, 0);
    assert.equal(actions[0].chipsBeforeAction, 990);
    assert.equal(actions[1].playerId, 1);
    assert.equal(client.state.pot, 0);
    assert.equal(client.state.currentBet, 0);
    assert.equal(phases[0].phase, 'flop');
    assert.equal(client.state.players[0].bet, 0);
    assert.equal(completions.length, 1);
    assert.deepEqual(completions[0].winners, [0]);
    assert.equal(completions[0].amounts[0], 40);
    assert.equal(completions[0].players[0].chips, 1020);
    assert.equal(completions[0].players[0].handResult.name, 'One Pair');
});
