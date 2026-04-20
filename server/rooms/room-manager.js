import { normalizeRoomConfig } from '../config.js';
import { GameSession } from './game-session.js';

function createRoomId() {
    return Math.random().toString(36).slice(2, 8);
}

export class RoomManager {
    constructor({
        idGenerator = createRoomId,
        roomDefaults,
        sessionFactory
    } = {}) {
        this.rooms = new Map();
        this._idGenerator = idGenerator;
        this._roomDefaults = roomDefaults;
        this._sessionFactory = sessionFactory ?? (({ roomId, config }) => new GameSession({
            roomId,
            config
        }));
    }

    createRoom({ ownerId, config = {} }) {
        const roomId = this._idGenerator({ ownerId, config });
        const roomConfig = normalizeRoomConfig(config, this._roomDefaults);
        const session = this._sessionFactory({
            roomId,
            ownerId,
            config: roomConfig
        });

        this.rooms.set(roomId, session);
        return session;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    joinRoom(roomId, player) {
        const session = this.getRoom(roomId);
        if (!session) {
            throw new Error(`Room not found: ${roomId}`);
        }

        return session.join(player);
    }

    leaveRoom(roomId, userId, reason = 'left') {
        const session = this.getRoom(roomId);
        if (!session) {
            return {
                roomId,
                becameEmpty: true
            };
        }

        const result = session.leave(userId, reason);
        if (session.isEmpty()) {
            session.dispose?.();
            this.rooms.delete(roomId);
        }

        return result;
    }

    handlePlayerAction(roomId, userId, action) {
        const session = this.getRoom(roomId);
        if (!session) {
            throw new Error(`Room not found: ${roomId}`);
        }

        return session.handlePlayerAction(userId, action);
    }

    listRooms() {
        return Array.from(this.rooms.values()).map(session => session.getSummary());
    }
}
