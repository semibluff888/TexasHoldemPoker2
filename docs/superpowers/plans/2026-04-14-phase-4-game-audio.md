# Phase 4 Game Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract browser audio lifecycle and audio-control code from `game.js` into a focused UI module while preserving current sound timing, control behavior, and gameplay flow.

**Architecture:** Keep `game.js` as the orchestration layer for gameplay state, round progression, translation, and the decision of when sounds should play. Introduce `src/ui/game-audio.js` as a browser-only module that owns audio resource setup, control binding, unlock behavior, and playback helpers, with `game.js` importing that module and keeping all existing sound trigger points.

**Tech Stack:** Vanilla JavaScript ES modules, browser DOM APIs, HTML5 Audio, existing Node built-in test runner via `npm test`, `node --check`, manual browser verification over static HTTP

---

## File Structure

- `src/ui/game-audio.js`
  Responsibility: Own browser audio state, preload sound assets, bind the existing music/SFX/volume controls, install first-interaction audio unlock listeners, and expose focused playback helpers such as `playCardDeal()` and `playWin()`.
- `game.js`
  Responsibility after this phase: Keep gameplay orchestration, translation ownership, startup flow, and all existing audio trigger points, but import the extracted audio module instead of owning the embedded `SoundManager` implementation.
- `src/main.js`
  Responsibility after this phase: Remain the browser entrypoint without behavior changes.

No new DOM-test framework is introduced in this phase. Verification remains the existing `npm test` suite plus `node --check` for changed browser modules and a manual browser smoke over HTTP.

### Task 1: Create the Game Audio Module

**Files:**
- Create: `src/ui/game-audio.js`
- Test: `src/ui/game-audio.js`

- [ ] **Step 1: Run a module syntax check before the file exists**

Run: `node --check src/ui/game-audio.js`
Expected: FAIL with a missing-file error because the audio module does not exist yet

- [ ] **Step 2: Create `src/ui/game-audio.js` with the extracted browser audio controller**

Create `src/ui/game-audio.js` with this exact public surface:

