import { calculatePots, splitPot } from './src/core/pot-settlement.js';
import {
    BIG_BLIND,
    STARTING_CHIPS,
    createDefaultStats,
    createInitialGameState
} from './src/state/game-state.js';
import {
    updatePlayerCards,
    updatePlayerCardsAnimated,
    updateCommunityCards,
    clearHighlightHumanBestHand,
    updateUI,
    clearWinnerHighlights,
    hideGameElements,
    showGameElements
} from './src/ui/game-table-renderer.js';
import { bindGameTableEvents } from './src/ui/game-table-events.js';
import {
    setHelpPopupVisible,
    updateGameModeButton,
    updateStatsToggleButton,
    updateAllPlayerStatsDisplays
} from './src/ui/game-shell-renderer.js';
import { bindGameShellEvents } from './src/ui/game-shell-events.js';
import { gameAudio } from './src/ui/game-audio.js';
import { createCountdownController } from './src/ui/countdown-controller.js';
import { gameCursorEffects } from './src/ui/game-cursor-effects.js';
import { gameHistory } from './src/ui/game-history.js';
import { createGameLanguageUI } from './src/ui/game-language-ui.js';
import {
    decideAIAction,
    getOpponentProfile
} from './src/ai/game-ai.js';
import { GameEngine } from './src/engine/game-engine.js';
import { createWebSocketClient } from './src/net/ws-client.js';
import { createOnlineGameClient } from './src/net/online-game-client.js';

// ===== Texas Hold'em Poker Game =====

// Game Constants
// Hand ranks are evaluated using numeric scores from core hand evaluator.

// ===== Game Mode Settings =====
const COUNTDOWN_DURATION = 15000; // 15 seconds for fast mode
document.documentElement.style.setProperty('--countdown-duration', (COUNTDOWN_DURATION / 1000) + 's');
document.documentElement.style.setProperty('--countdown-angle', '0deg');
let gameMode = localStorage.getItem('pokerGameMode') || 'fast'; // 'fast' or 'slow'

// Stats display toggle
let showAllStats = localStorage.getItem('showAllStats') === 'true';
// Game State
let gameState = createInitialGameState();

const gameLanguageUI = createGameLanguageUI({
    getGameState: () => gameState,
    getGameMode: () => gameMode,
    getOpponentProfile
});

const {
    t,
    translateHandName,
    getTranslatedPlayerName,
    getCurrentLanguage
} = gameLanguageUI;

let currentGameId = 0; // Game ID to track and cancel previous games
let engine = null;
let onlineClient = null;
let onlineRoomPanel = null;
let onlineSidebarTabs = null;
let onlineStatusMessage = {
    key: 'onlineStatusOffline',
    values: {},
    kind: 'info'
};
let areEngineEventListenersBound = false;
let visualTaskQueue = Promise.resolve();
let expectedHoleCardDeals = 0;
let completedHoleCardDeals = 0;
let holeCardAnimationStartTime = 0;
let latestHandSettlementId = 0;

const MAX_ONLINE_SEATS = 5;
const DEFAULT_ONLINE_WS_URL = 'ws://127.0.0.1:3000';
const countdownController = createCountdownController({
    onExpire: handleCountdownExpired
});

function getCurrentLogPhaseKey() {
    return gameState.phase === 'idle' ? 'start' : gameState.phase;
}

function queueVisualTask(task) {
    visualTaskQueue = visualTaskQueue
        .then(() => task())
        .catch(error => {
            console.error('Visual task failed', error);
        });

    return visualTaskQueue;
}

function waitForVisualTasks() {
    return visualTaskQueue;
}

function getOnlineModeSettings() {
    const query = new URLSearchParams(globalThis.location?.search ?? '');
    const requestedMode = String(
        globalThis.__POKER_ONLINE__ ?? query.get('online') ?? query.get('mode') ?? ''
    ).toLowerCase();
    const isOnline = requestedMode === '1' || requestedMode === 'true' || requestedMode === 'online';
    const requestedWsUrl = globalThis.__POKER_WS_URL__ ?? query.get('ws');

    if (!isOnline) {
        return {
            isOnline: false,
            wsUrl: requestedWsUrl ?? DEFAULT_ONLINE_WS_URL
        };
    }

    const location = globalThis.location;
    const defaultWsUrl = location?.host
        ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
        : DEFAULT_ONLINE_WS_URL;

    return {
        isOnline: true,
        wsUrl: requestedWsUrl ?? defaultWsUrl
    };
}

function isOnlineMode() {
    return Boolean(onlineClient);
}

function syncSeatVisibility() {
    const visibleSeatIds = new Set(
        (gameState.players ?? [])
            .filter(Boolean)
            .map(player => player.id)
    );

    for (let seatId = 0; seatId < MAX_ONLINE_SEATS; seatId += 1) {
        const playerElement = document.getElementById(`player-${seatId}`);
        if (!playerElement) {
            continue;
        }

        const shouldHide = isOnlineMode() && !visibleSeatIds.has(seatId);
        playerElement.classList.toggle('online-seat-hidden', shouldHide);
    }
}

function updateModeChrome() {
    document.body.classList.toggle('online-mode', isOnlineMode());

    const newGameButton = document.getElementById('btn-new-game');
    if (newGameButton) {
        newGameButton.style.display = isOnlineMode() ? 'none' : '';
    }
}

function ensureOnlineSidebarTabs() {
    if (onlineSidebarTabs) {
        return onlineSidebarTabs;
    }

    const sidePanelBody = document.getElementById('side-panel-body');
    const actionHistoryPanel = document.getElementById('action-history-panel');
    if (!sidePanelBody || !actionHistoryPanel) {
        return null;
    }

    const tabsRoot = document.createElement('section');
    tabsRoot.id = 'online-sidebar-tabs';
    tabsRoot.className = 'online-sidebar-tabs';
    tabsRoot.innerHTML = `
        <div class="online-sidebar-tab-list" role="tablist" aria-label="Online side panel views">
            <button type="button" class="online-sidebar-tab" data-tab="room" id="online-sidebar-tab-room" role="tab" aria-controls="online-sidebar-panel-room" aria-selected="false">
                Room
            </button>
            <button type="button" class="online-sidebar-tab" data-tab="log" id="online-sidebar-tab-log" role="tab" aria-controls="online-sidebar-panel-log" aria-selected="false">
                Log
            </button>
        </div>
        <div class="online-sidebar-panels">
            <section class="online-sidebar-panel" data-tab="room" data-active="false" id="online-sidebar-panel-room" role="tabpanel" aria-labelledby="online-sidebar-tab-room"></section>
            <section class="online-sidebar-panel" data-tab="log" data-active="false" id="online-sidebar-panel-log" role="tabpanel" aria-labelledby="online-sidebar-tab-log"></section>
        </div>
    `;
    sidePanelBody.appendChild(tabsRoot);

    const tabs = {
        room: tabsRoot.querySelector('[data-tab="room"]'),
        log: tabsRoot.querySelector('[data-tab="log"]')
    };
    const panels = {
        room: tabsRoot.querySelector('#online-sidebar-panel-room'),
        log: tabsRoot.querySelector('#online-sidebar-panel-log')
    };

    for (const [tabName, button] of Object.entries(tabs)) {
        button.addEventListener('click', () => {
            switchOnlineSidebarTab(tabName);
        });
    }

    panels.log.appendChild(actionHistoryPanel);

    onlineSidebarTabs = {
        root: tabsRoot,
        tabs,
        panels,
        sidePanelBody
    };

    return onlineSidebarTabs;
}

