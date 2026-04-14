# Phase 5 Game Translations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract translation data and pure translation helpers from `game.js` into a focused i18n module while preserving language-toggle behavior, DOM refresh behavior, and gameplay flow.

**Architecture:** Keep `game.js` as the orchestration layer for `currentLanguage`, `toggleLanguage()`, and `updateLanguageUI()`. Introduce `src/i18n/game-translations.js` as a pure module that owns the translation table and returns translator helpers through `createGameTranslator({ getLanguage })`, with `game.js` importing those helpers and continuing to inject `t()` and `translateHandName()` into existing UI modules.

**Tech Stack:** Vanilla JavaScript ES modules, browser DOM APIs, existing Node built-in test runner via `npm test`, `node --check`, manual browser verification over static HTTP

---

## File Structure

- `src/i18n/game-translations.js`
  Responsibility: Own the translation table plus pure helpers for `t()`, `translateHandName()`, and `getTranslatedPlayerName()` without touching the DOM, `localStorage`, or `gameState`.
- `tests/i18n/game-translations.test.js`
  Responsibility: Cover the new pure translation module in Node, including live-language lookup, English fallback, raw-key fallback, hand-name translation, and translated player-name generation.
- `game.js`
  Responsibility after this phase: Keep `currentLanguage`, `toggleLanguage()`, `updateLanguageUI()`, and all language-refresh orchestration while importing translator helpers from the new i18n module instead of owning the inline translation implementation.

No new DOM-test framework is introduced in this phase. Verification remains the existing `npm test` suite plus `node --check` for touched browser modules and a manual browser smoke over HTTP.

### Task 1: Add the Pure Translation Module and Its Node Tests

**Files:**
- Create: `src/i18n/game-translations.js`
- Create: `tests/i18n/game-translations.test.js`
- Test: `tests/i18n/game-translations.test.js`
- Test: `src/i18n/game-translations.js`

- [ ] **Step 1: Write the failing translation-module test file**

Create `tests/i18n/game-translations.test.js` with this exact content:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    TRANSLATIONS,
    createGameTranslator
} from '../../src/i18n/game-translations.js';

test('t() uses the active language, falls back to English, and then returns the raw key', () => {
    let currentLanguage = 'en';
    const { t } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    assert.equal(t('newGame'), 'NEW GAME');

    currentLanguage = 'zh';
    assert.equal(t('newGame'), TRANSLATIONS.zh.newGame);

    const originalZhNewGame = TRANSLATIONS.zh.newGame;
    delete TRANSLATIONS.zh.newGame;
    try {
        assert.equal(t('newGame'), 'NEW GAME');
    } finally {
        TRANSLATIONS.zh.newGame = originalZhNewGame;
    }

    assert.equal(t('missingTranslationKey'), 'missingTranslationKey');
});

test('translateHandName() translates known hand ranks and preserves unknown names', () => {
    let currentLanguage = 'en';
    const { translateHandName } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    assert.equal(translateHandName('Royal Flush'), 'Royal Flush');

    currentLanguage = 'zh';
    assert.equal(translateHandName('Royal Flush'), TRANSLATIONS.zh.royalFlush);
    assert.equal(translateHandName('Everyone Folded'), TRANSLATIONS.zh.everyoneFolded);
    assert.equal(translateHandName('Mystery Hand'), 'Mystery Hand');
});