```js
const MUSIC_BUTTON_ICON = '\uD83C\uDFB5';
const SFX_BUTTON_ICON = '\uD83D\uDD0A';
const SFX_MUTED_ICON = '\uD83D\uDD07';
const DEFAULT_VOLUME = 0.5;
const MUSIC_VOLUME_FACTOR = 0.5;

function getMusicButton() {
    return document.getElementById('btn-music');
}

function getSfxButton() {
    return document.getElementById('btn-sfx');
}

function getVolumeSlider() {
    return document.getElementById('volume-slider');
}

function syncMusicButton(musicEnabled) {
    const btn = getMusicButton();
    if (!btn) return;

    btn.classList.toggle('muted', !musicEnabled);
    btn.textContent = MUSIC_BUTTON_ICON;
}

function syncSfxButton(sfxEnabled) {
    const btn = getSfxButton();
    if (!btn) return;

    btn.classList.toggle('muted', !sfxEnabled);
    btn.textContent = sfxEnabled ? SFX_BUTTON_ICON : SFX_MUTED_ICON;
}

function syncVolumeSlider(volume) {
    const volumeSlider = getVolumeSlider();
    if (!volumeSlider) return;

    volumeSlider.value = volume * 100;
}

export const gameAudio = {
    initialized: false,
    controlsBound: false,
    unlockBound: false,
    sounds: {
        cardDeal: 'sound/card_deal.mp3',
        cardFlip: 'sound/card_deal.mp3',
        chips: 'sound/chips.mp3',
        check: 'sound/check.mp3',
        fold: 'sound/fold.mp3',
        win: 'sound/win.mp3',
        yourTurn: 'sound/ding.mp3',
        allIn: 'sound/all in.mp3'
    },
    musicUrl: 'sound/Jazz at Mladost Club - Blue Monk.mp3',
    audioCache: {},
    musicElement: null,
    musicEnabled: true,
    sfxEnabled: true,
    volume: DEFAULT_VOLUME,
    audioUnlocked: false,

    init() {
        if (!this.initialized) {
            this.preloadAudio();
            this.setupControls();
            this.setupAudioUnlock();
            this.initialized = true;
        } else {
            this.syncControls();
        }
    },

    preloadAudio() {
        if (Object.keys(this.audioCache).length === 0) {
            for (const [name, url] of Object.entries(this.sounds)) {
                const audio = new Audio(url);
                audio.volume = this.volume;
                audio.load();
                this.audioCache[name] = audio;
            }
        }

        if (!this.musicElement) {
            this.musicElement = new Audio(this.musicUrl);
            this.musicElement.loop = true;
            this.musicElement.volume = this.volume * MUSIC_VOLUME_FACTOR;
            this.musicElement.load();
        }
    },

    syncControls() {
        syncMusicButton(this.musicEnabled);
        syncSfxButton(this.sfxEnabled);
        syncVolumeSlider(this.volume);
    },

    setupAudioUnlock() {
        if (this.unlockBound) return;

        const unlockAudio = () => {
            if (this.audioUnlocked) return;

            const unlockPromises = [];

            for (const audio of Object.values(this.audioCache)) {
                audio.muted = true;
                const promise = audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.muted = false;
                }).catch(() => { });
                unlockPromises.push(promise);
            }

            if (this.musicElement) {
                this.musicElement.muted = true;
                const promise = this.musicElement.play().then(() => {
                    this.musicElement.pause();
                    this.musicElement.currentTime = 0;
                    this.musicElement.muted = false;
                }).catch(() => { });
                unlockPromises.push(promise);
            }

            Promise.all(unlockPromises).then(() => {
                this.audioUnlocked = true;
            });
        };

        const events = ['click', 'touchstart', 'keydown'];
        const unlockHandler = () => {
            unlockAudio();
            events.forEach(eventName => {
                document.removeEventListener(eventName, unlockHandler);
            });
        };

        events.forEach(eventName => {
            document.addEventListener(eventName, unlockHandler, { once: true });
        });

        this.unlockBound = true;
    },

    setupControls() {
        if (this.controlsBound) {
            this.syncControls();
            return;
        }

        const musicBtn = getMusicButton();
        const sfxBtn = getSfxButton();
        const volumeSlider = getVolumeSlider();

        if (musicBtn) {
            musicBtn.addEventListener('click', () => this.toggleMusic());
        }

        if (sfxBtn) {
            sfxBtn.addEventListener('click', () => this.toggleSfx());
        }

        if (volumeSlider) {
            volumeSlider.addEventListener('input', event => {
                this.setVolume(event.target.value / 100);
            });
        }

        this.controlsBound = true;
        this.syncControls();
    },

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        syncMusicButton(this.musicEnabled);

        if (this.musicElement) {
            this.musicElement.volume = this.musicEnabled
                ? this.volume * MUSIC_VOLUME_FACTOR
                : 0;
        }
    },

    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        syncSfxButton(this.sfxEnabled);
    },

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));

        for (const audio of Object.values(this.audioCache)) {
            audio.volume = this.volume;
        }

        if (this.musicElement) {
            this.musicElement.volume = this.musicEnabled
                ? this.volume * MUSIC_VOLUME_FACTOR
                : 0;
        }

        syncVolumeSlider(this.volume);
    },

    play(soundName) {
        if (!this.sfxEnabled) return;

        const audio = this.audioCache[soundName];
        if (!audio) return;

        const clone = audio.cloneNode();
        clone.volume = this.volume;
        clone.play().catch(() => { });
        clone.addEventListener('ended', () => clone.remove());
    },

    playMusic() {
        if (!this.musicEnabled || !this.musicElement) return;

        if (this.musicElement.readyState < 2) {
            this.musicElement.addEventListener('canplaythrough', () => {
                this.musicElement.play().catch(() => { });
            }, { once: true });
            this.musicElement.load();
            return;
        }

        this.musicElement.play().catch(() => { });
    },

    stopMusic() {
        if (!this.musicElement) return;

        this.musicElement.pause();
        this.musicElement.currentTime = 0;
    },

    playCardDeal() { this.play('cardDeal'); },
    playCardFlip() { this.play('cardFlip'); },
    playChips() { this.play('chips'); },
    playCheck() { this.play('check'); },
    playFold() { this.play('fold'); },
    playWin() { this.play('win'); },
    playYourTurn() { this.play('yourTurn'); },
    playAllIn() { this.play('allIn'); }
};
```

- [ ] **Step 3: Run a syntax check on the new audio module**

Run: `node --check src/ui/game-audio.js`
Expected: PASS with no output

- [ ] **Step 4: Commit the extracted audio module**

