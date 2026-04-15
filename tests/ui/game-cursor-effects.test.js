import test from 'node:test';
import assert from 'node:assert/strict';

import { gameCursorEffects } from '../../src/ui/game-cursor-effects.js';

function snapshotGameCursorEffectsState() {
    return {
        initialized: gameCursorEffects.initialized,
        controlsBound: gameCursorEffects.controlsBound,
        mouseMoveBound: gameCursorEffects.mouseMoveBound,
        trailContainer: gameCursorEffects.trailContainer,
        particleCount: gameCursorEffects.particleCount,
        currentEffect: gameCursorEffects.currentEffect,
        lastMouseX: gameCursorEffects.lastMouseX,
        lastMouseY: gameCursorEffects.lastMouseY
    };
}

function restoreGameCursorEffectsState(snapshot) {
    gameCursorEffects.initialized = snapshot.initialized;
    gameCursorEffects.controlsBound = snapshot.controlsBound;
    gameCursorEffects.mouseMoveBound = snapshot.mouseMoveBound;
    gameCursorEffects.trailContainer = snapshot.trailContainer;
    gameCursorEffects.particleCount = snapshot.particleCount;
    gameCursorEffects.currentEffect = snapshot.currentEffect;
    gameCursorEffects.lastMouseX = snapshot.lastMouseX;
    gameCursorEffects.lastMouseY = snapshot.lastMouseY;
}

function restoreDocument(originalDocument) {
    if (originalDocument === undefined) {
        delete globalThis.document;
        return;
    }

    globalThis.document = originalDocument;
}

function restoreLocalStorage(originalLocalStorage) {
    if (originalLocalStorage === undefined) {
        delete globalThis.localStorage;
        return;
    }

    globalThis.localStorage = originalLocalStorage;
}

function restoreSetTimeout(originalSetTimeout) {
    if (originalSetTimeout === undefined) {
        delete globalThis.setTimeout;
        return;
    }

    globalThis.setTimeout = originalSetTimeout;
}

function createEventTarget(base = {}) {
    const listeners = new Map();

    return {
        ...base,
        addEventListener(eventName, handler) {
            if (!listeners.has(eventName)) {
                listeners.set(eventName, new Set());
            }
            listeners.get(eventName).add(handler);
        },
        dispatch(eventName, event = {}) {
            const handlers = listeners.get(eventName);
            if (!handlers) return;
            for (const handler of handlers) {
                handler(event);
            }
        },
        getListenerCount(eventName) {
            return listeners.get(eventName)?.size ?? 0;
        }
    };
}

function createLocalStorageHarness(seed = {}) {
    const values = { ...seed };

    return {
        values,
        getItem(key) {
            return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
        },
        setItem(key, value) {
            values[key] = String(value);
        }
    };
}

function createCursorTrailContainer() {
    const container = {
        children: [],
        _innerHTML: 'occupied',
        appendChild(node) {
            node.parentNode = this;
            this.children.push(node);
        }
    };

    Object.defineProperty(container, 'innerHTML', {
        get() {
            return container._innerHTML;
        },
        set(value) {
            container._innerHTML = value;
            if (value === '') {
                container.children = [];
            }
        }
    });

    return container;
}

function createParticleElement() {
    return {
        className: '',
        style: {},
        parentNode: null,
        removed: false,
        remove() {
            this.removed = true;
            if (!this.parentNode) return;

            this.parentNode.children = this.parentNode.children.filter(node => node !== this);
            this.parentNode = null;
        }
    };
}

function createCursorSelect(options) {
    return createEventTarget({
        value: '',
        querySelectorAll(selector) {
            assert.equal(selector, 'option');
            return options;
        }
    });
}

function createDocumentHarness({ cursorSelect, trailContainer }) {
    const listeners = new Map();

    return {
        getElementById(id) {
            if (id === 'cursor-select') return cursorSelect;
            if (id === 'cursor-trail') return trailContainer;
            return null;
        },
        createElement(tagName) {
            assert.equal(tagName, 'div');
            return createParticleElement();
        },
        addEventListener(eventName, handler) {
            if (!listeners.has(eventName)) {
                listeners.set(eventName, new Set());
            }
            listeners.get(eventName).add(handler);
        },
        dispatch(eventName, event = {}) {
            const handlers = listeners.get(eventName);
            if (!handlers) return;
            for (const handler of handlers) {
                handler(event);
            }
        },
        getListenerCount(eventName) {
            return listeners.get(eventName)?.size ?? 0;
        }
    };
}

test('init() restores the saved cursor effect and binds listeners only once', () => {
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalState = snapshotGameCursorEffectsState();

    const options = [
        { value: 'sparkle', textContent: '' },
        { value: 'comet', textContent: '' },
        { value: 'bubble', textContent: '' },
        { value: 'none', textContent: '' }
    ];
    const cursorSelect = createCursorSelect(options);
    const trailContainer = createCursorTrailContainer();
    const documentHarness = createDocumentHarness({ cursorSelect, trailContainer });
    const localStorageHarness = createLocalStorageHarness({ cursorEffect: 'comet' });

    try {
        globalThis.document = documentHarness;
        globalThis.localStorage = localStorageHarness;

        gameCursorEffects.initialized = false;
        gameCursorEffects.controlsBound = false;
        gameCursorEffects.mouseMoveBound = false;
        gameCursorEffects.trailContainer = null;
        gameCursorEffects.particleCount = 0;
        gameCursorEffects.currentEffect = 'sparkle';

        gameCursorEffects.init();

        assert.equal(gameCursorEffects.currentEffect, 'comet');
        assert.equal(cursorSelect.value, 'comet');
        assert.equal(cursorSelect.getListenerCount('change'), 1);
        assert.equal(documentHarness.getListenerCount('mousemove'), 1);

        gameCursorEffects.init();

        assert.equal(cursorSelect.getListenerCount('change'), 1);
        assert.equal(documentHarness.getListenerCount('mousemove'), 1);
    } finally {
        restoreDocument(originalDocument);
        restoreLocalStorage(originalLocalStorage);
        restoreGameCursorEffectsState(originalState);
    }
});