test('getTranslatedPlayerName() follows the live language getter without recreating the translator', () => {
    let currentLanguage = 'en';
    const { getTranslatedPlayerName } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    assert.equal(getTranslatedPlayerName({ id: 0 }), 'You');
    assert.equal(getTranslatedPlayerName({ id: 4 }), 'AI Player 4');

    currentLanguage = 'zh';
    assert.equal(getTranslatedPlayerName({ id: 0 }), TRANSLATIONS.zh.you);
    assert.equal(getTranslatedPlayerName({ id: 4 }), `${TRANSLATIONS.zh.aiPlayer} 4`);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails before the module exists**

Run: `node --test tests/i18n/game-translations.test.js`
Expected: FAIL with an `ERR_MODULE_NOT_FOUND` error for `src/i18n/game-translations.js`

- [ ] **Step 3: Create `src/i18n/game-translations.js` with the helper surface and hand-name map**

Create `src/i18n/game-translations.js` with this exact structure:

```js
const HAND_NAME_KEYS = {
    'Royal Flush': 'royalFlush',
    'Straight Flush': 'straightFlush',
    'Four of a Kind': 'fourOfAKind',
    'Full House': 'fullHouse',
    'Flush': 'flush',
    'Straight': 'straight',
    'Three of a Kind': 'threeOfAKind',
    'Two Pair': 'twoPair',
    'One Pair': 'onePair',
    'High Card': 'highCard',
    'Everyone Folded': 'everyoneFolded'
};

export const TRANSLATIONS = {
};

export function createGameTranslator({ getLanguage }) {
    function t(key) {
        const currentTranslations = TRANSLATIONS[getLanguage()] || TRANSLATIONS.en;
        return currentTranslations[key] || TRANSLATIONS.en[key] || key;
    }

    function translateHandName(englishName) {
        const key = HAND_NAME_KEYS[englishName];
        return key ? t(key) : englishName;
    }

    function getTranslatedPlayerName(player) {
        return player.id === 0 ? t('you') : `${t('aiPlayer')} ${player.id}`;
    }

    return {
        t,
        translateHandName,
        getTranslatedPlayerName
    };
}
```

- [ ] **Step 4: Move the translation table into the new module without changing any keys or string values**

Cut the entire translation-table block in `game.js` that starts at the line
`const TRANSLATIONS = {` and ends at the matching closing `};`, then paste that
object into `src/i18n/game-translations.js` as the value of
`export const TRANSLATIONS =`.

Requirements for this step:

- keep every existing translation key unchanged
- keep every existing English and Chinese string unchanged
- do not add new translation keys
- do not change the current `en` / `zh` nesting shape

Keep the file order as:

1. `HAND_NAME_KEYS`
2. `export const TRANSLATIONS`
3. `export function createGameTranslator({ getLanguage })`

- [ ] **Step 5: Run syntax and the targeted Node test after creating the module**

Run: `node --check src/i18n/game-translations.js`
Expected: PASS with no output

Run: `node --test tests/i18n/game-translations.test.js`
Expected: PASS with `3` passing tests

- [ ] **Step 6: Commit the pure translation module and test coverage**

```bash
git add src/i18n/game-translations.js tests/i18n/game-translations.test.js
git commit -m "refactor: extract game translations module"
```

### Task 2: Wire the Translation Module Into `game.js`

**Files:**
- Modify: `game.js`
- Test: `game.js`
- Test: `src/i18n/game-translations.js`
- Test: `src/main.js`
- Test: `src/ui/game-table-renderer.js`
- Test: `src/ui/game-shell-renderer.js`
- Test: `tests/i18n/game-translations.test.js`
- Test: `tests/ui/game-audio.test.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Import the translator factory and create the three helper functions in `game.js`**

Add this import near the other `src/` imports at the top of `game.js`:

```js
import { createGameTranslator } from './src/i18n/game-translations.js';
```

Then replace the current translation-helper definitions immediately after `let currentLanguage = localStorage.getItem('pokerLanguage') || 'en';` with this exact block:

```js
const {
    t,
    translateHandName,
    getTranslatedPlayerName
} = createGameTranslator({
    getLanguage: () => currentLanguage
});
```

- [ ] **Step 2: Remove the inline translation implementation from `game.js` and leave language orchestration in place**

Delete everything in `game.js` from:

```js
const TRANSLATIONS = {
```

through the end of:

```js
function getTranslatedPlayerName(player) {
    return player.id === 0 ? t('you') : `${t('aiPlayer')} ${player.id}`;
}
```

Leave these functions in `game.js` unchanged:

```js
function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
    localStorage.setItem('pokerLanguage', currentLanguage);
    updateLanguageUI();
}
```

Leave the existing `updateLanguageUI()` function body unchanged.

Do not change any call sites that already use `t()`, `translateHandName()`, or `getTranslatedPlayerName()`.

- [ ] **Step 3: Run syntax checks and the full automated suite after wiring the module**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/i18n/game-translations.js`
Expected: PASS with no output

Run: `node --check src/main.js`
Expected: PASS with no output

Run: `node --check src/ui/game-table-renderer.js`
Expected: PASS with no output

Run: `node --check src/ui/game-shell-renderer.js`
Expected: PASS with no output

Run: `npm test`
Expected: PASS with `21` passing tests

- [ ] **Step 4: Perform manual browser verification over HTTP**

Run: `python -m http.server 8000`
Expected: a local static server starts at `http://localhost:8000`

Manual checklist:

1. Load `http://localhost:8000` and confirm the page initializes without module import errors.
2. Confirm the initial language still matches the current `localStorage` value for `pokerLanguage`.
3. Click the language toggle and confirm the header title, `NEW GAME`, betting buttons, help popup text, panel labels, and action-history navigation buttons all refresh together.
4. Start a hand and confirm translated AI player names still appear correctly in action messages and winner text.
5. Play through to a visible hand-rank highlight and confirm `translateHandName()` still updates the highlighted hand label in the active language.
6. Reach a showdown and confirm translated player names plus translated hand names still appear correctly in showdown logs and winner badges.
7. Toggle the language back and confirm the same UI areas refresh back to the original language without stale text.

- [ ] **Step 5: Commit the `game.js` wiring**

```bash
git add game.js
git commit -m "refactor: wire game translations module"
```
