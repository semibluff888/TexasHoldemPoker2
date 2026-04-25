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

function createTimerHarness() {
    const timers = new Map();
    let nextTimerId = 1;

    return {
        setTimeout(callback, delay = 0, ...args) {
            const timerId = nextTimerId++;
            timers.set(timerId, {
                callback,
                delay,
                args,
                cleared: false
            });
            return timerId;
        },
        clearTimeout(timerId) {
            const timer = timers.get(timerId);
            if (timer) {
                timer.cleared = true;
            }
        },
        getByDelay(delay) {
            return Array.from(timers.entries())
                .filter(([, timer]) => timer.delay === delay)
                .map(([timerId, timer]) => ({ timerId, ...timer }));
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

async function flushMicrotasks(count = 4) {
    for (let index = 0; index < count; index += 1) {
        await Promise.resolve();
    }
}

function createClient({
    userId = 'guest-self',
    username = 'Alice',
    reconnect
} = {}) {
    const wsClient = new FakeWsClient();
    const client = new OnlineGameClient({
        wsClient,
        maxSupportedPlayers: 5,
        defaultBigBlind: 20,
        reconnect
    });

    wsClient.emit('AUTH_OK', {
        type: 'AUTH_OK',
        user: {
            id: userId,
            username
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

test('OnlineGameClient reconnects with the saved placeholder token and applies RECONNECTED snapshots', async () => {
    const timers = createTimerHarness();
    const { client, wsClient } = createClient({
        reconnect: {
            maxAttempts: 2,
            delaysMs: [10, 20],
            connectTimeoutMs: 0,
            setTimeout: timers.setTimeout,
            clearTimeout: timers.clearTimeout
        }
    });
    const reconnecting = [];
    const reconnected = [];

    client.on('reconnecting', payload => reconnecting.push(payload));
    client.on('reconnected', payload => reconnected.push(payload));

    await client.connect({ token: 'guest-placeholder:self' });
    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 1,
        players: [
            { id: 'guest-other', username: 'Bob', chips: 980, seat: 0 },
            { id: 'guest-self', username: 'Alice', chips: 990, seat: 1 }
        ]
    });

    wsClient.emit('close', { code: 1006 });

    assert.deepEqual(reconnecting[0], {
        roomId: 'room-1',
        attempt: 1,
        delay: 10
    });

    const reconnectTimerId = timers.getByDelay(10)[0]?.timerId;
    assert.ok(reconnectTimerId);

    timers.run(reconnectTimerId);
    await Promise.resolve();

    assert.deepEqual(wsClient.connectCalls, [
        { token: 'guest-placeholder:self' },
        { token: 'guest-placeholder:self' }
    ]);
    assert.deepEqual(wsClient.sent.at(-1), {
        type: 'RECONNECT',
        token: 'guest-placeholder:self',
        roomId: 'room-1'
    });

    wsClient.emit('RECONNECTED', {
        type: 'RECONNECTED',
        data: {
            roomId: 'room-1',
            seat: 1,
            players: [
                {
                    id: 'guest-other',
                    username: 'Bob',
                    chips: 940,
                    seat: 0,
                    bet: 40,
                    totalContribution: 60
                },
                {
                    id: 'guest-self',
                    username: 'Alice',
                    chips: 960,
                    seat: 1,
                    bet: 40,
                    totalContribution: 40
                }
            ],
            gameState: {
                handNumber: 7,
                phase: 'flop',
                dealerIndex: 1,
                communityCards: [
                    card('2', 'C'),
                    card('7', 'D'),
                    card('9', 'H')
                ],
                pot: 100,
                currentBet: 40,
                currentPlayerId: 'guest-other',
                minRaise: 20
            },
            yourCards: [
                card('A', 'S'),
                card('K', 'H')
            ]
        }
    });

    assert.equal(reconnected.length, 1);
    assert.equal(client.currentRoomId, 'room-1');
    assert.equal(client.state.handNumber, 7);
    assert.equal(client.state.phase, 'flop');
    assert.equal(client.state.pot, 100);
    assert.equal(client.state.currentBet, 40);
    assert.equal(client.state.dealerIndex, 0);
    assert.equal(client.state.currentPlayerIndex, 1);
    assert.equal(client.state.players[0].remoteId, 'guest-self');
    assert.equal(client.state.players[0].bet, 40);
    assert.equal(client.state.players[0].totalContribution, 40);
    assert.deepEqual(client.state.players[0].cards, [
        card('A', 'S'),
        card('K', 'H')
    ]);
    assert.equal(client.state.players[1].remoteId, 'guest-other');
    assert.equal(client.state.players[1].bet, 40);
    assert.deepEqual(client.state.communityCards, [
        card('2', 'C'),
        card('7', 'D'),
        card('9', 'H')
    ]);
});

test('OnlineGameClient stops after max reconnect attempts and can return to lobby locally', async () => {
    const timers = createTimerHarness();
    const { client, wsClient } = createClient({
        reconnect: {
            maxAttempts: 2,
            delaysMs: [10, 20],
            connectTimeoutMs: 0,
            setTimeout: timers.setTimeout,
            clearTimeout: timers.clearTimeout
        }
    });
    const reconnecting = [];
    const failures = [];
    const leftRooms = [];

    client.on('reconnecting', payload => reconnecting.push(payload));
    client.on('reconnect_failed', payload => failures.push(payload));
    client.on('room_left', payload => leftRooms.push(payload));

    await client.connect({ token: 'guest-placeholder:self' });
    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 0,
        players: [
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 0 },
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 1 }
        ]
    });

    wsClient.connect = function connect(options = {}) {
        this.connectCalls.push(options);
        return Promise.reject(new Error('offline'));
    };

    wsClient.emit('close', { code: 1006 });

    timers.run(timers.getByDelay(10).at(-1).timerId);
    await Promise.resolve();
    await Promise.resolve();

    timers.run(timers.getByDelay(20).at(-1).timerId);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(reconnecting.map(payload => payload.attempt), [1, 2]);
    assert.deepEqual(failures, [{
        roomId: 'room-1',
        attempts: 2
    }]);
    assert.equal(client.currentRoomId, 'room-1');

    client.returnToLobby();

    assert.equal(client.currentRoomId, null);
    assert.deepEqual(leftRooms.at(-1), {
        roomId: 'room-1',
        reason: 'reconnect_failed'
    });
    assert.equal(wsClient.sent.some(message => message.type === 'LEAVE_ROOM'), false);
});

test('OnlineGameClient counts reconnect attempts that never resolve as failures', async () => {
    const timers = createTimerHarness();
    const { client, wsClient } = createClient({
        reconnect: {
            maxAttempts: 2,
            delaysMs: [10, 20],
            connectTimeoutMs: 30,
            setTimeout: timers.setTimeout,
            clearTimeout: timers.clearTimeout
        }
    });
    const reconnecting = [];
    const failures = [];

    client.on('reconnecting', payload => reconnecting.push(payload));
    client.on('reconnect_failed', payload => failures.push(payload));

    await client.connect({ token: 'guest-placeholder:self' });
    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 0,
        players: [
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 0 },
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 1 }
        ]
    });

    wsClient.connect = function connect(options = {}) {
        this.connectCalls.push(options);
        return new Promise(() => {});
    };

    wsClient.emit('close', { code: 1006 });

    timers.run(timers.getByDelay(10).at(-1).timerId);
    const firstTimeoutId = timers.getByDelay(30).at(-1)?.timerId;
    assert.ok(firstTimeoutId);
    timers.run(firstTimeoutId);
    await flushMicrotasks();

    timers.run(timers.getByDelay(20).at(-1).timerId);
    const secondTimeoutId = timers.getByDelay(30).at(-1)?.timerId;
    assert.ok(secondTimeoutId);
    timers.run(secondTimeoutId);
    await flushMicrotasks();

    assert.deepEqual(reconnecting.map(payload => payload.attempt), [1, 2]);
    assert.deepEqual(failures, [{
        roomId: 'room-1',
        attempts: 2
    }]);
});

