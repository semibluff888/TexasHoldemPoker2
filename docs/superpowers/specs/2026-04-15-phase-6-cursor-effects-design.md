# Phase 6 Cursor Effects Design

## Goal

Continue the medium refactor by extracting cursor-effects browser code from
`game.js` into a focused UI module, while keeping cursor visuals, effect
selection behavior, persisted preference, and language-refresh behavior
unchanged.

This phase stays structural. It should slim `game.js` further without changing
poker rules, AI behavior, betting/showdown orchestration, translation content,
or online-count API behavior.

## Why This Phase Next

After phase 5, the main low-to-medium sized non-gameplay slices still embedded
in `game.js` are:

- `updateLanguageUI()` and broader language-refresh orchestration
- cursor-effects state, particle creation, and cursor-select binding
- online-count polling and display refresh

Brief comparison:

1. Cursor effects
   - Best fit for the current cadence.
   - It is a self-contained browser subsystem with no dependency on
     `gameState`, AI decisions, betting flow, or showdown flow.
   - It removes a meaningful chunk of non-gameplay code from `game.js` without
     forcing a broader orchestration redesign.
2. `updateLanguageUI()` / language refresh
   - Higher long-term payoff, but riskier right now.
   - That function spans header text, help content, player labels, stats,
     history panel state, best-hand highlighting, cursor-select labels, and
     online-count text.
   - Extracting it now would widen the phase into cross-module refresh
     orchestration rather than one isolated subsystem.
3. Online-count service
   - Low risk, but lower yield.
   - The current polling code is small and mostly startup/service wiring.
   - It does not remove enough weight from `game.js` to be the best next phase
     while cursor effects are still embedded.

## Recommendation

Phase 6 should extract cursor effects first.

This keeps the current refactor rhythm intact:

- low risk
- behavior-preserving
- one subsystem at a time
- clear module boundary under `src/ui/`

`updateLanguageUI()` should remain in `game.js` for now, and online-count
polling should remain deferred to a later dedicated phase.

## Scope

### In Scope

- extract cursor-effect state and browser behavior from `game.js`
- extract cursor particle creation helpers from `game.js`
- extract cursor-select binding and persisted-effect handling
- keep `game.js` responsible for deciding when translated UI refresh runs
- preserve current effect names: `sparkle`, `comet`, `bubble`, `none`
- preserve current `localStorage` key: `cursorEffect`
- preserve current DOM IDs and CSS class names

### Out of Scope

- moving `updateLanguageUI()` out of `game.js`
- redesigning translation keys or rewriting translation copy
- changing cursor visuals, animation timing, or CSS styling
- changing poker rules, dealing flow, AI orchestration, betting flow, or
  showdown flow
- extracting or rewriting online-count polling or the `/api/heartbeat` API flow
- changing `index.html` structure except for a minimal compatibility fix if one
  is strictly necessary
- introducing a new test framework

## Selected Approach

Create a dedicated browser module:

- `src/ui/game-cursor-effects.js`

This module should own:

- lookup of the cursor trail container and cursor select
- current effect state
- persisted effect loading/saving
- global mousemove handling
- particle creation and timed cleanup
- cursor-select option-label refresh when `game.js` asks for translated labels

`game.js` should continue to own:

- `currentLanguage`
- `updateLanguageUI()`
- startup sequencing
- all gameplay orchestration
- online-count polling
- AI, betting, and showdown orchestration

## Module Boundary

### `src/ui/game-cursor-effects.js`

Responsibility:

- own the cursor-effects browser subsystem
- bind cursor-specific DOM listeners once
- render cursor particles based on the selected effect
- keep internal cursor state out of `game.js`

Recommended public surface:

- `gameCursorEffects.init()`
- `gameCursorEffects.syncLabels({ t })`

Rules:

- this module may read from and write to the DOM
- this module may read from and write to `localStorage` for `cursorEffect`
- this module must not import `gameState`
- this module must not decide when language changes
- this module must not import translation state directly; translated option text
  should still be driven by `game.js`

### `game.js`

Responsibility after phase 6:

- call `gameCursorEffects.init()` during existing browser-event setup
- keep `updateLanguageUI()` as the single orchestration point for translated DOM
  refresh
- replace the inline cursor-option refresh block with
  `gameCursorEffects.syncLabels({ t })`

This preserves the current rule that `game.js` decides when UI translation
refresh happens, while the new module owns cursor-select DOM details.

## Data Flow

The intended phase-6 flow is:

1. `src/main.js` boots the app as it does now.
2. `bindGameEventListeners()` still composes browser interactions, but now calls
   into the cursor-effects module instead of owning its internal state.
3. The cursor-effects module restores the saved effect from `localStorage`,
   syncs the select value, and installs the `change` and `mousemove` listeners.
4. Pointer movement continues to create the same particle DOM nodes and cleanup
   timers as today.
5. When language changes, `game.js` still runs `updateLanguageUI()`.
6. `updateLanguageUI()` delegates only cursor-option label refresh to
   `gameCursorEffects.syncLabels({ t })`.

## Migration Strategy

Keep the phase narrow:

1. Move cursor state and particle helpers into `src/ui/game-cursor-effects.js`.
2. Move cursor-select binding and saved-effect restoration into that module.
3. Leave the existing `updateLanguageUI()` function in `game.js`.
4. Replace only the inline cursor-option translation loop with a module call.
5. Do not combine this work with online-count extraction or broader
   language-refresh extraction.

## Behavior Preservation Notes

The current behavior to preserve is:

- the saved cursor effect still loads on startup
- changing the select still updates `localStorage`
- changing the select still clears existing particles and resets particle count
- `none` still disables new particles
- language toggle still updates the visible option labels
- the select `title` attribute is not expanded or redesigned in this phase

That last point is intentional: this phase should preserve current behavior, not
broaden localization scope.

## Verification Strategy

Keep the existing lightweight verification style:

1. Syntax check touched modules:
   - `node --check game.js`
   - `node --check src/ui/game-cursor-effects.js`
   - `node --check src/main.js`
2. Run the existing automated suite:
   - `npm test`
3. Perform browser smoke verification covering:
   - initial load restores the saved cursor effect
   - each effect still renders as before
   - selecting `none` stops new particles
   - language toggle updates cursor option labels
   - online-count behavior remains unchanged

No new framework should be introduced for this phase.

## Risks and Mitigations

### Risk: Duplicate listeners after repeated init calls

Mitigation:

- make the cursor-effects module internally idempotent
- bind DOM listeners only once even if `init()` is called again

### Risk: Cursor labels drift after language toggle

Mitigation:

- keep translation-refresh ownership in `game.js`
- expose a small `syncLabels({ t })` method and call it from
  `updateLanguageUI()`

### Risk: Scope creeps into general language-refresh cleanup

Mitigation:

- explicitly leave `updateLanguageUI()` in `game.js`
- treat this phase as a cursor-subsystem extraction only

## Acceptance Criteria

- `game.js` no longer owns cursor particle state and particle helper functions
- `game.js` no longer binds cursor-select change events directly
- `game.js` still owns `updateLanguageUI()` and decides when translated refresh
  happens
- cursor visuals and preference persistence behave the same as before
- syntax checks pass for touched modules
- the existing automated tests continue to pass
- no AI, betting, showdown, translation-content, or online-count API behavior is
  changed as part of this phase
