import test from 'node:test';
import assert from 'node:assert/strict';

import { RoomManager } from '../../server/rooms/room-manager.js';
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

test('ws-handler auto-pushes ROOM_LIST snapshots as rooms are created, joined, left, and destroyed', () => {
    const roomManager = new RoomManager();
    const handleWebSocket = createWebSocketHandler({
        roomManager,
        createGuestIdentity: (() => {
            const identities = [
                { id: 'guest-1', username: 'Guest 1' },
                { id: 'guest-2', username: 'Guest 2' }
            ];

            return () => identities.shift();
        })()
    });

    const hostSocket = new FakeSocket();
    const guestSocket = new FakeSocket();

    handleWebSocket(hostSocket, { url: '/ws' });
    handleWebSocket(guestSocket, { url: '/ws' });

    hostSocket.emit('message', JSON.stringify({
        type: 'CREATE_ROOM',
        config: {
            name: 'Default Loop',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    }));

    const roomId = hostSocket.getMessages('ROOM_CREATED')[0].roomId;
    assert.equal(hostSocket.getMessages('ROOM_LIST').at(-1).rooms[0].playerCount, 1);
    assert.equal(guestSocket.getMessages('ROOM_LIST').at(-1).rooms[0].playerCount, 1);

    guestSocket.emit('message', JSON.stringify({
        type: 'JOIN_ROOM',
        roomId
    }));

    assert.equal(guestSocket.getMessages('ROOM_ERROR').length, 0);
    assert.equal(guestSocket.getMessages('ROOM_JOINED').length, 1);
    assert.equal(guestSocket.getMessages('HAND_START').length, 1);
    assert.equal(hostSocket.getMessages('ROOM_LIST').at(-1).rooms[0].playerCount, 2);
    assert.equal(guestSocket.getMessages('ROOM_LIST').at(-1).rooms[0].playerCount, 2);

    guestSocket.emit('message', JSON.stringify({ type: 'LEAVE_ROOM' }));
    assert.equal(hostSocket.getMessages('ROOM_LIST').at(-1).rooms[0].playerCount, 1);
    assert.equal(guestSocket.getMessages('ROOM_LIST').at(-1).rooms[0].playerCount, 1);

    hostSocket.emit('message', JSON.stringify({ type: 'LEAVE_ROOM' }));

    assert.deepEqual(hostSocket.getMessages('ROOM_LIST').at(-1), {
        type: 'ROOM_LIST',
        rooms: []
    });
    assert.deepEqual(guestSocket.getMessages('ROOM_LIST').at(-1), {
        type: 'ROOM_LIST',
        rooms: []
    });
});

test('ws-handler auto-pushes the final ROOM_LIST when a player switches rooms', () => {
    const roomManager = new RoomManager();
    const handleWebSocket = createWebSocketHandler({
        roomManager,
        createGuestIdentity: (() => {
            const identities = [
                { id: 'guest-1', username: 'Guest 1' },
                { id: 'guest-2', username: 'Guest 2' }
            ];

            return () => identities.shift();
        })()
    });

    const guestOneSocket = new FakeSocket();
    const guestTwoSocket = new FakeSocket();

    handleWebSocket(guestOneSocket, { url: '/ws' });
    handleWebSocket(guestTwoSocket, { url: '/ws' });

    guestOneSocket.emit('message', JSON.stringify({
        type: 'CREATE_ROOM',
        config: {
            name: 'Room One',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    }));
    guestTwoSocket.emit('message', JSON.stringify({
        type: 'CREATE_ROOM',
        config: {
            name: 'Room Two',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    }));

    const roomOneId = guestOneSocket.getMessages('ROOM_CREATED')[0].roomId;
    const roomTwoId = guestTwoSocket.getMessages('ROOM_CREATED')[0].roomId;
    guestOneSocket.clearMessages();
    guestTwoSocket.clearMessages();

    guestOneSocket.emit('message', JSON.stringify({
        type: 'JOIN_ROOM',
        roomId: roomTwoId
    }));

    const guestOneRooms = guestOneSocket.getMessages('ROOM_LIST').at(-1).rooms;
    const guestTwoRooms = guestTwoSocket.getMessages('ROOM_LIST').at(-1).rooms;

    assert.equal(roomManager.getRoom(roomOneId), undefined);
    assert.equal(guestOneRooms.some(room => room.roomId === roomOneId), false);
    assert.equal(guestTwoRooms.some(room => room.roomId === roomOneId), false);
    assert.equal(guestOneRooms.find(room => room.roomId === roomTwoId)?.playerCount, 2);
    assert.equal(guestTwoRooms.find(room => room.roomId === roomTwoId)?.playerCount, 2);
});
