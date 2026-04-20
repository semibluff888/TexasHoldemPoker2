import test from 'node:test';
import assert from 'node:assert/strict';

import { RoomManager } from '../../server/rooms/room-manager.js';

function createFakeSession({ roomId, config, emptyAfterLeave = false }) {
    return {
        roomId,
        config,
        joinCalls: [],
        leaveCalls: [],
        join(payload) {
            this.joinCalls.push(payload);
            return {
                roomId,
                seat: 0,
                players: []
            };
        },
        leave(userId, reason = 'left') {
            this.leaveCalls.push({ userId, reason });
            return {
                roomId,
                becameEmpty: emptyAfterLeave
            };
        },
        getSummary() {
            return {
                roomId,
                name: config.name,
                playerCount: 0,
                maxPlayers: config.maxPlayers,
                smallBlind: config.smallBlind,
                bigBlind: config.bigBlind,
                status: 'waiting'
            };
        },
        isEmpty() {
            return emptyAfterLeave && this.leaveCalls.length > 0;
        }
    };
}

test('RoomManager.createRoom stores sessions and exposes summaries through listRooms', () => {
    const manager = new RoomManager({
        idGenerator: () => 'room-1',
        sessionFactory: ({ roomId, config }) => createFakeSession({ roomId, config })
    });

    const session = manager.createRoom({
        ownerId: 'guest-1',
        config: {
            name: 'Practice Table',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    });

    assert.equal(session.roomId, 'room-1');
    assert.equal(manager.getRoom('room-1'), session);
    assert.deepEqual(manager.listRooms(), [{
        roomId: 'room-1',
        name: 'Practice Table',
        playerCount: 0,
        maxPlayers: 2,
        smallBlind: 10,
        bigBlind: 20,
        status: 'waiting'
    }]);
});

test('RoomManager.joinRoom delegates to the target session', () => {
    let createdSession = null;
    const manager = new RoomManager({
        idGenerator: () => 'room-join',
        sessionFactory: ({ roomId, config }) => {
            createdSession = createFakeSession({ roomId, config });
            return createdSession;
        }
    });

    manager.createRoom({
        ownerId: 'guest-1',
        config: {
            name: 'Joinable Table',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    });

    const joinResult = manager.joinRoom('room-join', {
        userId: 'guest-2',
        username: 'Guest 2',
        socket: { id: 'socket-2' }
    });

    assert.deepEqual(joinResult, {
        roomId: 'room-join',
        seat: 0,
        players: []
    });
    assert.deepEqual(createdSession.joinCalls, [{
        userId: 'guest-2',
        username: 'Guest 2',
        socket: { id: 'socket-2' }
    }]);
});

test('RoomManager.leaveRoom removes sessions that become empty', () => {
    const manager = new RoomManager({
        idGenerator: () => 'room-empty',
        sessionFactory: ({ roomId, config }) => createFakeSession({
            roomId,
            config,
            emptyAfterLeave: true
        })
    });

    manager.createRoom({
        ownerId: 'guest-1',
        config: {
            name: 'Temporary Table',
            maxPlayers: 2,
            smallBlind: 10,
            bigBlind: 20
        }
    });

    const result = manager.leaveRoom('room-empty', 'guest-1', 'disconnect');

    assert.deepEqual(result, {
        roomId: 'room-empty',
        becameEmpty: true
    });
    assert.equal(manager.getRoom('room-empty'), undefined);
    assert.deepEqual(manager.listRooms(), []);
});

test('RoomManager throws when asked to join a missing room', () => {
    const manager = new RoomManager();

    assert.throws(() => {
        manager.joinRoom('missing-room', {
            userId: 'guest-1',
            username: 'Guest 1',
            socket: {}
        });
    }, /Room not found/);
});
