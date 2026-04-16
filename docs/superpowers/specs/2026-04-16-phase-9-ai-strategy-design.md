# Phase 9 AI Strategy Design

## Goal

Continue the medium refactor by extracting AI strategy and opponent-profile
logic from `game.js` into a focused module, while keeping gameplay behavior,
betting flow, showdown flow, translated UI behavior, and visible table updates
unchanged.

This phase stays structural. It should slim `game.js` further without changing
poker rules, action execution, animation timing, history logging, audio
triggers, or `/api/heartbeat` behavior.

## Why This Phase Next

After phase 8, the largest remaining slices inside `game.js` are:

- AI strategy and hand-strength evaluation
- betting-round orchestration and human-turn waiting
- showdown orchestration and winner presentation
- small browser-service leftovers such as online-count polling

Brief comparison:

1. AI strategy extraction
   - Best fit for the next phase.
   - It removes a large amount of logic from `game.js` while preserving the
     existing action-execution path.
   - Most of this code is decision logic over existing state, which is easier
     to isolate and test than async round orchestration.
2. Betting-round orchestration
   - Higher long-term payoff, but higher immediate risk.
   - The current flow mixes async waits, countdown timers, game-cancellation
   checks, AI turns, and human turns.
   - The repository does not yet have dedicated test coverage for that
     orchestration layer.
3. Showdown orchestration
   - Useful, but still more coupled than AI strategy.
   - The remaining showdown block mixes hand comparison, payout application,
     translated messages, DOM highlighting, audio, and animations.
4. Online-count extraction
   - Low risk, but low yield.
   - It does not reduce enough `game.js` weight to be the best next step.

## Recommendation

Phase 9 should extract AI strategy first.

More specifically, this phase should move AI decision-making and opponent
profiling out of `game.js`, while keeping actual gameplay mutation and UI side
effects in `game.js`.

This is the best balance of:

- low risk relative to round-flow extraction
- high yield in `game.js` size reduction
- behavior preservation
- clearer boundaries for a later betting-round refactor

## Scope

### In Scope

- extract AI hand-evaluation helpers from `game.js`
- extract AI hand-bucket and position helpers from `game.js`
- extract draw-evaluation and win-probability helpers from `game.js`
- extract opponent-profile calculation from `game.js`
- extract easy / medium / hard AI action-selection logic from `game.js`
- keep `game.js` responsible for applying the chosen action through the
  existing `playerFold()`, `playerCheck()`, `playerCall()`, and
  `playerRaise()` functions
- preserve current AI-level behavior and current bet-size heuristics
- add focused Node tests for the extracted AI module

### Out of Scope

- changing betting-round orchestration
- changing countdown behavior or human-turn waiting
- changing showdown sequencing or payout animation behavior
- changing poker rules, pot-settlement rules, or hand-evaluation rules
- changing translated copy or language-refresh behavior
- changing AI add/remove-seat behavior
- redesigning `index.html`, CSS, or visible table presentation
- introducing a new test framework

## Selected Approach

Create one focused AI module:

- `src/ai/game-ai.js`

This module should own:

- strategy-local constants and helper functions
- opponent-profile calculation
- AI action selection for all supported AI levels

`game.js` should continue to own:

- live gameplay state mutation
- action execution
- round progression
- timers and cancellation behavior
- UI refresh, history logging, and audio triggers

The key boundary is:

- the AI module decides what action should be taken
- `game.js` decides how that action is executed in the running game

That keeps side effects and orchestration stable while still removing the large
strategy block from `game.js`.

## Module Boundary

### `src/ai/game-ai.js`

Responsibility:

- read already-available game state
- compute opponent tendencies from player stats
- decide the next AI action for a given player
- keep strategy-specific helpers out of `game.js`

Recommended contents:

- current bucket constants
- `getHandNotation()`
- `getHandBucket()`
- `getPosition()`
- `evaluateDraws()`
- `calculateWinProbability()`
- `evaluateAIHand()`
- `getOpponentProfile()`
- current easy-mode strategy logic
- current medium/hard strategy logic
- current bet-sizing helper logic used by strategy decisions

Recommended public surface:

- `decideAIAction({ gameState, playerId, random })`
- `getOpponentProfile(player)`

Recommended return shape for `decideAIAction()`:

```js
{ type: 'fold' }
{ type: 'check' }
{ type: 'call' }
{ type: 'raise', totalBet: 240 }
```

Rules:

- this module must not read from or write to the DOM
- this module must not import browser-only UI modules
- this module must not call `playerFold()`, `playerCheck()`, `playerCall()`,
  `playerRaise()`, or `playerAllIn()` directly
- this module may read `gameState`, but should treat it as input for decision
  making rather than mutating it
