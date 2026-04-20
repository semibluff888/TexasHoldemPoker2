import test from 'node:test';
import assert from 'node:assert/strict';

import { createPokerServer } from '../../server/index.js';

class FakeWebSocketServer {
    constructor({ server }) {
        this.server = server;
        this.listeners = new Map();
    }

    on(eventName, listener) {
        this.listeners.set(eventName, listener);
    }

    close(callback) {
        callback();
    }
}

test('createPokerServer.start returns the actual bound port when listening on port 0', async () => {
    const server = await createPokerServer({
        port: 0,
        webSocketModule: {
            WebSocketServer: FakeWebSocketServer
        }
    });

    try {
        const address = await server.start();

        assert.equal(address.host, '0.0.0.0');
        assert.notEqual(address.port, 0);
    } finally {
        await server.stop();
    }
});
