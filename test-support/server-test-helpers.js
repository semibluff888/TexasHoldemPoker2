import { createDeck } from '../src/core/cards.js';

export function card(value, suit) {
    return { value, suit };
}

function cardKey({ value, suit }) {
    return `${value}${suit}`;
}

export function buildDeck(drawOrder) {
    const reserved = new Set(drawOrder.map(cardKey));
    const remainder = createDeck().filter(deckCard => !reserved.has(cardKey(deckCard)));
    return [...remainder, ...drawOrder.slice().reverse()];
}

export function createHeadsUpDeck() {
    return buildDeck([
        card('K', '♠'),
        card('A', '♠'),
        card('K', '♥'),
        card('A', '♥'),
        card('2', '♣'),
        card('7', '♣'),
        card('8', '♦'),
        card('9', '♥'),
        card('3', '♣'),
        card('J', '♣'),
        card('4', '♦'),
        card('5', '♠')
    ]);
}

export class FakeSocket {
    constructor() {
        this.readyState = 1;
        this.sent = [];
        this._listeners = new Map();
    }

    on(eventName, listener) {
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, []);
        }

        this._listeners.get(eventName).push(listener);
        return this;
    }

    emit(eventName, payload) {
        const listeners = this._listeners.get(eventName) ?? [];

        for (const listener of listeners) {
            listener(payload);
        }
    }

    send(payload) {
        const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
        this.sent.push(parsed);
    }

    close(code = 1000, reason = 'closed') {
        this.readyState = 3;
        this.emit('close', { code, reason });
    }

    getMessages(type) {
        return this.sent.filter(message => message.type === type);
    }

    clearMessages() {
        this.sent.length = 0;
    }
}