- randomness should be injectable for deterministic tests, with `Math.random`
  as the default runtime source

### `game.js`

Responsibility after phase 9:

- keep action-execution side effects in the current place
- call the AI module during AI turns
- translate the returned AI action into the existing player-action functions
- keep `getOpponentProfile()` available to stats and language-refresh code via
  dependency injection

Code that should stay in `game.js`:

- `playerFold()`, `playerCheck()`, `playerCall()`, `playerRaise()`,
  `playerAllIn()`
- `runBettingRound()`
- countdown and human-input waiting
- AI seat-management functions such as `toggleAILevel()`, `removeAIPlayer()`,
  and `addAIPlayer()`
- showdown sequencing and winner presentation

Code that should move out of `game.js`:

- `evaluateAIHand()`
- `getHandNotation()`
- `getHandBucket()`
- `getPosition()`
- `evaluateDraws()`
- `calculateWinProbability()`
- `getOpponentProfile()`
- current easy-mode AI decision logic
- current enhanced preflop/postflop AI decision logic

## Data Flow

The intended phase-9 flow is:

1. `runBettingRound()` reaches an AI player's turn in `game.js`.
2. `game.js` still performs the existing active-player UI refresh and delay.
3. `game.js` calls `decideAIAction({ gameState, playerId })`.
4. The AI module returns a plain action description.
5. `game.js` executes that description through the current player-action
   functions.
6. Those existing action functions continue to handle:
   - game-state mutation
   - audio
   - history logging
   - UI refresh
   - stats-panel refresh

This keeps the current gameplay side effects centralized while turning AI logic
into an explicit dependency.

## Behavior Preservation Notes

The current behavior to preserve is:

- easy AI still uses the simpler strength-based decision model
- medium and hard AI still share the current enhanced decision model
- preflop and postflop thresholds remain unchanged
- current bet-size heuristics remain unchanged
- current opponent-profile thresholds remain unchanged
- AI actions still flow through the same player-action functions, so history,
  audio, and UI updates stay in the same path

To reduce subtle drift, the extraction should preserve:

- current branch ordering
- current threshold values
- current use of current bet, min raise, pot size, and chip caps
- current interpretation of all-in results through existing action execution

This phase should not combine strategy retuning, dead-code cleanup beyond the
extracted block, or difficulty rebalance work.

## Testing and Verification Strategy

Follow the existing lightweight style:

1. Add focused Node tests for `src/ai/game-ai.js` using plain state fixtures.
   Cover:
   - opponent-profile calculation
   - hand-notation and hand-bucket classification
   - draw detection and win-probability helpers
   - easy AI returning fold / check / call / raise in representative cases
   - enhanced AI returning expected actions for representative preflop and
     postflop spots
   - raise sizing staying within min/max constraints
2. Make randomness deterministic in tests by injecting a fixed `random()`
   function.
3. Syntax-check touched modules:
   - `node --check game.js`
   - `node --check src/ai/game-ai.js`
   - `node --check src/main.js`
4. Run the automated suite:
   - `npm test`
5. Perform browser smoke verification covering:
   - AI players still act on their turns
   - easy AI still behaves as the simpler mode
   - medium/hard AI still produce raises, calls, checks, and folds in normal
     play
   - stats panel still renders opponent-profile values
   - language toggle still refreshes stats labels correctly
   - no regression in history logging or audio triggers for AI actions

No new framework should be introduced for this phase.

## Risks and Mitigations

### Risk: Extraction changes live AI behavior through altered branch structure

Mitigation:

- preserve the current decision tree closely
- keep threshold values unchanged
- add deterministic unit tests for representative branches

### Risk: AI module becomes a second action-execution path

Mitigation:

- return plain action descriptions only
- keep all state mutation and side effects in `game.js`
- route execution through the existing player-action functions only

### Risk: Opponent-profile extraction breaks stats rendering dependencies

Mitigation:

- keep `getOpponentProfile()` as an exported helper
- continue passing it into existing UI/language modules through dependency
  injection
- verify stats rendering and language refresh after extraction

## Acceptance Criteria

- `game.js` no longer contains the main AI strategy block
- `game.js` no longer defines `getOpponentProfile()`
- AI turns still execute through the existing player-action functions
- stats rendering still receives `getOpponentProfile()` from the extracted AI
  module
- gameplay behavior remains unchanged in browser smoke testing
- syntax checks pass for touched modules
- the automated test suite continues to pass

## Follow-On Work

If phase 9 succeeds, later phases can safely extract:

- betting-round orchestration
- human-turn waiting and countdown control
- showdown orchestration cleanup
- remaining startup/browser-service slices such as online-count polling
