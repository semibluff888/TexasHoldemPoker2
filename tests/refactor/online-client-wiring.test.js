import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('game.js wires the optional online mode through the new websocket client and adapter', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(
        source,
        /import\s*\{\s*createWebSocketClient\s*\}\s*from '\.\/src\/net\/ws-client\.js';/
    );
    assert.match(
        source,
        /import\s*\{\s*createOnlineGameClient\s*\}\s*from '\.\/src\/net\/online-game-client\.js';/
    );
    assert.match(source, /function getOnlineModeSettings\(\)\s*\{/);
    assert.match(source, /function initOnlineMode\(\{\s*wsUrl\s*\}\)\s*\{/);
    assert.match(source, /engine = onlineClient;/);
    assert.match(source, /onlineClient\.connect\(\{\s*token:\s*'guest-placeholder'\s*\}\)/s);
    assert.match(source, /ensureOnlineRoomPanel\(\);/);
    assert.match(source, /engine\.submitAction\(0,\s*\{\s*type:\s*'fold'\s*\}\);/);
});

test('game.js keeps the online countdown display-only and derives its duration from the server turn payload', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(
        source,
        /import\s*\{\s*createCountdownController\s*\}\s*from '\.\/src\/ui\/countdown-controller\.js';/
    );
    assert.match(source, /function getActionCountdownDurationMs\(timeLimit\)\s*\{/);
    assert.match(
        source,
        /const countdownController = createCountdownController\(\{\s*onExpire:\s*handleCountdownExpired\s*\}\);/
    );
    assert.match(source, /function startCountdown\(durationMs = COUNTDOWN_DURATION\)\s*\{/);
    assert.match(source, /countdownController\.start\(durationMs\);/);
    assert.match(source, /function clearCountdown\(\)\s*\{\s*countdownController\.clear\(\);/s);
    assert.match(
        source,
        /function handleCountdownExpired\(\)\s*\{\s*if \(isOnlineMode\(\)\) \{\s*return;\s*\}/s
    );
    assert.match(
        source,
        /engine\.on\('action_required',\s*async\s*\(\{\s*playerId,\s*timeLimit\s*\}\)\s*=>\s*\{/s
    );
    assert.match(source, /startCountdown\(getActionCountdownDurationMs\(timeLimit\)\);/);
});

test('game.js logs online room join and leave events into the shared action history', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(
        source,
        /onlineClient\.on\('player_joined',\s*\(\{\s*player\s*\}\)\s*=>\s*\{[\s\S]*?gameHistory\.showMessage\(/s
    );
    assert.match(
        source,
        /onlineClient\.on\('player_left',\s*\(\{\s*player\s*\}\)\s*=>\s*\{[\s\S]*?gameHistory\.showMessage\(/s
    );
    assert.match(source, /t\('playerJoinedRoom'\)/);
    assert.match(source, /t\('playerLeftRoom'\)/);
    assert.match(source, /phaseKey:\s*getCurrentLogPhaseKey\(\)/);
});
