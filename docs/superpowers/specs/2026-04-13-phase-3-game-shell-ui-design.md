# Phase 3 Game Shell UI Design

## Goal

Continue the medium refactor by extracting the non-table shell UI layer from
`game.js` into focused browser modules, while keeping gameplay behavior, DOM
structure, and visible presentation unchanged.

This phase is intentionally structural. It should reduce the amount of
history-panel, stats-panel, help-popup, and shell event code in `game.js`
without changing poker rules, state shape, AI behavior, or the current
translation model.

## Current Problems

After phase 2, the main game-table renderer and main game-table control
bindings are split out, but `game.js` still mixes orchestration with several
non-table UI responsibilities:

- action-history logging and hand-history DOM updates
- hand-history navigation UI
- stats tooltip rendering and stats-toggle UI
- help-popup visibility behavior
- language/mode toggle wiring and shell button refresh
- shell-level DOM updates that are not part of the main table

This creates three immediate problems:

1. `game.js` still combines gameplay orchestration with unrelated shell UI DOM
   work.
2. The remaining event-binding block is still broad enough that future UI
   cleanup depends on editing a very large file.
3. Translation refresh and shell UI refresh are entangled enough that small UI
   changes are harder to reason about than they need to be.

## Selected Approach

Extract the non-table shell UI into two browser modules:

- `src/ui/game-shell-renderer.js`
- `src/ui/game-shell-events.js`

`game.js` remains the orchestration layer in this phase. It will continue to
own game-state mutation, round progression, AI decisions, translation data,
message creation, and shell-state data such as hand-history arrays and current
viewing position. The new shell modules will own DOM rendering and DOM event
binding for shell UI that is not part of the main table.

This approach is preferred over:

- extracting AI or betting-round orchestration next, because those boundaries
  are higher value but materially riskier and larger
- moving the translation system out now, because that would expand scope across
  much more of the document and increase migration risk
- extracting cursor effects, audio, and online count together with shell UI,
  because those are separate concerns and do not form one clean low-risk slice

## User Decisions Captured In This Spec

The scope below reflects the approved choices from brainstorming:

- continue the current incremental medium-refactor cadence
- prioritize low-risk, high-yield module-boundary cleanup over deeper gameplay
  rewrites
- keep behavior unchanged wherever practical
- keep slimming `game.js`, but avoid splitting multiple unrelated subsystems in
  one phase
- do not introduce a new browser test framework in this phase
- do not move the translation system out of `game.js` yet

## Scope

### In Scope

- extract non-table shell rendering helpers from `game.js`
- extract non-table shell event binding from `game.js`
- keep `src/main.js` as the browser entry point
- keep `game.js` as the orchestration layer
- keep the current hand-history state arrays and shell-state values in
  `game.js`
- keep the current DOM selectors, IDs, and class names for shell UI
- preserve current side-panel, help-popup, stats, language-toggle, and
  mode-toggle behavior

### Out of Scope

- changing poker rules, betting flow, showdown flow, or dealing flow
- extracting AI strategy or AI profiling logic
- moving `TRANSLATIONS`, `t()`, `translateHandName()`, or general localization
  ownership out of `game.js`
- extracting audio setup or playback behavior
- extracting cursor-trail behavior
- extracting online-count polling
- redesigning layout or changing `index.html` structure
- adding a DOM test framework

## Module Boundaries

### `src/ui/game-shell-renderer.js`

Responsibility:

- render non-table shell UI that depends on already-owned state from `game.js`
- update hand-history navigation controls
- update the panel hand-number display
- render action-history content into the side panel
- render player stats tooltip content
- update help-popup visible state when asked
- update small shell control visuals such as the mode button when asked

Planned contents:

- helpers currently embedded in `updateHandNumberDisplay()`
- helpers currently embedded in `updateHistoryNavigation()`
- DOM-writing portions of `appendToCurrentHandHistory()` and history navigation
- DOM-writing portions of `updatePlayerStatsDisplay()` and
  `updateAllPlayerStatsDisplays()`
- a small helper for help-popup visible/hidden class updates
- small shell-UI helpers that only apply classes/text to shell controls

Rules:

- this module may read from and write to the DOM
- this module must not mutate poker rules or shared gameplay state
- this module must not own translation data or local-storage state
- this module should receive already-prepared values or translator callbacks
  from `game.js`

Expected public interface:

- a history-panel refresh helper
- a navigation-button state helper
- a panel hand-number helper
- player-stats rendering helpers
- a help-popup visibility helper
- small shell-control visual helpers needed by existing orchestration

The exported function names may stay close to the current in-file helper names
if that reduces migration risk.

### `src/ui/game-shell-events.js`

Responsibility:

- bind shell-area interactions that are not part of the main table controls

Planned contents:

- history navigation button listeners
- help-popup open/close listeners
- language-toggle listener
- game-mode toggle listener
- stats-toggle listener

Rules:

- this module should not import `gameState` directly
- this module should receive handlers from `game.js`
- this module should translate DOM events into handler calls only
- this module should not own cursor-select or global mousemove binding in this
  phase

Expected public interface:

- `bindGameShellEvents(handlers)`

Expected handler shape:

- `onNavigateHistory(direction)`
- `onReturnToCurrentHand()`
- `onOpenHelp()`
- `onCloseHelp()`
- `onToggleLanguage()`
- `onToggleGameMode()`
- `onToggleStats()`

If a small DOM helper is needed for popup-overlay click handling, it may be
included, but the module should remain thin.

### `game.js`

Responsibility after phase 3:

- keep game orchestration, state mutation, and round progression
- keep translation ownership and translated-message construction
- keep action-history arrays and current-viewing shell state as the source of
  truth
- call the shell renderer instead of directly performing most shell DOM
  updates
- provide handler functions to the shell-events module

Still intentionally left in `game.js` after phase 3:

- translation tables and translation helpers
- AI behavior and stats-profile decision logic
- betting-round orchestration and countdown behavior
- dealing and showdown sequencing
- audio initialization and playback
- cursor effects
- online-count polling

## Data Flow

The intended phase-3 execution shape is:

1. `src/main.js` boots the browser app as it does now.
2. `game.js` initializes orchestration, state, and shell state.
3. `bindGameEventListeners()` composes both table events and shell events.
4. Shell interactions are translated into handlers provided by `game.js`.
5. `game.js` mutates state, local-storage-backed preferences, or hand-history
   viewing state as needed.
6. `game.js` calls `src/ui/game-shell-renderer.js` to refresh the affected
   shell UI.
7. Translation refresh remains orchestrated by `game.js`, which may call shell
   renderer helpers with translated text or translator callbacks.

This keeps one source of truth for gameplay and shell state while making the
remaining UI boundary more explicit.

## Migration Strategy

Phase 3 should remain incremental and low risk.

1. Introduce `src/ui/game-shell-renderer.js` with behavior-preserving copies of
   the current shell DOM update logic.
2. Route history navigation, hand-number display, and stats display callsites
   in `game.js` through the shell renderer.
3. Keep hand-history arrays, current-viewing indices, and message-content
   construction in `game.js`.
4. Introduce `src/ui/game-shell-events.js` and move only shell-area listeners
   into it.
5. Keep translation data, cursor effects, audio, and online-count code in
   `game.js`.
6. Remove duplicated in-file shell DOM code once the new modules are wired in.

The phase should favor thin orchestration adapters over broad rewrites.

## HTML and CSS Constraints

The approved constraint for this phase is to avoid meaningful markup or styling
changes.

That means:

- keep the existing shell structure in `index.html`
- keep existing selector names and IDs used by the shell renderer and events
- keep CSS class names stable
- do not treat this phase as an opportunity to redesign side-panel or popup UI

If a tiny compatibility change is required to complete the extraction safely,
that change must be minimal and justified in the implementation plan.

## Error Handling

Phase 3 should preserve the current browser behavior and stay conservative:

- renderer helpers can keep the current defensive DOM patterns where they
  already exist
- event modules should fail fast on obviously missing required shell controls
  during initial binding, rather than silently binding a partial shell UI
- the renderer must not become a second source of truth for hand-history or
  stats state

The goal is to preserve runtime behavior while making UI failure locations
clearer during future refactors.

## Testing and Verification Strategy

This phase does not add DOM-level automation by default.

Automated verification remains:

- existing Node tests for pure rule and state modules
- `node --check` for changed browser modules

Manual verification remains required for the shell UI, and should be performed
over HTTP. Because the full browser smoke from phase 2 was still pending, the
manual pass for this phase should cover both the phase-2 table baseline and the
new shell boundaries.

Manual checklist:

1. start a new game over HTTP
2. verify the main table still deals cards and updates bets as before
3. verify action-history entries still append during play
4. verify previous/next/return hand navigation still works
5. verify the panel hand-number display stays correct when switching between
   past and current hands
6. verify the help popup still opens and closes correctly
7. verify the language toggle still refreshes shell text correctly
8. verify the mode toggle still refreshes the mode button and player mode
   classes correctly
9. verify stats toggle and stats tooltip content still refresh correctly

## Acceptance Criteria

Phase 3 is complete when all of the following are true:

- the non-table shell rendering logic no longer lives only inside `game.js`
- the non-table shell event-binding logic no longer lives only inside
  `game.js`
- `game.js` still owns orchestration, translation, and shell-state data
- `index.html` and `styles.css` remain effectively unchanged
- the existing Node test suite still passes
- the combined manual browser smoke for table and shell behavior passes

## Risks and Mitigations

### Risk: History extraction breaks current-hand vs past-hand rendering

Mitigation:

- keep hand-history arrays and current-viewing indices in `game.js`
- move only DOM-writing responsibilities into the renderer
- verify append, previous, next, and return flows manually

### Risk: Stats and language refresh drift apart

Mitigation:

- keep translation ownership in `game.js`
- let `updateLanguageUI()` remain the orchestration point for translated shell
  refreshes in this phase
- verify stats text after language toggle manually

### Risk: Scope creeps into cursor, audio, or online-count extraction

Mitigation:

- explicitly keep those systems in `game.js`
- reject unrelated cleanup from the implementation plan

## Follow-On Work

If phase 3 succeeds, later phases can safely extract:

- translation/localization helpers
- audio controls and audio lifecycle
- cursor and ambient browser-effects code
- online-count service integration
- betting-round orchestration/state-machine logic
- AI strategy modules
