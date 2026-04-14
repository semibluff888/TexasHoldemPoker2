# Phase 4 Game Audio Design

## Goal

Continue the medium refactor by extracting audio lifecycle and audio-control
browser code from `game.js` into a focused UI module, while keeping gameplay
behavior, sound timing, control behavior, and visible presentation unchanged.

This phase remains structural. It should reduce the amount of browser-only
audio setup code in `game.js` without changing poker rules, AI behavior,
translation ownership, cursor behavior, or online-count behavior.

## Current Problems

After phase 3, `game.js` is slimmer around shell UI and event binding, but it
still owns a large browser-specific audio subsystem:

- sound asset configuration and background-music configuration
- audio element caching and overlap playback behavior
- Safari/iOS-style audio unlock handling
- button and slider binding for music, SFX, and volume controls
- button visual state updates for muted/unmuted controls

This creates three immediate problems:

1. `game.js` still mixes gameplay orchestration with a self-contained browser
   subsystem that does not need access to poker rules or round state.
2. Audio-control wiring is harder to reason about because the code sits far
   away from the points that actually trigger sound playback.
3. Future cleanup of translation, cursor effects, or startup orchestration is
   harder while audio setup remains embedded in the main file.

## Selected Approach

Extract the current `SoundManager` object into a dedicated browser module:

- `src/ui/game-audio.js`

`game.js` remains the orchestration layer in this phase. It will continue to
decide when gameplay events should trigger audio, such as dealing, betting,
showdown, and game start. The new audio module will own browser-facing audio
resource setup, control binding, unlock behavior, and playback helpers.

This approach is preferred over:

- extracting translation/localization next, because translation helpers are
  referenced across much more of the current code and would widen the phase
  substantially
- extracting cursor effects next, because that slice is cleaner but much
  smaller and would not reduce as much `game.js` weight
- extracting online-count polling next, because that front-end slice is small
  and does not remove a meaningfully large subsystem from `game.js`
- extracting betting or showdown orchestration next, because those boundaries
  are more valuable long term but materially riskier right now

## User Decisions Captured In This Spec

The scope below reflects the approved direction for this phase:

- continue the current incremental medium-refactor cadence
- prioritize low-risk, high-yield module-boundary cleanup
- keep behavior unchanged wherever practical
- keep slimming `game.js`, but avoid splitting multiple unrelated subsystems in
  one phase
- do not introduce a new browser test framework in this phase
- do not move translation ownership, AI orchestration, betting orchestration,
  showdown orchestration, cursor behavior, or online-count polling in this
  phase

## Scope

### In Scope

- extract audio setup and playback helpers from `game.js`
- extract audio-control DOM binding for music, SFX, and volume controls
- preserve current sound asset paths and current playback timing
- preserve current background-music autoplay/unlock behavior
- preserve current overlapping SFX behavior via cloned audio nodes
- keep `src/main.js` as the browser entry point
- keep `game.js` responsible for deciding when to trigger audio actions

### Out of Scope

- changing poker rules, betting flow, dealing flow, or showdown flow
- changing which gameplay events trigger sounds
- changing translation tables, `t()`, or language-refresh ownership
- extracting cursor-trail behavior
- extracting online-count polling or API integration
- redesigning sound controls or changing `index.html` structure
- adding persistent audio preferences to local storage
- adding a DOM test framework

## Module Boundaries

### `src/ui/game-audio.js`

Responsibility:

- own browser audio resource configuration and browser audio state
- preload sound effects and background music
- manage music-enabled, sfx-enabled, and volume state
- bind the existing audio control DOM listeners
- implement first-user-interaction audio unlock behavior
- expose focused methods for gameplay-triggered sound playback

Planned contents:

- the current sound-effect URL map
- the current music URL
- cached audio elements and music element ownership
- `init()` logic that preloads audio, binds controls, and installs unlock
  listeners
- `toggleMusic()`, `toggleSfx()`, and `setVolume()` behavior
- `playMusic()`, `stopMusic()`, and specific gameplay sound helpers such as
  `playCardDeal()` and `playWin()`

Constraints:

- this module must stay browser-facing and must not import poker-rule modules
- this module must not read or mutate `gameState`
- this module must not decide when a hand starts, ends, or advances
- this module should remain safe if `init()` is called more than once, so the
  current single-boot guard in `game.js` is not the only protection against
  duplicate DOM listeners

### `game.js`

Responsibility after this phase:

- keep orchestration, state mutation, gameplay sequencing, and translation
  ownership
- create or import the audio controller and initialize it during boot
- continue to call audio methods at the same gameplay points as today
- continue to decide when background music should start or stop

