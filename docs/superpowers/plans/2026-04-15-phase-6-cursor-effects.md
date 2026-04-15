# Phase 6 Cursor Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the cursor-effects subsystem from `game.js` into a focused UI module while preserving cursor visuals, effect selection, saved preference behavior, and language-refresh behavior.

**Architecture:** Keep `game.js` as the orchestration layer for `updateLanguageUI()` and startup sequencing, but move cursor state, particle rendering, `mousemove` handling, and cursor-select persistence into `src/ui/game-cursor-effects.js`. Cover the new module with lightweight Node tests using DOM and `localStorage` stubs, then wire `game.js` to call `gameCursorEffects.init()` and `gameCursorEffects.syncLabels({ t })`.

**Tech Stack:** Vanilla JavaScript ES modules, browser DOM APIs, `localStorage`, existing Node built-in test runner via `node --test`, `node --check`, manual browser verification over static HTTP

---

## File Structure

- `src/ui/game-cursor-effects.js`
  Responsibility: Own cursor-effect state, saved-effect restoration, `mousemove` handling, particle creation, particle cleanup, select binding, and translated option-label refresh without importing `gameState` or deciding when language changes.
- `tests/ui/game-cursor-effects.test.js`
  Responsibility: Cover the new cursor module in Node with lightweight document and `localStorage` stubs, including idempotent init behavior, saved-effect restoration, select-change persistence/reset behavior, translated label refresh, and particle creation gating.
- `game.js`
  Responsibility after this phase: Keep `updateLanguageUI()` and gameplay/startup orchestration, import `gameCursorEffects`, delegate cursor label refresh to `gameCursorEffects.syncLabels({ t })`, and initialize the cursor module instead of owning cursor state and listeners inline.

No new DOM-test framework is introduced in this phase. Verification remains targeted `node --test`, syntax checks, the existing `npm test` suite, and manual browser smoke verification.

### Task 1: Add the Cursor Effects Module and Its Node Tests

**Files:**
- Create: `src/ui/game-cursor-effects.js`
- Create: `tests/ui/game-cursor-effects.test.js`
- Test: `tests/ui/game-cursor-effects.test.js`
- Test: `src/ui/game-cursor-effects.js`

- [ ] **Step 1: Write the failing cursor-module test file**

Create `tests/ui/game-cursor-effects.test.js` with this exact content:

```js
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
```

- [ ] **Step 2: Run the targeted test to verify it fails before the module exists**

Run: `node --test tests/ui/game-cursor-effects.test.js`
Expected: FAIL with an `ERR_MODULE_NOT_FOUND` error for `src/ui/game-cursor-effects.js`

- [ ] **Step 3: Create `src/ui/game-cursor-effects.js` with cursor state, bindings, and particle helpers**

Create `src/ui/game-cursor-effects.js` with this exact content:

