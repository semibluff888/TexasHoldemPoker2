import { createDeck, shuffleDeck } from './src/core/cards.js';
import { evaluateHand } from './src/core/hand-evaluator.js';
import { calculatePots, splitPot } from './src/core/pot-settlement.js';
import {
    SMALL_BLIND,
    BIG_BLIND,
    STARTING_CHIPS,
    createDefaultStats,
    createPlayer,
    createInitialGameState,
    resetPlayersForNewHand
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
import { gameCursorEffects } from './src/ui/game-cursor-effects.js';
import { gameHistory } from './src/ui/game-history.js';
import { createGameLanguageUI } from './src/ui/game-language-ui.js';
import {
    decideAIAction,
    getOpponentProfile
} from './src/ai/game-ai.js';

// ===== Texas Hold'em Poker Game =====

// Game Constants
// Hand ranks are evaluated using numeric scores from core hand evaluator.

// ===== Game Mode Settings =====
const COUNTDOWN_DURATION = 15000; // 15 seconds for fast mode
document.documentElement.style.setProperty('--countdown-duration', (COUNTDOWN_DURATION / 1000) + 's');
let gameMode = localStorage.getItem('pokerGameMode') || 'fast'; // 'fast' or 'slow'
let countdownTimerId = null;
let countdownStartTime = null;

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

function getCurrentLogPhaseKey() {
    return gameState.phase === 'idle' ? 'start' : gameState.phase;
}

// Initialize Players
function initPlayers() {
    gameState.players = [
        createPlayer({ id: 0, name: 'You', isAI: false, aiLevel: null }),
        createPlayer({ id: 1, name: 'AI Player 1', isAI: true }),
        createPlayer({ id: 2, name: 'AI Player 2', isAI: true }),
        createPlayer({ id: 3, name: 'AI Player 3', isAI: true }),
        createPlayer({ id: 4, name: 'AI Player 4', isAI: true })
    ];
}

// Reset a player's stats to default values
function resetPlayerStats(player) {
    player.stats = createDefaultStats();
}


// Deal Cards
function dealCard() {
    return gameState.deck.pop();
}

// Get dealing order (clockwise, starting after dealer, dealer last)
function getDealingOrder() {
    const order = [];
    const numPlayers = gameState.players.length;
    // Clockwise: 0 -> 1 -> 2 -> 3 -> 4 -> 0
    let currentIndex = (gameState.dealerIndex + 1) % numPlayers;
    for (let i = 0; i < numPlayers; i++) {
        const player = gameState.players[currentIndex];
        // Include all-in players (chips >= 0) - they still need cards dealt
        if (!player.folded && player.chips >= 0) {
            order.push(currentIndex);
        }
        currentIndex = (currentIndex + 1) % numPlayers;
    }
    return order;
}

// Deal hole cards with animation (async)
async function dealHoleCards(thisGameId) {
    const dealingOrder = getDealingOrder();

    // Minimum time for dealer GIF to play (in ms)
    const MIN_GIF_DURATION = 2000;
    const startTime = Date.now();

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_PREFLOP, thisGameId);

    // Deal first card to each player
    for (const playerId of dealingOrder) {
        // Check if game was cancelled
        if (currentGameId !== thisGameId) {
            hideDealerAnimation(thisGameId);
            return;
        }

        const player = gameState.players[playerId];
        player.cards.push(dealCard());
        updatePlayerCardsAnimated(gameState, playerId);
        gameAudio.playCardDeal();
        await delay(200);
    }

    // Deal second card to each player
    for (const playerId of dealingOrder) {
        // Check if game was cancelled
        if (currentGameId !== thisGameId) {
            hideDealerAnimation(thisGameId);
            return;
        }

        const player = gameState.players[playerId];
        player.cards.push(dealCard());
        updatePlayerCardsAnimated(gameState, playerId);
        gameAudio.playCardDeal();
        await delay(200);
    }

    // Wait for minimum GIF duration if dealing was faster
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_GIF_DURATION) {
        await delay(MIN_GIF_DURATION - elapsed);
    }

    // Check if game was cancelled during extra wait
    if (currentGameId !== thisGameId) {
        hideDealerAnimation(thisGameId);
        return;
    }

    // Hide dealer animation
    hideDealerAnimation(thisGameId);
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

