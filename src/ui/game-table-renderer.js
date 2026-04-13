import { evaluateHand } from '../core/hand-evaluator.js';

function getCardHTML(card, isHidden = false, animate = true) {
    const animClass = animate ? ' dealing' : '';
    if (isHidden) {
        return `<div class="card card-back${animClass}"></div>`;
    }
    const isRed = card.suit === '♥' || card.suit === '♦';
    return `
        <div class="card card-face ${isRed ? 'red' : 'black'}${animClass}">
            <span class="card-value">${card.value}</span>
            <span class="card-suit">${card.suit}</span>
        </div>
    `;
}

function animateCardFromDealer(cardElement) {
    const dealerGif = document.getElementById('dealer-gif');
    if (!dealerGif || !cardElement) return;

    cardElement.classList.remove('dealing');

    const dealerRect = dealerGif.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    const offsetX = dealerRect.left + dealerRect.width / 2 - cardRect.left - cardRect.width / 2;
    const offsetY = dealerRect.top + dealerRect.height / 2 - cardRect.top - cardRect.height / 2;

    cardElement.style.setProperty('--deal-start-x', `${offsetX}px`);
    cardElement.style.setProperty('--deal-start-y', `${offsetY}px`);

    cardElement.offsetHeight;

    cardElement.classList.add('dealing');

    cardElement.addEventListener('animationend', function handleAnimationEnd() {
        cardElement.classList.remove('dealing');
        cardElement.removeEventListener('animationend', handleAnimationEnd);
    });
}

export function updatePlayerCards(gameState, playerId, { isHidden = false } = {}) {
    const player = gameState.players[playerId];
    const cardsContainer = document.getElementById(`cards-${playerId}`);

    if (player.cards.length === 0 || (player.folded && player.isAI)) {
        cardsContainer.innerHTML = `
            <div class="card card-placeholder"></div>
            <div class="card card-placeholder"></div>
        `;
        return;
    }

    const hidden = isHidden && player.isAI && gameState.phase !== 'showdown';

    const existingCards = cardsContainer.querySelectorAll('.card-face');
    if (existingCards.length === player.cards.length && !hidden && !player.folded) {
        let allMatch = true;
        existingCards.forEach((el, i) => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (!valueEl || !suitEl ||
                valueEl.textContent !== player.cards[i].value ||
                suitEl.textContent !== player.cards[i].suit) {
                allMatch = false;
            }
        });
        if (allMatch) return;
    }

    cardsContainer.innerHTML = player.cards.map(card => getCardHTML(card, hidden, false)).join('');
}

export function updatePlayerCardsAnimated(gameState, playerId) {
    const player = gameState.players[playerId];
    const cardsContainer = document.getElementById(`cards-${playerId}`);
    const hidden = player.isAI;

    let html = '';
    for (let i = 0; i < 2; i++) {
        if (i < player.cards.length) {
            const shouldAnimate = i === player.cards.length - 1;
            html += `<div class="card-slot">
                <div class="card card-placeholder"></div>
                ${getCardHTML(player.cards[i], hidden, shouldAnimate)}
            </div>`;
        } else {
            html += '<div class="card-slot"><div class="card card-placeholder"></div></div>';
        }
    }
    cardsContainer.innerHTML = html;

    const dealingCard = cardsContainer.querySelector('.card.dealing');
    if (dealingCard) {
        animateCardFromDealer(dealingCard);
    }
}

export function updateCommunityCards(gameState) {
    const container = document.getElementById('community-cards');

    const existingSlots = container.querySelectorAll('.card-slot');
    const existingFaceCards = container.querySelectorAll('.card-face');

    if (existingFaceCards.length === gameState.communityCards.length &&
        gameState.displayedCommunityCards === gameState.communityCards.length) {
        let allMatch = true;
        existingFaceCards.forEach((el, i) => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (!valueEl || !suitEl ||
                valueEl.textContent !== gameState.communityCards[i].value ||
                suitEl.textContent !== gameState.communityCards[i].suit) {
                allMatch = false;
            }
        });
        if (allMatch) return;
    }

    clearHighlightHumanBestHand();

    let html = '';

    for (let i = 0; i < 5; i++) {
        if (i < gameState.communityCards.length) {
            const shouldAnimate = i >= gameState.displayedCommunityCards;
            html += `<div class="card-slot community-slot">
                <div class="card card-placeholder"></div>
                ${getCardHTML(gameState.communityCards[i], false, shouldAnimate)}
            </div>`;
        } else {
            html += '<div class="card-slot community-slot"><div class="card card-placeholder"></div></div>';
        }
    }

    container.innerHTML = html;

    const dealingCards = container.querySelectorAll('.card.dealing');
    dealingCards.forEach(card => animateCardFromDealer(card));

    gameState.displayedCommunityCards = gameState.communityCards.length;
}