function getOnlineSidebarTabPanel(tabName) {
    return ensureOnlineSidebarTabs()?.panels?.[tabName] ?? null;
}

function switchOnlineSidebarTab(tabName) {
    const sidebarTabs = ensureOnlineSidebarTabs();
    if (!sidebarTabs || !sidebarTabs.tabs[tabName] || !sidebarTabs.panels[tabName]) {
        return;
    }

    for (const [name, button] of Object.entries(sidebarTabs.tabs)) {
        const isActive = name === tabName;
        button.dataset.active = String(isActive);
        button.setAttribute('aria-selected', String(isActive));
    }

    for (const [name, panel] of Object.entries(sidebarTabs.panels)) {
        const isActive = name === tabName;
        panel.dataset.active = String(isActive);
        panel.hidden = !isActive;
    }
}

function disableHumanControls() {
    const controls = document.getElementById('controls');
    if (!controls) {
        return;
    }

    controls.classList.add('disabled');
    controls.classList.remove('active');
}

function prepareHumanActionSubmission() {
    if (!isOnlineMode()) {
        clearCountdown();
    }

    disableHumanControls();
}

function refreshTableUI() {
    syncSeatVisibility();

    if (!Array.isArray(gameState.players) || gameState.players.length === 0) {
        const potAmount = document.getElementById('pot-amount');
        if (potAmount) {
            potAmount.textContent = '$0';
        }

        const potChip = document.querySelector('.pot-chip');
        if (potChip) {
            potChip.style.display = 'none';
        }

        updateCommunityCards({
            ...gameState,
            communityCards: [],
            displayedCommunityCards: 0
        });
        disableHumanControls();
        return;
    }

    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
}

function refreshStatsUI() {
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });
}

function formatTranslation(template, replacements = {}) {
    return String(template).replace(/\{([^}]+)\}/g, (match, key) =>
        replacements[key] ?? match
    );
}

function getOnlineRoomStatusKey(status) {
    if (status === 'waiting') return 'onlineRoomStatusWaiting';
    if (status === 'playing') return 'onlineRoomStatusPlaying';
    return null;
}

function getOnlineRoomDetailText(room) {
    const statusKey = getOnlineRoomStatusKey(room.status);
    const status = statusKey ? t(statusKey) : room.status;

    return `${room.playerCount}/${room.maxPlayers} ${t('onlineRoomPlayers')} | ${room.smallBlind}/${room.bigBlind} | ${status}`;
}

function isDefaultOnlineRoomName(roomName) {
    return !roomName || roomName === 'Practice Table';
}

function getOnlineRoomDisplayName(roomName) {
    return isDefaultOnlineRoomName(roomName) ? t('onlineRoomPracticeTable') : roomName;
}

function getOnlineRoomActionKey(state) {
    return {
        joined: 'onlineRoomJoined',
        unsupported: 'onlineRoomUnsupported',
        full: 'onlineRoomFull',
        join: 'onlineRoomJoin'
    }[state] ?? 'onlineRoomJoin';
}

function setOnlineRoomJoinButtonState(button, state) {
    button.dataset.onlineRoomActionState = state;
    button.textContent = t(getOnlineRoomActionKey(state));
}

function applyOnlineStatus(statusElement) {
    if (!statusElement) {
        return;
    }

    statusElement.dataset.kind = onlineStatusMessage.kind;

    if (onlineStatusMessage.key) {
        statusElement.dataset.i18nKey = onlineStatusMessage.key;
        statusElement.dataset.i18nValues = JSON.stringify(onlineStatusMessage.values ?? {});
        statusElement.textContent = formatTranslation(t(onlineStatusMessage.key), onlineStatusMessage.values);
        return;
    }

    delete statusElement.dataset.i18nKey;
    delete statusElement.dataset.i18nValues;
    statusElement.textContent = onlineStatusMessage.text ?? '';
}

function setOnlineStatus(messageKey, kind = 'info', values = {}) {
    onlineStatusMessage = {
        key: messageKey,
        values,
        kind
    };

    const panel = ensureOnlineRoomPanel();
    if (!panel) {
        return;
    }

    applyOnlineStatus(panel.status);
}

function setOnlineStatusText(message, kind = 'info') {
    onlineStatusMessage = {
        text: message,
        kind
    };

    const panel = ensureOnlineRoomPanel();
    if (!panel) {
        return;
    }

    applyOnlineStatus(panel.status);
}

function renderOnlineRoomList() {
    const panel = ensureOnlineRoomPanel();
    if (!panel) {
        return;
    }

    panel.list.innerHTML = '';

    const rooms = onlineClient?.rooms ?? [];
    if (rooms.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'online-room-empty';
        emptyState.textContent = t('onlineRoomEmpty');
        panel.list.appendChild(emptyState);
        return;
    }

    for (const room of rooms) {
        const row = document.createElement('div');
        row.className = 'online-room-row';

        const meta = document.createElement('div');
        meta.className = 'online-room-meta';

        const name = document.createElement('div');
        name.className = 'online-room-name';
        if (isDefaultOnlineRoomName(room.name)) {
            name.dataset.defaultRoomName = 'true';
            name.textContent = t('onlineRoomPracticeTable');
        } else {
            name.textContent = room.name;
        }

        const detail = document.createElement('div');
        detail.className = 'online-room-detail';
        detail.dataset.playerCount = room.playerCount;
        detail.dataset.maxPlayers = room.maxPlayers;
        detail.dataset.smallBlind = room.smallBlind;
        detail.dataset.bigBlind = room.bigBlind;
        detail.dataset.status = room.status;
        detail.textContent = getOnlineRoomDetailText(room);

        meta.appendChild(name);
        meta.appendChild(detail);

        const joinButton = document.createElement('button');
        joinButton.type = 'button';
        joinButton.className = 'btn online-room-join';

        const isUnsupported = room.maxPlayers > MAX_ONLINE_SEATS;
        const isFull = room.playerCount >= room.maxPlayers;
        const isJoined = room.roomId === onlineClient?.currentRoomId;

        if (isJoined) {
            setOnlineRoomJoinButtonState(joinButton, 'joined');
            joinButton.disabled = true;
        } else if (isUnsupported) {
            setOnlineRoomJoinButtonState(joinButton, 'unsupported');
            joinButton.disabled = true;
        } else if (isFull) {
            setOnlineRoomJoinButtonState(joinButton, 'full');
            joinButton.disabled = true;
        } else {
            setOnlineRoomJoinButtonState(joinButton, 'join');
            joinButton.addEventListener('click', () => {
                setOnlineStatus('onlineStatusJoiningRoom', 'info', {
                    roomName: getOnlineRoomDisplayName(room.name)
                });
                onlineClient?.joinRoom(room.roomId);
            });
        }

        row.appendChild(meta);
        row.appendChild(joinButton);
        panel.list.appendChild(row);
    }
}

function updateOnlineRoomPanel() {
    const panel = ensureOnlineRoomPanel();
    if (!panel) {
        return;
    }

    panel.refreshButton.disabled = !onlineClient;
    panel.createButton.disabled = !onlineClient?.user || Boolean(onlineClient.currentRoomId);
    panel.leaveButton.disabled = !onlineClient?.currentRoomId;

    if (!panel.status.textContent) {
        applyOnlineStatus(panel.status);
    }

    renderOnlineRoomList();
}

