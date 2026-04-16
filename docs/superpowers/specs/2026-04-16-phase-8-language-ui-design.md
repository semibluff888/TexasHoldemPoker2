# Phase 8 Language UI Design

## Goal

Continue the medium refactor by extracting browser-side language state and
language-refresh orchestration from `game.js` into a focused UI module, while
keeping translation behavior, visible UI text, gameplay behavior, and
online-count polling behavior unchanged.

This phase stays structural. It should slim `game.js` further without changing
poker rules, AI decisions, betting flow, showdown flow, translation content,
cursor visuals, history behavior, or `/api/heartbeat` network behavior.

## Why This Phase Next

After phase 7, the main remaining non-rule slices still embedded in `game.js`
are:

- `currentLanguage`, `toggleLanguage()`, and `updateLanguageUI()`
- online-count polling and label refresh
- AI / betting / showdown orchestration

Brief comparison:

1. Language UI / refresh orchestration
   - Best fit for the next phase.
   - It now sits on top of boundaries that are already stable after phases 5-7:
     pure translation helpers, shell renderer helpers, cursor-label syncing,
     history-panel syncing, and best-hand highlight helpers.
   - It removes a meaningful amount of non-gameplay orchestration from
     `game.js` without entering betting or showdown logic.
2. Online-count service extraction
   - Lower risk, but lower yield.
   - The current polling block is small and mostly startup/service wiring.
   - It is a reasonable follow-on phase, but not the best next cut if the goal
     is to keep slimming `game.js`.
3. AI / betting / showdown orchestration
   - Higher long-term payoff, but materially higher behavior risk.
   - Those paths mix async sequencing, game-state mutation, animation timing,
     settlement, and translated message generation.

Previous specs deferred `updateLanguageUI()` because it was too cross-cutting
while cursor effects and history were still inline. That is less true now:
those subsystems already expose dedicated refresh hooks, so the remaining work
is much closer to extracting one browser-side orchestration layer than to
redesigning multiple subsystems at once.

## Recommendation

Phase 8 should extract language UI orchestration first.

More specifically, this phase should move:

- `currentLanguage`
- `toggleLanguage()`
- `updateLanguageUI()`
- translator helper wiring tied to live language state

into one dedicated browser module under `src/ui/`.

This is the best balance of:

- low risk relative to gameplay extraction
- higher yield than online-count extraction
- behavior preservation
- continued slimming of `game.js`

## Scope

### In Scope

- extract `currentLanguage` ownership from `game.js`
- extract `toggleLanguage()` from `game.js`
- extract `updateLanguageUI()` from `game.js`
- keep the existing `pokerLanguage` local-storage key and current toggle
  behavior
- keep using `src/i18n/game-translations.js` as the pure translation layer
- preserve translated refresh of:
  - header and control labels
  - help popup text
  - player names and AI tooltips
  - history navigation labels and panel hand-number display
  - cursor-effect option labels
  - stats labels
  - best-hand highlight text
  - online-count label text using the already stored count

### Out of Scope

- changing translation keys or translation copy
- changing poker rules, AI behavior, betting flow, or showdown settlement
- extracting or rewriting `/api/heartbeat` polling
- changing startup wiring beyond what is required to use the new language UI
  module
- redesigning HTML structure or CSS styling
- introducing a new test framework

## Selected Approach

Create one focused browser module:

- `src/ui/game-language-ui.js`

This module should own:

- the current language source of truth
- local-storage read/write for `pokerLanguage`
- creation of `t()`, `translateHandName()`, and `getTranslatedPlayerName()`
  using the existing pure i18n module
- `toggleLanguage()` behavior
- DOM refresh orchestration previously handled by `updateLanguageUI()`

`game.js` should continue to own:

- gameplay state and gameplay sequencing
- AI, betting, and showdown orchestration
- online-count polling and network requests
- the decision of when gameplay messages are generated
- calls to renderer/history/audio modules during gameplay flow

The important line is this:

- the new module may refresh the already-known online-count label text
- the new module must not own heartbeat polling, fetch timing, or API behavior

## Module Boundary

### `src/ui/game-language-ui.js`

Responsibility:

- own live language state and language-toggle behavior
- expose the translator helpers used throughout the app
- refresh translated UI text by delegating to existing modules where possible

Recommended public surface:

- `createGameLanguageUI({ getGameState, getGameMode, getOpponentProfile })`

Recommended returned surface:

- `t`
- `translateHandName`
- `getTranslatedPlayerName`
- `getCurrentLanguage()`
- `toggleLanguage()`
- `syncUI()`

Rules:

- this module may read from and write to the DOM
- this module may read from and write to `localStorage`
- this module must not import `game.js`
- this module must not own gameplay state mutation
- this module must not own online-count polling
- this module should reuse existing helpers instead of reimplementing their DOM
  logic

Expected collaborators:

- `src/i18n/game-translations.js`
- `src/ui/game-shell-renderer.js`
- `src/ui/game-history.js`
- `src/ui/game-cursor-effects.js`
- `src/ui/game-table-renderer.js`

### `src/i18n/game-translations.js`

Responsibility after phase 8:

- remain the pure translation-data and translation-helper factory layer

This phase should not fold translation data back into a UI module. The new
language UI module should sit on top of the existing pure i18n module.

### `game.js`

Responsibility after phase 8:

