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
    assert.match(source, /function getGuestPlaceholderToken\(\)\s*\{/);
    assert.match(source, /function initOnlineMode\(\{\s*wsUrl\s*\}\)\s*\{/);
    assert.match(source, /engine = onlineClient;/);
    assert.match(source, /const guestToken = getGuestPlaceholderToken\(\);/);
    assert.match(source, /onlineClient\.connect\(\{\s*token:\s*guestToken\s*\}\)/s);
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
    assert.match(source, /if \(!isOnlineMode\(\) \|\| playerId === 0\) \{\s*gameAudio\.playYourTurn\(\);/s);
    assert.match(source, /startCountdown\(getActionCountdownDurationMs\(timeLimit\)\);/);
});

test('game.js limits the center win GIF to the winning local seat while keeping pot flight shared', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(source, /function shouldShowWinAnimationForWinners\(winners\)\s*\{/);
    assert.doesNotMatch(
        source,
        /if \(isOnlineMode\(\)\) \{\s*return winners\.length > 0;\s*\}/s
    );
    assert.match(source, /return winners\.some\(winner => winner\.id === 0\);/);
    assert.match(source, /if \(shouldShowWinAnimationForWinners\(\[winner\]\)\) \{\s*showWinAnimation\(\);/s);
    assert.match(source, /if \(shouldShowWinAnimationForWinners\(winners\)\) \{\s*showWinAnimation\(\);/s);
    assert.match(source, /await animatePotToWinners\(\s*\[winner\],\s*\[winAmount\]\s*\);/s);
    assert.match(source, /await animatePotToWinners\(\s*allWinners,\s*allWinners\.map\(winner => totalWinAmounts\[winner\.id\] \|\| 0\)\s*\);/s);
});

test('online mode styles active remote seats with the shared countdown ring', async () => {
    const source = await readFile(new URL('../../styles.css', import.meta.url), 'utf8');

    assert.match(source, /\.online-mode \.player\.active \.player-info\s*\{/);
    assert.match(source, /\.online-mode \.player\.active \.player-info::before\s*\{/);
    assert.match(
        source,
        /\.online-mode \.player\.active \.player-info::before\s*\{[\s\S]*?var\(--countdown-angle,\s*0deg\)/s
    );
});

test('online mode styles retained disconnected seats with a muted pulse', async () => {
    const rendererSource = await readFile(new URL('../../src/ui/game-table-renderer.js', import.meta.url), 'utf8');
    const stylesSource = await readFile(new URL('../../styles.css', import.meta.url), 'utf8');

    assert.match(rendererSource, /playerEl\.classList\.toggle\('disconnected',\s*!!player\.disconnected\);/);
    assert.match(stylesSource, /\.online-mode \.player\.disconnected \.player-info\s*\{/);
    assert.match(stylesSource, /@keyframes onlineDisconnectedPulse\s*\{/);
    assert.match(
        stylesSource,
        /\.online-mode \.player\.disconnected \.player-info::after\s*\{[\s\S]*?animation:\s*onlineDisconnectedPulse/s
    );
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
    assert.match(source, /t\('playerJoinedRoom',\s*\{/);
    assert.match(source, /t\('playerLeftRoom',\s*\{/);
    assert.match(source, /phaseKey:\s*getCurrentLogPhaseKey\(\)/);
});

test('game.js logs online disconnect and reconnect events into the shared action history', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(
        source,
        /onlineClient\.on\('player_disconnected',\s*\(\{\s*player\s*\}\)\s*=>\s*\{[\s\S]*?gameHistory\.showMessage\(/s
    );
    assert.match(
        source,
        /onlineClient\.on\('player_reconnected',\s*\(\{\s*player\s*\}\)\s*=>\s*\{[\s\S]*?gameHistory\.showMessage\(/s
    );
    assert.match(source, /t\('playerDisconnectedRoom',\s*\{/);
    assert.match(source, /t\('playerReconnectedRoom',\s*\{/);
});

test('game.js routes the online side panel through Room and Log tabs without changing the room protocol flow', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(source, /function ensureOnlineSidebarTabs\(\)\s*\{/);
    assert.match(source, /function switchOnlineSidebarTab\(tabName\)\s*\{/);
    assert.match(source, /ensureOnlineSidebarTabs\(\);/);
    assert.match(source, /switchOnlineSidebarTab\('room'\);/);
    assert.match(
        source,
        /engine\.on\('hand_start',\s*\(\{\s*players\s*\}\)\s*=>\s*\{[\s\S]*?if \(isOnlineMode\(\)\) \{[\s\S]*?switchOnlineSidebarTab\('log'\);/s
    );
    assert.match(
        source,
        /onlineClient\.on\('room_left',\s*\(\)\s*=>\s*\{[\s\S]*?switchOnlineSidebarTab\('room'\);/s
    );
    assert.match(
        source,
        /const roomPanelHost = getOnlineSidebarTabPanel\('room'\);/
    );
});

test('game.js gives the room tab its own Room Info header and compact create controls', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(
        source,
        /<div class="panel-header online-room-title">Room Info<\/div>/
    );
    assert.match(
        source,
        /<div class="online-room-create">[\s\S]*?<input id="online-room-name" class="online-room-input"[\s\S]*?<div class="online-room-create-controls">[\s\S]*?<select id="online-room-max" class="online-room-select">[\s\S]*?<button type="button" class="btn online-room-create-button" id="btn-create-room">Create<\/button>/s
    );
});

test('index.html defines a dedicated log panel mount instead of exposing the history nodes directly at the side-panel root', async () => {
    const source = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

    assert.match(source, /<div class="side-panel-body" id="side-panel-body">/);
    assert.match(
        source,
        /<section class="side-panel-view action-history-panel" id="action-history-panel">[\s\S]*?<div class="panel-header">Action History<\/div>/s
    );
    assert.doesNotMatch(
        source,
        /<div class="side-panel">\s*<div class="panel-header">Action History<\/div>\s*<div class="panel-hand-number"/s
    );
});

test('styles.css includes online tab shell styling for the side panel while preserving the history panel layout', async () => {
    const source = await readFile(new URL('../../styles.css', import.meta.url), 'utf8');

    assert.match(source, /\.side-panel-body\s*\{/);
    assert.match(source, /\.side-panel-view\s*\{/);
    assert.match(source, /\.online-sidebar-tabs\s*\{/);
    assert.match(source, /\.online-sidebar-tab\[data-active="true"\]\s*\{/);
    assert.match(source, /\.online-sidebar-panel\s*\{/);
    assert.match(source, /\.online-sidebar-panel\[data-active="true"\]\s*\{/);
    assert.match(source, /\.online-room-create-controls\s*\{/);
    assert.match(source, /\.online-room-create-button\s*\{[\s\S]*?width:\s*100%;/s);
});

test('online room status renders as a connection badge with state-specific indicator colors', async () => {
    const gameSource = await readFile(new URL('../../game.js', import.meta.url), 'utf8');
    const stylesSource = await readFile(new URL('../../styles.css', import.meta.url), 'utf8');

    assert.match(gameSource, /function getOnlineConnectionBadgeState\(\)\s*\{/);
    assert.match(gameSource, /statusElement\.dataset\.connectionBadge\s*=\s*getOnlineConnectionBadgeState\(\);/);
    assert.match(stylesSource, /\.online-room-status::before\s*\{/);
    assert.match(stylesSource, /\.online-room-status\[data-connection-badge="connected"\]::before\s*\{[\s\S]*?background:\s*var\(--accent-green\);/s);
    assert.match(stylesSource, /\.online-room-status\[data-connection-badge="busy"\]::before\s*\{[\s\S]*?background:\s*var\(--accent-gold\);/s);
    assert.match(stylesSource, /\.online-room-status\[data-connection-badge="error"\]::before\s*\{[\s\S]*?background:\s*var\(--accent\);/s);
    assert.match(stylesSource, /\.online-room-status\[data-connection-badge="offline"\]::before\s*\{[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.35\);/s);
});

test('online room status badge treats reconnecting as busy even after auth succeeds', async () => {
    const gameSource = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(gameSource, /onlineStatusReconnecting/);
    assert.match(
        gameSource,
        /BUSY_ONLINE_STATUS_KEYS\.has\(onlineStatusMessage\.key\)[\s\S]*?return 'busy';/
    );
});