function ensureOnlineRoomPanel() {
    if (onlineRoomPanel) {
        return onlineRoomPanel;
    }

    const roomPanelHost = getOnlineSidebarTabPanel('room');
    if (!roomPanelHost) {
        return null;
    }

    const panel = document.createElement('section');
    panel.id = 'online-room-panel';
    panel.className = 'online-room-panel';
    panel.innerHTML = `
        <div class="online-room-panel-header">
            <div class="panel-header online-room-title">Room Info</div>
            <button type="button" class="btn btn-nav online-room-refresh" id="btn-refresh-rooms">Refresh</button>
        </div>
        <div class="online-room-status" id="online-room-status"></div>
        <div class="online-room-create">
            <input id="online-room-name" class="online-room-input" type="text" maxlength="24" placeholder="Room name">
            <div class="online-room-create-controls">
                <select id="online-room-max" class="online-room-select">
                    <option value="2">2 players</option>
                    <option value="3">3 players</option>
                    <option value="4">4 players</option>
                    <option value="5" selected>5 players</option>
                </select>
                <button type="button" class="btn online-room-create-button" id="btn-create-room">Create</button>
            </div>
        </div>
        <div class="online-room-list" id="online-room-list"></div>
        <button type="button" class="btn online-room-leave" id="btn-leave-room">Leave Room</button>
    `;
    roomPanelHost.appendChild(panel);

    onlineRoomPanel = {
        root: panel,
        status: panel.querySelector('#online-room-status'),
        roomName: panel.querySelector('#online-room-name'),
        maxPlayers: panel.querySelector('#online-room-max'),
        list: panel.querySelector('#online-room-list'),
        refreshButton: panel.querySelector('#btn-refresh-rooms'),
        createButton: panel.querySelector('#btn-create-room'),
        leaveButton: panel.querySelector('#btn-leave-room')
    };

    onlineRoomPanel.refreshButton.addEventListener('click', () => {
        setOnlineStatus('onlineStatusRefreshingRooms');
        onlineClient?.listRooms();
    });

    onlineRoomPanel.createButton.addEventListener('click', () => {
        const roomName = onlineRoomPanel.roomName.value.trim();
        const maxPlayers = Number.parseInt(onlineRoomPanel.maxPlayers.value, 10) || MAX_ONLINE_SEATS;

        setOnlineStatus('onlineStatusCreatingRoom', 'info', {
            roomName: getOnlineRoomDisplayName(roomName)
        });

        const roomConfig = {
            maxPlayers,
            smallBlind: 10,
            bigBlind: 20
        };
        if (roomName) {
            roomConfig.name = roomName;
        }

        onlineClient?.createRoom(roomConfig);
    });

    onlineRoomPanel.leaveButton.addEventListener('click', () => {
        setOnlineStatus('onlineStatusLeavingRoom');
        onlineClient?.leaveRoom();
        onlineClient?.listRooms();
    });

    applyOnlineStatus(onlineRoomPanel.status);
    return onlineRoomPanel;
}

// Initialize Players
function initPlayers() {
    engine = new GameEngine();
    areEngineEventListenersBound = false;
    gameState = engine.state;

    engine.addPlayer({ id: 0, name: 'You', isAI: false, aiLevel: null });
    engine.addPlayer({ id: 1, name: 'AI Player 1', isAI: true });
    engine.addPlayer({ id: 2, name: 'AI Player 2', isAI: true });
    engine.addPlayer({ id: 3, name: 'AI Player 3', isAI: true });
    engine.addPlayer({ id: 4, name: 'AI Player 4', isAI: true });

    bindEngineEventListeners();
}

// Reset a player's stats to default values
function resetPlayerStats(player) {
    player.stats = createDefaultStats();
}

function showAction(playerId, action, chipsBeforeAction = null) {
    const actionEl = document.getElementById(`action-${playerId}`);
    actionEl.textContent = action;
    actionEl.classList.add('visible');

    setTimeout(() => {
        actionEl.classList.remove('visible');
    }, 2000);

    // Log the action with player's chip amount before the action
    const player = gameState.players[playerId];
    gameHistory.logAction({
        player,
        action,
        chipsBeforeAction,
        phaseKey: getCurrentLogPhaseKey(),
        t,
        getTranslatedPlayerName
    });
}

// Animate AI fold cards flying to center
function animateFoldCards(playerId) {
    const cardsContainer = document.getElementById(`cards-${playerId}`);
    const cards = cardsContainer.querySelectorAll('.card');
    const communityCards = document.querySelector('.community-cards');

    if (!communityCards || cards.length === 0) return;

    // Get the center of community cards area
    const communityRect = communityCards.getBoundingClientRect();
    const targetCenterX = communityRect.left + communityRect.width / 2;
    const targetCenterY = communityRect.top + communityRect.height / 2;

    cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();

        // Starting position (card's current center)
        const startX = cardRect.left + cardRect.width / 2;
        const startY = cardRect.top + cardRect.height / 2;

        // Create a clone for animation
        const clone = card.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = `${startX - cardRect.width / 2}px`;
        clone.style.top = `${startY - cardRect.height / 2}px`;
        clone.style.width = `${cardRect.width}px`;
        clone.style.height = `${cardRect.height}px`;
        clone.style.zIndex = '2000';
        clone.style.pointerEvents = 'none';
        clone.style.margin = '0';

        document.body.appendChild(clone);

        // Use Web Animations API for reliable animation
        const animation = clone.animate([
            {
                left: `${startX - cardRect.width / 2}px`,
                top: `${startY - cardRect.height / 2}px`,
                opacity: 1,
                transform: 'scale(1) rotate(0deg)'
            },
            {
                left: `${targetCenterX - cardRect.width / 2}px`,
                top: `${targetCenterY - cardRect.height / 2}px`,
                opacity: 0,
                transform: 'scale(0.3) rotate(25deg)'
            }
        ], {
            duration: 500,
            delay: index * 80,
            easing: 'ease-in',
            fill: 'forwards'
        });

        // Remove clone after animation
        animation.onfinish = () => {
            clone.remove();
        };
    });

    // Hide original cards immediately by showing placeholders
    cardsContainer.innerHTML = `
        <div class="card card-placeholder"></div>
        <div class="card card-placeholder"></div>
    `;
}

function toggleAILevel(playerId) {
    if (isOnlineMode()) {
        return;
    }

    const player = gameState.players[playerId];
    if (!player || !player.isAI || player.isRemoved) {
        return;
    }

    engine.cycleAILevel(playerId);
    refreshTableUI();
}

function removeAIPlayer(playerId) {
    if (isOnlineMode()) {
        return;
    }

    const player = gameState.players[playerId];
    if (!player || !player.isAI || player.isRemoved) {
        return;
    }

    // Check minimum AI requirement
    const activeAIs = gameState.players.filter(p => p.isAI && !p.isRemoved);
    if (activeAIs.length <= 1) {
        gameHistory.showMessage({
            message: t('minAiRequired'),
            phaseKey: getCurrentLogPhaseKey(),
            t
        });
        return;
    }

    engine.removePlayer(playerId);

    // Reset player stats
    resetPlayerStats(player);
    refreshStatsUI();

    // Action log
    const name = getTranslatedPlayerName(player);
    gameHistory.showMessage({
            message: t('aiLeft').replace('{name}', name),
            phaseKey: getCurrentLogPhaseKey(),
            t
        });

    refreshTableUI();
}

