function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function calculateCountdownProgress({
    startedAtMs,
    durationMs,
    currentTimeMs
}) {
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(durationMs) || durationMs <= 0) {
        return 0;
    }

    return clamp((currentTimeMs - startedAtMs) / durationMs, 0, 1);
}

export function calculateCountdownAngle(progress) {
    return `${Math.round(clamp(progress, 0, 1) * 360)}deg`;
}

export function createCountdownController({
    documentRef = globalThis.document,
    setTimeoutFn = globalThis.setTimeout,
    clearTimeoutFn = globalThis.clearTimeout,
    requestAnimationFrameFn = globalThis.requestAnimationFrame?.bind(globalThis),
    cancelAnimationFrameFn = globalThis.cancelAnimationFrame?.bind(globalThis),
    now = () => Date.now(),
    onExpire = () => {}
} = {}) {
    let startedAtMs = null;
    let durationMs = 0;
    let deadlineAtMs = null;
    let timeoutId = null;
    let animationFrameId = null;
    let expired = false;

    function setStyleProperty(name, value) {
        documentRef?.documentElement?.style?.setProperty?.(name, value);
    }

    function cancelScheduledFrame() {
        if (animationFrameId === null) {
            return;
        }

        cancelAnimationFrameFn?.(animationFrameId);
        animationFrameId = null;
    }

    function cancelTimeout() {
        if (timeoutId === null) {
            return;
        }

        clearTimeoutFn?.(timeoutId);
        timeoutId = null;
    }

    function renderProgress(currentTimeMs = now()) {
        const progress = calculateCountdownProgress({
            startedAtMs,
            durationMs,
            currentTimeMs
        });

        setStyleProperty('--countdown-angle', calculateCountdownAngle(progress));
        return progress;
    }

    function stopWithoutReset() {
        cancelTimeout();
        cancelScheduledFrame();
    }

    function expire(currentTimeMs = now()) {
        if (startedAtMs === null || expired || currentTimeMs < deadlineAtMs) {
            return false;
        }

        expired = true;
        renderProgress(deadlineAtMs);
        stopWithoutReset();
        onExpire();
        return true;
    }

    function scheduleFrame() {
        if (!requestAnimationFrameFn || startedAtMs === null || expired || documentRef?.hidden) {
            return;
        }

        animationFrameId = requestAnimationFrameFn(() => {
            animationFrameId = null;
            if (expire()) {
                return;
            }

            renderProgress();
            scheduleFrame();
        });
    }

    function handleVisibilityChange() {
        if (startedAtMs === null) {
            return;
        }

        if (expire()) {
            return;
        }

        renderProgress();

        if (documentRef?.hidden) {
            cancelScheduledFrame();
            return;
        }

        scheduleFrame();
    }

    documentRef?.addEventListener?.('visibilitychange', handleVisibilityChange);

    return {
        start(nextDurationMs) {
            this.clear();

            durationMs = Number(nextDurationMs);
            startedAtMs = now();
            deadlineAtMs = startedAtMs + durationMs;
            expired = false;

            setStyleProperty('--countdown-duration', `${durationMs / 1000}s`);
            renderProgress(startedAtMs);

            timeoutId = setTimeoutFn(() => {
                expire();
            }, durationMs);

            scheduleFrame();
        },

        clear() {
            stopWithoutReset();
            startedAtMs = null;
            durationMs = 0;
            deadlineAtMs = null;
            expired = false;
            setStyleProperty('--countdown-angle', '0deg');
        },

        sync(currentTimeMs = now()) {
            if (startedAtMs === null) {
                setStyleProperty('--countdown-angle', '0deg');
                return 0;
            }

            if (expire(currentTimeMs)) {
                return 1;
            }

            return renderProgress(currentTimeMs);
        },

        destroy() {
            this.clear();
            documentRef?.removeEventListener?.('visibilitychange', handleVisibilityChange);
        }
    };
}