```js
const DEFAULT_CURSOR_EFFECT = 'sparkle';
const MAX_PARTICLES = 50;
const CURSOR_EFFECT_DURATIONS = {
    sparkle: 800,
    comet: 600,
    bubble: 1200
};

function getCursorTrailContainer() {
    return document.getElementById('cursor-trail');
}

function getCursorSelect() {
    return document.getElementById('cursor-select');
}

function getCursorEffectLabelKey(value) {
    return 'cursor' + value.charAt(0).toUpperCase() + value.slice(1);
}

export const gameCursorEffects = {
    initialized: false,
    controlsBound: false,
    mouseMoveBound: false,
    trailContainer: null,
    particleCount: 0,
    currentEffect: DEFAULT_CURSOR_EFFECT,
    lastMouseX: 0,
    lastMouseY: 0,

    init() {
        if (!this.initialized) {
            this.loadStoredEffect();
            this.trailContainer = getCursorTrailContainer();
            this.setupControls();
            this.setupMouseTracking();
            this.initialized = true;
        } else {
            this.trailContainer = getCursorTrailContainer();
            this.syncControls();
        }
    },

    loadStoredEffect() {
        this.currentEffect = localStorage.getItem('cursorEffect') || DEFAULT_CURSOR_EFFECT;
    },

    syncControls() {
        const cursorSelect = getCursorSelect();
        if (cursorSelect) {
            cursorSelect.value = this.currentEffect;
        }
    },

    setupControls() {
        if (this.controlsBound) {
            this.syncControls();
            return;
        }

        const cursorSelect = getCursorSelect();
        if (cursorSelect) {
            cursorSelect.value = this.currentEffect;
            cursorSelect.addEventListener('change', event => {
                this.currentEffect = event.target.value;
                localStorage.setItem('cursorEffect', this.currentEffect);
                this.clearParticles();
            });
        }

        this.controlsBound = true;
    },

    setupMouseTracking() {
        if (this.mouseMoveBound) return;

        document.addEventListener('mousemove', event => {
            this.handleMouseMove(event);
        });
        this.mouseMoveBound = true;
    },

    clearParticles() {
        if (this.trailContainer) {
            this.trailContainer.innerHTML = '';
        }
        this.particleCount = 0;
    },

    handleMouseMove(event) {
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;

        if (!this.trailContainer) {
            this.trailContainer = getCursorTrailContainer();
        }

        if (!this.trailContainer || this.currentEffect === 'none' || this.particleCount >= MAX_PARTICLES) return;

        this.createParticle(event.clientX, event.clientY, event.movementX, event.movementY);
    },

    createParticle(x, y, moveX = 0, moveY = 0) {
        if (!this.trailContainer) return;

        const particle = document.createElement('div');

        switch (this.currentEffect) {
            case 'sparkle':
                this.createSparkleParticle(particle, x, y);
                break;
            case 'comet':
                this.createCometParticle(particle, x, y, moveX, moveY);
                break;
            case 'bubble':
                this.createBubbleParticle(particle, x, y);
                break;
            default:
                return;
        }

        this.trailContainer.appendChild(particle);
        this.particleCount += 1;

        const duration = CURSOR_EFFECT_DURATIONS[this.currentEffect];
        setTimeout(() => {
            if (particle.parentNode) {
                particle.remove();
            }
            this.particleCount = Math.max(0, this.particleCount - 1);
        }, duration);
    },

    createSparkleParticle(particle, x, y) {
        particle.className = 'cursor-particle';

        const offsetX = (Math.random() - 0.5) * 10;
        const offsetY = (Math.random() - 0.5) * 10;

        particle.style.left = `${x + offsetX}px`;
        particle.style.top = `${y + offsetY}px`;

        const size = 6 + Math.random() * 10;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
    },

    createCometParticle(particle, x, y, moveX, moveY) {
        particle.className = 'cursor-comet';

        const angle = Math.atan2(moveY, moveX) * (180 / Math.PI);

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.transform = `rotate(${angle}deg)`;

        const speed = Math.sqrt(moveX * moveX + moveY * moveY);
        const length = 10 + Math.min(speed * 2, 30);
        particle.style.width = `${length}px`;
    },

    createBubbleParticle(particle, x, y) {
        particle.className = 'cursor-bubble';

        const offsetX = (Math.random() - 0.5) * 20;

        particle.style.left = `${x + offsetX}px`;
        particle.style.top = `${y}px`;

        const size = 8 + Math.random() * 16;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
    },

    syncLabels({ t }) {
        const cursorSelect = getCursorSelect();
        if (!cursorSelect) return;

        const options = cursorSelect.querySelectorAll('option');
        options.forEach(option => {
            option.textContent = t(getCursorEffectLabelKey(option.value));
        });
    }
};
```

- [ ] **Step 4: Run syntax and the targeted Node test after creating the module**

Run: `node --check src/ui/game-cursor-effects.js`
Expected: PASS with no output

Run: `node --test tests/ui/game-cursor-effects.test.js`
Expected: PASS with `4` passing tests

- [ ] **Step 5: Commit the new cursor-effects module and its tests**

```bash
git add src/ui/game-cursor-effects.js tests/ui/game-cursor-effects.test.js
git commit -m "refactor: add cursor effects module"
```

### Task 2: Wire `game.js` to the Cursor Effects Module