function addAIPlayer(playerId) {
    if (isOnlineMode()) {
        return;
    }

    const player = gameState.players[playerId];
    if (!player || !player.isAI || !player.isRemoved) {
        return;
    }

    engine.restorePlayer({
        id: playerId,
        name: player.name,
        isAI: true,
        aiLevel: player.aiLevel,
        chips: engine.config.startingChips
    });

    const restoredPlayer = gameState.players[playerId];

    // Random portrait
    const avatarContainer = document.getElementById(`avatar-${playerId}`);
    if (avatarContainer) {
        const img = avatarContainer.querySelector('img');
        if (img) {
            const shuffled = [...AI_PORTRAITS].sort(() => Math.random() - 0.5);
            img.src = shuffled[0];
        }
    }

    // Action log
    const name = getTranslatedPlayerName(restoredPlayer);
    gameHistory.showMessage({
        message: t('aiJoined').replace('{name}', name),
        phaseKey: getCurrentLogPhaseKey(),
        t
    });

    refreshTableUI();
    refreshStatsUI();
}

// Toggle show all stats
function toggleShowAllStats() {
    showAllStats = !showAllStats;
    localStorage.setItem('showAllStats', showAllStats);
    updateStatsToggleButton({ showAllStats });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });
}

function getPlayersInHand() {
    return gameState.players.filter(p => !p.folded && !p.isRemoved);
}

// Animate bets moving to pot
async function animateBetsToPot() {
    const potDisplay = document.querySelector('.pot-display');
    if (!potDisplay) return;

    const potRect = potDisplay.getBoundingClientRect();
    const animations = [];

    for (const player of gameState.players) {
        if (!player) continue;

        const betDisplay = document.getElementById(`bet-${player.id}`);
        if (!betDisplay || !betDisplay.classList.contains('visible')) continue;

        const betAmount = betDisplay.querySelector('.bet-amount')?.textContent;
        if (!betAmount) continue;

        const betRect = betDisplay.getBoundingClientRect();

        // Create a clone for animation
        const clone = document.createElement('div');
        clone.className = 'bet-clone';
        clone.innerHTML = `<span class="bet-amount">${betAmount}</span>`;
        clone.style.left = `${betRect.left}px`;
        clone.style.top = `${betRect.top}px`;
        clone.style.width = `${betRect.width}px`;
        clone.style.height = `${betRect.height}px`;

        document.body.appendChild(clone);

        // Calculate target position (center of pot)
        const targetX = potRect.left + potRect.width / 2 - betRect.width / 2;
        const targetY = potRect.top + potRect.height / 2 - betRect.height / 2;

        // Hide original bet display
        betDisplay.classList.remove('visible');

        // Animate clone to pot
        const animation = new Promise(resolve => {
            clone.offsetHeight;

            clone.style.transition = 'all 0.4s ease-in-out';
            clone.style.left = `${targetX}px`;
            clone.style.top = `${targetY}px`;
            clone.style.transform = 'scale(0.5)';
            clone.style.opacity = '0';

            setTimeout(() => {
                clone.remove();
                resolve();
            }, 400);
        });

        animations.push(animation);
    }

    // Wait for all animations to complete
    if (animations.length > 0) {
        await Promise.all(animations);
    }
}

