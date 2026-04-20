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
    const handleWebSocket = createWebSocketHandler({
        roomManager,
        createGuestIdentity: overrides.createGuestIdentity ?? createGuestIdentityFactory({
            prefix: config.guestPrefix
        })
    });

    webSocketServer.on('connection', (socket, request) => {
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