export function clearHighlightHumanBestHand() {
    document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));
    const existingName = document.querySelector('.hand-rank-name');
    if (existingName) existingName.remove();
}

export function highlightHumanBestHand(gameState, { translateHandName }) {
    const validPhases = ['flop', 'turn', 'river'];
    if (!validPhases.includes(gameState.phase)) return;

    const humanPlayer = gameState.players[0];
    if (humanPlayer.folded || humanPlayer.isRemoved) {
        clearHighlightHumanBestHand();
        return;
    }

    const allCards = [...humanPlayer.cards, ...gameState.communityCards];
    if (allCards.length < 5) return;

    const handResult = evaluateHand(allCards);

    const existingName = document.querySelector('.hand-rank-name');
    if (existingName) existingName.remove();

    if (handResult.name === 'High Card') {
        document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));
        return;
    }

    const handNameEl = document.createElement('div');
    handNameEl.className = 'hand-rank-name';
    handNameEl.textContent = translateHandName(handResult.name);

    const communityCardsEl = document.getElementById('community-cards');
    if (communityCardsEl) {
        communityCardsEl.appendChild(handNameEl);
    }

    document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));

    let cardsToHighlight = [];
    const handName = handResult.name;
    const bestCards = handResult.bestCards;

    if (handName === 'One Pair') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const pairValue = Object.keys(valueCounts).find(v => valueCounts[v] === 2);
        cardsToHighlight = bestCards.filter(card => card.value === pairValue);
    } else if (handName === 'Two Pair') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const pairValues = Object.keys(valueCounts).filter(v => valueCounts[v] === 2);
        cardsToHighlight = bestCards.filter(card => pairValues.includes(card.value));
    } else if (handName === 'Three of a Kind') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const tripsValue = Object.keys(valueCounts).find(v => valueCounts[v] === 3);
        cardsToHighlight = bestCards.filter(card => card.value === tripsValue);
    } else if (handName === 'Four of a Kind') {
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const quadsValue = Object.keys(valueCounts).find(v => valueCounts[v] === 4);
        cardsToHighlight = bestCards.filter(card => card.value === quadsValue);
    } else if (handName === 'Full House') {
        cardsToHighlight = bestCards;
    } else {
        cardsToHighlight = bestCards;
    }

    const highlightCardInContainer = (containerId, card) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const cardEls = container.querySelectorAll('.card');

        cardEls.forEach(el => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (valueEl && suitEl) {
                if (valueEl.textContent === card.value && suitEl.textContent === card.suit) {
                    el.classList.add('highlight');
                }
            }
        });
    };

    cardsToHighlight.forEach(card => {
        highlightCardInContainer('cards-0', card);
        highlightCardInContainer('community-cards', card);
    });
}

export function clearWinnerHighlights() {
    document.querySelectorAll('.player.winner').forEach(el => {
        el.classList.remove('winner');
    });

    document.querySelectorAll('.hand-rank-badge').forEach(el => {
        el.remove();
    });

    document.querySelectorAll('.card.winning-card').forEach(el => {
        el.classList.remove('winning-card');
    });
}

export function hideGameElements() {
    const playerInfos = document.querySelectorAll('.player-info');
    playerInfos.forEach(info => {
        info.classList.add('pre-game-hidden');
        info.classList.remove('game-started');
    });

    const controls = document.getElementById('controls');
    if (controls) {
        controls.classList.add('pre-game-hidden');
        controls.classList.remove('game-started');
    }
}

export function showGameElements() {
    const playerInfos = document.querySelectorAll('.player-info');
    playerInfos.forEach(info => {
        info.classList.remove('pre-game-hidden');
        info.classList.add('game-started');
    });

    const controls = document.getElementById('controls');
    if (controls) {
        controls.classList.remove('pre-game-hidden');
        controls.classList.add('game-started');
    }
}

function updateBetDisplay(gameState, playerId) {
    const player = gameState.players[playerId];
    const betDisplay = document.getElementById(`bet-${playerId}`);
    const betAmount = betDisplay.querySelector('.bet-amount');

    if (player.bet > 0) {
        betAmount.textContent = `$${player.bet}`;
        betDisplay.classList.add('visible');
    } else {
        betDisplay.classList.remove('visible');
    }
}

