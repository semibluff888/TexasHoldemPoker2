import test from 'node:test';
import assert from 'node:assert/strict';

import { gameAudio } from '../../src/ui/game-audio.js';

function snapshotGameAudioState() {
    return {
        initialized: gameAudio.initialized,
        controlsBound: gameAudio.controlsBound,
        unlockBound: gameAudio.unlockBound,
        audioCache: gameAudio.audioCache,
        musicElement: gameAudio.musicElement,
        musicEnabled: gameAudio.musicEnabled,
        sfxEnabled: gameAudio.sfxEnabled,
        volume: gameAudio.volume,
        audioUnlocked: gameAudio.audioUnlocked
    };
}

function restoreGameAudioState(snapshot) {
    gameAudio.initialized = snapshot.initialized;
    gameAudio.controlsBound = snapshot.controlsBound;
    gameAudio.unlockBound = snapshot.unlockBound;
    gameAudio.audioCache = snapshot.audioCache;
    gameAudio.musicElement = snapshot.musicElement;
    gameAudio.musicEnabled = snapshot.musicEnabled;
    gameAudio.sfxEnabled = snapshot.sfxEnabled;
    gameAudio.volume = snapshot.volume;
    gameAudio.audioUnlocked = snapshot.audioUnlocked;
}

function restoreDocument(originalDocument) {
    if (originalDocument === undefined) {
        delete globalThis.document;
        return;
    }

    globalThis.document = originalDocument;
}

function createDocumentListenerHarness() {
    const listeners = new Map();
    const addCalls = [];
    const removeCalls = [];

    return {
        addEventListener(eventName, handler) {
            addCalls.push(eventName);
            if (!listeners.has(eventName)) {
                listeners.set(eventName, new Set());
            }
            listeners.get(eventName).add(handler);
        },
        removeEventListener(eventName, handler) {
            removeCalls.push(eventName);
            listeners.get(eventName)?.delete(handler);
        },
        dispatch(eventName) {
            const handlers = listeners.get(eventName);
            if (!handlers) return;
            for (const handler of handlers) {
                handler();
            }
        },
        getListenerCount(eventName) {
            return listeners.get(eventName)?.size ?? 0;
        },
        addCalls,
        removeCalls
    };
}

async function flushAsyncWork() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

function createFakeMusicElement() {
    let canPlayThroughHandler = null;

    return {
        readyState: 0,
        volume: 0,
        loop: false,
        currentTime: 0,
        loadCalls: 0,
        playCalls: 0,
        addEventListener(eventName, handler) {
            if (eventName === 'canplaythrough') {
                canPlayThroughHandler = handler;
            }
        },
        load() {
            this.loadCalls += 1;
        },
        play() {
            this.playCalls += 1;
            return Promise.resolve();
        },
        pause() { },
        triggerCanPlayThrough() {
            this.readyState = 4;
            if (canPlayThroughHandler) {
                canPlayThroughHandler();
            }
        }
    };
}

test('music resumes when re-enabled after pending canplaythrough callback skipped playback while muted', () => {
    const originalDocument = globalThis.document;
    const originalGameAudio = snapshotGameAudioState();
    const musicButton = {
        classList: { toggle() { } },
        textContent: ''
    };
    try {
        globalThis.document = {
            getElementById(id) {
                return id === 'btn-music' ? musicButton : null;
            }
        };

        const musicElement = createFakeMusicElement();

        gameAudio.musicElement = musicElement;
        gameAudio.musicEnabled = true;
        gameAudio.volume = 0.5;

        gameAudio.playMusic();
        assert.equal(musicElement.loadCalls, 1);
        assert.equal(musicElement.playCalls, 0);

        gameAudio.toggleMusic();
        assert.equal(gameAudio.musicEnabled, false);
        assert.equal(musicElement.volume, 0);

        musicElement.triggerCanPlayThrough();
        assert.equal(musicElement.playCalls, 0);

        gameAudio.toggleMusic();
        assert.equal(gameAudio.musicEnabled, true);
        assert.equal(musicElement.playCalls, 1);
    } finally {
        restoreDocument(originalDocument);
        restoreGameAudioState(originalGameAudio);
    }
});

test('audio unlock treats partial success as unlocked and removes listeners after first interaction', async () => {
    const originalDocument = globalThis.document;
    const originalGameAudio = snapshotGameAudioState();
    const docHarness = createDocumentListenerHarness();

    const successfulTarget = {
        muted: false,
        currentTime: 5,
        playCalls: 0,
        pauseCalls: 0,
        play() {
            this.playCalls += 1;
            return Promise.resolve();
        },
        pause() {
            this.pauseCalls += 1;
        }
    };

    const failingTarget = {
        muted: false,
        currentTime: 9,
        playCalls: 0,
        pauseCalls: 0,
        play() {
            this.playCalls += 1;
            return Promise.reject(new Error('locked'));
        },
        pause() {
            this.pauseCalls += 1;
        }
    };

    try {
        globalThis.document = {
            ...docHarness,
            getElementById() {
                return null;
            }
        };

        gameAudio.unlockBound = false;
        gameAudio.audioUnlocked = false;
        gameAudio.audioCache = { success: successfulTarget };
        gameAudio.musicElement = failingTarget;

        gameAudio.setupAudioUnlock();

        assert.deepEqual(docHarness.addCalls.sort(), ['click', 'keydown', 'touchstart']);
        assert.equal(docHarness.getListenerCount('click'), 1);
        assert.equal(docHarness.getListenerCount('touchstart'), 1);
        assert.equal(docHarness.getListenerCount('keydown'), 1);

        docHarness.dispatch('click');
        await flushAsyncWork();

        assert.equal(gameAudio.audioUnlocked, true);
        assert.deepEqual(docHarness.removeCalls.sort(), ['click', 'keydown', 'touchstart']);
        assert.equal(docHarness.getListenerCount('click'), 0);
        assert.equal(docHarness.getListenerCount('touchstart'), 0);
        assert.equal(docHarness.getListenerCount('keydown'), 0);

        docHarness.dispatch('keydown');
        await flushAsyncWork();

        assert.equal(successfulTarget.playCalls, 1);
        assert.equal(failingTarget.playCalls, 1);
    } finally {
        restoreDocument(originalDocument);
        restoreGameAudioState(originalGameAudio);
    }
});