// Betting Actions
function playerFold(playerId) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;

    // Trigger flying animation for AI players before marking as folded
    if (player.isAI) {
        animateFoldCards(playerId);
    }

    // Track "Fold to C-Bet"
    if (gameState.cBetActive) {
        player.stats.foldToCBetCount++;
    }

    player.folded = true;
    showAction(playerId, t('actionFold'), chipsBeforeAction);
    gameAudio.playFold();
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
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

function playerCheck(playerId) {
    const player = gameState.players[playerId];
    showAction(playerId, t('actionCheck'), player.chips);
    gameAudio.playCheck();
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });
}

function playerCall(playerId) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;
    const callAmount = Math.min(gameState.currentBet - player.bet, player.chips);

    // Track stats for opponent modeling
    if (callAmount > 0) {
        // VPIP only counts preflop voluntary actions, and only once per hand
        if (gameState.phase === 'preflop' && !player.stats.vpipCountedThisHand) {
            player.stats.vpipCount++;
            player.stats.vpipCountedThisHand = true;
        }
    }

    player.chips -= callAmount;
    player.bet += callAmount;
    player.totalContribution += callAmount;
    gameState.pot += callAmount;

    if (player.chips === 0) {
        player.allIn = true;
        showAction(playerId, t('actionAllIn'), chipsBeforeAction);
        gameAudio.playAllIn();
    } else {
        showAction(playerId, `${t('actionCall')} $${callAmount}`, chipsBeforeAction);
        gameAudio.playChips();
    }

    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });
}

function playerRaise(playerId, totalBet) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;
    const raiseAmount = totalBet - player.bet;
    const actualRaise = totalBet - gameState.currentBet;

    // Track stats for opponent modeling
    if (gameState.phase === 'preflop') {
        // VPIP only counts once per hand
        if (!player.stats.vpipCountedThisHand) {
            player.stats.vpipCount++;
            player.stats.vpipCountedThisHand = true;
        }
        // PFR only counts once per hand
        if (!player.stats.pfrCountedThisHand) {
            player.stats.pfrCount++;
            player.stats.pfrCountedThisHand = true;
        }

        // Track 3-bets (re-raise against an open raise)
        gameState.preflopRaiseCount++;
        // If this is the 2nd raise (1st was open raise), it's a 3-bet
        if (gameState.preflopRaiseCount === 2) {
            if (!player.stats.threeBetCountedThisHand) {
                player.stats.threeBetCount++;
                player.stats.threeBetCountedThisHand = true;
            }
        }

        // Track preflop aggressor (last player to raise preflop)
        gameState.preflopAggressorId = playerId;
    } else if (gameState.phase === 'flop') {
        // Track C-bet (Continuation Bet)
        // Must be preflop aggressor, first bet on flop (gameState.currentBet was 0 before this raise)
        // Note: playerRaise is called for both betting (opening) and raising
        if (playerId === gameState.preflopAggressorId &&
            !player.stats.cBetCountedThisHand &&
            gameState.currentBet === 0) {
            player.stats.cBetCount++;
            player.stats.cBetCountedThisHand = true;
            gameState.cBetActive = true;
        } else {
            // Any other flop raise resets C-bet status (now it's a raise over a c-bet, or standard raise)
            gameState.cBetActive = false;
        }
    } else {
        // Raises in other phases reset C-bet active status
        gameState.cBetActive = false;
    }

    player.chips -= raiseAmount;
    player.bet = totalBet;
    player.totalContribution += raiseAmount;
    gameState.pot += raiseAmount;
    gameState.currentBet = totalBet;
    gameState.minRaise = Math.max(gameState.minRaise, actualRaise);

    if (player.chips === 0) {
        player.allIn = true;
        showAction(playerId, t('actionAllIn'), chipsBeforeAction);
        gameAudio.playAllIn();
    } else {
        showAction(playerId, `${t('actionRaise')} $${totalBet}`, chipsBeforeAction);
        gameAudio.playChips();
    }

    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });
}