function updateControls(gameState, { gameMode }) {
    const controls = document.getElementById('controls');
    const player = gameState.players[0];

    controls.classList.remove('hidden');

    const isUserTurn = gameState.currentPlayerIndex === 0;
    const canAct = gameState.phase !== 'idle' &&
        gameState.phase !== 'showdown' &&
        !player.folded &&
        !player.allIn;
    const isActive = isUserTurn && canAct;

    controls.classList.toggle('disabled', !isActive);
    controls.classList.toggle('active', isActive);

    const callAmount = gameState.currentBet - player.bet;
    const canCheck = callAmount === 0;

    document.getElementById('btn-check').style.display = canCheck ? 'block' : 'none';
    document.getElementById('btn-call').style.display = canCheck ? 'none' : 'block';
    document.getElementById('call-amount').textContent = Math.min(callAmount, player.chips);

    const slider = document.getElementById('raise-slider');
    const minRaise = gameState.currentBet + gameState.minRaise;
    slider.min = minRaise;
    slider.max = player.chips + player.bet;
    slider.value = minRaise;
    document.getElementById('raise-amount').textContent = minRaise;

    const allButtons = controls.querySelectorAll('.btn');
    allButtons.forEach(btn => btn.disabled = !isActive);

    if (isActive) {
        document.getElementById('btn-raise').disabled = player.chips <= callAmount;
    }

    slider.disabled = !isActive;

    void gameMode;
}

export function updateUI(gameState, {
    gameMode,
    t,
    translateHandName,
    onToggleAILevel,
    onRemoveAIPlayer,
    onAddAIPlayer
}) {
    document.getElementById('pot-amount').textContent = `$${gameState.pot}`;
    const potChip = document.querySelector('.pot-chip');
    if (potChip) {
        potChip.style.display = gameState.pot > 0 ? 'block' : 'none';
    }

    for (const player of gameState.players) {
        document.getElementById(`chips-${player.id}`).textContent = player.chips;

        const playerEl = document.getElementById(`player-${player.id}`);
        playerEl.classList.toggle('folded', player.folded);
        playerEl.classList.toggle('removed', !!player.isRemoved);
        const isActivePlayer = gameState.phase !== 'idle' &&
            gameState.currentPlayerIndex === player.id &&
            !player.folded && !player.allIn;
        playerEl.classList.toggle('active', isActivePlayer);
        playerEl.classList.toggle('fast-mode', gameMode === 'fast');
        playerEl.classList.toggle('slow-mode', gameMode === 'slow');

        const dealerChip = document.getElementById(`dealer-${player.id}`);
        dealerChip.classList.toggle('visible', gameState.dealerIndex === player.id && !player.isRemoved);

        updatePlayerCards(gameState, player.id, { isHidden: true });
        updateBetDisplay(gameState, player.id);

        if (player.isAI) {
            const levelEl = document.getElementById(`level-${player.id}`);
            const avatarContainer = document.getElementById(`avatar-${player.id}`);

            let removeBtn = playerEl.querySelector('.btn-remove');
            if (!removeBtn) {
                removeBtn = document.createElement('button');
                removeBtn.className = 'btn-remove';
                removeBtn.innerHTML = '×';
                removeBtn.title = t('removeAI');
                playerEl.querySelector('.player-info').appendChild(removeBtn);
            }
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                onRemoveAIPlayer(player.id);
            };
            removeBtn.style.display = player.isRemoved ? 'none' : 'block';

            let plusSign = playerEl.querySelector('.player-add-plus');
            if (!plusSign) {
                plusSign = document.createElement('div');
                plusSign.className = 'player-add-plus';
                plusSign.innerHTML = '+';
                plusSign.title = t('addAI');
                playerEl.querySelector('.player-info').appendChild(plusSign);
            }
            plusSign.onclick = (e) => {
                e.stopPropagation();
                onAddAIPlayer(player.id);
            };
            plusSign.style.display = player.isRemoved ? 'flex' : 'none';

            if (levelEl) {
                levelEl.textContent = `(${t(player.aiLevel)})`;
                levelEl.title = t('changeDifficulty');
                levelEl.className = `player-level ${player.aiLevel}`;
                levelEl.style.display = player.isRemoved ? 'none' : 'block';

                levelEl.onclick = (e) => {
                    e.stopPropagation();
                    onToggleAILevel(player.id);
                };
            }

            const nameEl = playerEl.querySelector('.player-name');
            const chipsEl = playerEl.querySelector('.player-chips');
            if (nameEl) nameEl.style.display = player.isRemoved ? 'none' : 'block';
            if (chipsEl) chipsEl.style.display = player.isRemoved ? 'none' : 'block';
            if (avatarContainer) avatarContainer.style.display = player.isRemoved ? 'none' : 'flex';
        }
    }

    updateCommunityCards(gameState);
    updateControls(gameState, { gameMode });
    highlightHumanBestHand(gameState, { translateHandName });
}
