import test from 'node:test';
import assert from 'node:assert/strict';

import { createPokerServer } from '../../server/index.js';

class FakeWebSocketServer {
    constructor({ server }) {
        this.server = server;
        this.clients = new Set();
        this.listeners = new Map();
    }

    on(eventName, listener) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        this.listeners.get(eventName).push(listener);
    }

    emit(eventName, ...args) {
        for (const listener of this.listeners.get(eventName) ?? []) {
            listener(...args);
        }
    }

    close(callback) {
        this.emit('close');
        callback();
    }
}

class FakeHeartbeatSocket {
    constructor() {
        this.readyState = 1;
        this.pingCalls = 0;
        this.terminated = false;
        this.listeners = new Map();
    }

    on(eventName, listener) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }

        this.listeners.get(eventName).push(listener);
    }

    emit(eventName, payload) {
        for (const listener of this.listeners.get(eventName) ?? []) {
            listener(payload);
        }
    }

    ping() {
        this.pingCalls += 1;
    }

    terminate() {
        this.terminated = true;
        this.readyState = 3;
        this.emit('close', { code: 1006, reason: 'heartbeat timeout' });
    }

    send() {}
}

function createIntervalHarness() {
    const intervals = new Map();
    let nextId = 1;

    return {
        setInterval(callback, delay = 0, ...args) {
            const id = nextId++;
            intervals.set(id, {
                callback,
                delay,
                args,
                cleared: false
            });
            return id;
        },
        clearInterval(id) {
            const interval = intervals.get(id);
            if (interval) {
                interval.cleared = true;
            }
        },
        getByDelay(delay) {
            return Array.from(intervals.entries())
                .filter(([, interval]) => interval.delay === delay)
                .map(([id, interval]) => ({ id, ...interval }));
        },
        run(id) {
            const interval = intervals.get(id);
            assert.ok(interval, `Unknown interval ${id}`);
            assert.equal(interval.cleared, false, `Interval ${id} was already cleared`);
            interval.callback(...interval.args);
        },
        wasCleared(id) {
            return intervals.get(id)?.cleared === true;
        }
    };
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

test('createPokerServer heartbeat terminates stale websocket clients', async () => {
    const intervals = createIntervalHarness();
    const server = await createPokerServer({
        port: 0,
        webSocketHeartbeatIntervalMs: 25,
        setInterval: intervals.setInterval,
        clearInterval: intervals.clearInterval,
        webSocketModule: {
            WebSocketServer: FakeWebSocketServer
        }
    });

    try {
        await server.start();

        const socket = new FakeHeartbeatSocket();
        server.webSocketServer.clients.add(socket);
        server.webSocketServer.emit('connection', socket, { url: '/ws' });

        const heartbeatIntervalId = intervals.getByDelay(25)[0]?.id;

        assert.ok(heartbeatIntervalId);

        intervals.run(heartbeatIntervalId);
        assert.equal(socket.pingCalls, 1);
        assert.equal(socket.terminated, false);

        socket.emit('pong');
        intervals.run(heartbeatIntervalId);
        assert.equal(socket.pingCalls, 2);
        assert.equal(socket.terminated, false);

        intervals.run(heartbeatIntervalId);
        assert.equal(socket.terminated, true);

        await server.stop();
        assert.equal(intervals.wasCleared(heartbeatIntervalId), true);
    } finally {
        if (server.httpServer.listening) {
            await server.stop();
        }
    }
});
