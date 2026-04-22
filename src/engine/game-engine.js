import { createDeck, shuffleDeck } from '../core/cards.js';
import { evaluateHand } from '../core/hand-evaluator.js';
import { calculatePots, splitPot } from '../core/pot-settlement.js';
import {
    BIG_BLIND,
    SMALL_BLIND,
    STARTING_CHIPS,
    createInitialGameState,
    createPlayer,
    resetPlayersForNewHand
} from '../state/game-state.js';
import { EventEmitter } from './event-emitter.js';
import { getValidActions, validateAction } from './action-validator.js';

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function clonePlayer(player) {
    return cloneValue(player);
}

function createAmountsObject(payouts) {
    return payouts.reduce((amounts, payout) => {
        amounts[payout.playerId] = (amounts[payout.playerId] ?? 0) + payout.amount;
        return amounts;
    }, {});
}

export class GameEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            maxPlayers: 6,
            smallBlind: SMALL_BLIND,
            bigBlind: BIG_BLIND,
            startingChips: STARTING_CHIPS,
            actionTimeoutMs: 30000,
            deckFactory: () => shuffleDeck(createDeck()),
            random: Math.random,
            ...config
        };

        this.state = createInitialGameState();
        this.state.players = [];
        this.state.currentPlayerIndex = -1;
        this.state.handNumber = 0;

        this._playersActedSinceLastRaise = new Set();
        this._smallBlindPlayerId = null;
        this._bigBlindPlayerId = null;
        this._lastHandSettlement = null;
        this._settlementSequence = 0;
    }

    addPlayer({
        id = this.state.players.length,
        name,
        isAI = false,
        aiLevel = 'medium',
        chips = this.config.startingChips
    }) {
        const existingPlayer = this.state.players[id];

        if (existingPlayer && !existingPlayer.isRemoved) {
            throw new Error(`Player seat ${id} is already occupied`);
        }

        const player = createPlayer({
            id,
            name,
            isAI,
            aiLevel,
            chips
        });

        this.state.players[id] = player;
        this.emit('player_added', { player: clonePlayer(player) });
        return clonePlayer(player);
    }

    removePlayer(playerId) {
        const player = this._getPlayer(playerId);

        if (!player || player.isRemoved) {
            return false;
        }

        player.isRemoved = true;
        player.isPendingJoin = false;
        player.folded = true;
        player.allIn = false;

        this.emit('player_removed', {
            playerId,
            player: clonePlayer(player)
        });

        if (this.state.phase === 'idle') {
            return true;
        }

        if (this.state.phase === 'showdown') {
            if (this._shouldResettleShowdownForRemoval(playerId)) {
                this._applySettlement(this._buildHandSettlement());
            }

            return true;
        }

        if (this._getPlayersInHand().length <= 1) {
            this._clearCurrentRoundBets();
            this._resolveShowdown();
            return true;
        }

        if (this._isBettingRoundComplete()) {
            this.emit('betting_round_end', { phase: this.state.phase });
            this._completeBettingRound();
            return true;
        }

        if (this.state.currentPlayerIndex === playerId) {
            if (!this._advanceTurn()) {
                this._completeBettingRound();
                return true;
            }

            this._requestAction(this.state.currentPlayerIndex);
        }

        return true;
    }

    restorePlayer({ id, name, isAI, aiLevel, chips = this.config.startingChips }) {
        const existingPlayer = this.state.players[id];

        if (existingPlayer && !existingPlayer.isRemoved) {
            throw new Error(`Player seat ${id} is already occupied`);
        }

        const player = createPlayer({
            id,
            name: name ?? existingPlayer?.name ?? `Player ${id}`,
            isAI: isAI ?? existingPlayer?.isAI ?? false,
            aiLevel: aiLevel ?? existingPlayer?.aiLevel ?? 'medium',
            chips,
            folded: true,
            isRemoved: false,
            isPendingJoin: true
        });

        this.state.players[id] = player;

        this.emit('player_restored', { player: clonePlayer(player) });
        return clonePlayer(player);
    }

    resumePlayer({ id, name, isAI, aiLevel }) {
        const player = this._getPlayer(id);

        if (!player || !player.isRemoved) {
            throw new Error(`Player seat ${id} is not available to resume`);
        }

        player.name = name ?? player.name;
        player.isAI = isAI ?? player.isAI;
        player.aiLevel = aiLevel ?? player.aiLevel;
        player.isRemoved = false;
        player.isPendingJoin = this.state.phase !== 'idle';
        player.folded = this.state.phase !== 'idle' || player.chips <= 0;
        player.allIn = false;

        this.emit('player_restored', { player: clonePlayer(player) });
        return clonePlayer(player);
    }

    cycleAILevel(playerId) {
        const player = this._getPlayer(playerId);

        if (!player || !player.isAI || player.isRemoved) {
            return null;
        }

        const levels = ['easy', 'medium', 'hard'];
        const currentIndex = levels.indexOf(player.aiLevel);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % levels.length;
        player.aiLevel = levels[nextIndex];

        this.emit('player_updated', { player: clonePlayer(player) });
        return player.aiLevel;
    }

    startHand({ randomizeDealer = false } = {}) {
        const playersWithChips = this._getPlayersWithChips();

        if (playersWithChips.length < 2) {
            this.emit('game_over', {
                winner: playersWithChips[0] ? clonePlayer(playersWithChips[0]) : null
            });
            return false;
        }

        this._prepareHand(randomizeDealer);

        this.emit('hand_start', {
            dealerIndex: this.state.dealerIndex,
            handNumber: this.state.handNumber,
            players: this.getFullState().players
        });

        this.emit('blinds_posted', this._postBlinds());
        this._dealHoleCards();
        this._startBettingRound(this._getPreflopStartPlayerId());

        return true;
    }

    submitAction(playerId, action) {
        const validation = validateAction(this.state, playerId, action);

        if (!validation.valid) {
            const result = { ok: false, reason: validation.reason };
            this.emit('error', {
                playerId,
                message: validation.reason
            });
            return result;
        }

        const chipsBeforeAction = this._getPlayer(playerId).chips;
        const previousCurrentBet = this.state.currentBet;
        const actionSummary = this._applyAction(playerId, action);

        this.emit('action_executed', {
            playerId,
            action: actionSummary,
            chipsBeforeAction,
            playerState: clonePlayer(this._getPlayer(playerId)),
            pot: this.state.pot,
            currentBet: this.state.currentBet
        });

        if (this._getPlayersInHand().length <= 1) {
            this._clearCurrentRoundBets();
            this._resolveShowdown();
            return { ok: true };
        }

        this._playersActedSinceLastRaise.add(playerId);

        if (this.state.currentBet > previousCurrentBet) {
            this._playersActedSinceLastRaise = new Set([playerId]);
        }

        if (this._isBettingRoundComplete()) {
            this.emit('betting_round_end', { phase: this.state.phase });
            this._completeBettingRound();
            return { ok: true };
        }

        if (!this._advanceTurn()) {
            this._completeBettingRound();
            return { ok: true };
        }

        this._requestAction(this.state.currentPlayerIndex);
        return { ok: true };
    }

    getPlayerView(playerId) {
        const playerView = this.getFullState();

        if (playerView.phase === 'showdown') {
            return playerView;
        }

        playerView.players = playerView.players.map(player => {
            if (!player) {
                return player;
            }

            if (player.id !== playerId) {
                player.cards = [];
            }

            return player;
        });

        return playerView;
    }

    getFullState() {
        return {
            ...cloneValue(this.state),
            players: this.state.players.map(player => player ? clonePlayer(player) : player)
        };
    }

    getPlayersInHand() {
        return this._getPlayersInHand().map(player => clonePlayer(player));
    }

    getActivePlayers() {
        return this._getActivePlayers().map(player => clonePlayer(player));
    }

    _prepareHand(randomizeDealer) {
        const previousHandNumber = this.state.handNumber;

        this.state.deck = [...this.config.deckFactory()];
        this.state.communityCards = [];
        this.state.displayedCommunityCards = 0;
        this.state.pot = 0;
        this.state.currentBet = 0;
        this.state.phase = 'preflop';
        this.state.minRaise = this.config.bigBlind;
        this.state.preflopRaiseCount = 0;
        this.state.preflopAggressorId = null;
        this.state.cBetActive = false;
        this.state.currentPlayerIndex = -1;
        this.state.players = this.state.players.map(player => {
            if (!player) {
                return player;
            }

            return resetPlayersForNewHand([clonePlayer(player)])[0];
        });

        this.state.handNumber = previousHandNumber + 1;
        this._playersActedSinceLastRaise = new Set();
        this._lastHandSettlement = null;

        this._assignDealer({ randomizeDealer, previousHandNumber });
    }

    _assignDealer({ randomizeDealer, previousHandNumber }) {
        const eligiblePlayerIds = this._getPlayersWithChips().map(player => player.id);

        if (eligiblePlayerIds.length === 0) {
            this.state.dealerIndex = 0;
            return;
        }

        if (randomizeDealer) {
            const randomIndex = Math.floor(this.config.random() * eligiblePlayerIds.length);
            this.state.dealerIndex = eligiblePlayerIds[randomIndex];
            return;
        }

        if (previousHandNumber === 0) {
            if (!eligiblePlayerIds.includes(this.state.dealerIndex)) {
                this.state.dealerIndex = eligiblePlayerIds[0];
            }
            return;
        }

        this.state.dealerIndex = this._getNextEligiblePlayerId(this.state.dealerIndex);
    }

    _postBlinds() {
        const playersWithChips = this._getPlayersWithChips();

        if (playersWithChips.length === 2) {
            this._smallBlindPlayerId = this.state.dealerIndex;
            this._bigBlindPlayerId = this._getNextEligiblePlayerId(this.state.dealerIndex);
        } else {
            this._smallBlindPlayerId = this._getNextEligiblePlayerId(this.state.dealerIndex);
            this._bigBlindPlayerId = this._getNextEligiblePlayerId(this._smallBlindPlayerId);
        }

        const smallBlind = this._postBlind(this._smallBlindPlayerId, this.config.smallBlind);
        const bigBlind = this._postBlind(this._bigBlindPlayerId, this.config.bigBlind);

        this.state.currentBet = Math.max(smallBlind.amount, bigBlind.amount);
        this.state.minRaise = this.config.bigBlind;

        return {
            smallBlind,
            bigBlind
        };
    }

    _postBlind(playerId, amount) {
        const player = this._getPlayer(playerId);
        const blindAmount = Math.min(amount, player.chips);

        player.chips -= blindAmount;
        player.bet = blindAmount;
        player.totalContribution += blindAmount;
        player.allIn = player.chips === 0;
        this.state.pot += blindAmount;

        return {
            playerId,
            amount: blindAmount
        };
    }

    _dealHoleCards() {
        const dealingOrder = this._getDealingOrder();

        for (let round = 0; round < 2; round += 1) {
            for (const playerId of dealingOrder) {
                this._getPlayer(playerId).cards.push(this._drawCard());
            }
        }

        for (const playerId of dealingOrder) {
            this.emit('hole_cards_dealt', {
                playerId,
                cards: cloneValue(this._getPlayer(playerId).cards)
            });
        }
    }

    _startBettingRound(startPlayerId) {
        if (this._getPlayersInHand().length <= 1) {
            this._resolveShowdown();
            return;
        }

        this._playersActedSinceLastRaise = new Set();
        this.state.currentPlayerIndex = startPlayerId ?? -1;

        if (this._shouldSkipBettingRound()) {
            this._completeBettingRound();
            return;
        }

        this._requestAction(this.state.currentPlayerIndex);
    }

    _requestAction(playerId) {
        const player = this._getPlayer(playerId);

        if (!player) {
            return;
        }

        this._trackActionOpportunity(player);

        const callAmount = Math.max(0, this.state.currentBet - player.bet);
        this.emit('action_required', {
            playerId,
            validActions: getValidActions(this.state, playerId),
            timeLimit: this.config.actionTimeoutMs,
            callAmount,
            minRaiseTo: this.state.currentBet + this.state.minRaise,
            maxBet: player.bet + player.chips
        });
    }

    _trackActionOpportunity(player) {
        if (
            this.state.phase === 'preflop' &&
            this.state.preflopRaiseCount === 1 &&
            !player.stats.facedOpenRaiseCountedThisHand
        ) {
            player.stats.facedOpenRaiseCount += 1;
            player.stats.facedOpenRaiseCountedThisHand = true;
        }

        if (
            this.state.phase === 'flop' &&
            this.state.preflopAggressorId === player.id &&
            this.state.currentBet === 0 &&
            !player.stats.cBetOpportunityCountedThisHand
        ) {
            player.stats.cBetOpportunityCount += 1;
            player.stats.cBetOpportunityCountedThisHand = true;
        }

        if (this.state.cBetActive && !player.stats.cBetFacedCountedThisHand) {
            player.stats.cBetFaced += 1;
            player.stats.cBetFacedCountedThisHand = true;
        }
    }

    _applyAction(playerId, action) {
        const player = this._getPlayer(playerId);
        const callAmount = Math.max(0, this.state.currentBet - player.bet);

        switch (action.type) {
            case 'fold':
                if (this.state.cBetActive) {
                    player.stats.foldToCBetCount += 1;
                }
                player.folded = true;
                return { type: 'fold' };
            case 'check':
                return { type: 'check' };
            case 'call': {
                const amountToCall = Math.min(callAmount, player.chips);

                if (this.state.phase === 'preflop' && amountToCall > 0 && !player.stats.vpipCountedThisHand) {
                    player.stats.vpipCount += 1;
                    player.stats.vpipCountedThisHand = true;
                }

                player.chips -= amountToCall;
                player.bet += amountToCall;
                player.totalContribution += amountToCall;
                player.allIn = player.chips === 0;
                this.state.pot += amountToCall;

                return { type: player.allIn ? 'allin' : 'call', amount: amountToCall };
            }
            case 'raise':
                return this._applyRaise(player, action.totalBet);
            case 'allin':
                return this._applyAllIn(player);
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }

    _applyRaise(player, totalBet) {
        const previousCurrentBet = this.state.currentBet;
        const raiseAmount = totalBet - player.bet;
        const actualRaise = totalBet - previousCurrentBet;

        this._trackAggressiveAction(player.id, previousCurrentBet === 0);

        player.chips -= raiseAmount;
        player.bet = totalBet;
        player.totalContribution += raiseAmount;
        player.allIn = player.chips === 0;

        this.state.pot += raiseAmount;
        this.state.currentBet = totalBet;
        this.state.minRaise = Math.max(this.state.minRaise, actualRaise);

        return {
            type: player.allIn ? 'allin' : 'raise',
            totalBet
        };
    }

    _applyAllIn(player) {
        const previousCurrentBet = this.state.currentBet;
        const allInAmount = player.chips;
        const newBet = player.bet + allInAmount;

        if (this.state.phase === 'preflop' && allInAmount > 0 && !player.stats.vpipCountedThisHand) {
            player.stats.vpipCount += 1;
            player.stats.vpipCountedThisHand = true;
        }

        player.chips = 0;
        player.bet = newBet;
        player.totalContribution += allInAmount;
        player.allIn = true;
        this.state.pot += allInAmount;

        if (newBet > previousCurrentBet) {
            this._trackAggressiveAction(player.id, previousCurrentBet === 0);
            this.state.minRaise = Math.max(this.state.minRaise, newBet - previousCurrentBet);
            this.state.currentBet = newBet;
        }

        return {
            type: 'allin',
            totalBet: newBet
        };
    }

    _trackAggressiveAction(playerId, isOpeningBet) {
        const player = this._getPlayer(playerId);

        if (this.state.phase === 'preflop') {
            if (!player.stats.vpipCountedThisHand) {
                player.stats.vpipCount += 1;
                player.stats.vpipCountedThisHand = true;
            }

            if (!player.stats.pfrCountedThisHand) {
                player.stats.pfrCount += 1;
                player.stats.pfrCountedThisHand = true;
            }

            this.state.preflopRaiseCount += 1;
            if (this.state.preflopRaiseCount === 2 && !player.stats.threeBetCountedThisHand) {
                player.stats.threeBetCount += 1;
                player.stats.threeBetCountedThisHand = true;
            }

            this.state.preflopAggressorId = playerId;
            return;
        }

        if (
            this.state.phase === 'flop' &&
            playerId === this.state.preflopAggressorId &&
            isOpeningBet &&
            !player.stats.cBetCountedThisHand
        ) {
            player.stats.cBetCount += 1;
            player.stats.cBetCountedThisHand = true;
            this.state.cBetActive = true;
            return;
        }

        this.state.cBetActive = false;
    }

    _advanceTurn() {
        const nextPlayerId = this._getNextActingPlayerId(this.state.currentPlayerIndex);

        if (nextPlayerId === null) {
            this.state.currentPlayerIndex = -1;
            return false;
        }

        this.state.currentPlayerIndex = nextPlayerId;
        return true;
    }

    _isBettingRoundComplete() {
        const actingPlayers = this._getActingPlayers();

        if (actingPlayers.length === 0) {
            return true;
        }

        if (actingPlayers.length === 1 && actingPlayers.every(player => player.bet === this.state.currentBet)) {
            return true;
        }

        const allHaveActed = actingPlayers.every(player => this._playersActedSinceLastRaise.has(player.id));
        const allBetsMatched = actingPlayers.every(player => player.bet === this.state.currentBet);

        return allHaveActed && allBetsMatched;
    }

    _shouldSkipBettingRound() {
        const actingPlayers = this._getActingPlayers();

        if (actingPlayers.length === 0) {
            return true;
        }

        return actingPlayers.length === 1 && actingPlayers.every(player => player.bet === this.state.currentBet);
    }

    _completeBettingRound() {
        if (this._getPlayersInHand().length <= 1) {
            this._clearCurrentRoundBets();
            this._resolveShowdown();
            return;
        }

        if (this.state.phase === 'river') {
            this._clearCurrentRoundBets();
            this._resolveShowdown();
            return;
        }

        this._advancePhase();
    }

    _advancePhase() {
        this._clearCurrentRoundBets();

        if (this.state.phase === 'preflop') {
            this.state.phase = 'flop';
            this._dealCommunityCards(3);
        } else if (this.state.phase === 'flop') {
            this.state.phase = 'turn';
            this._dealCommunityCards(1);
        } else if (this.state.phase === 'turn') {
            this.state.phase = 'river';
            this._dealCommunityCards(1);
        }

        this.emit('phase_changed', {
            phase: this.state.phase,
            communityCards: cloneValue(this.state.communityCards)
        });

        this._startBettingRound(this._getPostFlopStartPlayerId());
    }

    _dealCommunityCards(count) {
        this._drawCard();

        for (let index = 0; index < count; index += 1) {
            this.state.communityCards.push(this._drawCard());
        }
    }

    _clearCurrentRoundBets() {
        for (const player of this.state.players) {
            if (!player) {
                continue;
            }

            player.bet = 0;
        }

        this.state.currentBet = 0;
        this.state.minRaise = this.config.bigBlind;
        this.state.cBetActive = false;
        this.state.currentPlayerIndex = -1;
    }

    _resolveShowdown() {
        this.state.phase = 'showdown';
        this.state.currentPlayerIndex = -1;
        this._applySettlement(this._buildHandSettlement());
    }

    _buildHandSettlement() {
        const playersInHand = this._getPlayersInHand();
        const totalPot = this.state.players
            .filter(Boolean)
            .reduce((sum, player) => sum + player.totalContribution, 0);

        if (playersInHand.length <= 1) {
            const winner = playersInHand[0];
            const payouts = winner && totalPot > 0
                ? [{ playerId: winner.id, amount: totalPot }]
                : [];

            return {
                results: [],
                pots: [],
                payouts,
                winners: payouts.map(payout => payout.playerId),
                amounts: createAmountsObject(payouts),
                showdownParticipantIds: []
            };
        }

        const results = playersInHand.map(player => ({
            playerId: player.id,
            hand: evaluateHand([
                ...player.cards,
                ...this.state.communityCards
            ])
        }));
        const handResultsByPlayerId = new Map(
            results.map(result => [result.playerId, result.hand])
        );
        const pots = calculatePots(this.state.players.filter(Boolean));
        const payouts = [];

        for (const pot of pots) {
            const eligiblePlayers = pot.eligiblePlayerIds
                .map(playerId => ({
                    id: playerId,
                    handResult: handResultsByPlayerId.get(playerId)
                }))
                .filter(player => player.handResult);

            let bestScore = -1;
            let winners = [];

            for (const player of eligiblePlayers) {
                if (player.handResult.score > bestScore) {
                    bestScore = player.handResult.score;
                    winners = [player];
                } else if (player.handResult.score === bestScore) {
                    winners.push(player);
                }
            }

            const winnerIds = winners.map(player => player.id);
            const splitPayouts = splitPot(
                pot.amount,
                winnerIds,
                this._getSeatOrderFromDealer(winnerIds)
            );

            payouts.push(...splitPayouts);
        }

        return {
            results,
            pots,
            payouts,
            winners: [...new Set(payouts.map(payout => payout.playerId))],
            amounts: createAmountsObject(payouts),
            showdownParticipantIds: playersInHand.map(player => player.id)
        };
    }

    _applySettlement(settlement) {
        this._rollbackSettlement();
        this._clearHandResults();

        for (const result of settlement.results) {
            const player = this._getPlayer(result.playerId);

            if (!player) {
                continue;
            }

            player.stats.showdownCount += 1;
            player.handResult = cloneValue(result.hand);
        }

        for (const payout of settlement.payouts) {
            const player = this._getPlayer(payout.playerId);

            if (player) {
                player.chips += payout.amount;
            }
        }

        this.state.pot = 0;

        const settledHand = {
            ...cloneValue(settlement),
            settlementId: ++this._settlementSequence
        };

        this._lastHandSettlement = settledHand;

        if (settledHand.results.length > 0) {
            this.emit('showdown', {
                results: cloneValue(settledHand.results),
                pots: cloneValue(settledHand.pots),
                winners: [...settledHand.winners],
                amounts: { ...settledHand.amounts },
                settlementId: settledHand.settlementId
            });
        }

        this.emit('hand_complete', {
            winners: [...settledHand.winners],
            amounts: { ...settledHand.amounts },
            players: this.getFullState().players,
            results: cloneValue(settledHand.results),
            pots: cloneValue(settledHand.pots),
            settlementId: settledHand.settlementId
        });
    }

    _rollbackSettlement() {
        if (!this._lastHandSettlement) {
            return;
        }

        for (const payout of this._lastHandSettlement.payouts) {
            const player = this._getPlayer(payout.playerId);

            if (player) {
                player.chips -= payout.amount;
            }
        }

        for (const playerId of this._lastHandSettlement.showdownParticipantIds) {
            const player = this._getPlayer(playerId);

            if (player) {
                player.stats.showdownCount = Math.max(0, player.stats.showdownCount - 1);
            }
        }

        this._clearHandResults();
        this._lastHandSettlement = null;
    }

    _clearHandResults() {
        for (const player of this.state.players) {
            if (!player || !Object.prototype.hasOwnProperty.call(player, 'handResult')) {
                continue;
            }

            delete player.handResult;
        }
    }

    _shouldResettleShowdownForRemoval(playerId) {
        if (!this._lastHandSettlement) {
            return false;
        }

        return this._lastHandSettlement.showdownParticipantIds.includes(playerId) ||
            this._lastHandSettlement.winners.includes(playerId);
    }

    _getPreflopStartPlayerId() {
        if (this._getPlayersWithChips().length === 2) {
            return this._smallBlindPlayerId;
        }

        return this._getNextActingPlayerId(this._bigBlindPlayerId);
    }

    _getPostFlopStartPlayerId() {
        return this._getNextActingPlayerId(this.state.dealerIndex);
    }

    _getDealingOrder() {
        const order = [];
        let currentPlayerId = this._getNextEligiblePlayerId(this.state.dealerIndex);

        for (let count = 0; count < this._getPlayersWithChips().length; count += 1) {
            order.push(currentPlayerId);
            currentPlayerId = this._getNextEligiblePlayerId(currentPlayerId);
        }

        return order;
    }

    _getSeatOrderFromDealer(playerIds) {
        const targetPlayerIds = new Set(playerIds);
        const seatedPlayerIds = this.state.players
            .filter(Boolean)
            .map(player => player.id)
            .sort((left, right) => left - right);
        const seatingOrder = [];
        const dealerPosition = seatedPlayerIds.indexOf(this.state.dealerIndex);
        const startPosition = dealerPosition === -1 ? 0 : (dealerPosition + 1) % seatedPlayerIds.length;

        for (let count = 0; count < seatedPlayerIds.length; count += 1) {
            const currentPlayerId = seatedPlayerIds[(startPosition + count) % seatedPlayerIds.length];
            if (targetPlayerIds.has(currentPlayerId)) {
                seatingOrder.push(currentPlayerId);
            }
        }

        return seatingOrder;
    }

    _getPlayer(playerId) {
        return this.state.players.find(player => player?.id === playerId) ?? null;
    }

    _getPlayersWithChips() {
        return this.state.players.filter(player => player && !player.isRemoved && player.chips > 0);
    }

    _getPlayersInHand() {
        return this.state.players.filter(player => player && !player.isRemoved && !player.folded);
    }

    _getActivePlayers() {
        return this._getPlayersInHand().filter(player => !player.allIn && player.chips > 0);
    }

    _getActingPlayers() {
        return this._getActivePlayers();
    }

    _getNextEligiblePlayerId(fromPlayerId) {
        return this._getNextPlayerId(fromPlayerId, player => !player.isRemoved && player.chips > 0);
    }

    _getNextActingPlayerId(fromPlayerId) {
        return this._getNextPlayerId(fromPlayerId, player => !player.isRemoved && !player.folded && !player.allIn && player.chips > 0);
    }

    _getNextSeatedPlayerId(fromPlayerId) {
        return this._getNextPlayerId(fromPlayerId, player => !player.isRemoved);
    }

    _getNextPlayerId(fromPlayerId, predicate) {
        const seatedPlayers = this.state.players.filter(Boolean);

        if (seatedPlayers.length === 0) {
            return null;
        }

        const orderedIds = seatedPlayers.map(player => player.id).sort((left, right) => left - right);
        const currentIndex = orderedIds.indexOf(fromPlayerId);
        const startIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % orderedIds.length;

        for (let offset = 0; offset < orderedIds.length; offset += 1) {
            const candidateId = orderedIds[(startIndex + offset) % orderedIds.length];
            const candidate = this._getPlayer(candidateId);

            if (candidate && predicate(candidate)) {
                return candidateId;
            }
        }

        return null;
    }

    _drawCard() {
        return this.state.deck.pop();
    }
}
