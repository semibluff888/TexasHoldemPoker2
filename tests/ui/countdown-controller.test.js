import test from 'node:test';
import assert from 'node:assert/strict';

import {
    calculateCountdownAngle,
    calculateCountdownProgress,
    createCountdownController
} from '../../src/ui/countdown-controller.js';

function createDocumentHarness() {
    const listeners = new Map();
    const styles = new Map();

    return {
        hidden: false,
        documentElement: {
            style: {
                setProperty(name, value) {
                    styles.set(name, value);
                },
                getPropertyValue(name) {
                    return styles.get(name) ?? '';
                }
            }
        },
        addEventListener(eventName, listener) {
            if (!listeners.has(eventName)) {
                listeners.set(eventName, new Set());
            }
            listeners.get(eventName).add(listener);
        },
        removeEventListener(eventName, listener) {
            listeners.get(eventName)?.delete(listener);
        },
        dispatch(eventName) {
            const handlers = listeners.get(eventName) ?? [];
            for (const handler of handlers) {
                handler({ type: eventName });
            }
        }
    };
}

function createTimerHarness() {
    const timers = new Map();
    let nextTimerId = 1;

    return {
        setTimeout(callback, delay = 0, ...args) {
            const timerId = nextTimerId++;
            timers.set(timerId, { callback, delay, args });
            return timerId;
        },
        clearTimeout(timerId) {
            timers.delete(timerId);
        },
        getTimerCount() {
            return timers.size;
        }
    };
}

function createAnimationHarness() {
    const frames = new Map();
    let nextFrameId = 1;

    return {
        requestAnimationFrame(callback) {
            const frameId = nextFrameId++;
            frames.set(frameId, callback);
            return frameId;
        },
        cancelAnimationFrame(frameId) {
            frames.delete(frameId);
        },
        getFrameCount() {
            return frames.size;
        }
    };
}

test('countdown helpers clamp progress and convert it into a conic angle', () => {
    assert.equal(calculateCountdownProgress({
        startedAtMs: 1_000,
        durationMs: 30_000,
        currentTimeMs: 16_000
    }), 0.5);
    assert.equal(calculateCountdownProgress({
        startedAtMs: 1_000,
        durationMs: 30_000,
        currentTimeMs: 40_000
    }), 1);
    assert.equal(calculateCountdownProgress({
        startedAtMs: 1_000,
        durationMs: 30_000,
        currentTimeMs: 0
    }), 0);
    assert.equal(calculateCountdownAngle(0.5), '180deg');
    assert.equal(calculateCountdownAngle(2), '360deg');
});

test('countdown controller catches the visual state up when the page becomes visible again', () => {
    const documentHarness = createDocumentHarness();
    const timerHarness = createTimerHarness();
    const animationHarness = createAnimationHarness();
    let currentTimeMs = 1_000;
    let expirationCount = 0;

    const controller = createCountdownController({
        documentRef: documentHarness,
        now: () => currentTimeMs,
        setTimeoutFn: timerHarness.setTimeout,
        clearTimeoutFn: timerHarness.clearTimeout,
        requestAnimationFrameFn: animationHarness.requestAnimationFrame,
        cancelAnimationFrameFn: animationHarness.cancelAnimationFrame,
        onExpire: () => {
            expirationCount += 1;
        }
    });

    controller.start(30_000);
    assert.equal(
        documentHarness.documentElement.style.getPropertyValue('--countdown-angle'),
        '0deg'
    );

    currentTimeMs = 16_000;
    controller.sync();
    assert.equal(
        documentHarness.documentElement.style.getPropertyValue('--countdown-angle'),
        '180deg'
    );

    documentHarness.hidden = true;
    documentHarness.dispatch('visibilitychange');
    currentTimeMs = 29_500;

    documentHarness.hidden = false;
    documentHarness.dispatch('visibilitychange');

    assert.equal(
        documentHarness.documentElement.style.getPropertyValue('--countdown-angle'),
        '342deg'
    );
    assert.equal(expirationCount, 0);

    currentTimeMs = 32_000;
    documentHarness.dispatch('visibilitychange');

    assert.equal(
        documentHarness.documentElement.style.getPropertyValue('--countdown-angle'),
        '360deg'
    );
    assert.equal(expirationCount, 1);

    controller.destroy();
});

test('countdown controller clears pending timers and resets the visual angle', () => {
    const documentHarness = createDocumentHarness();
    const timerHarness = createTimerHarness();
    const animationHarness = createAnimationHarness();

    const controller = createCountdownController({
        documentRef: documentHarness,
        setTimeoutFn: timerHarness.setTimeout,
        clearTimeoutFn: timerHarness.clearTimeout,
        requestAnimationFrameFn: animationHarness.requestAnimationFrame,
        cancelAnimationFrameFn: animationHarness.cancelAnimationFrame
    });

    controller.start(30_000);
    controller.clear();

    assert.equal(timerHarness.getTimerCount(), 0);
    assert.equal(animationHarness.getFrameCount(), 0);
    assert.equal(
        documentHarness.documentElement.style.getPropertyValue('--countdown-angle'),
        '0deg'
    );

    controller.destroy();
});
