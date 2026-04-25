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

test('OnlineGameClient keeps its room snapshot aligned with repeated server ROOM_LIST pushes', () => {
    const { client, wsClient } = createClient();
    const roomLists = [];

    client.on('room_list', payload => roomLists.push(payload.rooms));

    wsClient.emit('ROOM_LIST', {
        type: 'ROOM_LIST',
        rooms: [{
            roomId: 'room-1',
            name: 'Practice Table',
            playerCount: 1,
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20,
            status: 'waiting'
        }]
    });

    wsClient.emit('ROOM_LIST', {
        type: 'ROOM_LIST',
        rooms: [{
            roomId: 'room-1',
            name: 'Practice Table',
            playerCount: 2,
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20,
            status: 'playing'
        }]
    });

    wsClient.emit('ROOM_LIST', {
        type: 'ROOM_LIST',
        rooms: []
    });

    assert.equal(roomLists.length, 3);
    assert.equal(roomLists[0][0].playerCount, 1);
    assert.equal(roomLists[1][0].playerCount, 2);
    assert.deepEqual(client.rooms, []);
});

test('OnlineGameClient emits joined and departed player snapshots for room roster updates', () => {
    const { client, wsClient } = createClient();
    const joined = [];
    const left = [];

    client.on('player_joined', payload => joined.push(payload));
    client.on('player_left', payload => left.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 1,
        players: [
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 0 },
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('PLAYER_JOINED', {
        type: 'PLAYER_JOINED',
        data: {
            player: { id: 'guest-cara', username: 'Cara', chips: 1000, seat: 2 }
        }
    });

    assert.equal(joined.length, 1);
    assert.equal(joined[0].player.name, 'Cara');
    assert.equal(joined[0].player.displayName, 'Cara');
    assert.equal(joined[0].player.remoteId, 'guest-cara');
    assert.equal(client.state.players.length, 3);

    wsClient.emit('PLAYER_LEFT', {
        type: 'PLAYER_LEFT',
        data: {
            playerId: 'guest-other',
            reason: 'left'
        }
    });

    assert.equal(left.length, 1);
    assert.equal(left[0].playerId, 'guest-other');
    assert.equal(left[0].reason, 'left');
    assert.equal(left[0].player.name, 'Bob');
    assert.equal(left[0].player.displayName, 'Bob');
    assert.equal(left[0].player.remoteId, 'guest-other');
    assert.equal(client.state.players.some(player => player.remoteId === 'guest-other'), false);
});

test('OnlineGameClient ignores malformed departed-player entries in HAND_COMPLETE snapshots', () => {
    const { client, wsClient } = createClient();
    const completions = [];

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
            handNumber: 1,
            dealerIndex: 0,
            players: [
                { id: 'guest-other', username: 'Bob', chips: 980, seat: 0 },
                { id: 'guest-self', username: 'Alice', chips: 990, seat: 1 }
            ],
            yourCards: [
                card('A', 'S'),
                card('K', 'H')
            ]
        }
    });

    wsClient.emit('PLAYER_LEFT', {
        type: 'PLAYER_LEFT',
        data: {
            playerId: 'guest-other',
            reason: 'left'
        }
    });

    wsClient.emit('HAND_COMPLETE', {
        type: 'HAND_COMPLETE',
        data: {
            winners: [{
                playerId: 'guest-self',
                amount: 30
            }],
            players: [
                { chips: 980 },
                { id: 'guest-self', chips: 1010 }
            ],
            nextHandIn: 0
        }
    });

    assert.equal(client.state.players.length, 1);
    assert.equal(client.state.players[0].remoteId, 'guest-self');
    assert.equal(client.state.players[0].chips, 1010);
    assert.equal(completions.at(-1).players.length, 1);
});