test('OnlineGameClient treats rejected RECONNECT responses as reconnect failures', async () => {
    const timers = createTimerHarness();
    const { client, wsClient } = createClient({
        reconnect: {
            maxAttempts: 2,
            delaysMs: [10, 20],
            connectTimeoutMs: 0,
            setTimeout: timers.setTimeout,
            clearTimeout: timers.clearTimeout
        }
    });
    const errors = [];
    const failures = [];

    client.on('error', payload => errors.push(payload));
    client.on('reconnect_failed', payload => failures.push(payload));

    await client.connect({ token: 'guest-placeholder:self' });
    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 0,
        players: [
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 0 },
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('close', { code: 1006 });

    timers.run(timers.getByDelay(10).at(-1).timerId);
    await Promise.resolve();

    assert.deepEqual(wsClient.sent.at(-1), {
        type: 'RECONNECT',
        token: 'guest-placeholder:self',
        roomId: 'room-1'
    });

    wsClient.emit('ERROR', {
        type: 'ERROR',
        message: 'Player is not waiting to reconnect in this room'
    });

    assert.deepEqual(errors, []);
    assert.deepEqual(failures, [{
        roomId: 'room-1',
        attempts: 1,
        message: 'Player is not waiting to reconnect in this room'
    }]);
    assert.equal(client.currentRoomId, 'room-1');
});