function playerAllIn(playerId) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;
    const allInAmount = player.chips;
    const newBet = player.bet + allInAmount;

    if (newBet > gameState.currentBet) {
        gameState.minRaise = Math.max(gameState.minRaise, newBet - gameState.currentBet);
        gameState.currentBet = newBet;
    }

    player.chips = 0;
    player.bet = newBet;
    player.totalContribution += allInAmount;
    player.allIn = true;
    gameState.pot += allInAmount;

    showAction(playerId, t('actionAllIn'), chipsBeforeAction);
    gameAudio.playAllIn();
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });
}

function executeAIAction(playerId, action) {
    if (!action) {
        return;
    }

    switch (action.type) {
        case 'fold':
            playerFold(playerId);
            return;
        case 'check':
            playerCheck(playerId);
            return;
        case 'call':
            playerCall(playerId);
            return;
        case 'raise':
            playerRaise(playerId, action.totalBet);
            return;
        default:
            throw new Error(`Unknown AI action type: ${action.type}`);
    }
}

function toggleAILevel(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || player.isRemoved) return;

    if (player.aiLevel === 'easy') {
        player.aiLevel = 'medium';
    } else if (player.aiLevel === 'medium') {
        player.aiLevel = 'hard';
    } else {
        player.aiLevel = 'easy';
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

function removeAIPlayer(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || player.isRemoved) return;

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

    player.isRemoved = true;
    player.folded = true; // folded immediately

    // Reset player stats
    resetPlayerStats(player);
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });

    // Action log
    const name = getTranslatedPlayerName(player);
    gameHistory.showMessage({
        message: t('aiLeft').replace('{name}', name),
        phaseKey: getCurrentLogPhaseKey(),
        t
    });

    // Update UI
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });

    // If it was the player's turn, resolve it
    if (gameState.currentPlayerIndex === playerId && gameState.phase !== 'idle' && gameState.phase !== 'showdown') {
        if (playerActionResolver) {
            resolvePlayerAction();
        } else {
            // If AI's turn during runBettingRound, it will continue in the loop
            // but we might need to trigger nextPlayer manually if the loop is waiting
        }
    }

    // Check if hand is over (only 1 player remains) - wake up the loop to handle it correctly in showdown
    const playersInHand = getPlayersInHand();
    if (playersInHand.length === 1 && gameState.phase !== 'idle' && gameState.phase !== 'showdown') {
        resolvePlayerAction();
    }
}


function addAIPlayer(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || !player.isRemoved) return;

    player.isRemoved = false;
    player.isPendingJoin = true; // Will join next hand
    player.chips = STARTING_CHIPS;
    player.folded = true; // Stay out of current hand
    player.allIn = false;
    player.bet = 0;
    player.cards = [];

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
    const name = getTranslatedPlayerName(player);
    gameHistory.showMessage({
        message: t('aiJoined').replace('{name}', name),
        phaseKey: getCurrentLogPhaseKey(),
        t
    });

    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });
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

function nextPlayer() {
    const numPlayers = gameState.players.length;
    let attempts = 0;
    do {
        // Clockwise direction: 0 -> 1 -> 2 -> 3 -> 4 -> 0
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % numPlayers;
        attempts++;
    } while (
        (gameState.players[gameState.currentPlayerIndex].folded ||
            gameState.players[gameState.currentPlayerIndex].allIn ||
            gameState.players[gameState.currentPlayerIndex].isRemoved) &&
        attempts < numPlayers
    );

    return attempts < numPlayers;
}

