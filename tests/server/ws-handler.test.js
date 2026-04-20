import test from 'node:test';
import assert from 'node:assert/strict';

import { createWebSocketHandler } from '../../server/ws/ws-handler.js';
import { FakeSocket } from '../../test-support/server-test-helpers.js';

function attachHandler({ roomManager, identity = { id: 'guest-1', username: 'Guest 1' } }) {
    const socket = new FakeSocket();
    const handleWebSocket = createWebSocketHandler({
        roomManager,
        createGuestIdentity: () => identity
    });

    handleWebSocket(socket, { url: '/ws' });
    return socket;
}

test('ws-handler responds to LIST_ROOMS with the current room summaries', () => {
    const socket = attachHandler({
        roomManager: {
            listRooms() {
                return [{
                    roomId: 'room-1',
                    name: 'Practice Table',
                    playerCount: 1,
                    maxPlayers: 2,
                    smallBlind: 10,
                    bigBlind: 20,
                    status: 'waiting'
                }];
            }
        }
    });

    socket.emit('message', JSON.stringify({ type: 'LIST_ROOMS' }));

    assert.deepEqual(socket.getMessages('ROOM_LIST')[0], {
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
});

test('ws-handler exposes a placeholder AUTH_OK response without enabling real authentication', () => {
    const socket = attachHandler({
        roomManager: {
            listRooms() {
                return [];
            }
        }
    });

    socket.emit('message', JSON.stringify({
        type: 'AUTH',
        token: 'placeholder-token'
    }));

    assert.deepEqual(socket.getMessages('AUTH_OK')[0], {
        type: 'AUTH_OK',
        user: {
            id: 'guest-1',
            username: 'Guest 1'
        },
        placeholder: true
    });
});

test('ws-handler creates a room, auto-joins the current guest, and routes actions to the active room', () => {
    const calls = [];
    const socket = attachHandler({
        roomManager: {
            createRoom(payload) {
                calls.push(['createRoom', payload]);
                return { roomId: 'room-7' };
            },
            joinRoom(roomId, payload) {
                calls.push(['joinRoom', roomId, payload]);
                return { roomId, seat: 0, players: [] };
            },
            handlePlayerAction(roomId, userId, action) {
                calls.push(['handlePlayerAction', roomId, userId, action]);
            },
            leaveRoom(roomId, userId, reason) {
                calls.push(['leaveRoom', roomId, userId, reason]);
                return { roomId, becameEmpty: false };
            },
            listRooms() {
                return [];
            }
        }
    });

    socket.emit('message', JSON.stringify({
        type: 'CREATE_ROOM',
        config: {
            name: 'Heads Up',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    }));
    socket.emit('message', JSON.stringify({
        type: 'PLAYER_ACTION',
        action: { type: 'call' }
    }));
    socket.emit('message', JSON.stringify({ type: 'LEAVE_ROOM' }));

    assert.deepEqual(socket.getMessages('ROOM_CREATED')[0], {
        type: 'ROOM_CREATED',
        roomId: 'room-7'
    });
    assert.deepEqual(calls, [
        ['createRoom', {
            ownerId: 'guest-1',
            config: {
                name: 'Heads Up',
                maxPlayers: 2,
                smallBlind: 10,
                bigBlind: 20
            }
        }],
        ['joinRoom', 'room-7', {
            userId: 'guest-1',
            username: 'Guest 1',
            socket
        }],
        ['handlePlayerAction', 'room-7', 'guest-1', { type: 'call' }],
        ['leaveRoom', 'room-7', 'guest-1', 'left']
    ]);
});

test('ws-handler leaves the current room when the socket closes', () => {
    const calls = [];
    const socket = attachHandler({
        roomManager: {
            createRoom() {
                return { roomId: 'room-close' };
            },
            joinRoom() {
                return { roomId: 'room-close', seat: 0, players: [] };
            },
            leaveRoom(roomId, userId, reason) {
                calls.push([roomId, userId, reason]);
                return { roomId, becameEmpty: false };
            },
            listRooms() {
                return [];
            }
        }
    });

    socket.emit('message', JSON.stringify({
        type: 'CREATE_ROOM',
        config: {
            name: 'Close Test',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    }));
    socket.close(1001, 'bye');

    assert.deepEqual(calls, [['room-close', 'guest-1', 'disconnect']]);
});
