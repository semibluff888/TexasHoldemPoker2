# Phase 7 Game History Design

## Goal

Continue the medium refactor by extracting the hand-history and action-log
subsystem from `game.js` into a focused UI module, while keeping gameplay
behavior, history navigation behavior, showdown detail logging, translated log
content, and visible shell rendering unchanged.

This phase stays structural. It should slim `game.js` further without changing
poker rules, AI decisions, betting/showdown settlement, translation content,
cursor behavior, audio behavior, or online-count behavior.

## Why This Phase Next

After phase 6, the main remaining non-rule slices still embedded in `game.js`
are:

- hand-history state and action-log entry construction
- `updateLanguageUI()` and broader language-refresh orchestration
- online-count polling and display refresh

Brief comparison:

1. Hand history and action logs
   - Best fit for the next medium phase.
   - It is a cohesive subsystem with clear state and rendering behavior:
     current hand number, stored entries per hand, current-viewing position,
     generic log entries, and showdown-detail entries.
   - It removes a meaningful amount of non-gameplay code from `game.js`
     without forcing a broader redesign of language refresh or betting flow.
2. `updateLanguageUI()` / language-refresh orchestration
   - Higher long-term payoff, but riskier right now.
   - That function still coordinates text refresh across table UI, shell UI,
     stats, cursor labels, best-hand highlighting, and online-count text.
   - Extracting it next would widen the phase into cross-module UI-refresh
     orchestration instead of one contained subsystem.
3. Online-count polling
   - Low risk, but lower yield.
   - The polling block is small and mostly startup/service wiring.
   - It would not reduce enough `game.js` weight to be the best next phase
     while the history subsystem is still embedded.

## Recommendation

Phase 7 should extract the hand-history and action-log subsystem first.

This keeps the refactor cadence consistent:

- low risk relative to gameplay logic
- behavior-preserving
- one cohesive subsystem at a time
- clear module boundary under `src/ui/`

`updateLanguageUI()` should remain in `game.js` for now, and online-count
polling should remain deferred to a later dedicated phase.

## Scope

### In Scope

- extract hand-history state from `game.js`:
  - `handNumber`
  - `handHistories`
  - `currentViewingHand`
- extract generic action-history entry creation from `game.js`
- extract showdown-detail and everyone-folded history entry creation from
  `game.js`
- extract current-hand vs past-hand navigation orchestration from `game.js`
- preserve the existing history-panel HTML structure and current translated log
  content
- preserve the current use of `src/ui/game-shell-renderer.js` for history-panel
  rendering
- keep `game.js` responsible for deciding when messages are logged

### Out of Scope

- changing poker rules, betting flow, dealing flow, or showdown settlement
- changing AI strategy, player profiling, or opponent-model logic
- extracting `updateLanguageUI()` from `game.js`
- changing translation keys or translation copy
- changing online-count polling or `/api/heartbeat` behavior
- changing cursor, audio, or startup-service behavior
- redesigning the history panel UI or changing `index.html` structure
- introducing a new test framework

## Selected Approach

Create one focused browser module:

- `src/ui/game-history.js`

This module should own:

- hand-history state and its lifecycle
- current-hand start/reset behavior for the history subsystem
- generic log-entry HTML construction
- showdown-detail and fold-win log-entry HTML construction
- current-viewing navigation behavior
- delegation to `src/ui/game-shell-renderer.js` for history-panel rendering and
  panel hand-number refresh

`game.js` should continue to own:

- gameplay state mutation
- betting, dealing, and showdown orchestration
- the decision of when to log a message or showdown event
- `currentLanguage`, `toggleLanguage()`, and `updateLanguageUI()`
- AI logic and pot-settlement logic

This keeps history as a UI-side stateful subsystem without turning it into a
second source of truth for gameplay.

## Module Boundary

### `src/ui/game-history.js`

Responsibility:

- own hand-history state and action-log entry creation
- decide how history state updates affect the shell history panel
- keep history-specific state out of `game.js`

Recommended public surface:

- `gameHistory.startHand({ currentLanguage, t })`
- `gameHistory.resetGame()`
- `gameHistory.showMessage({ message, phase, t })`
- `gameHistory.logAction({ player, action, chipsBeforeAction, t, getTranslatedPlayerName })`
- `gameHistory.logFoldWin({ winner, winAmount, t, getTranslatedPlayerName })`
- `gameHistory.logShowdown({ playersInHand, winners, communityCards, totalWinAmounts, t, translateHandName, getTranslatedPlayerName })`
- `gameHistory.navigate(direction, { currentLanguage, t })`
- `gameHistory.returnToCurrent({ currentLanguage, t })`
- `gameHistory.syncPanel({ currentLanguage, t })`

Rules:

- this module may read from and write to the DOM only through existing shell
  renderer helpers
- this module may keep its own history-specific state
- this module must not import `gameState`
- this module must not decide when betting rounds or showdown occur
- this module must not own translation state; translated strings should still
  be supplied by `game.js`

### `src/ui/game-shell-renderer.js`

Responsibility after phase 7:

- remain the DOM-writing helper for:
  - rendering history entries
  - appending current-hand entries
  - updating history navigation button state
  - updating the panel hand-number display