test('select changes persist the effect and clear existing particles', () => {
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalState = snapshotGameCursorEffectsState();

    const options = [
        { value: 'sparkle', textContent: '' },
        { value: 'comet', textContent: '' },
        { value: 'bubble', textContent: '' },
        { value: 'none', textContent: '' }
    ];
    const cursorSelect = createCursorSelect(options);
    const trailContainer = createCursorTrailContainer();
    const documentHarness = createDocumentHarness({ cursorSelect, trailContainer });
    const localStorageHarness = createLocalStorageHarness();

    try {
        globalThis.document = documentHarness;
        globalThis.localStorage = localStorageHarness;

        gameCursorEffects.initialized = false;
        gameCursorEffects.controlsBound = false;
        gameCursorEffects.mouseMoveBound = false;
        gameCursorEffects.trailContainer = null;
        gameCursorEffects.particleCount = 0;
        gameCursorEffects.currentEffect = 'sparkle';

        gameCursorEffects.init();
        trailContainer.innerHTML = 'has-particles';
        gameCursorEffects.particleCount = 6;

        cursorSelect.dispatch('change', {
            target: { value: 'bubble' }
        });

        assert.equal(gameCursorEffects.currentEffect, 'bubble');
        assert.equal(localStorageHarness.values.cursorEffect, 'bubble');
        assert.equal(trailContainer.innerHTML, '');
        assert.equal(gameCursorEffects.particleCount, 0);
    } finally {
        restoreDocument(originalDocument);
        restoreLocalStorage(originalLocalStorage);
        restoreGameCursorEffectsState(originalState);
    }
});

test('syncLabels() refreshes the cursor option labels through the provided translator', () => {
    const originalDocument = globalThis.document;
    const originalState = snapshotGameCursorEffectsState();

    const options = [
        { value: 'sparkle', textContent: '' },
        { value: 'comet', textContent: '' },
        { value: 'bubble', textContent: '' },
        { value: 'none', textContent: '' }
    ];
    const cursorSelect = createCursorSelect(options);
    const trailContainer = createCursorTrailContainer();
    const documentHarness = createDocumentHarness({ cursorSelect, trailContainer });

    try {
        globalThis.document = documentHarness;

        gameCursorEffects.syncLabels({
            t: key => `translated:${key}`
        });

        assert.deepEqual(
            options.map(option => option.textContent),
            [
                'translated:cursorSparkle',
                'translated:cursorComet',
                'translated:cursorBubble',
                'translated:cursorNone'
            ]
        );
    } finally {
        restoreDocument(originalDocument);
        restoreGameCursorEffectsState(originalState);
    }
});

test('handleMouseMove() appends particles for active effects and skips none', () => {
    const originalDocument = globalThis.document;
    const originalLocalStorage = globalThis.localStorage;
    const originalSetTimeout = globalThis.setTimeout;
    const originalState = snapshotGameCursorEffectsState();

    const options = [
        { value: 'sparkle', textContent: '' },
        { value: 'comet', textContent: '' },
        { value: 'bubble', textContent: '' },
        { value: 'none', textContent: '' }
    ];
    const cursorSelect = createCursorSelect(options);
    const trailContainer = createCursorTrailContainer();
    const documentHarness = createDocumentHarness({ cursorSelect, trailContainer });
    const localStorageHarness = createLocalStorageHarness({ cursorEffect: 'sparkle' });

    try {
        globalThis.document = documentHarness;
        globalThis.localStorage = localStorageHarness;
        globalThis.setTimeout = () => 0;

        gameCursorEffects.initialized = false;
        gameCursorEffects.controlsBound = false;
        gameCursorEffects.mouseMoveBound = false;
        gameCursorEffects.trailContainer = null;
        gameCursorEffects.particleCount = 0;
        gameCursorEffects.currentEffect = 'sparkle';

        gameCursorEffects.init();
        gameCursorEffects.handleMouseMove({
            clientX: 40,
            clientY: 60,
            movementX: 5,
            movementY: 2
        });

        assert.equal(trailContainer.children.length, 1);
        assert.equal(trailContainer.children[0].className, 'cursor-particle');
        assert.equal(gameCursorEffects.particleCount, 1);

        gameCursorEffects.currentEffect = 'none';
        gameCursorEffects.handleMouseMove({
            clientX: 44,
            clientY: 66,
            movementX: 1,
            movementY: 1
        });

        assert.equal(trailContainer.children.length, 1);
        assert.equal(gameCursorEffects.particleCount, 1);
    } finally {
        restoreDocument(originalDocument);
        restoreLocalStorage(originalLocalStorage);
        restoreSetTimeout(originalSetTimeout);
        restoreGameCursorEffectsState(originalState);
    }
});
