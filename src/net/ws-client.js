import { EventEmitter } from '../engine/event-emitter.js';

const SOCKET_OPEN = 1;

function bindSocketListener(socket, eventName, listener) {
    if (typeof socket.addEventListener === 'function') {
        socket.addEventListener(eventName, listener);
        return;
    }

    socket[`on${eventName}`] = listener;
}

function parseInboundMessage(raw) {
    const text = typeof raw === 'string' ? raw : String(raw);

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

export class WebSocketClient extends EventEmitter {
    constructor({
        url,
        token = null,
        WebSocketClass = globalThis.WebSocket
    } = {}) {
        super();
        this.url = url;
        this.token = token;
        this.WebSocketClass = WebSocketClass;
        this.socket = null;
    }

    connect({ token = this.token } = {}) {
        if (!this.WebSocketClass) {
            throw new Error('WebSocket is not available in this environment');
        }

        this.token = token;
        this.socket = new this.WebSocketClass(this.url);
        const socket = this.socket;

        return new Promise((resolve, reject) => {
            bindSocketListener(socket, 'open', () => {
                this.emit('open');

                if (this.token) {
                    this.send({
                        type: 'AUTH',
                        token: this.token
                    });
                }

                resolve(this);
            });

            bindSocketListener(socket, 'message', event => {
                const message = parseInboundMessage(event?.data ?? event);

                if (!message?.type) {
                    this.emit('protocol_error', new Error('Invalid message payload'));
                    return;
                }

                this.emit('message', message);
                this.emit(message.type, message);
            });

            bindSocketListener(socket, 'close', event => {
                if (this.socket === socket) {
                    this.socket = null;
                }

                this.emit('close', event);
            });

            bindSocketListener(socket, 'error', event => {
                this.emit('error', event);

                if (socket.readyState !== SOCKET_OPEN) {
                    reject(event instanceof Error ? event : new Error('WebSocket connection failed'));
                }
            });
        });
    }

    disconnect(code = 1000, reason = '') {
        if (!this.socket) {
            return this;
        }

        this.socket.close(code, reason);
        return this;
    }

    isConnected() {
        return Boolean(this.socket) && this.socket.readyState === SOCKET_OPEN;
    }

    send(message) {
        if (!this.isConnected()) {
            throw new Error('WebSocket is not connected');
        }

        this.socket.send(JSON.stringify(message));
        return this;
    }
}

export function createWebSocketClient(options) {
    return new WebSocketClient(options);
}