test('OnlineGameClient excludes a mid-hand newcomer from no-showdown hand completion', () => {
    const { client, wsClient } = createClient();
    const completions = [];

    client.on('hand_complete', payload => completions.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 0,
        players: [
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 0 },
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('HAND_START', {
        type: 'HAND_START',
        data: {
            handNumber: 2,
            dealerIndex: 0,
            players: [
                { id: 'guest-self', username: 'Alice', chips: 990, seat: 0 },
                { id: 'guest-other', username: 'Bob', chips: 980, seat: 1 }
            ],
            yourCards: [
                card('A', 'S'),
                card('K', 'H')
            ]
        }
    });

    wsClient.emit('ACTION', {
        type: 'ACTION',
        data: {
            playerId: 'guest-other',
            action: { type: 'fold' },
            chips: 980,
            pot: 40,
            currentBet: 20
        }
    });

    wsClient.emit('PLAYER_JOINED', {
        type: 'PLAYER_JOINED',
        data: {
            player: { id: 'guest-new', username: 'Charlie', chips: 1000, seat: 2 }
        }
    });

    wsClient.emit('HAND_COMPLETE', {
        type: 'HAND_COMPLETE',
        data: {
            winners: [{ playerId: 'guest-self', amount: 40 }],
            players: [
                { id: 'guest-self', chips: 1030 },
                { id: 'guest-other', chips: 980 },
                { id: 'guest-new', chips: 1000 }
            ],
            nextHandIn: 0
        }
    });

    const completion = completions.at(-1);
    const newcomer = completion.players.find(player => player.remoteId === 'guest-new');
    const playersInHand = completion.players.filter(player => !player.folded && !player.isRemoved);

    assert.equal(client.state.phase, 'showdown');
    assert.equal(newcomer.folded, true);
    assert.equal(newcomer.isPendingJoin, true);
    assert.deepEqual(playersInHand.map(player => player.remoteId), ['guest-self']);
});

test('OnlineGameClient reconciles departed players from no-showdown hand completion before PLAYER_LEFT arrives', () => {
    const { client, wsClient } = createClient();
    const completions = [];

    client.on('hand_complete', payload => completions.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 0,
        players: [
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 0 },
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('HAND_START', {
        type: 'HAND_START',
        data: {
            handNumber: 3,
            dealerIndex: 0,
            players: [
                { id: 'guest-self', username: 'Alice', chips: 990, seat: 0 },
                { id: 'guest-other', username: 'Bob', chips: 980, seat: 1 }
            ],
            yourCards: [
                card('A', 'S'),
                card('K', 'H')
            ]
        }
    });

    wsClient.emit('HAND_COMPLETE', {
        type: 'HAND_COMPLETE',
        data: {
            winners: [{ playerId: 'guest-self', amount: 30 }],
            players: [
                { id: 'guest-self', chips: 1020 }
            ],
            nextHandIn: 0
        }
    });

    assert.equal(client.state.phase, 'showdown');
    assert.deepEqual(
        completions.at(-1).players.map(player => player.remoteId),
        ['guest-self']
    );
    assert.equal(client.state.players.some(player => player.remoteId === 'guest-other'), false);
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
    assert.equal(turns[0].isLocalTurn, true);
    assert.equal(client.state.currentPlayerIndex, 0);
});

test('OnlineGameClient maps TURN_STARTED into a remote display-only action_required event', () => {
    const { client, wsClient } = createClient();
    const turns = [];

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

    wsClient.emit('HAND_START', {
        type: 'HAND_START',
        data: {
            handNumber: 5,
            dealerIndex: 1,
            players: [
                { id: 'guest-other', username: 'Bob', chips: 980, seat: 0 },
                { id: 'guest-self', username: 'Alice', chips: 990, seat: 1 }
            ],
            yourCards: [
                card('A', 'S'),
                card('K', 'H')
            ]
        }
    });

    wsClient.emit('TURN_STARTED', {
        type: 'TURN_STARTED',
        data: {
            playerId: 'guest-other',
            timeLimit: 30
        }
    });

    assert.equal(turns.length, 1);
    assert.deepEqual(turns[0], {
        playerId: 1,
        validActions: [],
        timeLimit: 30,
        isLocalTurn: false
    });
    assert.equal(client.state.currentPlayerIndex, 1);
});

test('OnlineGameClient preserves the active remote turn when a departed player reshuffles local seats', () => {
    const { client, wsClient } = createClient();
    const turns = [];

    client.on('action_required', payload => turns.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 2,
        players: [
            { id: 'guest-alice', username: 'Alice', chips: 1000, seat: 0 },
            { id: 'guest-bob', username: 'Bob', chips: 1000, seat: 1 },
            { id: 'guest-self', username: 'Cara', chips: 1000, seat: 2 }
        ]
    });

    wsClient.emit('HAND_START', {
        type: 'HAND_START',
        data: {
            handNumber: 6,
            dealerIndex: 0,
            players: [
                { id: 'guest-alice', username: 'Alice', chips: 980, seat: 0 },
                { id: 'guest-bob', username: 'Bob', chips: 980, seat: 1 },
                { id: 'guest-self', username: 'Cara', chips: 980, seat: 2 }
            ],
            yourCards: [
                card('A', 'S'),
                card('Q', 'H')
            ]
        }
    });

    wsClient.emit('TURN_STARTED', {
        type: 'TURN_STARTED',
        data: {
            playerId: 'guest-bob',
            timeLimit: 30
        }
    });

    assert.equal(turns.at(-1).playerId, 2);
    assert.equal(client.state.players[2].remoteId, 'guest-bob');
    assert.equal(client.state.currentPlayerIndex, 2);

    wsClient.emit('PLAYER_LEFT', {
        type: 'PLAYER_LEFT',
        data: {
            playerId: 'guest-alice',
            reason: 'left'
        }
    });

    assert.deepEqual(
        client.state.players.map(player => player.remoteId),
        ['guest-self', 'guest-bob']
    );
    assert.equal(client.state.currentPlayerIndex, 1);
    assert.equal(client.state.players[client.state.currentPlayerIndex].remoteId, 'guest-bob');
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

test('OnlineGameClient keeps the big blind client in sync and restores the turn after a rejected invalid action', () => {
    const { client, wsClient } = createClient();
    const turns = [];
    const errors = [];

    client.on('action_required', payload => turns.push(payload));
    client.on('error', payload => errors.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-2',
        seat: 1,
        players: [
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 0 },
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('BLINDS', {
        type: 'BLINDS',
        data: {
            smallBlind: { playerId: 'guest-other', amount: 10 },
            bigBlind: { playerId: 'guest-self', amount: 20 },
            pot: 30
        }
    });

    wsClient.emit('HAND_START', {
        type: 'HAND_START',
        data: {
            handNumber: 1,
            dealerIndex: 0,
            players: [
                { id: 'guest-other', username: 'Bob', chips: 990, seat: 0 },
                { id: 'guest-self', username: 'Alice', chips: 980, seat: 1 }
            ],
            yourCards: [
                card('A', 'S'),
                card('K', 'H')
            ]
        }
    });

    wsClient.emit('ACTION', {
        type: 'ACTION',
        data: {
            playerId: 'guest-other',
            action: { type: 'call', amount: 10 },
            chips: 980,
            pot: 40,
            currentBet: 20
        }
    });

    wsClient.emit('YOUR_TURN', {
        type: 'YOUR_TURN',
        data: {
            validActions: ['fold', 'check', 'raise', 'allin'],
            callAmount: 0,
            minRaise: 40,
            maxBet: 980,
            pot: 40,
            currentBet: 20,
            timeLimit: 30
        }
    });

    assert.equal(client.state.dealerIndex, 1);
    assert.equal(client.state.players[0].bet, 20);
    assert.equal(client.state.players[1].bet, 20);
    assert.equal(turns.at(-1).callAmount, 0);

    client.submitAction(0, { type: 'call' });
    wsClient.emit('ERROR', {
        type: 'ERROR',
        message: 'Nothing to call'
    });

    assert.deepEqual(wsClient.sent.at(-1), {
        type: 'PLAYER_ACTION',
        action: { type: 'call' }
    });
    assert.deepEqual(errors.at(-1), {
        message: 'Nothing to call'
    });
    assert.equal(client.state.currentPlayerIndex, 0);
});
