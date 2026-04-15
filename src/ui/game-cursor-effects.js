const DEFAULT_CURSOR_EFFECT = 'sparkle';
const MAX_PARTICLES = 50;
const CURSOR_EFFECT_DURATIONS = {
    sparkle: 800,
    comet: 600,
    bubble: 1200
};

function getCursorTrailContainer() {
    return document.getElementById('cursor-trail');
}

function getCursorSelect() {
    return document.getElementById('cursor-select');
}

function getCursorEffectLabelKey(value) {
    return 'cursor' + value.charAt(0).toUpperCase() + value.slice(1);
}

export const gameCursorEffects = {
    initialized: false,
    controlsBound: false,
    mouseMoveBound: false,
    trailContainer: null,
    particleCount: 0,
    currentEffect: DEFAULT_CURSOR_EFFECT,
    lastMouseX: 0,
    lastMouseY: 0,

    init() {
        if (!this.initialized) {
            this.loadStoredEffect();
            this.trailContainer = getCursorTrailContainer();
            this.setupControls();
            this.setupMouseTracking();
            this.initialized = true;
        } else {
            this.trailContainer = getCursorTrailContainer();
            this.syncControls();
        }
    },

    loadStoredEffect() {
        this.currentEffect = localStorage.getItem('cursorEffect') || DEFAULT_CURSOR_EFFECT;
    },

    syncControls() {
        const cursorSelect = getCursorSelect();
        if (cursorSelect) {
            cursorSelect.value = this.currentEffect;
        }
    },

    setupControls() {
        if (this.controlsBound) {
            this.syncControls();
            return;
        }

        const cursorSelect = getCursorSelect();
        if (cursorSelect) {
            cursorSelect.value = this.currentEffect;
            cursorSelect.addEventListener('change', event => {
                this.currentEffect = event.target.value;
                localStorage.setItem('cursorEffect', this.currentEffect);
                this.clearParticles();
            });
        }

        this.controlsBound = true;
    },

    setupMouseTracking() {
        if (this.mouseMoveBound) return;

        document.addEventListener('mousemove', event => {
            this.handleMouseMove(event);
        });
        this.mouseMoveBound = true;
    },

    clearParticles() {
        if (this.trailContainer) {
            this.trailContainer.innerHTML = '';
        }
        this.particleCount = 0;
    },

    handleMouseMove(event) {
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;

        if (!this.trailContainer) {
            this.trailContainer = getCursorTrailContainer();
        }

        if (!this.trailContainer || this.currentEffect === 'none' || this.particleCount >= MAX_PARTICLES) return;

        this.createParticle(event.clientX, event.clientY, event.movementX, event.movementY);
    },

    createParticle(x, y, moveX = 0, moveY = 0) {
        if (!this.trailContainer) return;

        const particle = document.createElement('div');

        switch (this.currentEffect) {
            case 'sparkle':
                this.createSparkleParticle(particle, x, y);
                break;
            case 'comet':
                this.createCometParticle(particle, x, y, moveX, moveY);
                break;
            case 'bubble':
                this.createBubbleParticle(particle, x, y);
                break;
            default:
                return;
        }

        this.trailContainer.appendChild(particle);
        this.particleCount += 1;

        const duration = CURSOR_EFFECT_DURATIONS[this.currentEffect];
        setTimeout(() => {
            if (particle.parentNode) {
                particle.remove();
            }
            this.particleCount = Math.max(0, this.particleCount - 1);
        }, duration);
    },

    createSparkleParticle(particle, x, y) {
        particle.className = 'cursor-particle';

        const offsetX = (Math.random() - 0.5) * 10;
        const offsetY = (Math.random() - 0.5) * 10;

        particle.style.left = `${x + offsetX}px`;
        particle.style.top = `${y + offsetY}px`;

        const size = 6 + Math.random() * 10;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
    },

    createCometParticle(particle, x, y, moveX, moveY) {
        particle.className = 'cursor-comet';

        const angle = Math.atan2(moveY, moveX) * (180 / Math.PI);

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.transform = `rotate(${angle}deg)`;

        const speed = Math.sqrt(moveX * moveX + moveY * moveY);
        const length = 10 + Math.min(speed * 2, 30);
        particle.style.width = `${length}px`;
    },

    createBubbleParticle(particle, x, y) {
        particle.className = 'cursor-bubble';

        const offsetX = (Math.random() - 0.5) * 20;

        particle.style.left = `${x + offsetX}px`;
        particle.style.top = `${y}px`;

        const size = 8 + Math.random() * 16;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
    },

    syncLabels({ t }) {
        const cursorSelect = getCursorSelect();
        if (!cursorSelect) return;

        const options = cursorSelect.querySelectorAll('option');
        options.forEach(option => {
            option.textContent = t(getCursorEffectLabelKey(option.value));
        });
    }
};