test('OnlineGameClient reconnects before sending lobby commands after returning offline', async () => {
    const { client, wsClient } = createClient();
    let connected = true;
    const roomConfig = {
        name: 'Recovered Room',
        maxPlayers: 3,
        smallBlind: 10,
        bigBlind: 20
    };

    wsClient.isConnected = () => connected;
    wsClient.connect = function connect(options = {}) {
        this.connectCalls.push(options);
        connected = true;
        return Promise.resolve(this);
    };
    wsClient.send = function send(message) {
        assert.equal(connected, true);
        this.sent.push(message);
        return this;
    };

    await client.connect({ token: 'guest-placeholder:self' });
    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 0,
        players: [
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 0 },
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 1 }
        ]
    });

    connected = false;
    client.returnToLobby();
    client.createRoom(roomConfig);
    await flushMicrotasks(8);

    assert.deepEqual(wsClient.connectCalls.at(-1), {
        token: 'guest-placeholder:self'
    });
    assert.deepEqual(wsClient.sent.at(-1), {
        type: 'CREATE_ROOM',
        config: roomConfig
    });

    connected = false;
    client.joinRoom('room-2');
    await flushMicrotasks(8);

    assert.deepEqual(wsClient.connectCalls.at(-1), {
        token: 'guest-placeholder:self'
    });
    assert.deepEqual(wsClient.sent.at(-1), {
        type: 'JOIN_ROOM',
        roomId: 'room-2'
    });
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

test('OnlineGameClient tracks retained disconnected players and emits reconnect roster events', () => {
    const { client, wsClient } = createClient();
    const disconnected = [];
    const reconnected = [];

    client.on('player_disconnected', payload => disconnected.push(payload));
    client.on('player_reconnected', payload => reconnected.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 1,
        players: [
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 0 },
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 1 }
        ]
    });

    wsClient.emit('PLAYER_DISCONNECTED', {
        type: 'PLAYER_DISCONNECTED',
        data: {
            playerId: 'guest-other',
            reason: 'disconnect',
            graceMs: 60000
        }
    });

    assert.equal(disconnected.length, 1);
    assert.equal(disconnected[0].player.remoteId, 'guest-other');
    assert.equal(disconnected[0].player.disconnected, true);
    assert.equal(disconnected[0].reason, 'disconnect');
    assert.equal(client.state.players[1].disconnected, true);

    wsClient.emit('PLAYER_RECONNECTED', {
        type: 'PLAYER_RECONNECTED',
        data: {
            player: { id: 'guest-other', username: 'Bob', chips: 980, seat: 0 }
        }
    });

    assert.equal(reconnected.length, 1);
    assert.equal(reconnected[0].player.remoteId, 'guest-other');
    assert.equal(reconnected[0].player.disconnected, false);
    assert.equal(client.state.players[1].chips, 980);
    assert.equal(client.state.players[1].disconnected, false);
});

test('OnlineGameClient applies disconnected markers from ROOM_JOINED snapshots', () => {
    const { client, wsClient } = createClient();

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 1,
        players: [
            { id: 'guest-other', username: 'Bob', chips: 1000, seat: 0, disconnected: true },
            { id: 'guest-self', username: 'Alice', chips: 1000, seat: 1 }
        ]
    });

    assert.equal(client.state.players[1].remoteId, 'guest-other');
    assert.equal(client.state.players[1].disconnected, true);
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

test('OnlineGameClient keeps a self mid-hand joiner out of showdown winner animation state', () => {
    const { client, wsClient } = createClient({
        userId: 'guest-new',
        username: 'Charlie'
    });
    const completions = [];

    client.on('hand_complete', payload => completions.push(payload));

    wsClient.emit('ROOM_JOINED', {
        type: 'ROOM_JOINED',
        roomId: 'room-1',
        seat: 2,
        players: [
            { id: 'guest-winner', username: 'Winner', chips: 980, seat: 0 },
            { id: 'guest-loser', username: 'Loser', chips: 980, seat: 1 },
            {
                id: 'guest-new',
                username: 'Charlie',
                chips: 1000,
                seat: 2,
                folded: true,
                isPendingJoin: true
            }
        ]
    });

    wsClient.emit('SHOWDOWN', {
        type: 'SHOWDOWN',
        data: {
            players: [
                {
                    id: 'guest-winner',
                    cards: [card('A', 'S'), card('A', 'H')],
                    handName: 'One Pair',
                    handRank: 2
                },
                {
                    id: 'guest-loser',
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
            winners: [{ playerId: 'guest-winner', amount: 40 }],
            players: [
                { id: 'guest-winner', chips: 1020 },
                { id: 'guest-loser', chips: 980 },
                { id: 'guest-new', chips: 1000 }
            ],
            nextHandIn: 0
        }
    });

    const completion = completions.at(-1);
    const selfPlayer = completion.players.find(player => player.remoteId === 'guest-new');
    const playersInHand = completion.players.filter(player => !player.folded && !player.isRemoved);

    assert.equal(selfPlayer.folded, true);
    assert.equal(selfPlayer.isPendingJoin, true);
    assert.deepEqual(playersInHand.map(player => player.remoteId), ['guest-winner', 'guest-loser']);
    assert.deepEqual(completion.winners, [1]);
    assert.equal(completion.players[1].handResult.name, 'One Pair');
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