async function resetBets(thisGameId) {
    // Check if game was cancelled before proceeding
    if (thisGameId !== undefined && currentGameId !== thisGameId) return;

    // Animate bets moving to pot first
    await animateBetsToPot();

    // Check again after animation in case game was cancelled
    if (thisGameId !== undefined && currentGameId !== thisGameId) return;

    // Reset C-bet active status at start of betting round
    gameState.cBetActive = false;

    for (const player of gameState.players) {
        player.bet = 0;
    }
    gameState.currentBet = 0;
    gameState.minRaise = BIG_BLIND;

    // Clear all bet displays
    for (const player of gameState.players) {
        const betDisplay = document.getElementById(`bet-${player.id}`);
        if (betDisplay) {
            betDisplay.classList.remove('visible');
        }
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== AI Player Portraits =====
const AI_PORTRAITS = [
    'pic/portrait/Becky_Blackbell_Portrait.png',
    'pic/portrait/Bond_Forger_Portrait.png',
    'pic/portrait/Camilla_Portrait.png',
    'pic/portrait/Damian_Desmond_Portrait.png',
    'pic/portrait/Dominic_Portrait.png',
    'pic/portrait/Ewen_Egeburg_Portrait.png',
    'pic/portrait/Fiona_Frost_Portrait.png',
    'pic/portrait/Franky_Franklin_Portrait.png',
    'pic/portrait/Henry_Henderson_Portrait.png',
    'pic/portrait/Loid_Forger_Portrait.png',
    'pic/portrait/Sylvia_Sherwood_Portrait.png',
    'pic/portrait/Yor_Forger_Portrait.png',
    'pic/portrait/Yuri_Briar_Portrait.png'
];

// Randomize AI player portraits
function randomizeAIPortraits() {
    // Get number of AI players (all players except human at index 0)
    const aiPlayerCount = gameState.players.length - 1;

    // Shuffle array and pick unique portraits for each AI
    const shuffled = [...AI_PORTRAITS].sort(() => Math.random() - 0.5);

    for (let i = 1; i <= aiPlayerCount; i++) {
        const avatarContainer = document.getElementById(`avatar-${i}`);
        if (avatarContainer) {
            const img = avatarContainer.querySelector('img');
            if (img) {
                img.src = shuffled[i - 1];
            }
        }
    }
}

// Dealer Animation Control
const DEALER_GIF_PREFLOP = 'pic/dealing_preflop.gif';
const DEALER_GIF_FLOP = 'pic/dealing_left.gif';
const DEALER_GIF_TURN_RIVER = 'pic/dealing_right.gif';
const DEALER_STATIC_SRC = 'pic/dealing.png';

// Track which game started the current animation
let dealerAnimationGameId = null;
let winAnimationTimeoutId = null;

function showDealerAnimation(gifSrc, gameId) {
    const gif = document.getElementById('dealer-gif');
    if (gif) {
        // Track which game owns this animation
        dealerAnimationGameId = gameId || currentGameId;
        // Start the animated gif with unique query param to force restart
        gif.src = gifSrc + '?t=' + Date.now();
    }
}

function hideDealerAnimation(gameId) {
    const gif = document.getElementById('dealer-gif');
    if (gif) {
        // Only hide if this is from the current game (or if no gameId provided)
        // This prevents old game's hide call from affecting new game's animation
        if (gameId === undefined || gameId === dealerAnimationGameId) {
            // Replace with static image to stop the animation
            gif.src = DEALER_STATIC_SRC;
            dealerAnimationGameId = null;
        }
    }
}

// ===== Countdown Timer for Fast Mode =====
function getActionCountdownDurationMs(timeLimit) {
    if (!isOnlineMode()) {
        return COUNTDOWN_DURATION;
    }

    const durationSeconds = Number(timeLimit);
    return Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds * 1000
        : COUNTDOWN_DURATION;
}

function startCountdown(durationMs = COUNTDOWN_DURATION) {
    if (!isOnlineMode() && gameMode !== 'fast') return;

    countdownController.start(durationMs);
}

function clearCountdown() {
    countdownController.clear();
}

function handleCountdownExpired() {
    if (isOnlineMode()) {
        return;
    }

    const player = gameState.players[0]; // Human player
    const callAmount = gameState.currentBet - player.bet;

    disableHumanControls();

    if (callAmount > 0) {
        engine.submitAction(0, { type: 'fold' });
    } else {
        engine.submitAction(0, { type: 'check' });
    }
}

// ===== Game Mode Toggle =====
function toggleGameMode() {
    gameMode = gameMode === 'fast' ? 'slow' : 'fast';
    localStorage.setItem('pokerGameMode', gameMode);
    updateGameModeButton({ gameMode, t });
    refreshTableUI(); // Refresh player mode classes
}

function bindEngineEventListeners() {
    if (areEngineEventListenersBound || !engine) {
        return;
    }

    engine.on('hand_start', ({ players }) => {
        if (gameState.handNumber > currentGameId) {
            currentGameId = gameState.handNumber;
        }

        if (gameHistory.handNumber < gameState.handNumber) {
            gameHistory.startHand({
                currentLanguage: getCurrentLanguage(),
                t
            });
        }

        clearWinnerHighlights();
        const potDisplay = document.querySelector('.pot-display');
        if (potDisplay) {
            potDisplay.style.visibility = 'visible';
        }

        expectedHoleCardDeals = players.filter(player => player && !player.folded).length;
        completedHoleCardDeals = 0;
        holeCardAnimationStartTime = 0;
        clearCountdown();
        gameState.displayedCommunityCards = 0;
        if (isOnlineMode()) {
            switchOnlineSidebarTab('log');
        }
        refreshStatsUI();
        refreshTableUI();
    });

    engine.on('blinds_posted', ({ smallBlind, bigBlind }) => {
        const smallBlindPlayer = gameState.players[smallBlind.playerId];
        const bigBlindPlayer = gameState.players[bigBlind.playerId];

        showAction(
            smallBlind.playerId,
            t('actionSmallBlind'),
            smallBlindPlayer.chips + smallBlind.amount
        );
        showAction(
            bigBlind.playerId,
            t('actionBigBlind'),
            bigBlindPlayer.chips + bigBlind.amount
        );

        refreshTableUI();
        refreshStatsUI();
    });

    engine.on('hole_cards_dealt', ({ playerId }) => {
        const thisGameId = currentGameId;

        queueVisualTask(async () => {
            if (currentGameId !== thisGameId) {
                return;
            }

            if (completedHoleCardDeals === 0) {
                holeCardAnimationStartTime = Date.now();
                showDealerAnimation(DEALER_GIF_PREFLOP, thisGameId);
            }

            updatePlayerCardsAnimated(gameState, playerId);
            gameAudio.playCardDeal();
            completedHoleCardDeals += 1;
            await delay(200);

            if (completedHoleCardDeals === expectedHoleCardDeals) {
                const elapsed = Date.now() - holeCardAnimationStartTime;
                if (elapsed < 2000) {
                    await delay(2000 - elapsed);
                }

                if (currentGameId === thisGameId) {
                    hideDealerAnimation(thisGameId);
                }
            }
        });
    });

    engine.on('action_required', async ({ playerId, timeLimit }) => {
        const thisGameId = currentGameId;

        await waitForVisualTasks();
        if (currentGameId !== thisGameId) {
            return;
        }

        const player = gameState.players[playerId];
        if (!player || player.folded || player.allIn || player.isRemoved) {
            return;
        }

        if (player.isAI) {
            refreshTableUI();
            await delay(800);

            if (currentGameId !== thisGameId) {
                return;
            }

            const action = decideAIAction({
                gameState,
                playerId: player.id
            });

            if (action) {
                engine.submitAction(player.id, action);
            }
            return;
        }

        gameAudio.playYourTurn();
        refreshTableUI();
        startCountdown(getActionCountdownDurationMs(timeLimit));
    });

    engine.on('action_executed', ({ playerId, action, playerState, chipsBeforeAction }) => {
        if (action.type === 'fold') {
            if (gameState.players[playerId].isAI) {
                animateFoldCards(playerId);
            }
            showAction(playerId, t('actionFold'), chipsBeforeAction);
            gameAudio.playFold();
        } else if (action.type === 'check') {
            showAction(playerId, t('actionCheck'), chipsBeforeAction);
            gameAudio.playCheck();
        } else if (action.type === 'call') {
            showAction(
                playerId,
                `${t('actionCall')} $${action.amount}`,
                chipsBeforeAction
            );
            gameAudio.playChips();
        } else if (action.type === 'raise') {
            showAction(playerId, `${t('actionRaise')} $${action.totalBet}`, chipsBeforeAction);
            gameAudio.playChips();
        } else if (action.type === 'allin') {
            showAction(playerId, t('actionAllIn'), chipsBeforeAction);
            gameAudio.playAllIn();
        }

        refreshTableUI();
        refreshStatsUI();
    });

    engine.on('phase_changed', ({ phase }) => {
        const thisGameId = currentGameId;

        queueVisualTask(async () => {
            if (currentGameId !== thisGameId) {
                return;
            }

            clearCountdown();
            await resetBets(thisGameId);

            if (currentGameId !== thisGameId) {
                return;
            }

            const dealerGif = phase === 'flop' ? DEALER_GIF_FLOP : DEALER_GIF_TURN_RIVER;
            showDealerAnimation(dealerGif, thisGameId);
            updateCommunityCards(gameState);
            gameAudio.playCardFlip();
            await delay(1000);

            if (currentGameId !== thisGameId) {
                return;
            }

            hideDealerAnimation(thisGameId);
            refreshTableUI();
        });
    });

    engine.on('hand_complete', payload => {
        const thisGameId = currentGameId;
        const thisSettlementId = payload.settlementId ?? (latestHandSettlementId + 1);
        latestHandSettlementId = thisSettlementId;
        const settledPlayers = payload.players ?? gameState.players;
        const settledPlayersById = new Map(
            settledPlayers
                .filter(Boolean)
                .map(player => [player.id, player])
        );
        const settledState = {
            ...gameState,
            players: settledPlayers
        };

        const isStaleSettlement = () =>
            currentGameId !== thisGameId || thisSettlementId !== latestHandSettlementId;

        queueVisualTask(async () => {
            if (isStaleSettlement()) {
                return;
            }

            clearCountdown();
            clearHighlightHumanBestHand();
            await resetBets(thisGameId);

            if (isStaleSettlement()) {
                return;
            }

            clearWinnerHighlights();

            const playersInHand = settledPlayers.filter(player => player && !player.folded && !player.isRemoved);
            refreshStatsUI();

            for (const player of playersInHand) {
                updatePlayerCards(settledState, player.id, { isHidden: false });
            }

            await delay(500);
            if (isStaleSettlement()) {
                return;
            }

            if (playersInHand.length === 1) {
                const winner = playersInHand[0];
                const winAmount = payload.amounts[winner.id] || 0;

                gameAudio.playWin();
                if (winner.id === 0) {
                    showWinAnimation();
                }

                if (winner.isAI && Math.random() < 0.5) {
                    showAIEmotionGif(winner.id, 'joy.gif');
                }

                updatePlayerCards(settledState, winner.id, { isHidden: false });

                const playerEl = document.getElementById(`player-${winner.id}`);
                playerEl.classList.add('winner');

                const badge = document.createElement('div');
                badge.className = 'hand-rank-badge';
                badge.textContent = t('everyoneFolded');
                badge.id = `hand-badge-${winner.id}`;
                playerEl.appendChild(badge);

                const playerCardsContainer = document.getElementById(`cards-${winner.id}`);
                const playerCardEls = playerCardsContainer.querySelectorAll('.card');
                playerCardEls.forEach(card => card.classList.add('winning-card'));

                gameHistory.showMessage({
                    message: t('potWinMessage')
                        .replace('{pot}', t('mainPot') || 'Main Pot')
                        .replace('{winner}', getTranslatedPlayerName(winner))
                        .replace('{amount}', winAmount)
                        .replace('{hand}', t('everyoneFolded')),
                    phaseKey: 'everyoneFolded',
                    t
                });

                gameHistory.logFoldWin({
                    winner,
                    winAmount,
                    t,
                    getTranslatedPlayerName
                });

                await animatePotToWinners([winner], [winAmount]);
            } else {
                const allWinners = payload.winners
                    .map(playerId => settledPlayersById.get(playerId))
                    .filter(Boolean);
                const totalWinAmounts = payload.amounts;
                const pots = payload.pots ?? calculatePots(settledPlayers.filter(Boolean));

                for (let i = 0; i < pots.length; i++) {
                    const pot = pots[i];
                    const eligiblePlayers = pot.eligiblePlayerIds
                        .map(playerId => settledPlayersById.get(playerId))
                        .filter(Boolean);

                    let bestScore = -1;
                    let potWinners = [];

                    for (const player of eligiblePlayers) {
                        if (player.handResult.score > bestScore) {
                            bestScore = player.handResult.score;
                            potWinners = [player];
                        } else if (player.handResult.score === bestScore) {
                            potWinners.push(player);
                        }
                    }

                    const winnerIds = potWinners.map(winner => winner.id);
                    const payouts = splitPot(pot.amount, winnerIds, getSeatOrderFromDealer(winnerIds));
                    const handName = potWinners[0].handResult.name;
                    const translatedPotName = i === 0 ? t('mainPot') : `${t('sidePot')} ${i}`;
                    const translatedWinnerNames = payouts
                        .map(payout => settledPlayersById.get(payout.playerId))
                        .filter(Boolean)
                        .map(player => getTranslatedPlayerName(player))
                        .join(' & ');
                    const displayAmount = payouts.length === 1 ? payouts[0].amount : pot.amount;
                    const translatedHandName = translateHandName(handName);

                    gameHistory.showMessage({
                        message: t('potWinMessage')
                            .replace('{pot}', translatedPotName)
                            .replace('{winner}', translatedWinnerNames)
                            .replace('{amount}', displayAmount)
                            .replace('{hand}', translatedHandName),
                        phaseKey: getCurrentLogPhaseKey(),
                        t
                    });
                }

                gameHistory.logShowdown({
                    playersInHand,
                    winners: allWinners,
                    communityCards: gameState.communityCards,
                    totalWinAmounts,
                    t,
                    translateHandName,
                    getTranslatedPlayerName
                });

                highlightWinners(allWinners);
                await animatePotToWinners(
                    allWinners,
                    allWinners.map(winner => totalWinAmounts[winner.id] || 0)
                );

                if (isStaleSettlement()) {
                    return;
                }

                for (const player of playersInHand) {
                    if (player.isAI && player.chips === 0 && !allWinners.some(winner => winner.id === player.id)) {
                        showAIEmotionGif(player.id, 'cry.gif');
                    }
                }
            }

            if (!isStaleSettlement()) {
                refreshTableUI();
                await finalizeShowdown({
                    players: settledPlayers.filter(Boolean),
                    shouldAbort: isStaleSettlement
                });
            }
        });
    });

    engine.on('error', ({ message }) => {
        gameHistory.showMessage({
            message,
            phaseKey: getCurrentLogPhaseKey(),
            t
        });
        refreshTableUI();
    });

    engine.on('game_over', ({ winner }) => {
        gameHistory.showMessage({
            message: `Game Over! ${winner?.name || 'No one'} wins!`,
            phaseKey: getCurrentLogPhaseKey(),
            t
        });

        const newGameButton = document.getElementById('btn-new-game');
        if (newGameButton) {
            newGameButton.textContent = 'RESTART GAME';
        }

        refreshTableUI();
    });

    areEngineEventListenersBound = true;
}

// Game Phases
async function startNewGame(randomizeDealer = false) {
    if (isOnlineMode()) {
        return;
    }

    currentGameId++;

    gameAudio.playMusic();

    if (winAnimationTimeoutId) {
        clearTimeout(winAnimationTimeoutId);
        winAnimationTimeoutId = null;
    }

    gameHistory.startHand({
        currentLanguage: getCurrentLanguage(),
        t
    });

    // Clear any previous winner highlights
    clearWinnerHighlights();
    // Restore pot display visibility (hidden during pot animation)
    const potDisplay = document.querySelector('.pot-display');
    if (potDisplay) potDisplay.style.visibility = 'visible';

    clearCountdown();
    disableHumanControls();

    // Reset all player stats if this is a fresh New Game (randomizeDealer = true)
    if (randomizeDealer) {
        for (const player of gameState.players) {
            if (!player) continue;
            resetPlayerStats(player);
        }
    }

    refreshStatsUI();
    refreshTableUI();

    engine.startHand({ randomizeDealer });
}

function getSeatOrderFromDealer(playerIds) {
    const targetPlayerIds = new Set(playerIds);
    const seatOrder = [];
    let currentIndex = (gameState.dealerIndex + 1) % gameState.players.length;

    for (let i = 0; i < gameState.players.length; i++) {
        const player = gameState.players[currentIndex];
        if (targetPlayerIds.has(player.id)) {
            seatOrder.push(player.id);
        }
        currentIndex = (currentIndex + 1) % gameState.players.length;
    }

    return seatOrder;
}

// Update chips display only after showdown (called within showdown)
async function finalizeShowdown({ players = gameState.players, shouldAbort = () => false } = {}) {
    // Store game ID to check if user started a new game during the delay
    const thisGameId = currentGameId;
    const delayMs = isOnlineMode() ? 1000 : 5000;

    // Update chips display only (don't call updateUI which would rebuild cards and remove highlights)
    for (const player of players) {
        if (!player) continue;
        document.getElementById(`chips-${player.id}`).textContent = player.chips;
    }

    // Let the winner state breathe briefly before the next hand or refresh arrives.
    await delay(delayMs);

    if (shouldAbort()) {
        return;
    }

    if (isOnlineMode()) {
        return;
    }

    // Only start next game if user didn't already click New Game
    if (currentGameId === thisGameId) {
        startNewGame();
    }
}

// Highlight winning players and their winning cards
function highlightWinners(winners) {
    // Play win sound
    gameAudio.playWin();

    // Check if human player (id 0) is among winners - show win animation
    const humanWinner = winners.find(w => w.id === 0);
    if (humanWinner) {
        showWinAnimation();
    }

    for (const winner of winners) {
        const playerEl = document.getElementById(`player-${winner.id}`);
        playerEl.classList.add('winner');

        // Add hand rank badge - use each winner's own hand result name (translated)
        const badge = document.createElement('div');
        badge.className = 'hand-rank-badge';
        badge.textContent = winner.handResult ? translateHandName(winner.handResult.name) : t('winner');
        badge.id = `hand-badge-${winner.id}`;
        playerEl.appendChild(badge);

        // Highlight winning cards (only if we have a real hand result)
        if (winner.handResult && winner.handResult.bestCards && winner.handResult.bestCards.length > 0) {
            highlightWinningCards(winner);
        }

        // Show emotion animation for AI winners based on hand strength
        if (winner.isAI && winner.handResult) {
            const handName = winner.handResult.name;
            const betterThanStraight = ['Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];

            if (handName === 'High Card') {
                showAIEmotionGif(winner.id, 'sweat.gif');
            } else if (betterThanStraight.includes(handName)) {
                showAIEmotionGif(winner.id, 'star.gif');
            } else {
                // 30% chance to show grin for normal wins
                if (Math.random() < 0.3) {
                    showAIEmotionGif(winner.id, 'grin.gif');
                }
            }
        }
    }
}

// Show emotion gif animation for AI player
function showAIEmotionGif(playerId, gifName = 'grin.gif') {
    const playerEl = document.getElementById(`player-${playerId}`);
    if (!playerEl) return;

    // Remove any existing emotion gif for this player
    const existingGif = document.getElementById(`emotion-${playerId}`);
    if (existingGif) existingGif.remove();

    // Create emotion gif element
    const emotionGif = document.createElement('img');
    emotionGif.src = `pic/${gifName}?` + Date.now(); // Cache-bust to restart animation
    emotionGif.className = 'ai-winner-grin';
    emotionGif.id = `emotion-${playerId}`;

    // Append to player element
    playerEl.appendChild(emotionGif);

    // Remove after animation (approximately 1.5 seconds)
    setTimeout(() => {
        const gif = document.getElementById(`emotion-${playerId}`);
        if (gif) gif.remove();
    }, 1500);
}

// Show win animation for human player
function showWinAnimation() {
    const gif = document.getElementById('dealer-gif');
    if (gif) {
        // Clear any existing win animation timeout
        if (winAnimationTimeoutId) {
            clearTimeout(winAnimationTimeoutId);
        }

        // Change src with cache-bust to restart animation
        gif.src = 'pic/user_win.gif?t=' + Date.now();

        // Auto-hide after animation plays (approximately cost 1.6 seconds)
        winAnimationTimeoutId = setTimeout(() => {
            gif.src = DEALER_STATIC_SRC;
            winAnimationTimeoutId = null;
        }, 1600);
    }
}

// Highlight the 5 cards that make up the winning hand
function highlightWinningCards(winner) {
    const bestCards = winner.handResult.bestCards;

    // Get player's hole cards (exclude placeholders)
    const playerCardsContainer = document.getElementById(`cards-${winner.id}`);
    const playerCardEls = playerCardsContainer.querySelectorAll('.card:not(.card-placeholder)');

    // Get community cards (exclude placeholders)
    const communityContainer = document.getElementById('community-cards');
    const communityCardEls = communityContainer.querySelectorAll('.card:not(.card-placeholder)');

    // Check each of the best 5 cards and highlight matching ones
    for (const bestCard of bestCards) {
        // Check player's hole cards
        for (let i = 0; i < winner.cards.length; i++) {
            if (winner.cards[i].suit === bestCard.suit && winner.cards[i].value === bestCard.value) {
                if (playerCardEls[i]) {
                    playerCardEls[i].classList.add('winning-card');
                }
            }
        }

        // Check community cards
        for (let i = 0; i < gameState.communityCards.length; i++) {
            if (gameState.communityCards[i].suit === bestCard.suit &&
                gameState.communityCards[i].value === bestCard.value) {
                if (communityCardEls[i]) {
                    communityCardEls[i].classList.add('winning-card');
                }
            }
        }
    }
}

// Animate pot moving to winners
async function animatePotToWinners(winners, winAmounts) {
    const potDisplay = document.querySelector('.pot-display');
    const potRect = potDisplay.getBoundingClientRect();

    // Hide original pot display during animation
    potDisplay.style.visibility = 'hidden';

    for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        const winAmount = winAmounts[i];

        // Get winner's position
        const playerEl = document.getElementById(`player-${winner.id}`);
        const playerRect = playerEl.getBoundingClientRect();

        // Create pot clone
        const potClone = document.createElement('div');
        potClone.className = 'pot-clone';
        potClone.innerHTML = `
            <span class="pot-label">${winners.length > 1 ? 'SPLIT' : 'POT'}</span>
            <span class="pot-amount">$${winAmount}</span>
        `;

        // Position at pot's location
        potClone.style.left = `${potRect.left}px`;
        potClone.style.top = `${potRect.top}px`;

        document.body.appendChild(potClone);

        // Calculate target position (center of player element)
        const targetX = playerRect.left + playerRect.width / 2 - potRect.width / 2;
        const targetY = playerRect.top + playerRect.height / 2 - potRect.height / 2;

        // Animate to player
        potClone.style.transition = 'all 0.6s ease-out';

        // Force reflow
        potClone.offsetHeight;

        potClone.style.left = `${targetX}px`;
        potClone.style.top = `${targetY}px`;

        // Wait for animation
        await delay(600);

        // Fade out
        potClone.classList.add('animating');
        await delay(400);

        // Remove clone
        potClone.remove();

        // Small delay between multiple winners
        if (i < winners.length - 1) {
            await delay(200);
        }
    }

    // Clear pot display
    gameState.pot = 0;
    document.getElementById('pot-amount').textContent = '$0';
}

// ===== Pot Preset Buttons =====
// Set slider to a fraction/multiple of the pot amount, capped at player's max chips
function setPotPreset(multiplier) {
    const player = gameState.players[0];
    const slider = document.getElementById('raise-slider');

    // Calculate target bet based on pot
    let targetBet = Math.floor(gameState.pot * multiplier);

    // Ensure target bet is at least the minimum raise
    const minRaise = parseInt(slider.min);
    if (targetBet < minRaise) {
        targetBet = minRaise;
    }

    // Cap at player's maximum available bet (current chips + already bet)
    const maxBet = player.chips + player.bet;
    if (targetBet > maxBet) {
        targetBet = maxBet;
    }

    // Also cap at slider max
    const sliderMax = parseInt(slider.max);
    if (targetBet > sliderMax) {
        targetBet = sliderMax;
    }

    // Update slider and display
    slider.value = targetBet;
    document.getElementById('raise-amount').textContent = targetBet;
}

// Helper for reset and start new game
let lastNewGameClickTime = 0;
let cooldownIntervalId = null;
const NEW_GAME_DEBOUNCE_MS = 5000; // 5 seconds cooldown

function resetAndStartNewGame() {
    if (isOnlineMode()) {
        return;
    }

    // Debounce: prevent double-clicking within cooldown period
    const now = Date.now();
    if (now - lastNewGameClickTime < NEW_GAME_DEBOUNCE_MS) {
        return; // Ignore rapid clicks
    }
    lastNewGameClickTime = now;

    // Add cooldown visual style to button with countdown timer
    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) {
        newGameBtn.classList.add('cooldown');

        // Start countdown timer
        let secondsRemaining = Math.ceil(NEW_GAME_DEBOUNCE_MS / 1000);
        newGameBtn.textContent = `${t('newGame')} (${secondsRemaining})`;

        // Clear any existing interval
        if (cooldownIntervalId) {
            clearInterval(cooldownIntervalId);
        }

        cooldownIntervalId = setInterval(() => {
            secondsRemaining--;
            if (secondsRemaining > 0) {
                newGameBtn.textContent = `${t('newGame')} (${secondsRemaining})`;
            } else {
                // Cooldown finished
                newGameBtn.textContent = t('newGame');
                newGameBtn.classList.remove('cooldown');
                clearInterval(cooldownIntervalId);
                cooldownIntervalId = null;
            }
        }, 1000);
    }

    document.getElementById('winner-popup').classList.remove('visible');
    for (const player of gameState.players) {
        if (!player) continue;
        player.chips = STARTING_CHIPS;
    }

    // Reset hand counter and clear all history IMMEDIATELY
    gameHistory.resetGame();

    // Randomize AI player portraits for this new game
    randomizeAIPortraits();

    // Show all player elements and controls (remove pre-game hidden state)
    showGameElements();

    startNewGame(true);
}

// ===== Online User Count =====
function initOnlineCount() {
    const userIdKey = 'poker_online_user_id';
    let userId = localStorage.getItem(userIdKey);
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(userIdKey, userId);
    }

    const updateCount = async () => {
        try {
            const response = await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            if (response.ok) {
                const data = await response.json();
                const countEl = document.getElementById('online-count');
                if (countEl && data.count) {
                    countEl.dataset.count = data.count; // Store count for translation updates
                    countEl.textContent = `🟢 ${t('onlineUsers')}: ${data.count}`;
                }
            }
        } catch (e) {
            // Quietly fail for local dev (no API)
            const countEl = document.getElementById('online-count');
            if (countEl && !countEl.dataset.count) {
                countEl.dataset.count = 1;
                countEl.textContent = `🟢 ${t('onlineUsers')}: 1`;
            }
        }
    };

    // Update immediately
    updateCount();

    // Poll every 15 seconds
    setInterval(updateCount, 15000);
}