function getActivePlayers() {
    return gameState.players.filter(p => !p.folded && p.chips >= 0 && !p.isRemoved);
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
        if (player.bet > 0) {
            const betDisplay = document.getElementById(`bet-${player.id}`);
            if (!betDisplay || !betDisplay.classList.contains('visible')) continue;

            const betRect = betDisplay.getBoundingClientRect();

            // Create a clone for animation
            const clone = document.createElement('div');
            clone.className = 'bet-clone';
            clone.innerHTML = `<span class="bet-amount">$${player.bet}</span>`;
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
                // Force reflow
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

async function runBettingRound() {
    // Store the game ID at the very start - if it changes, abort this round
    const thisGameId = currentGameId;

    // Get players who can still act (not folded, not all-in, have chips)
    const getActingPlayers = () => gameState.players.filter(p => !p.folded && !p.allIn && p.chips > 0);

    // If only one or zero players can act and all bets are matched, skip the round
    const initialActingPlayers = getActingPlayers();
    if (initialActingPlayers.length === 0) {
        return;
    }
    if (initialActingPlayers.length === 1 && initialActingPlayers.every(p => p.bet === gameState.currentBet)) {
        return;
    }

    // Track which players have acted since the last raise/bet
    // When someone raises, everyone else needs to respond
    // Start empty - every player must act at least once per round
    let playersActedSinceLastRaise = new Set();

    while (true) {
        // Check if a new game started - if so, abort this betting round
        if (currentGameId !== thisGameId) {
            return;
        }

        const player = gameState.players[gameState.currentPlayerIndex];

        // If only one player remains in hand (not folded), end the round
        if (getPlayersInHand().length === 1) {
            break;
        }

        // Check if this player can act
        if (!player.folded && !player.allIn && player.chips > 0) {
            // Track "Faced Open Raise" stat
            // If it's preflop, exactly one raise has occurred, and we haven't counted this yet for this player
            if (gameState.phase === 'preflop' &&
                gameState.preflopRaiseCount === 1 &&
                !player.stats.facedOpenRaiseCountedThisHand) {
                player.stats.facedOpenRaiseCount++;
                player.stats.facedOpenRaiseCountedThisHand = true;
            }

            // Track C-bet Opportunity
            // Preflop aggressor, on flop, facing no bet (opportunity to open)
            if (gameState.phase === 'flop' &&
                gameState.preflopAggressorId === player.id &&
                gameState.currentBet === 0 &&
                !player.stats.cBetOpportunityCountedThisHand) {
                player.stats.cBetOpportunityCount++;
                player.stats.cBetOpportunityCountedThisHand = true;
            }

            // Track "Faced C-Bet"
            if (gameState.cBetActive && !player.stats.cBetFacedCountedThisHand) {
                player.stats.cBetFaced++;
                player.stats.cBetFacedCountedThisHand = true;
            }

            const previousCurrentBet = gameState.currentBet;

            if (player.isAI) {
                // Update UI to show active state for AI player
                updateUI(gameState, {
                    gameMode,
                    t,
                    translateHandName,
                    onToggleAILevel: toggleAILevel,
                    onRemoveAIPlayer: removeAIPlayer,
                    onAddAIPlayer: addAIPlayer
                });
                await delay(800);
                // Check again after await in case game was cancelled during delay
                if (currentGameId !== thisGameId) return;
                const action = decideAIAction({
                    gameState,
                    playerId: player.id
                });

                executeAIAction(player.id, action);
            } else {
                // Play notification sound for human player's turn
                gameAudio.playYourTurn();
                updateUI(gameState, {
                    gameMode,
                    t,
                    translateHandName,
                    onToggleAILevel: toggleAILevel,
                    onRemoveAIPlayer: removeAIPlayer,
                    onAddAIPlayer: addAIPlayer
                });
                // Start countdown timer in fast mode
                startCountdown();
                await waitForPlayerAction();
                // Check again after await in case game was cancelled during wait
                if (currentGameId !== thisGameId) return;
            }

            // Mark this player as having acted
            playersActedSinceLastRaise.add(player.id);

            // If a raise occurred (current bet increased), reset tracking
            // Everyone except the raiser needs to act again
            if (gameState.currentBet > previousCurrentBet) {
                playersActedSinceLastRaise = new Set([player.id]);
            }
        }

        // Check gameId AGAIN before calling nextPlayer - critical to prevent
        // old game's loop from modifying new game's currentPlayerIndex
        if (currentGameId !== thisGameId) return;

        // Move to next player
        if (!nextPlayer()) break;

        // Check gameId again after nextPlayer in case game was cancelled
        if (currentGameId !== thisGameId) return;

        // Check if round is complete:
        // All active players have acted since last raise AND all bets are matched
        const actingPlayers = getActingPlayers();

        if (actingPlayers.length === 0) {
            // No one can act anymore (all folded or all-in)
            break;
        }

        const allHaveActed = actingPlayers.every(p => playersActedSinceLastRaise.has(p.id));
        const allBetsMatched = actingPlayers.every(p => p.bet === gameState.currentBet);

        if (allHaveActed && allBetsMatched) {
            break;
        }
    }

    // Clear countdown timer when betting round ends
    clearCountdown();
    // Reset currentPlayerIndex so no player is marked as active
    gameState.currentPlayerIndex = -1;
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    }); // Remove active class to stop flowing border animation
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

let playerActionResolver = null;

function waitForPlayerAction() {
    return new Promise(resolve => {
        playerActionResolver = resolve;
    });
}

function resolvePlayerAction() {
    if (playerActionResolver) {
        // Clear countdown timer if running
        clearCountdown();

        // Immediately disable controls after user takes action
        const controls = document.getElementById('controls');
        controls.classList.add('disabled');
        controls.classList.remove('active');

        playerActionResolver();
        playerActionResolver = null;
    }
}

// ===== Countdown Timer for Fast Mode =====
function startCountdown() {
    if (gameMode !== 'fast') return;

    clearCountdown(); // Clear any existing timer
    countdownStartTime = Date.now();

    countdownTimerId = setTimeout(() => {
        handleCountdownExpired();
    }, COUNTDOWN_DURATION);
}

function clearCountdown() {
    if (countdownTimerId) {
        clearTimeout(countdownTimerId);
        countdownTimerId = null;
    }
    countdownStartTime = null;
}

function handleCountdownExpired() {
    const player = gameState.players[0]; // Human player
    const callAmount = gameState.currentBet - player.bet;

    if (callAmount > 0) {
        // Facing a raise - auto fold
        playerFold(0);
    } else {
        // No raise - auto check
        playerCheck(0);
    }

    resolvePlayerAction();
}

// ===== Game Mode Toggle =====
function toggleGameMode() {
    gameMode = gameMode === 'fast' ? 'slow' : 'fast';
    localStorage.setItem('pokerGameMode', gameMode);
    updateGameModeButton({ gameMode, t });
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    }); // Refresh player mode classes
}

