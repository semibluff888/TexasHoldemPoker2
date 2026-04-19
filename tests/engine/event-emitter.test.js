import test from 'node:test';
import assert from 'node:assert/strict';

import { EventEmitter } from '../../src/engine/event-emitter.js';

test('EventEmitter emits payloads to every registered listener in order', () => {
    const emitter = new EventEmitter();
    const calls = [];

    emitter.on('phase_changed', payload => {
        calls.push(['first', payload.phase]);
    });

    emitter.on('phase_changed', payload => {
        calls.push(['second', payload.phase]);
    });

    emitter.emit('phase_changed', { phase: 'flop' });

    assert.deepEqual(calls, [
        ['first', 'flop'],
        ['second', 'flop']
    ]);
});

test('EventEmitter.off removes only the provided listener', () => {
    const emitter = new EventEmitter();
    const calls = [];
    const removedListener = () => {
        calls.push('removed');
    };

    emitter.on('action_required', removedListener);
    emitter.on('action_required', () => {
        calls.push('kept');
    });

    emitter.off('action_required', removedListener);
    emitter.emit('action_required', { playerId: 2 });

    assert.deepEqual(calls, ['kept']);
});

test('EventEmitter.once unsubscribes itself after the first emission', () => {
    const emitter = new EventEmitter();
    let calls = 0;

    emitter.once('hand_complete', () => {
        calls += 1;
    });

    emitter.emit('hand_complete', { handNumber: 1 });
    emitter.emit('hand_complete', { handNumber: 2 });

    assert.equal(calls, 1);
});
