const MUSIC_BUTTON_ICON = '\uD83C\uDFB5';
const SFX_BUTTON_ICON = '\uD83D\uDD0A';
const SFX_MUTED_ICON = '\uD83D\uDD07';
const DEFAULT_VOLUME = 0.5;
const MUSIC_VOLUME_FACTOR = 0.5;
let musicStartPending = false;
let musicStartDeferred = false;

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

        let unlockInProgress = false;
        const events = ['click', 'touchstart', 'keydown'];

        const removeUnlockListeners = () => {
            events.forEach(eventName => {
                document.removeEventListener(eventName, unlockHandler);
            });
        };

        const tryUnlockAudio = async audio => {
            audio.muted = true;
            try {
                await audio.play();
                audio.pause();
                audio.currentTime = 0;
                return true;
            } catch {
                return false;
            } finally {
                audio.muted = false;
            }
        };

        const unlockAudio = async () => {
            if (this.audioUnlocked || unlockInProgress) return;
            unlockInProgress = true;

            const targets = [...Object.values(this.audioCache)];
            if (this.musicElement) targets.push(this.musicElement);

            const results = await Promise.all(targets.map(audio => tryUnlockAudio(audio)));
            const unlocked = targets.length > 0 && results.some(Boolean);
            this.audioUnlocked = unlocked;
            unlockInProgress = false;

            if (unlocked) {
                removeUnlockListeners();
            }
        };

        const unlockHandler = () => {
            unlockAudio().catch(() => { });
        };

        events.forEach(eventName => {
            document.addEventListener(eventName, unlockHandler);
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

        if (this.musicEnabled && musicStartDeferred) {
            musicStartDeferred = false;
            this.playMusic();
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
            if (!musicStartPending) {
                musicStartPending = true;
                this.musicElement.addEventListener('canplaythrough', () => {
                    musicStartPending = false;
                    if (!this.musicEnabled || !this.musicElement) {
                        if (!this.musicEnabled) {
                            musicStartDeferred = true;
                        }
                        return;
                    }
                    musicStartDeferred = false;
                    this.musicElement.play().catch(() => { });
                }, { once: true });
            }
            this.musicElement.load();
            return;
        }

        musicStartPending = false;
        musicStartDeferred = false;
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