**Files:**
- Modify: `game.js:37-38`
- Modify: `game.js:212-221`
- Modify: `game.js:2767-2859`
- Modify: `game.js:2954-2969`
- Test: `game.js`
- Test: `src/ui/game-cursor-effects.js`
- Test: `src/main.js`
- Test: `tests/ui/game-cursor-effects.test.js`
- Test: `tests/ui/game-audio.test.js`
- Test: `tests/i18n/game-translations.test.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Import the cursor module and delegate cursor label refresh inside `updateLanguageUI()`**

Add this import next to the other `src/ui/` imports near the top of `game.js`:

```js
import { gameCursorEffects } from './src/ui/game-cursor-effects.js';
```

Then replace the current cursor-label block inside `updateLanguageUI()`:

```js
    // Update cursor effect dropdown
    const cursorSelect = document.getElementById('cursor-select');
    if (cursorSelect) {
        const options = cursorSelect.querySelectorAll('option');
        options.forEach(option => {
            const value = option.value;
            const key = 'cursor' + value.charAt(0).toUpperCase() + value.slice(1);
            option.textContent = t(key);
        });
    }
```

with:

```js
    // Update cursor effect dropdown
    gameCursorEffects.syncLabels({ t });
```

- [ ] **Step 2: Remove the inline cursor subsystem from `game.js` and initialize the new module**

Delete the entire inline cursor subsystem in `game.js` from:

```js
// ===== Cursor Trail Effect =====
let cursorTrailContainer = null;
let particleCount = 0;
const MAX_PARTICLES = 50;
let currentCursorEffect = localStorage.getItem('cursorEffect') || 'sparkle';
let lastMouseX = 0;
let lastMouseY = 0;

function handleCursorMouseMove(e) {
```

through the end of:

```js
function createBubbleParticle(particle, x, y) {
    particle.className = 'cursor-bubble';

    const offsetX = (Math.random() - 0.5) * 20;

    particle.style.left = `${x + offsetX}px`;
    particle.style.top = `${y}px`;

    const size = 8 + Math.random() * 16;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
}
```

Then replace the cursor setup block in `bindGameEventListeners()`:

```js
    cursorTrailContainer = document.getElementById('cursor-trail');

    const cursorSelect = document.getElementById('cursor-select');
    if (cursorSelect) {
        cursorSelect.value = currentCursorEffect;
        cursorSelect.addEventListener('change', event => {
            currentCursorEffect = event.target.value;
            localStorage.setItem('cursorEffect', currentCursorEffect);
            if (cursorTrailContainer) {
                cursorTrailContainer.innerHTML = '';
            }
            particleCount = 0;
        });
    }

    document.addEventListener('mousemove', handleCursorMouseMove);
```

with:

```js
    gameCursorEffects.init();
```

Do not change `toggleLanguage()`, `updateLanguageUI()` ownership, `initOnlineCount()`, AI orchestration, betting/showdown orchestration, or any translation strings.

- [ ] **Step 3: Run syntax checks, the targeted cursor tests, and the full automated suite**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-cursor-effects.js`
Expected: PASS with no output

Run: `node --check src/main.js`
Expected: PASS with no output

Run: `node --test tests/ui/game-cursor-effects.test.js`
Expected: PASS with `4` passing tests

Run: `npm test`
Expected: PASS with `26` passing tests

- [ ] **Step 4: Perform manual browser verification over HTTP**

Run: `python -m http.server 8000`
Expected: a local static server starts at `http://localhost:8000`

Manual checklist:

1. Load `http://localhost:8000` and confirm the page initializes without import errors.
2. Confirm the cursor select restores the saved `cursorEffect` value from `localStorage`.
3. Move the cursor with `sparkle`, `comet`, and `bubble` selected and confirm each effect still looks the same as before.
4. Switch to `none` and confirm no new particles are created.
5. Switch between cursor effects and confirm existing particles clear immediately when the selection changes.
6. Toggle the language and confirm the cursor option labels refresh with the rest of the translated UI.
7. Confirm online-count behavior remains unchanged during the smoke check.

- [ ] **Step 5: Commit the `game.js` wiring**

```bash
git add game.js
git commit -m "refactor: wire cursor effects module"
```