let areGameEventListenersBound = false;
let hasGameBooted = false;

function bindOnlineClientListeners() {
    if (!onlineClient) {
        return;
    }

    onlineClient.on('auth_ok', ({ user }) => {
        gameState = engine.state;
        setOnlineStatus('onlineStatusConnectedAs', 'info', {
            username: user.username
        });
        updateOnlineRoomPanel();
        gameLanguageUI.syncUI();
        onlineClient.listRooms();
    });

    onlineClient.on('room_list', () => {
        updateOnlineRoomPanel();
    });

    onlineClient.on('room_created', ({ roomId }) => {
        setOnlineStatus('onlineStatusCreatedRoom', 'info', { roomId });
        updateOnlineRoomPanel();
    });

    onlineClient.on('room_joined', ({ roomId }) => {
        gameState = engine.state;
        gameHistory.resetGame();
        clearWinnerHighlights();
        clearCountdown();
        showGameElements();
        disableHumanControls();
        refreshTableUI();
        refreshStatsUI();
        gameLanguageUI.syncUI();
        setOnlineStatus('onlineStatusJoinedRoom', 'info', { roomId });
        updateOnlineRoomPanel();
    });

    onlineClient.on('room_left', () => {
        gameState = engine.state;
        gameHistory.resetGame();
        hideGameElements();
        clearCountdown();
        disableHumanControls();
        refreshTableUI();
        gameLanguageUI.syncUI();
        switchOnlineSidebarTab('room');
        setOnlineStatus('onlineStatusBackInLobby');
        updateOnlineRoomPanel();
    });

    onlineClient.on('player_joined', ({ player }) => {
        if (!player) {
            return;
        }

        gameHistory.showMessage({
            message: t('playerJoinedRoom').replace('{name}', getTranslatedPlayerName(player)),
            phaseKey: getCurrentLogPhaseKey(),
            t
        });
    });

    onlineClient.on('player_left', ({ player }) => {
        if (!player) {
            return;
        }

        gameHistory.showMessage({
            message: t('playerLeftRoom').replace('{name}', getTranslatedPlayerName(player)),
            phaseKey: getCurrentLogPhaseKey(),
            t
        });
    });

    onlineClient.on('room_state_updated', () => {
        gameState = engine.state;
        refreshTableUI();
        refreshStatsUI();
        gameLanguageUI.syncUI();
        updateOnlineRoomPanel();
    });

    onlineClient.on('error', ({ message }) => {
        setOnlineStatusText(message, 'error');
        updateOnlineRoomPanel();
    });

    onlineClient.on('connection_closed', () => {
        clearCountdown();
        setOnlineStatus('onlineStatusConnectionClosed', 'error');
        updateOnlineRoomPanel();
    });
}