// Game Phases
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

    gameHistory.startHand({
        currentLanguage: getCurrentLanguage(),
        t
    });

    // Clear any previous winner highlights
    clearWinnerHighlights();
    // Restore pot display visibility (hidden during pot animation)
    const potDisplay = document.querySelector('.pot-display');
    if (potDisplay) potDisplay.style.visibility = 'visible';

    // Reset game state
    gameState.deck = shuffleDeck(createDeck());
    gameState.communityCards = [];
    gameState.displayedCommunityCards = 0;
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.phase = 'preflop';
    gameState.minRaise = BIG_BLIND;
    gameState.preflopRaiseCount = 0; // Reset raise count
    gameState.preflopAggressorId = null; // Reset preflop aggressor
    gameState.cBetActive = false; // Reset C-bet flag
    gameState.currentPlayerIndex = -1; // No active player until blinds are posted

    // Reset all player stats if this is a fresh New Game (randomizeDealer = true)
    if (randomizeDealer) {
        for (const player of gameState.players) {
            resetPlayerStats(player);
        }
    }

    gameState.players = resetPlayersForNewHand(gameState.players);

    // Update stats display after handsPlayed is incremented
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });

    // Check if game can continue (at least human + 1 active AI)
    const playersWithChips = gameState.players.filter(p => !p.isRemoved && p.chips > 0);
    if (playersWithChips.length < 2) {
        gameHistory.showMessage({
            message: 'Game Over! ' + (playersWithChips[0]?.name || 'No one') + ' wins!',
            phaseKey: getCurrentLogPhaseKey(),
            t
        });
        document.getElementById('btn-new-game').textContent = 'RESTART GAME';
        initPlayers();
        updateUI(gameState, {
            gameMode,
            t,
            translateHandName,
            onToggleAILevel: toggleAILevel,
            onRemoveAIPlayer: removeAIPlayer,
            onAddAIPlayer: addAIPlayer
        });
        return;
    }

    // Set dealer position
    if (randomizeDealer) {
        // Random dealer position for fresh game
        const eligibleDealers = gameState.players.map((p, i) => ({ player: p, index: i }))
            .filter(p => !p.player.isRemoved && p.player.chips > 0);
        if (eligibleDealers.length > 0) {
            const randomPlayerIndex = Math.floor(Math.random() * eligibleDealers.length);
            gameState.dealerIndex = eligibleDealers[randomPlayerIndex].index;
        }
    } else {
        // Move dealer clockwise for next round
        do {
            gameState.dealerIndex = (gameState.dealerIndex + 1) % gameState.players.length;
        } while (gameState.players[gameState.dealerIndex].isRemoved || gameState.players[gameState.dealerIndex].chips <= 0);
    }

    // Post blinds
    const sbIndex = getNextActivePlayer(gameState.dealerIndex);
    const bbIndex = getNextActivePlayer(sbIndex);

    postBlind(sbIndex, SMALL_BLIND);
    postBlind(bbIndex, BIG_BLIND);

    gameState.currentBet = BIG_BLIND;
    // Don't set currentPlayerIndex yet - wait until after dealing

    // Update UI before dealing to show blinds (no active player yet)
    updateUI(gameState, {
        gameMode,
        t,
        translateHandName,
        onToggleAILevel: toggleAILevel,
        onRemoveAIPlayer: removeAIPlayer,
        onAddAIPlayer: addAIPlayer
    });

    // Store game ID at the start of this game
    const thisGameId = currentGameId;

    // Deal hole cards with animation
    await dealHoleCards(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after hole cards are dealt)
    gameState.currentPlayerIndex = getNextActivePlayer(bbIndex);

    // Run betting rounds
    await runBettingRound();

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    if (getPlayersInHand().length > 1) {
        await dealFlop(thisGameId);
    }

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    if (getPlayersInHand().length > 1) {
        await dealTurn(thisGameId);
    }

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    if (getPlayersInHand().length > 1) {
        await dealRiver(thisGameId);
    }

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    await showdown(thisGameId);
}