- initialize the language UI module
- keep using `t()`, `translateHandName()`, and `getTranslatedPlayerName()` for
  gameplay messages and renderer calls
- ask the language module for the current language when a downstream module
  still needs an explicit `currentLanguage` argument
- stop owning `currentLanguage`, `toggleLanguage()`, and `updateLanguageUI()`

## Data Flow

The intended phase-8 flow is:

1. `game.js` creates the language UI module with getters into live
   `gameState`, `gameMode`, and `getOpponentProfile()`.
2. The language module reads the initial language from `localStorage`.
3. The language module creates translator helpers through
   `createGameTranslator({ getLanguage })`.
4. `game.js` continues to use those helper functions everywhere it already
   needs translated names and strings.
5. Clicking the language button calls `toggleLanguage()` on the language UI
   module.
6. `toggleLanguage()` updates `localStorage` and then runs `syncUI()`.
7. `syncUI()` refreshes direct DOM text and delegates subsystem-specific
   refreshes to:
   - `gameHistory.syncPanel({ currentLanguage, t })`
   - `gameCursorEffects.syncLabels({ t })`
   - `updateGameModeButton({ gameMode, t })`
   - `updateAllPlayerStatsDisplays(...)`
   - `clearHighlightHumanBestHand()` plus
     `highlightHumanBestHand(gameState, { translateHandName })`
8. `initOnlineCount()` stays in `game.js`, but `syncUI()` still rewrites the
   label text from the stored `data-count` value so language toggles keep the
   current behavior.

## Migration Strategy

Keep the phase narrow:

1. Add `src/ui/game-language-ui.js`.
2. Move `currentLanguage` initialization plus translator-helper creation into
   the new module.
3. Move `toggleLanguage()` and `updateLanguageUI()` into the new module.
4. Keep helper names stable so existing `t()`, `translateHandName()`, and
   `getTranslatedPlayerName()` call sites do not need broad rewrites.
5. Replace direct `currentLanguage` reads in `game.js` with
   `getCurrentLanguage()` only where a downstream module still needs explicit
   language context.
6. Leave `initOnlineCount()` and its fetch loop in `game.js`.
7. Verify that UI refresh order and translated content remain unchanged.

This phase should not combine online-count extraction, startup-service
extraction, or gameplay-orchestration cleanup.

## Behavior Preservation Notes

The current behavior to preserve is:

- the default language still comes from `localStorage` or falls back to `en`
- the language button still flips between the English and Chinese labels
- visible labels still refresh together when the language changes
- translated player names and AI tooltips still update correctly
- history navigation labels and panel hand-number text still update correctly
- cursor option labels still update correctly
- stats labels still update correctly
- best-hand highlight text still updates correctly
- the online-count label still updates language using the cached count value
- no new network request is introduced by a language toggle

## Testing and Verification Strategy

Follow the existing lightweight style:

1. Add focused Node tests for `src/ui/game-language-ui.js` using DOM and
   local-storage stubs. Cover:
   - initial language loading
   - language toggle persistence
   - direct label refresh
   - history/cursor/stats/best-hand refresh behavior
   - online-count label refresh from stored `data-count`
2. Syntax-check touched modules:
   - `node --check game.js`
   - `node --check src/ui/game-language-ui.js`
   - `node --check src/main.js`
   - `node --check src/ui/game-shell-renderer.js`
   - `node --check src/ui/game-table-renderer.js`
   - `node --check src/ui/game-history.js`
   - `node --check src/ui/game-cursor-effects.js`
3. Run the automated suite:
   - `npm test`
4. Perform browser smoke verification covering:
   - initial load in the saved language
   - language toggle before starting a hand
   - language toggle during an active hand
   - header, buttons, help text, history labels, and stats labels refreshing
     together
   - history panel hand-number text still matching the current language
   - cursor select labels still translating correctly
   - best-hand highlight text still translating correctly
   - online-count label still translating without changing the count

No new framework should be introduced in this phase.

## Risks and Mitigations

### Risk: Language state becomes split or stale after extraction

Mitigation:

- keep one source of truth for current language inside the new module
- keep translator helpers bound to a live getter, not a copied value
- keep `game.js` consuming the returned helpers instead of creating a second
  translator instance

### Risk: Refresh ordering changes cause subtle UI drift

Mitigation:

- preserve the current refresh sequence as closely as possible
- keep subsystem-specific refresh logic in existing modules
- limit this phase to moving orchestration, not redesigning refresh behavior

### Risk: Scope creeps into online-count service extraction

Mitigation:

- leave `initOnlineCount()` and its polling loop in `game.js`
- allow only cached-label translation refresh in the new module
- treat service extraction as a later dedicated phase

## Acceptance Criteria

- `game.js` no longer defines `currentLanguage`
- `game.js` no longer defines `toggleLanguage()`
- `game.js` no longer defines `updateLanguageUI()`
- existing translator helper names remain available to gameplay code
- language-toggle behavior and `localStorage` behavior match current behavior
- history panel, cursor labels, stats labels, best-hand highlight text, and
  online-count label still refresh correctly
- `/api/heartbeat` polling behavior remains unchanged
- syntax checks pass for touched modules
- the automated test suite continues to pass

## Follow-On Work

If phase 8 succeeds, later phases can safely extract:

- online-count polling and browser-service integration
- broader startup/browser-service wiring
- AI strategy modules
- betting-round orchestration or state-machine cleanup
- showdown orchestration cleanup