Code that should stay in `game.js`:

- the places where dealing, betting, showdown, and turn notifications trigger
  audio
- startup sequencing such as `bootGame()` and `startNewGame()`
- translation-owned button labels outside the audio module
- all non-audio browser subsystems

Code that should move out of `game.js`:

- the embedded `SoundManager` object
- audio-control DOM listener binding
- audio unlock listener setup
- audio cache ownership and playback implementation details

## Data Flow

The post-refactor audio flow should look like this:

1. `bootGame()` initializes the app as it does today.
2. During boot, `game.js` initializes the audio module.
3. The audio module preloads sound resources, binds sound controls, and
   installs one-time unlock listeners.
4. Gameplay code in `game.js` calls focused methods such as `playCardDeal()`,
   `playChips()`, `playWin()`, `playYourTurn()`, and `playMusic()` at the same
   orchestration points as today.
5. The audio module handles browser-level playback details without exposing its
   internal cache or DOM listener details back to `game.js`.

## Migration Strategy

Perform the extraction in one focused phase:

1. Create `src/ui/game-audio.js` with the migrated audio controller logic.
2. Export a focused browser-facing API that matches the current needs of
   `game.js`.
3. Replace the inline `SoundManager` usage in `game.js` with the imported audio
   controller.
4. Keep all call sites for gameplay-triggered audio timing in place to avoid
   behavior drift.
5. Verify that the same audio controls, sound triggers, and startup behavior
   still work in the browser.

The migration should not combine cursor, translation, or online-count cleanup.

## HTML and CSS Constraints

- keep the current audio control element IDs:
  - `btn-music`
  - `btn-sfx`
  - `volume-slider`
- keep the current button text/icon behavior and muted-class behavior
- keep the current existing layout and styling hooks
- avoid changing `index.html` unless a small defensive attribute change is
  strictly necessary
- avoid changing `styles.css` unless a behavior-preserving fix is strictly
  necessary

## Error Handling

- preserve the current tolerant behavior for browser autoplay failures
- preserve the current pattern of catching playback errors without interrupting
  gameplay
- preserve graceful behavior when audio control elements are absent from the
  DOM
- preserve graceful behavior if audio resources are not yet ready when music is
  requested

This phase should not add user-facing error UI for audio failures.

## Testing and Verification Strategy

This repository already uses Node checks and Node tests for pure modules. This
phase should follow the same lightweight verification style as phases 2 and 3:

1. Syntax-check the touched browser files:
   - `node --check game.js`
   - `node --check src/ui/game-audio.js`
   - `node --check src/main.js`
2. Run the existing automated test suite:
   - `npm test`
3. Perform browser smoke verification covering:
   - initial boot still succeeds
   - music button toggles muted visual state correctly
   - SFX button toggles muted visual state correctly
   - volume slider still updates playback volume
   - starting a new game still attempts to start music as before
   - deal, check, fold, chips, all-in, win, and your-turn sounds still trigger
   - repeated use of controls does not create duplicate listeners or obvious
     duplicate playback side effects

No new framework should be introduced for this phase.

## Acceptance Criteria

- `game.js` no longer contains the embedded audio manager implementation
- audio-control listener binding lives in `src/ui/game-audio.js`
- `game.js` still controls when audio methods are invoked during gameplay
- sound control behavior matches current behavior in the browser
- background music behavior matches current behavior in the browser
- syntax checks pass for touched modules
- existing automated tests continue to pass
- no gameplay rules or flow behavior change as part of this phase

## Risks and Mitigations

### Risk: Audio extraction changes playback timing

Mitigation:

- keep all gameplay-triggered call sites in `game.js`
- migrate implementation details only, not orchestration decisions
- verify deal, action, and showdown sounds manually after extraction

### Risk: Duplicate control listeners or duplicate unlock listeners

Mitigation:

- make audio-module initialization idempotent
- keep `bootGame()` single-boot behavior in place
- manually exercise the controls multiple times during smoke testing

### Risk: Scope creeps into translation, cursor, or startup refactors

Mitigation:

- limit the phase to audio resource ownership, control binding, and playback
  helpers
- keep translation refresh, cursor effects, and online-count logic in
  `game.js`
- defer any broader startup cleanup to a later phase

## Follow-On Work

If phase 4 succeeds, later phases can safely extract:

- translation/localization helpers
- cursor and ambient browser-effects code
- online-count service integration
- startup wiring cleanup around `bootGame()` and browser-only services
- betting-round orchestration/state-machine logic
- AI strategy modules
