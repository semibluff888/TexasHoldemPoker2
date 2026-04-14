import test from 'node:test';
import assert from 'node:assert/strict';

import { gameAudio } from '../../src/ui/game-audio.js';

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
    const musicButton = {
        classList: { toggle() { } },
        textContent: ''
    };

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

    if (originalDocument === undefined) {
        delete globalThis.document;
    } else {
        globalThis.document = originalDocument;
    }
});
