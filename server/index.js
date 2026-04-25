import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import { createServerConfig } from './config.js';
import { RoomManager } from './rooms/room-manager.js';
import {
    createGuestIdentityFactory,
    createWebSocketHandler
} from './ws/ws-handler.js';

async function loadWebSocketModule() {
    try {
        return await import('ws');
    } catch (error) {
        throw new Error(
            'The `ws` package is required to run the multiplayer server. Install it with `npm install ws`.',
            { cause: error }
        );
    }
}

function isSocketOpen(socket) {
    return Boolean(socket) && (socket.readyState === undefined || socket.readyState === 1);
}

function installWebSocketHeartbeat(webSocketServer, {
    intervalMs,
    setInterval = globalThis.setInterval,
    clearInterval = globalThis.clearInterval
} = {}) {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0 || typeof setInterval !== 'function') {
        return {
            track() {},
            stop() {}
        };
    }

    function markAlive(socket) {
        socket.isAlive = true;
    }

    function track(socket) {
        markAlive(socket);
        socket.on?.('pong', () => markAlive(socket));
        socket.on?.('message', () => markAlive(socket));
    }

    const heartbeatTimer = setInterval(() => {
        for (const socket of webSocketServer.clients ?? []) {
            if (!isSocketOpen(socket)) {
                continue;
            }

            if (socket.isAlive === false) {
                socket.terminate?.();
                continue;
            }

            socket.isAlive = false;
            try {
                socket.ping?.();
            } catch {
                socket.terminate?.();
            }
        }
    }, intervalMs);
    heartbeatTimer?.unref?.();

    return {
        track,
        stop() {
            clearInterval?.(heartbeatTimer);
        }
    };
}

export async function createPokerServer(overrides = {}) {
    const config = createServerConfig(overrides);
    const roomManager = overrides.roomManager ?? new RoomManager({
        roomDefaults: {
            ...config.roomDefaults,
            autoStartMinPlayers: config.autoStartMinPlayers,
            autoRestartDelayMs: config.autoRestartDelayMs
        }
    });
    const httpServer = createServer((request, response) => {
        if (request.url === '/health') {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ ok: true }));
            return;
        }

        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'Not found' }));
    });
    const { WebSocketServer } = overrides.webSocketModule ?? await loadWebSocketModule();
    const webSocketServer = new WebSocketServer({ server: httpServer });
    const heartbeat = installWebSocketHeartbeat(webSocketServer, {
        intervalMs: config.webSocketHeartbeatIntervalMs,
        setInterval: overrides.setInterval,
        clearInterval: overrides.clearInterval
    });
    const handleWebSocket = createWebSocketHandler({
        roomManager,
        createGuestIdentity: overrides.createGuestIdentity ?? createGuestIdentityFactory({
            prefix: config.guestPrefix
        })
    });

    webSocketServer.on('connection', (socket, request) => {
        heartbeat.track(socket);
        handleWebSocket(socket, request);
    });

    return {
        config,
        roomManager,
        httpServer,
        webSocketServer,
        start() {
            return new Promise(resolve => {
                httpServer.listen(config.port, config.host, () => {
                    const address = httpServer.address();

                    resolve({
                        host: typeof address === 'string' ? config.host : address.address,
                        port: typeof address === 'string' ? config.port : address.port
                    });
                });
            });
        },
        stop() {
            return new Promise(resolve => {
                heartbeat.stop();
                webSocketServer.close(() => {
                    httpServer.close(() => resolve());
                });
            });
        }
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const server = await createPokerServer();
    const address = await server.start();
    console.log(`Poker server listening on ws://${address.host}:${address.port}`);
}