function getNextActivePlayer(fromIndex) {
    const numPlayers = gameState.players.length;
    // Clockwise direction: 0 -> 1 -> 2 -> 3 -> 4 -> 0
    let index = (fromIndex + 1) % numPlayers;
    let attempts = 0;
    // Skip only folded players - all-in players (chips=0 but allIn=true) are still in the hand
    while (gameState.players[index].folded && attempts < numPlayers) {
        index = (index + 1) % numPlayers;
        attempts++;
    }
    return index;
}

function postBlind(playerIndex, amount) {
    const player = gameState.players[playerIndex];
    const chipsBeforeAction = player.chips;
    const blindAmount = Math.min(amount, player.chips);

    player.chips -= blindAmount;
    player.bet = blindAmount;
    player.totalContribution += blindAmount;
    gameState.pot += blindAmount;

    if (player.chips === 0) {
        player.allIn = true;
    }

    showAction(playerIndex, amount === SMALL_BLIND ? t('actionSmallBlind') : t('actionBigBlind'), chipsBeforeAction);
}

async function dealFlop(thisGameId) {
    gameState.phase = 'flop';
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_FLOP, thisGameId);

    // Burn and deal 3 cards
    dealCard(); // Burn
    for (let i = 0; i < 3; i++) {
        gameState.communityCards.push(dealCard());
    }

    // Update community cards display (but don't set active player yet)
    updateCommunityCards(gameState);
    gameAudio.playCardFlip();

    // Wait for GIF animation to complete one loop
    await delay(1000);

    // Hide dealer animation
    hideDealerAnimation(thisGameId);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after animation completes)
    gameState.currentPlayerIndex = getNextActivePlayer(gameState.dealerIndex);

    await runBettingRound();
}

