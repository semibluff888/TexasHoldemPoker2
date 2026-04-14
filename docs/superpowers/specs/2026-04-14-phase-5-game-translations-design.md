# Phase 5 Game Translations Design

## Goal

Continue the medium refactor by extracting translation data and pure
translation helpers from `game.js` into a focused i18n module, while keeping
language-toggle behavior, DOM refresh behavior, and gameplay behavior
unchanged.

This phase remains structural. It should reduce the amount of translation
definition and translation-helper code in `game.js` without changing poker
rules, AI behavior, betting flow, showdown flow, audio behavior, cursor
behavior, or online-count behavior.

## Current Problems

After phase 4, `game.js` is slimmer around shell UI and audio setup, but it
still owns the full translation table plus several reusable translation
helpers:

- the `TRANSLATIONS` object for English and Chinese text
- the `t()` lookup helper
- the `translateHandName()` helper for hand-rank display text
- the `getTranslatedPlayerName()` helper for translated player labels

This creates three immediate problems:

1. `game.js` still mixes orchestration with a self-contained translation slice
   that does not need to own gameplay state transitions or DOM refresh
   sequencing.
2. Translation helpers are referenced across `game.js` and existing UI modules,
   but the underlying translation implementation still lives in the main file.
3. Future cleanup of language-refresh orchestration is harder while translation
   data and translation helper logic remain embedded in `game.js`.

## Selected Approach

Extract translation data and pure translation helpers into one focused module:

- `src/i18n/game-translations.js`

`game.js` remains the orchestration layer in this phase. It will continue to
own:

- `currentLanguage`
- `toggleLanguage()`
- `updateLanguageUI()`
- the decision of when translated DOM refreshes happen

The new i18n module will own only translation data and pure lookup helpers. It
should not read from the DOM, write to the DOM, or become a second source of
truth for the current language.

This approach is preferred over:

- extracting `updateLanguageUI()` now, because that would widen the phase into
  shell-level DOM orchestration and increase behavior risk
- extracting audio, cursor effects, or online-count behavior next, because
  translation helpers are already a clearer and more reusable boundary after
  phases 3 and 4
- extracting betting, showdown, or AI orchestration next, because those
  boundaries are more valuable long term but materially riskier right now

## User Decisions Captured In This Spec

The scope below reflects the approved direction for this phase:

- continue the current incremental medium-refactor cadence
- prioritize low-risk, high-yield module-boundary cleanup
- keep behavior unchanged wherever practical
- keep slimming `game.js`, but avoid splitting multiple unrelated subsystems in
  one phase
- do not introduce a new browser test framework in this phase
- do not move AI orchestration, betting orchestration, or showdown
  orchestration in this phase
- do not move `updateLanguageUI()` out of `game.js` in this phase
- do move only:
  - `TRANSLATIONS`
  - `t()`
  - `translateHandName()`
  - `getTranslatedPlayerName()`

## Scope

### In Scope

- extract translation tables from `game.js`
- extract pure translation helpers from `game.js`
- preserve existing translation keys and current English/Chinese strings
- preserve current `currentLanguage` ownership in `game.js`
- preserve the current language toggle flow and current DOM refresh flow
- keep `src/main.js` as the browser entry point
- keep `src/ui/` modules receiving translator functions via dependency
  injection

### Out of Scope

- moving `toggleLanguage()` out of `game.js`
- moving `updateLanguageUI()` out of `game.js`
- changing language-toggle behavior or local-storage behavior
- redesigning translation keys or rewriting translation content
- changing poker rules, betting flow, dealing flow, or showdown flow
- extracting audio behavior, cursor effects, or online-count polling
- adding a DOM test framework

## Module Boundaries

### `src/i18n/game-translations.js`

Responsibility:

- own translation data
- expose pure translation helpers
- stay independent from the DOM and browser orchestration

Planned contents:

- the current `TRANSLATIONS` object
- a small translator factory or equivalent helper surface that can produce:
  - `t(key)`
  - `translateHandName(englishName)`
  - `getTranslatedPlayerName(player)`

Constraints:

- this module must not own `currentLanguage`
- this module must not read from `localStorage`
- this module must not read from or write to the DOM
- this module must not import `gameState`
- this module should depend only on values passed in from `game.js`

Recommended interface:

- export a translator creator such as:
  - `createGameTranslator({ getLanguage })`

That factory should return the helper functions currently used throughout the
app, while continuing to resolve the active language from `game.js`. This keeps
one source of truth for language state and avoids stale language snapshots.

### `game.js`

Responsibility after this phase:

- keep `currentLanguage` as the source of truth
- keep `toggleLanguage()` and `updateLanguageUI()`
- initialize translator helpers from the new i18n module
- continue to pass `t()` and `translateHandName()` into UI renderer modules
- continue to use translated helper functions when constructing messages,
  labels, showdown logs, and winner displays

Code that should stay in `game.js`:

