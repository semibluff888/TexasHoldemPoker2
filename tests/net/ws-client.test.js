import test from 'node:test';
import assert from 'node:assert/strict';

import { WebSocketClient } from '../../src/net/ws-client.js';

class FakeWebSocket {
    static instances = [];

    constructor(url) {
        this.url = url;
        this.readyState = FakeWebSocket.CONNECTING;
        this.sent = [];
        this.closeCalls = [];
        FakeWebSocket.instances.push(this);
    }

    send(payload) {
        this.sent.push(JSON.parse(payload));
    }

    close(code = 1000, reason = '') {
        this.closeCalls.push({ code, reason });
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ code, reason });
    }

    open() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    receive(message) {
        this.onmessage?.({
            data: typeof message === 'string' ? message : JSON.stringify(message)
        });
    }

    fail(error) {
        this.onerror?.(error);
    }
}

FakeWebSocket.CONNECTING = 0;
FakeWebSocket.OPEN = 1;
FakeWebSocket.CLOSING = 2;
FakeWebSocket.CLOSED = 3;

test('WebSocketClient.connect authenticates on open and dispatches typed messages', async () => {
    FakeWebSocket.instances.length = 0;

    const client = new WebSocketClient({
        url: 'ws://example.test/ws',
        token: 'guest-token',
        WebSocketClass: FakeWebSocket
    });

    const opened = [];
    const messages = [];
    const authEvents = [];

    client.on('open', () => opened.push('open'));
    client.on('message', message => messages.push(message));
    client.on('AUTH_OK', message => authEvents.push(message));

    const connectPromise = client.connect();
    const socket = FakeWebSocket.instances[0];

    assert.equal(socket.url, 'ws://example.test/ws');

    socket.open();
    await connectPromise;

    assert.deepEqual(socket.sent, [{
        type: 'AUTH',
        token: 'guest-token'
    }]);
    assert.equal(opened.length, 1);

    socket.receive({
        type: 'AUTH_OK',
        user: {
            id: 'guest-1',
            username: 'Guest 1'
        }
    });

    assert.equal(messages.length, 1);
    assert.deepEqual(authEvents[0], {
        type: 'AUTH_OK',
        user: {
            id: 'guest-1',
            username: 'Guest 1'
        }
    });
});

test('WebSocketClient.send stringifies payloads and disconnect closes the active socket', async () => {
    FakeWebSocket.instances.length = 0;

    const client = new WebSocketClient({
        url: 'ws://example.test/ws',
        WebSocketClass: FakeWebSocket
    });

    const connectPromise = client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    await connectPromise;

    client.send({ type: 'LIST_ROOMS' });
    client.disconnect(4001, 'done');

    assert.deepEqual(socket.sent.at(-1), { type: 'LIST_ROOMS' });
    assert.deepEqual(socket.closeCalls[0], {
        code: 4001,
        reason: 'done'
    });
});

test('WebSocketClient emits protocol_error when it receives malformed JSON', async () => {
    FakeWebSocket.instances.length = 0;

    const client = new WebSocketClient({
        url: 'ws://example.test/ws',
        WebSocketClass: FakeWebSocket
    });

    const protocolErrors = [];
    client.on('protocol_error', error => protocolErrors.push(error));

    const connectPromise = client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.open();
    await connectPromise;

    socket.receive('not-json');

    assert.equal(protocolErrors.length, 1);
    assert.match(protocolErrors[0].message, /invalid message payload/i);
});

test('WebSocketClient.send throws when the socket is not open', () => {
    const client = new WebSocketClient({
        url: 'ws://example.test/ws',
        WebSocketClass: FakeWebSocket
    });

    assert.throws(() => {
        client.send({ type: 'LIST_ROOMS' });
    }, /not connected/i);
});

test('WebSocketClient.connect rejects if the socket closes before opening', async () => {
    FakeWebSocket.instances.length = 0;

    const client = new WebSocketClient({
        url: 'ws://example.test/ws',
        WebSocketClass: FakeWebSocket
    });
    const closes = [];
    client.on('close', event => closes.push(event));

    const connectPromise = client.connect();
    const socket = FakeWebSocket.instances[0];
    socket.close(1006, 'network down');

    const outcome = await Promise.race([
        connectPromise.then(
            () => ({ status: 'resolved' }),
            error => ({ status: 'rejected', error })
        ),
        new Promise(resolve => setTimeout(() => resolve({ status: 'pending' }), 0))
    ]);

    assert.equal(outcome.status, 'rejected');
    assert.match(outcome.error.message, /connection closed before opening/i);
    assert.equal(client.socket, null);
    assert.deepEqual(closes, [{
        code: 1006,
        reason: 'network down'
    }]);
});
