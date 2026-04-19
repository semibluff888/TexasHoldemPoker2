export class EventEmitter {
    constructor() {
        this._listeners = new Map();
    }

    on(eventName, listener) {
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }

        this._listeners.get(eventName).add(listener);
        return this;
    }

    off(eventName, listener) {
        this._listeners.get(eventName)?.delete(listener);
        return this;
    }

    emit(eventName, payload) {
        const listeners = this._listeners.get(eventName);

        if (!listeners) {
            return this;
        }

        for (const listener of listeners) {
            listener(payload);
        }

        return this;
    }

    once(eventName, listener) {
        const onceListener = (payload) => {
            this.off(eventName, onceListener);
            listener(payload);
        };

        return this.on(eventName, onceListener);
    }
}