function initOnlineMode({ wsUrl }) {
    const wsClient = createWebSocketClient({
        url: wsUrl,
        token: 'guest-placeholder'
    });

    onlineClient = createOnlineGameClient({
        wsClient,
        maxSupportedPlayers: MAX_ONLINE_SEATS
    });
    engine = onlineClient;
    gameState = engine.state;
    areEngineEventListenersBound = false;

    updateModeChrome();
    ensureOnlineSidebarTabs();
    switchOnlineSidebarTab('room');
    ensureOnlineRoomPanel();
    bindEngineEventListeners();
    bindOnlineClientListeners();
    gameHistory.resetGame();
    hideGameElements();
    disableHumanControls();
    refreshTableUI();
    gameLanguageUI.syncUI();
    setOnlineStatus('onlineStatusConnectingTo', 'info', { url: wsUrl });
    updateOnlineRoomPanel();

    onlineClient.connect({
        token: 'guest-placeholder'
    }).catch(error => {
        if (error?.message) {
            setOnlineStatusText(error.message, 'error');
        } else {
            setOnlineStatus('onlineStatusUnableToConnect', 'error');
        }
        updateOnlineRoomPanel();
    });
}

export function bindGameEventListeners() {
    if (areGameEventListenersBound) {
        return;
    }

    bindGameTableEvents({
        onFold: () => {
            prepareHumanActionSubmission();
            engine.submitAction(0, { type: 'fold' });
        },
        onCheck: () => {
            prepareHumanActionSubmission();
            engine.submitAction(0, { type: 'check' });
        },
        onCall: () => {
            prepareHumanActionSubmission();
            engine.submitAction(0, { type: 'call' });
        },
        onRaise: (raiseAmount) => {
            prepareHumanActionSubmission();
            engine.submitAction(0, { type: 'raise', totalBet: raiseAmount });
        },
        onAllIn: () => {
            prepareHumanActionSubmission();
            engine.submitAction(0, { type: 'allin' });
        },
        onSetPotPreset: (multiplier) => {
            setPotPreset(multiplier);
        },
        onResetAndStartNewGame: resetAndStartNewGame
    });

    bindGameShellEvents({
        onNavigateHistory: direction => {
            gameHistory.navigate(direction, {
                currentLanguage: getCurrentLanguage(),
                t
            });
        },
        onReturnToCurrentHand: () => {
            gameHistory.returnToCurrent({
                currentLanguage: getCurrentLanguage(),
                t
            });
        },
        onOpenHelp: () => {
            setHelpPopupVisible(true);
        },
        onCloseHelp: () => {
            setHelpPopupVisible(false);
        },
        onToggleLanguage: gameLanguageUI.toggleLanguage,
        onToggleGameMode: toggleGameMode,
        onToggleStats: toggleShowAllStats
    });

    gameCursorEffects.init();

    areGameEventListenersBound = true;
}

export function bootGame() {
    if (hasGameBooted) {
        return;
    }

    gameAudio.init();
    initOnlineCount();
    updateModeChrome();

    const onlineModeSettings = getOnlineModeSettings();
    if (onlineModeSettings.isOnline) {
        initOnlineMode(onlineModeSettings);
    } else {
        initPlayers();
        hideGameElements();
        refreshTableUI();
        gameLanguageUI.syncUI();
        gameHistory.showMessage({
            message: t('startMessage'),
            phaseKey: 'start',
            t
        });
    }

    updateStatsToggleButton({ showAllStats });

    hasGameBooted = true;
}