- `currentLanguage`
- `toggleLanguage()`
- `updateLanguageUI()`
- all language-refresh DOM work
- all orchestration that decides when translated text must be re-rendered

Code that should move out of `game.js`:

- the `TRANSLATIONS` object
- the `t()` implementation
- the `translateHandName()` implementation
- the `getTranslatedPlayerName()` implementation

## Data Flow

The post-refactor translation flow should look like this:

1. `game.js` initializes `currentLanguage` from local storage as it does today.
2. `game.js` creates translator helpers by calling the new i18n module.
3. The translator helpers resolve the active language through a getter owned by
   `game.js`.
4. `game.js` passes `t()` and `translateHandName()` into existing UI helpers as
   it does today.
5. `game.js` calls `updateLanguageUI()` when language changes or when the UI
   needs a translated refresh.
6. `updateLanguageUI()` continues to own all DOM refresh work, but now uses the
   imported translator helpers instead of inline translation code.

This keeps one source of truth for active language state while pulling the
translation implementation out of the orchestration file.

## Migration Strategy

Perform the extraction in one focused phase:

1. Create `src/i18n/game-translations.js` with the migrated translation data
   and helper logic.
2. Export a focused helper surface that lets `game.js` keep ownership of
   `currentLanguage`.
3. Replace the inline translation definitions in `game.js` with imports from
   the new module.
4. Keep the current helper names and current call patterns as stable as
   practical to reduce migration risk across existing call sites.
5. Leave `updateLanguageUI()` in `game.js` and only switch its dependencies to
   the extracted translator helpers.
6. Verify that language toggle behavior and translated UI refresh behavior
   remain unchanged.

The migration should not combine shell refresh extraction, audio cleanup,
cursor cleanup, or online-count cleanup.

## HTML and CSS Constraints

- keep the current DOM structure and selector names unchanged
- keep existing translation keys expected by current DOM refresh code
- avoid changing `index.html` unless a minimal compatibility fix is strictly
  necessary
- avoid changing `styles.css` in this phase

This phase is not a UI redesign and should not require meaningful markup or
styling changes.

## Error Handling

- preserve the current fallback behavior of `t()`:
  - active-language key
  - English fallback
  - raw key fallback
- keep translation helpers tolerant of currently translated hand and player
  display flows
- avoid introducing a second cached language state that could drift after a
  toggle
- keep DOM refresh responsibility centralized in `updateLanguageUI()`

This phase should not add new user-facing error UI.

## Testing and Verification Strategy

This repository already uses lightweight syntax checks plus Node tests for pure
modules. This phase should follow the same verification style as the previous
phases:

1. Syntax-check the touched browser files:
   - `node --check game.js`
   - `node --check src/i18n/game-translations.js`
   - `node --check src/main.js`
   - `node --check src/ui/game-table-renderer.js`
   - `node --check src/ui/game-shell-renderer.js`
2. Run the existing automated test suite:
   - `npm test`
3. Perform browser smoke verification covering:
   - initial load still shows the expected default language
   - language toggle still flips between English and Chinese
   - buttons, help popup, player labels, history controls, and panel text still
     refresh together
   - stats labels still refresh correctly after language toggle
   - translated hand names still appear correctly in the best-hand highlight
     and winner displays
   - translated player names still appear correctly in messages and showdown
     logs

No new framework should be introduced for this phase.

## Acceptance Criteria

- `game.js` no longer contains the full translation table definition
- `game.js` no longer contains the inline implementations of `t()`,
  `translateHandName()`, and `getTranslatedPlayerName()`
- `game.js` still owns `currentLanguage`, `toggleLanguage()`, and
  `updateLanguageUI()`
- existing `src/ui/` modules continue to receive translator functions via
  injection
- language toggle behavior matches current behavior in the browser
- syntax checks pass for touched modules
- existing automated tests continue to pass
- no gameplay rules or flow behavior change as part of this phase

## Risks and Mitigations

### Risk: Translator helpers read stale language state after extraction

Mitigation:

- keep `currentLanguage` in `game.js`
- pass a getter into the translator module instead of copying the language
  value
- verify toggle behavior manually after extraction

### Risk: Existing call sites need wider changes than expected

Mitigation:

- keep helper names and helper semantics close to the current shape
- keep UI modules using injected translator functions instead of importing
  language state directly
- limit this phase to one i18n module rather than multiple translation files

### Risk: Scope creeps into language-refresh orchestration

Mitigation:

- explicitly leave `updateLanguageUI()` in `game.js`
- treat DOM refresh ownership as out of scope for this phase
- defer deeper localization orchestration cleanup to a later phase

## Follow-On Work

If phase 5 succeeds, later phases can safely extract:

- `updateLanguageUI()` and related language-refresh orchestration
- cursor and ambient browser-effects code
- online-count service integration
- startup wiring cleanup around browser-only services
- betting-round orchestration or state-machine logic
- AI strategy modules
