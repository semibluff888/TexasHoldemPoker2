# Phase 2 Game Table UI Design

## Goal

Continue the medium refactor by extracting the main game-table UI layer from
`game.js` into focused browser modules, while keeping gameplay behavior, DOM
structure, and visual presentation unchanged.

This phase is intentionally about UI structure, not new features. It should
reduce the amount of DOM-specific code in `game.js` without redesigning the
table or changing the rules, state model, or AI behavior.

## Current Problems

After phase 1, `game.js` has better rule and state boundaries, but the main
browser script still mixes too many responsibilities:

- game flow and betting progression
- AI and player action orchestration
- main table rendering
- card rendering and animations
- control-state updates
- main game-area event binding
- side-panel, popup, stats, and utility UI logic

This creates three immediate problems:

1. Main-game rendering is still tightly coupled to state progression.
2. The event-binding layer is harder to reason about because unrelated UI
   listeners are registered in one place.
3. Future refactors of the side panel, stats, or history UI still depend on a
   large `game.js` file with mixed DOM concerns.

## Selected Approach

Extract the main game area into two browser modules:

- `src/ui/game-table-renderer.js`
- `src/ui/game-table-events.js`

`game.js` remains the orchestration layer in this phase. It will continue to
own state mutation, round progression, AI decisions, timing, and most
non-table UI features, but it will stop directly owning the bulk of game-table
DOM rendering and main-game-area event binding.

This approach is preferred over:

- extracting only rendering, because event wiring would remain entangled with
  orchestration and the UI boundary would still be incomplete
- extracting both main game area and side-panel UI at once, because that makes
  the phase materially larger and riskier than needed
- redesigning DOM structure during extraction, because the user explicitly
  wants this phase to avoid HTML/CSS churn

## User Decisions Captured In This Spec

The scope below reflects the approved choices from brainstorming:

- prioritize UI/DOM refactoring before game flow or AI extraction
- refactor rendering and event binding together
- focus only on the main game area first
- keep `index.html` and `styles.css` effectively unchanged unless a minimal
  compatibility fix is strictly required
- validate primarily with existing Node tests, syntax checks, and manual
  browser testing rather than introducing DOM-level tests in this phase

## Scope

### In Scope

- extract main game-area rendering helpers from `game.js`
- extract main game-area event binding from `game.js`
- keep current DOM selectors, IDs, and class names for the main game area
- keep `src/main.js` as the browser entrypoint
- keep `game.js` as the orchestration layer that calls UI modules
- preserve current table behavior, animations, and visible layout
- preserve the current side-panel, popup, stats, history, language, and mode
  behavior even if those remain in `game.js`

### Out of Scope

- redesigning the table layout
- renaming or restructuring the main HTML markup
- editing `styles.css` except for a small compatibility fix if one is required
- extracting side-panel, help popup, stats panel, history navigation, language
  toggle, mode toggle, cursor effect, online count, or audio controls
- changing the game loop, betting rules, showdown rules, AI strategy, or state
  shape
- adding a browser DOM test framework in this phase

## Module Boundaries

### `src/ui/game-table-renderer.js`

Responsibility:

- render the visible main game area
- update player-area visual state
- update public-card area visual state
- update bet displays and pot display
- update action-control state for the active player
- own purely visual game-table helpers that do not change gameplay state

Planned contents:

- card rendering helpers currently used for hole cards and community cards
- player-area refresh logic currently embedded in `updateUI()`
- betting/pot display refresh logic currently embedded in `updateUI()`
- control enable/disable and slider synchronization currently embedded in
  `updateUI()`
- purely visual cleanup helpers such as hiding/showing the main game elements
  and clearing winner highlights

Rules:

- this module may read from the DOM and write to the DOM
- this module must not advance betting rounds or mutate poker rules/state
- this module must not own AI decisions, pot settlement, or showdown logic
- this module should expose a small public surface, even if it keeps several
  internal private helpers

Expected public interface:

- a high-level table refresh entrypoint used by `game.js`
- targeted card/community/bet update helpers still needed by existing dealing
  and animation flows
- visual cleanup helpers for the game-table area

The exact exported function names can stay close to the current ones if that
reduces migration risk.

### `src/ui/game-table-events.js`

Responsibility:

- bind main game-area interactions only

Planned contents:

- fold/check/call/raise/all-in button listeners
- raise-slider input listener
- half-pot / one-pot / two-pot button listeners
- new-game / continue button listeners because they are part of the game-table
  control area

Rules:

- this module should not import `gameState` directly
- this module should receive handlers from `game.js`
- this module should translate DOM events into handler calls and nothing more

Expected public interface:

- `bindGameTableEvents(handlers)`

Expected handler shape:

- `onFold()`
- `onCheck()`
- `onCall()`
- `onRaise(amount)`
- `onAllIn()`
- `onSetPotPreset(multiplier)`
- `onResetAndStartNewGame()`

If a small helper such as `getRaiseAmount()` makes the boundary cleaner, it may
be included, but the module should remain thin.

### `game.js`

Responsibility after phase 2:

- keep game orchestration, state mutation, and round progression
- call the table renderer instead of directly performing most main-game DOM
  updates
- provide handler functions to the table-events module
- keep non-table UI logic in place for now

Still intentionally left in `game.js` after phase 2:

- side panel and action history behavior
- help popup
- stats panel and tooltip logic
- language and mode UI
- cursor effects
- online count polling
- audio initialization and control binding
- showdown sequencing and pot animations

## Data Flow

The intended phase-2 execution shape is:

1. `src/main.js` boots the browser app as it does now.
2. `game.js` initializes orchestration and state.
3. `bindGameEventListeners()` delegates main game-area listeners to
   `src/ui/game-table-events.js`.
4. User actions in the main game area are translated into handlers provided by
   `game.js`.
5. Those handlers mutate `gameState` through the existing orchestration logic.
6. `game.js` calls `src/ui/game-table-renderer.js` to refresh the main table.
7. Non-table UI continues to be updated by the existing code paths in
   `game.js`.

This keeps a single source of truth for gameplay state while making the DOM
boundary explicit.

## Migration Strategy

Phase 2 should remain incremental and low risk.

1. Introduce `src/ui/game-table-renderer.js` with behavior-preserving copies of
   the existing game-table DOM logic.
2. Route the existing `game.js` refresh paths through the renderer module.
3. Introduce `src/ui/game-table-events.js` and move only the main game-area
   listeners into it.
4. Keep `bindGameEventListeners()` in `game.js`, but make it compose the new
   event module rather than bind everything inline.
5. Leave non-table UI listeners in `game.js` for now.
6. Remove duplicated in-file UI logic once the new modules are wired in.

The phase should favor thin orchestration adapters over broad rewrites.

## HTML and CSS Constraints

The approved constraint for this phase is to avoid meaningful markup or styling
changes.

That means:

- keep the existing main table structure in `index.html`
- keep existing selector names and IDs used by the renderer
- keep CSS class names stable
- do not treat this phase as an opportunity to redesign layout or styles

If a tiny compatibility change is required to complete the extraction safely,
that change must be minimal and justified in the implementation plan.

## Error Handling

Phase 2 should preserve the current browser behavior and stay conservative:

- missing DOM nodes can still use the current defensive patterns where they
  already exist
- event modules should fail fast on obviously missing required controls during
  initial binding, rather than silently binding a partial game-table UI
- renderer helpers should not silently mutate gameplay state when DOM updates
  fail

The goal is to preserve runtime behavior while making failure locations easier
to understand during refactor work.

## Testing and Verification Strategy

This phase does not add DOM-level automation by default.

Automated verification remains:

- existing Node tests for pure rule and state modules
- `node --check` for changed browser modules

Manual verification remains required for the visible game table:

1. start a new game over HTTP
2. verify hole-card dealing and public-card dealing still render correctly
3. verify pot display, bet display, and player active/dealer/fold/all-in states
   still refresh correctly
4. verify `fold`, `check`, `call`, `raise`, and `all-in` still work
5. verify raise slider and pot preset buttons still work
6. verify showdown highlights and cleanup still appear correctly

This test strategy is explicitly limited so the phase stays structural rather
than turning into a test-framework migration.

## Acceptance Criteria

Phase 2 is complete when all of the following are true:

- the main game-table rendering logic no longer lives only inside `game.js`
- the main game-table event-binding logic no longer lives only inside
  `game.js`
- `game.js` still owns orchestration and state progression
- `index.html` and `styles.css` remain effectively unchanged
- the existing Node test suite still passes
- the main game area still behaves the same in manual browser testing

## Risks and Mitigations

### Risk: Renderer extraction accidentally changes visual refresh order

Mitigation:

- preserve the current call order as much as possible
- keep the first exported renderer API close to the existing function shape
- verify dealing, betting, and showdown manually

### Risk: Event extraction duplicates or drops listeners

Mitigation:

- keep `bindGameEventListeners()` as the composition root
- move only main-table listeners in this phase
- verify each main control manually after extraction

### Risk: Scope creeps into side-panel or popup refactors

Mitigation:

- keep side-panel, help, stats, history, cursor, audio, and online-count logic
  in `game.js`
- reject unrelated UI cleanup from the implementation plan

## Follow-On Work

If phase 2 succeeds, later phases can safely extract:

- side-panel and history UI
- stats and profile rendering
- help and settings UI
- audio controls
- game flow/state machine logic
- AI modules
