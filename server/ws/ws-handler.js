function parseMessage(raw) {
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function isSocketOpen(socket) {
    return Boolean(socket) && (socket.readyState === undefined || socket.readyState === 1);
}

function send(socket, message) {
    if (!isSocketOpen(socket)) {
        return;
    }

    socket.send(JSON.stringify(message));
}

function createErrorMessage(message) {
    return {
        type: 'ERROR',
        message
    };
}

const GUEST_PLACEHOLDER_TOKEN_PREFIX = 'guest-placeholder:';

export function createGuestIdentityFactory({ prefix = 'guest' } = {}) {
    let nextId = 1;

    return () => ({
        id: `${prefix}-${nextId}`,
        username: `Guest ${nextId++}`
    });
}

export function createGuestIdentityFromToken(token, fallbackUser) {
    const tokenText = typeof token === 'string' ? token : '';

    if (!tokenText.startsWith(GUEST_PLACEHOLDER_TOKEN_PREFIX)) {
        return fallbackUser;
    }

    const guestId = tokenText.slice(GUEST_PLACEHOLDER_TOKEN_PREFIX.length);
    if (!guestId || !/^[a-zA-Z0-9_-]+$/.test(guestId)) {
        return fallbackUser;
    }

    return {
        id: tokenText,
        username: `Guest ${guestId}`
    };
}

export function createWebSocketHandler({
    roomManager,
    createGuestIdentity = createGuestIdentityFactory()
}) {
    const activeSockets = new Set();

    function createRoomListMessage() {
        return {
            type: 'ROOM_LIST',
            rooms: roomManager.listRooms()
        };
    }

    function sendRoomList(socket) {
        send(socket, createRoomListMessage());
    }

    function broadcastRoomList() {
        const roomListMessage = createRoomListMessage();

        for (const activeSocket of activeSockets) {
            send(activeSocket, roomListMessage);
        }
    }

    return function handleWebSocket(socket, request) {
        activeSockets.add(socket);
        let user = createGuestIdentity(request);
        let currentRoomId = null;

        function leaveCurrentRoom(reason = 'left') {
            if (!currentRoomId) {
                return false;
            }

            roomManager.leaveRoom(currentRoomId, user.id, reason);
            currentRoomId = null;
            broadcastRoomList();
            return true;
        }

        function disconnectCurrentRoom() {
            if (!currentRoomId) {
                return false;
            }

            if (typeof roomManager.disconnectRoom === 'function') {
                roomManager.disconnectRoom(currentRoomId, user.id, socket);
            } else {
                roomManager.leaveRoom(currentRoomId, user.id, 'disconnect');
            }

            currentRoomId = null;
            broadcastRoomList();
            return true;
        }

        socket.on('message', raw => {
            const message = parseMessage(raw);
            if (!message?.type) {
                send(socket, createErrorMessage('Invalid message payload'));
                return;
            }

            try {
                switch (message.type) {
                    case 'AUTH':
                        user = createGuestIdentityFromToken(message.token, user);
                        send(socket, {
                            type: 'AUTH_OK',
                            user,
                            placeholder: true
                        });
                        break;
                    case 'LIST_ROOMS':
                        sendRoomList(socket);
                        break;
                    case 'CREATE_ROOM': {
                        const session = roomManager.createRoom({
                            ownerId: user.id,
                            config: message.config ?? {}
                        });
                        const nextRoomId = session.roomId ?? session.id;
                        const previousRoomId = currentRoomId;
                        send(socket, {
                            type: 'ROOM_CREATED',
                            roomId: nextRoomId
                        });
                        roomManager.joinRoom(nextRoomId, {
                            userId: user.id,
                            username: user.username,
                            socket
                        });
                        currentRoomId = nextRoomId;

                        if (previousRoomId && previousRoomId !== nextRoomId) {
                            roomManager.leaveRoom(previousRoomId, user.id, 'left');
                        }

                        broadcastRoomList();
                        break;
                    }
                    case 'JOIN_ROOM': {
                        const previousRoomId = currentRoomId;
                        roomManager.joinRoom(message.roomId, {
                            userId: user.id,
                            username: user.username,
                            socket
                        });
                        currentRoomId = message.roomId;
                        if (previousRoomId && previousRoomId !== currentRoomId) {
                            roomManager.leaveRoom(previousRoomId, user.id, 'left');
                        }

                        broadcastRoomList();
                        break;
                    }
                    case 'RECONNECT': {
                        user = createGuestIdentityFromToken(message.token, user);
                        roomManager.reconnectRoom(message.roomId, {
                            userId: user.id,
                            username: user.username,
                            socket
                        });
                        currentRoomId = message.roomId;
                        broadcastRoomList();
                        break;
                    }
                    case 'LEAVE_ROOM':
                        leaveCurrentRoom('left');
                        break;
                    case 'PLAYER_ACTION':
                        if (!currentRoomId) {
                            send(socket, createErrorMessage('Not in a room'));
                            break;
                        }

                        roomManager.handlePlayerAction(currentRoomId, user.id, message.action);
                        break;
                    default:
                        send(socket, createErrorMessage(`Unknown message type: ${message.type}`));
                        break;
                }
            } catch (error) {
                const roomError = message.type === 'CREATE_ROOM' || message.type === 'JOIN_ROOM';
                send(socket, roomError
                    ? { type: 'ROOM_ERROR', message: error.message }
                    : createErrorMessage(error.message));
            }
        });

        socket.on('close', () => {
            activeSockets.delete(socket);
            disconnectCurrentRoom();
        });
    };
}