This phase should reuse the existing shell renderer instead of replacing it.

### `game.js`

Responsibility after phase 7:

- call the history module when a new hand starts
- call the history module when resetting the whole game
- call the history module when gameplay wants to log:
  - generic messages
  - action log messages
  - fold-win details
  - showdown details
- keep transient seat-action UI behavior outside the history module
- keep `updateLanguageUI()` as the orchestration point for translated refresh

That last point is important: history extraction should not become a general
language-refresh refactor.

## Data Flow

The intended phase-7 flow is:

1. `src/main.js` boots the app as it does now.
2. `game.js` continues to own gameplay sequencing.
3. When a new hand starts, `game.js` calls `gameHistory.startHand(...)`.
4. When gameplay wants to log text, `game.js` calls the appropriate history
   method instead of building history HTML inline.
5. The history module stores entries under the current hand and updates the DOM
   only when the current hand is being viewed.
6. History navigation buttons still call back into `game.js`, but `game.js`
   delegates the actual history-navigation state transition to the history
   module.
7. When language changes, `game.js` still runs `updateLanguageUI()`.
8. `updateLanguageUI()` delegates only the panel hand-number refresh to
   `gameHistory.syncPanel({ currentLanguage, t })`.

## Migration Strategy

Keep the phase narrow and incremental:

1. Create `src/ui/game-history.js` with the migrated history state and entry
   builders.
2. Move `handNumber`, `handHistories`, and `currentViewingHand` out of
   `game.js`.
3. Route `showMessage()` behavior through the new module.
4. Route fold-win and showdown-detail history entry creation through the new
   module.
5. Route history navigation and history reset/start behavior through the new
   module.
6. Leave seat-action popups, gameplay state mutation, and showdown settlement
   in `game.js`.
7. Leave `updateLanguageUI()` in `game.js` and replace only the direct panel
   hand-number refresh with a history-module call.

This phase should not combine language-refresh extraction, online-count
cleanup, or AI/betting refactors.

## Behavior Preservation Notes

The current behavior to preserve is:

- a new hand starts with an empty history view for that hand
- history entries are still stored per hand
- if the user is viewing the current hand, new entries still append to the DOM
  immediately
- if the user is viewing a past hand, new entries still store in memory
  without disrupting the viewed history
- previous/next/return navigation still works the same way
- showdown detail entries still use the existing translated labels and current
  HTML layout
- everyone-folded detail entries still use the existing translated labels and
  current HTML layout
- language toggle still refreshes the panel hand-number display correctly

The phase is intentionally about ownership and boundaries, not a redesign of
history presentation.

## Testing and Verification Strategy

Follow the existing lightweight verification style:

1. Add focused Node tests for `src/ui/game-history.js` using lightweight DOM
   stubs:
   - new-hand initialization
   - current-hand append behavior
   - past-hand viewing behavior
   - navigation state transitions
   - generic log entry construction
   - fold-win and showdown-detail entry construction
2. Syntax-check touched modules:
   - `node --check game.js`
   - `node --check src/ui/game-history.js`
   - `node --check src/main.js`
   - `node --check src/ui/game-shell-renderer.js`
3. Run the existing automated suite:
   - `npm test`
4. Perform browser smoke verification covering:
   - a new hand starts with empty current-hand history
   - action-history entries still append during live play
   - viewing a past hand does not get interrupted by new current-hand entries
   - previous/next/return history navigation still works
   - everyone-folded detail entries still render correctly
   - showdown detail entries still render correctly
   - language toggle still refreshes the panel hand-number display correctly

No new framework should be introduced for this phase.

## Risks and Mitigations

### Risk: Current-hand vs past-hand behavior regresses

Mitigation:

- make `src/ui/game-history.js` the single owner of history-viewing state
- preserve the rule that DOM append happens only when viewing the current hand
- cover current-hand and past-hand flows in targeted Node tests

### Risk: Showdown detail logs drift from existing content

Mitigation:

- preserve the current HTML structure and current translated labels
- keep showdown evaluation and payout logic in `game.js`
- have the history module format already-known results instead of recalculating
  gameplay outcomes

### Risk: Scope creeps into table-action UI or general shell rendering cleanup

Mitigation:

- keep transient seat-action popups outside this phase
- reuse `src/ui/game-shell-renderer.js` instead of redesigning it
- treat this phase as history-subsystem extraction only

## Acceptance Criteria

- `game.js` no longer owns `handNumber`, `handHistories`, or
  `currentViewingHand`
- `game.js` no longer builds generic history-entry HTML inline
- `game.js` no longer builds fold-win or showdown-detail history-entry HTML
  inline
- `game.js` still owns gameplay sequencing, showdown settlement, and
  translation-refresh orchestration
- history navigation behavior matches current behavior in the browser
- translated history content and panel hand-number behavior remain unchanged
- syntax checks pass for touched modules
- the existing automated tests continue to pass
- no AI, betting, showdown-settlement, cursor, audio, or online-count behavior
  is changed as part of this phase

## Follow-On Work

If phase 7 succeeds, later phases can safely extract:

- `updateLanguageUI()` and broader language-refresh orchestration
- online-count service integration
- startup wiring around browser-only services
- AI strategy modules
- betting-round orchestration or state-machine cleanup
