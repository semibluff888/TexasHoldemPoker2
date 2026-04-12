# Phase 1 Refactor Design

## Goal

Create a low-risk foundation for a medium-sized refactor of the poker game by
extracting pure game rules from the monolithic browser script, introducing
native ES modules, and adding automated regression coverage for hand evaluation
and pot settlement.

This phase is intentionally structural. The table layout, animations, audio
behavior, and game flow should remain visibly unchanged to the player.

## Current Problems

The current implementation keeps almost all responsibilities in
`game.js`:

- game state creation and mutation
- hand evaluation and pot settlement rules
- AI decision logic
- DOM rendering and event binding
- audio setup
- localization
- online count polling

This creates three immediate problems:

1. Rule logic is hard to verify because it is mixed with DOM and timing code.
2. Refactoring any gameplay rule risks breaking UI behavior.
3. The project has no automated tests for the most correctness-sensitive logic.

## Selected Approach

Use browser-native ES modules without adding a bundler in this phase.

`index.html` will load a module entry point. That entry point will initialize
the application and import focused modules from `src/`.

This approach is preferred over:

- keeping a single script file with only comment-based sections, because it does
  not create enforceable boundaries
- introducing a bundler now, because that mixes code structure changes with tool
  chain migration and increases the risk of avoidable regressions

## Scope

### In Scope

- convert the runtime entry from a classic script to a module entry
- add `src/` module structure for pure rules and state factories
- move hand evaluation logic into a pure module
- move pot settlement logic into a pure module
- move base game/player state factory logic into a state module
- add automated tests for extracted pure modules
- keep the current DOM structure and current CSS selectors intact
- preserve current gameplay flow and UI behavior

### Out of Scope

- redesigning the table UI
- changing AI strategy behavior
- changing localization text content
- replacing the current animation system
- introducing a frontend framework
- introducing a bundler or transpiler
- finishing the full medium refactor in one pass

## Module Boundaries

### `src/main.js`

Responsibility:

- browser entry point
- startup ordering
- DOM event binding
- wiring extracted modules into the existing orchestration code

Notes:

- this file should become the only script referenced by `index.html`
- it should own bootstrap sequencing such as `initPlayers`, `SoundManager.init`,
  `initOnlineCount`, initial UI sync, and control binding

### `src/core/cards.js`

Responsibility:

- card constants shared by rule modules
- deck creation and shuffle helpers
- card value normalization helpers

Expected exports:

- `SUITS`
- `VALUES`
- `createDeck()`
- `shuffleDeck(deck)`
- `getCardValue(value)`

Only pure helpers belong here. Functions that depend on current table state or
DOM positions stay outside this module in phase 1.

### `src/core/hand-evaluator.js`

Responsibility:

- pure hand ranking and comparison

Expected exports:

- `evaluateHand(cards)`
- `evaluateFiveCards(cards)`
- `getCombinations(arr, size)`
- `checkStraight(values)`

Rules:

- input is plain card data
- output is plain result data
- no reads from `gameState`
- no DOM work

### `src/core/pot-settlement.js`

Responsibility:

- pure side-pot construction and chip distribution helpers

Expected exports:

- `calculatePots(players)`
- `splitPot(amount, winnerIds, seatingOrder)`

Rules:

- inputs are plain player contribution records
- folded contributions must remain attached to the correct contribution levels,
  not be collapsed into the first pot
- total distributed chips must exactly equal total pot amount

Odd chip rule for this project:

- when a pot does not divide evenly, distribute the remaining chips one at a
  time following table order starting from the first eligible winner clockwise
  from the dealer button

This rule is explicit to avoid ambiguity and to preserve chip conservation.

### `src/state/game-state.js`

Responsibility:

- initial game state factory
- player factory
- default stats factory
- hand reset helpers

Expected exports:

- `SMALL_BLIND`
- `BIG_BLIND`
- `STARTING_CHIPS`
- `createDefaultStats()`
- `createPlayer(overrides)`
- `createInitialGameState()`
- `resetPlayersForNewHand(players, options)`

This module should centralize object-shape definitions so later phases can move
orchestrator code without chasing duplicated defaults.

## Migration Strategy

Phase 1 is intentionally incremental.

1. Add pure modules first with no behavior changes.
2. Add tests for the extracted logic before routing runtime code to them.
3. Switch the runtime entry to ES modules.
4. Replace in-file rule implementations with imports from `src/`.
5. Leave DOM rendering, timing, audio, localization, and most orchestration in
   place for now.

This preserves working behavior while creating stable seams for later phases.

## Runtime and Deployment Considerations

The current Docker setup serves static files over HTTP and is compatible with
native browser modules.

After the entry script becomes a module, local development should also use an
HTTP static server instead of relying on `file://` loading. The README should
be updated during implementation to reflect that expectation.

No server-side runtime changes are required for this phase.

## Data Flow After Phase 1

The intended execution shape is:

1. `index.html` loads `src/main.js`
2. `src/main.js` initializes state and services
3. runtime orchestration reads and mutates the shared game state
4. when rule decisions are needed, orchestration calls pure modules
5. pure modules return plain data structures
6. orchestration applies results to state and triggers existing UI updates

The critical design point is that rule modules do not call back into the DOM or
global browser APIs.

## Error Handling

Phase 1 keeps runtime error handling conservative:

- online count polling continues to fail quietly when `/api/heartbeat` is not
  available
- DOM-oriented code keeps current defensive null checks
- pure rule modules should throw or fail fast on structurally invalid inputs
  during tests, rather than silently producing partial results

This gives clearer failures in automated verification without changing normal
player-facing behavior.

## Testing Strategy

Phase 1 introduces automated tests only for pure modules.

Test areas:

- hand ranking ordering
- tie breaking within the same hand class
- ace-low straight handling
- side-pot construction across folded, all-in, and tied-winner scenarios
- odd-chip distribution with exact chip conservation

Test runner:

- use Node's built-in test runner to avoid adding a test framework in this
  phase

Expected files:

- `tests/core/hand-evaluator.test.js`
- `tests/core/pot-settlement.test.js`

Package updates:

- replace the placeholder test script in `package.json` with a real test command

## Acceptance Criteria

Phase 1 is complete when all of the following are true:

- `index.html` loads a module entry point successfully
- hand evaluation logic no longer lives only inside the monolithic script
- pot settlement logic no longer lives only inside the monolithic script
- state factory/default object creation is centralized
- automated tests cover representative hand evaluation and side-pot cases
- the game still starts, deals hands, and reaches showdown with unchanged UI

## Risks and Mitigations

### Risk: Entry-point conversion breaks current local usage

Mitigation:

- keep the deployment model static-only
- verify module loading through HTTP
- update README during implementation

### Risk: Partial extraction creates duplicate logic

Mitigation:

- once an extracted rule module is wired in, remove the legacy in-file version
  immediately instead of keeping two active implementations

### Risk: Refactor quietly changes gameplay behavior

Mitigation:

- limit phase 1 to pure-rule extraction and startup wiring
- add regression tests before swapping runtime calls
- verify a full manual happy-path round after code changes

## Follow-On Phases

This phase is the prerequisite for the medium refactor target.

Later phases can then safely extract:

- rendering and DOM update helpers
- audio management
- localization
- online count polling
- AI strategy modules
- round orchestration/state machine code