```bash
git add src/ui/game-audio.js
git commit -m "refactor: extract game audio module"
```

### Task 2: Wire the Audio Module Back Into `game.js`

**Files:**
- Modify: `game.js`
- Test: `game.js`
- Test: `src/ui/game-audio.js`
- Test: `src/main.js`
- Test: `tests/core/cards.test.js`
- Test: `tests/core/hand-evaluator.test.js`
- Test: `tests/core/pot-settlement.test.js`
- Test: `tests/state/game-state.test.js`

- [ ] **Step 1: Import the audio module and remove the embedded `SoundManager` block**

Add this import near the existing `src/ui/` imports:

```js
import { gameAudio } from './src/ui/game-audio.js';
```

Then delete the entire inline audio block from:

```js
// ===== Sound Manager =====
const SoundManager = {
```

through the closing:

```js
    playAllIn() { this.play('allIn'); }
};
```

Leave the closing online-count refresh block in `updateLanguageUI()` and the
following `// Game State` section untouched.

- [ ] **Step 2: Replace every `SoundManager.` call site with `gameAudio.` while keeping timing unchanged**

Make these exact call-site replacements in `game.js`:

```js
// dealHoleCards()
gameAudio.playCardDeal();
gameAudio.playCardDeal();

// playerFold()
gameAudio.playFold();

// playerCheck()
gameAudio.playCheck();

// playerCall()
gameAudio.playAllIn();
gameAudio.playChips();

// playerRaise()
gameAudio.playAllIn();
gameAudio.playChips();

// playerAllIn()
gameAudio.playAllIn();

// runBettingRound() human-turn branch
gameAudio.playYourTurn();

// startNewGame()
gameAudio.playMusic();

// dealFlop(), dealTurn(), dealRiver()
gameAudio.playCardFlip();
gameAudio.playCardFlip();
gameAudio.playCardFlip();

// showdown() folded-win branch
gameAudio.playWin();

// highlightWinners()
gameAudio.playWin();

// bootGame()
gameAudio.init();
```

The two function bodies that must read exactly as follows after the replacement are:

```js
async function startNewGame(randomizeDealer = false) {
    currentGameId++;

    gameAudio.playMusic();

    if (winAnimationTimeoutId) {
        clearTimeout(winAnimationTimeoutId);
        winAnimationTimeoutId = null;
    }

    if (playerActionResolver) {
        playerActionResolver();
        playerActionResolver = null;
    }
```

```js
export function bootGame() {
    if (hasGameBooted) {
        return;
    }

    initPlayers();
    gameAudio.init();
    initOnlineCount();
    hideGameElements();
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    updateLanguageUI();
    showMessage(t('startMessage'));
    updateStatsToggleButton({ showAllStats });

    hasGameBooted = true;
}
```

- [ ] **Step 3: Run automated verification after wiring the audio module**

Run: `node --check game.js`
Expected: PASS with no output

Run: `node --check src/ui/game-audio.js`
Expected: PASS with no output

Run: `node --check src/main.js`
Expected: PASS with no output

Run: `npm test`
Expected: PASS with the current 16 passing tests

- [ ] **Step 4: Perform manual browser verification over HTTP**

Run: `python -m http.server 8000`
Expected: a local static server starts at `http://localhost:8000`

Manual checklist:

1. Load `http://localhost:8000` and confirm the page initializes without module import errors.
2. Confirm the initial music button still shows the music icon and the initial SFX button still shows the enabled-speaker icon.
3. Click the music button twice and confirm the `muted` class toggles correctly while the icon stays the same.
4. Click the SFX button twice and confirm the `muted` class toggles correctly while the icon switches between enabled and muted speaker states.
5. Move the volume slider and confirm the next deal, check, fold, or win sound
   reflects the changed volume.
6. Click `NEW GAME` and confirm background music still attempts to start at game start.
7. Confirm hole-card dealing still plays deal sounds.
8. Confirm flop, turn, and river reveals still play the card-flip sound.
9. Confirm check, fold, chip, all-in, win, and human-turn notification sounds still trigger at the same gameplay points as before.
10. Exercise music/SFX buttons multiple times during a session and confirm there are no obvious duplicate listeners or repeated-control side effects.

- [ ] **Step 5: Commit the audio wiring**

```bash
git add game.js src/ui/game-audio.js
git commit -m "refactor: wire game audio module"
```
