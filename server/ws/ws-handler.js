function parseMessage(raw) {
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function send(socket, message) {
    socket.send(JSON.stringify(message));
}

function createErrorMessage(message) {
    return {
        type: 'ERROR',
        message
    };
}

export function createGuestIdentityFactory({ prefix = 'guest' } = {}) {
    let nextId = 1;

    return () => ({
        id: `${prefix}-${nextId}`,
        username: `Guest ${nextId++}`
    });
}

export function createWebSocketHandler({
    roomManager,
    createGuestIdentity = createGuestIdentityFactory()
}) {
    return function handleWebSocket(socket, request) {
        const user = createGuestIdentity(request);
        let currentRoomId = null;

        function leaveCurrentRoom(reason = 'left') {
            if (!currentRoomId) {
                return;
            }

            roomManager.leaveRoom(currentRoomId, user.id, reason);
            currentRoomId = null;
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
                        send(socket, {
                            type: 'AUTH_OK',
                            user,
                            placeholder: true
                        });
                        break;
                    case 'LIST_ROOMS':
                        send(socket, {
                            type: 'ROOM_LIST',
                            rooms: roomManager.listRooms()
                        });
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
            leaveCurrentRoom('disconnect');
        });
    };
}