async function dealTurn(thisGameId) {
    gameState.phase = 'turn';
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_TURN_RIVER, thisGameId);

    // Burn and deal 1 card
    dealCard(); // Burn
    gameState.communityCards.push(dealCard());

    // Update community cards display (but don't set active player yet)
    updateCommunityCards(gameState);
    gameAudio.playCardFlip();

    // Wait for GIF animation to complete one loop
    await delay(1000);

    // Hide dealer animation
    hideDealerAnimation(thisGameId);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after animation completes)
    gameState.currentPlayerIndex = getNextActivePlayer(gameState.dealerIndex);

    await runBettingRound();
}

async function dealRiver(thisGameId) {
    gameState.phase = 'river';
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_TURN_RIVER, thisGameId);

    // Burn and deal 1 card
    dealCard(); // Burn
    gameState.communityCards.push(dealCard());

    // Update community cards display (but don't set active player yet)
    updateCommunityCards(gameState);
    gameAudio.playCardFlip();

    // Wait for GIF animation to complete one loop
    await delay(1000);

    // Hide dealer animation
    hideDealerAnimation(thisGameId);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after animation completes)
    gameState.currentPlayerIndex = getNextActivePlayer(gameState.dealerIndex);

    await runBettingRound();
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

async function showdown(thisGameId) {
    gameState.phase = 'showdown';
    clearHighlightHumanBestHand(); // Clear post-flop highlights before showdown

    // Animate final bets to pot before showdown
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    const playersInHand = getPlayersInHand();

    // Track showdownCount - only if multiple players reach showdown (actual hand comparison)
    if (playersInHand.length > 1) {
        for (const player of playersInHand) {
            player.stats.showdownCount++;
        }
    }

    // Update stats display after showdownCount
    updateAllPlayerStatsDisplays({
        players: gameState.players,
        t,
        getOpponentProfile
    });

    // Reveal all cards
    for (const player of playersInHand) {
        updatePlayerCards(gameState, player.id, { isHidden: false });
    }

    await delay(500);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    if (playersInHand.length === 1) {
        // Everyone folded - highlight winner and their hole cards
        const winner = playersInHand[0];
        const winAmount = gameState.pot;

        // Play win sound
        gameAudio.playWin();

        // Show win animation if human player wins
        if (winner.id === 0) {
            showWinAnimation();
        }

        // Show joy animation if AI player wins by fold (50% chance)
        if (winner.isAI && Math.random() < 0.5) {
            showAIEmotionGif(winner.id, 'joy.gif');
        }

        // Reveal winner's cards
        updatePlayerCards(gameState, winner.id, { isHidden: false });

        // Highlight winner (with "Everyone Folded" badge instead of hand name)
        const playerEl = document.getElementById(`player-${winner.id}`);
        playerEl.classList.add('winner');

        const badge = document.createElement('div');
        badge.className = 'hand-rank-badge';
        badge.textContent = t('everyoneFolded');
        badge.id = `hand-badge-${winner.id}`;
        playerEl.appendChild(badge);

        // Highlight winner's hole cards
        const playerCardsContainer = document.getElementById(`cards-${winner.id}`);
        const playerCardEls = playerCardsContainer.querySelectorAll('.card');
        playerCardEls.forEach(card => card.classList.add('winning-card'));

        // Show immediate message for feedback (consistent with other wins)
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

        // Animate pot to winner
        await animatePotToWinners([winner], [winAmount]);

        // Check if game was cancelled after animation
        if (currentGameId !== thisGameId) return;

        // Update chips after animation
        winner.chips += winAmount;
    } else {
        // Evaluate all hands first
        for (const player of playersInHand) {
            const allCards = [...player.cards, ...gameState.communityCards];
            const hand = evaluateHand(allCards);
            player.handResult = hand;
        }

        // Calculate pots (main pot and side pots)
        // Pass all players so folded contributions are included
        const pots = calculatePots(gameState.players);

        let allWinners = [];
        let totalWinAmounts = {};

        // Award each pot to its winner(s)
        for (let i = 0; i < pots.length; i++) {
            const pot = pots[i];
            const eligiblePlayers = pot.eligiblePlayerIds
                .map(playerId => gameState.players.find(player => player.id === playerId))
                .filter(Boolean);

            // Find best hand among eligible players for this pot.
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

            // Track all winners and their total winnings
            for (const payout of payouts) {
                const winner = gameState.players.find(player => player.id === payout.playerId);
                if (!winner) {
                    continue;
                }
                if (!allWinners.some(player => player.id === winner.id)) {
                    allWinners.push(winner);
                }
                totalWinAmounts[winner.id] = (totalWinAmounts[winner.id] || 0) + payout.amount;
                winner.chips += payout.amount;
            }

            // Log each pot award - translate all parts
            const translatedPotName = i === 0 ? t('mainPot') : `${t('sidePot')} ${i}`;
            const translatedWinnerNames = payouts
                .map(payout => gameState.players.find(player => player.id === payout.playerId))
                .filter(Boolean)
                .map(player => getTranslatedPlayerName(player))
                .join(' & ');
            const displayAmount = payouts.length === 1
                ? payouts[0].amount
                : pot.amount;
            const translatedHandName = translateHandName(handName);

            // Use translated message format
            const message = t('potWinMessage')
                .replace('{pot}', translatedPotName)
                .replace('{winner}', translatedWinnerNames)
                .replace('{amount}', displayAmount)
                .replace('{hand}', translatedHandName);
            gameHistory.showMessage({
                message,
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

        // Highlight all winners
        highlightWinners(allWinners);

        // Animate pot to all winners (simplified - just show total)
        await animatePotToWinners(allWinners, allWinners.map(w => totalWinAmounts[w.id]));

        // Check if game was cancelled after animation
        if (currentGameId !== thisGameId) return;

        // Show cry animation for AI players who lost and have 0 chips
        for (const player of playersInHand) {
            if (player.isAI && player.chips === 0 && !allWinners.some(w => w.id === player.id)) {
                showAIEmotionGif(player.id, 'cry.gif');
            }
        }
    }

    // Finalize showdown - update chips display and start next game
    await finalizeShowdown();
}

// Update chips display only after showdown (called within showdown)
async function finalizeShowdown() {
    // Store game ID to check if user started a new game during the delay
    const thisGameId = currentGameId;

    // Update chips display only (don't call updateUI which would rebuild cards and remove highlights)
    for (const player of gameState.players) {
        document.getElementById(`chips-${player.id}`).textContent = player.chips;
    }

    // Wait 5 seconds to let player see the winner highlights, then start next game
    await delay(5000);

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

export function bindGameEventListeners() {
    if (areGameEventListenersBound) {
        return;
    }

    bindGameTableEvents({
        onFold: () => {
            playerFold(0);
            resolvePlayerAction();
        },
        onCheck: () => {
            playerCheck(0);
            resolvePlayerAction();
        },
        onCall: () => {
            playerCall(0);
            resolvePlayerAction();
        },
        onRaise: (raiseAmount) => {
            playerRaise(0, raiseAmount);
            resolvePlayerAction();
        },
        onAllIn: () => {
            playerAllIn(0);
            resolvePlayerAction();
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
    gameLanguageUI.syncUI();
    gameHistory.showMessage({
        message: t('startMessage'),
        phaseKey: 'start',
        t
    });
    updateStatsToggleButton({ showAllStats });

    hasGameBooted = true;
}
