import { evaluateHand } from '../core/hand-evaluator.js';
import { createPlayer, createInitialGameState } from '../state/game-state.js';
import { EventEmitter } from '../engine/event-emitter.js';

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
}

function createHiddenCards(count = 2) {
    return Array.from({ length: count }, () => ({
        value: '?',
        suit: '?'
    }));
}

function createInitialOnlineState() {
    return {
        ...createInitialGameState(),
        handNumber: 0,
        currentPlayerIndex: -1,
        players: []
    };
}

function sortBySeat(left, right) {
    return left.seat - right.seat;
}

export class OnlineGameClient extends EventEmitter {
    constructor({
        wsClient,
        maxSupportedPlayers = 5,
        defaultBigBlind = 20
    } = {}) {
        super();
        this.wsClient = wsClient;
        this.maxSupportedPlayers = maxSupportedPlayers;
        this.defaultBigBlind = defaultBigBlind;

        this.user = null;
        this.rooms = [];
        this.currentRoomId = null;
        this.state = createInitialOnlineState();

        this._remotePlayers = [];
        this._localSeatByRemoteId = new Map();
        this._pendingBlinds = null;
        this._pendingShowdown = null;
        this._roomSummariesById = new Map();
        this._createdRoomConfig = null;

        this._bindWebSocketEvents();
    }

    connect(options = {}) {
        return this.wsClient.connect(options);
    }

    listRooms() {
        this.wsClient.send({ type: 'LIST_ROOMS' });
        return this;
    }

    createRoom(config) {
        this._createdRoomConfig = config ? cloneValue(config) : null;
        this.wsClient.send({
            type: 'CREATE_ROOM',
            config
        });
        return this;
    }

    joinRoom(roomId) {
        this.wsClient.send({
            type: 'JOIN_ROOM',
            roomId
        });
        return this;
    }

    leaveRoom() {
        const roomId = this.currentRoomId;
        this.wsClient.send({ type: 'LEAVE_ROOM' });
        this._resetRoomState();
        this.emit('room_left', { roomId });
        return this;
    }

    submitAction(playerId, action) {
        if (playerId !== 0) {
            return { ok: false, reason: 'Only the local player can submit actions' };
        }

        if (!this.currentRoomId) {
            this.emit('error', { message: 'Not in a room' });
            return { ok: false, reason: 'Not in a room' };
        }

        this.wsClient.send({
            type: 'PLAYER_ACTION',
            action
        });
        this.state.currentPlayerIndex = -1;

        return { ok: true };
    }

    startHand() {
        return false;
    }

    addPlayer() {
        return null;
    }

    removePlayer() {
        return false;
    }

    restorePlayer() {
        return null;
    }

    cycleAILevel() {
        return null;
    }

    _bindWebSocketEvents() {
        this.wsClient.on('AUTH_OK', message => {
            this.user = cloneValue(message.user);
            this.emit('auth_ok', { user: cloneValue(this.user) });
        });

        this.wsClient.on('ROOM_LIST', message => {
            this.rooms = cloneValue(message.rooms ?? []);
            this._roomSummariesById = new Map(
                this.rooms.map(room => [room.roomId, room])
            );
            this.emit('room_list', { rooms: cloneValue(this.rooms) });
        });

        this.wsClient.on('ROOM_CREATED', message => {
            this.currentRoomId = message.roomId;
            if (this._createdRoomConfig) {
                this._roomSummariesById.set(message.roomId, {
                    roomId: message.roomId,
                    ...this._createdRoomConfig
                });
            }
            this.emit('room_created', cloneValue(message));
        });

        this.wsClient.on('ROOM_JOINED', message => {
            this._handleRoomJoined(message);
        });

        this.wsClient.on('PLAYER_JOINED', message => {
            const player = message?.data?.player;
            if (!player) {
                return;
            }

            this._upsertRemotePlayer(player);
            this._syncPlayersFromRemotePlayers();
            this.emit('player_joined', { player: cloneValue(this._getLocalPlayerByRemoteId(player.id)) });
            this.emit('room_state_updated', { players: cloneValue(this.state.players) });
        });

        this.wsClient.on('PLAYER_LEFT', message => {
            const remotePlayerId = message?.data?.playerId;
            if (!remotePlayerId) {
                return;
            }

            this._removeRemotePlayer(remotePlayerId);
            this._syncPlayersFromRemotePlayers();
            this.emit('player_left', cloneValue(message.data));
            this.emit('room_state_updated', { players: cloneValue(this.state.players) });
        });

        this.wsClient.on('BLINDS', message => {
            this._handleBlinds(message.data);
        });

        this.wsClient.on('HAND_START', message => {
            this._handleHandStart(message.data);
        });

        this.wsClient.on('YOUR_TURN', message => {
            const data = message.data ?? {};

            this.state.pot = data.pot ?? this.state.pot;
            this.state.currentBet = data.currentBet ?? this.state.currentBet;
            this.state.minRaise = Math.max(
                0,
                (data.minRaise ?? this.state.currentBet) - this.state.currentBet
            );
            this.state.currentPlayerIndex = 0;

            this.emit('action_required', {
                playerId: 0,
                validActions: cloneValue(data.validActions ?? []),
                timeLimit: data.timeLimit,
                callAmount: data.callAmount,
                minRaiseTo: data.minRaise,
                maxBet: data.maxBet
            });
        });

        this.wsClient.on('ACTION', message => {
            this._handleAction(message.data);
        });

        this.wsClient.on('COMMUNITY', message => {
            this._handleCommunity(message.data);
        });

        this.wsClient.on('SHOWDOWN', message => {
            this._pendingShowdown = cloneValue(message.data ?? null);
        });

        this.wsClient.on('HAND_COMPLETE', message => {
            this._handleHandComplete(message.data);
        });

        this.wsClient.on('ROOM_ERROR', message => {
            this.emit('error', { message: message.message });
        });

        this.wsClient.on('ERROR', message => {
            this.emit('error', { message: message.message });
        });

        this.wsClient.on('close', event => {
            this.emit('connection_closed', event);
        });

        this.wsClient.on('protocol_error', error => {
            this.emit('error', { message: error.message });
        });
    }

    _handleRoomJoined(message) {
        this.currentRoomId = message.roomId;
        this._pendingBlinds = null;
        this._pendingShowdown = null;
        this.state = createInitialOnlineState();
        this._remotePlayers = cloneValue(message.players ?? []);

        const roomSummary = this._roomSummariesById.get(message.roomId);
        if (roomSummary?.bigBlind) {
            this.defaultBigBlind = roomSummary.bigBlind;
        }

        this._syncPlayersFromRemotePlayers();

        this.emit('room_joined', {
            roomId: message.roomId,
            seat: 0,
            players: cloneValue(this.state.players)
        });
        this.emit('room_state_updated', { players: cloneValue(this.state.players) });
    }

    _handleBlinds(data) {
        if (!data) {
            return;
        }

        if (this.state.handNumber === 0 || this.state.players.length === 0) {
            this._pendingBlinds = cloneValue(data);
            return;
        }

        for (const player of this.state.players) {
            player.bet = 0;
        }

        const smallBlindSeat = this._localSeatByRemoteId.get(data.smallBlind?.playerId);
        const bigBlindSeat = this._localSeatByRemoteId.get(data.bigBlind?.playerId);

        if (smallBlindSeat !== undefined) {
            const player = this.state.players[smallBlindSeat];
            player.bet = data.smallBlind.amount;
            player.totalContribution += data.smallBlind.amount;
        }

        if (bigBlindSeat !== undefined) {
            const player = this.state.players[bigBlindSeat];
            player.bet = data.bigBlind.amount;
            player.totalContribution += data.bigBlind.amount;
        }

        this.state.phase = 'preflop';
        this.state.pot = data.pot ?? this.state.pot;
        this.state.currentBet = data.bigBlind?.amount ?? this.state.currentBet;
        this.state.minRaise = this.defaultBigBlind;

        this.emit('blinds_posted', {
            smallBlind: {
                playerId: smallBlindSeat,
                amount: data.smallBlind?.amount ?? 0
            },
            bigBlind: {
                playerId: bigBlindSeat,
                amount: data.bigBlind?.amount ?? 0
            }
        });
    }

    _handleHandStart(data) {
        if (!data) {
            return;
        }

        this._remotePlayers = cloneValue(data.players ?? []);
        this._syncPlayersFromRemotePlayers({ resetRound: true });

        this.state.handNumber = data.handNumber ?? (this.state.handNumber + 1);
        this.state.phase = 'preflop';
        this.state.communityCards = [];
        this.state.displayedCommunityCards = 0;
        this.state.pot = 0;
        this.state.currentBet = 0;
        this.state.currentPlayerIndex = -1;
        this.state.minRaise = this.defaultBigBlind;

        const selfPlayer = this.state.players[0];
        if (selfPlayer) {
            selfPlayer.cards = cloneValue(data.yourCards ?? []);
        }

        for (const player of this.state.players.slice(1)) {
            player.cards = createHiddenCards();
        }

        const dealerRemotePlayer = this._remotePlayers.find(player => player.seat === data.dealerIndex);
        this.state.dealerIndex = dealerRemotePlayer
            ? this._localSeatByRemoteId.get(dealerRemotePlayer.id) ?? 0
            : 0;

        this.emit('hand_start', {
            handNumber: this.state.handNumber,
            dealerIndex: this.state.dealerIndex,
            players: cloneValue(this.state.players)
        });

        if (this._pendingBlinds) {
            const pendingBlinds = this._pendingBlinds;
            this._pendingBlinds = null;
            this._handleBlinds(pendingBlinds);
        }

        for (const player of this.state.players) {
            this.emit('hole_cards_dealt', {
                playerId: player.id,
                cards: cloneValue(player.cards)
            });
        }
    }

    _handleAction(data) {
        if (!data) {
            return;
        }

        const player = this._getLocalPlayerByRemoteId(data.playerId);
        if (!player) {
            return;
        }

        const chipsBeforeAction = player.chips;
        const previousBet = player.bet;

        switch (data.action?.type) {
            case 'fold':
                player.folded = true;
                break;
            case 'call':
                player.bet += data.action.amount ?? 0;
                player.totalContribution += data.action.amount ?? 0;
                break;
            case 'raise': {
                const addedAmount = Math.max(0, (data.action.totalBet ?? previousBet) - previousBet);
                player.bet = data.action.totalBet ?? previousBet;
                player.totalContribution += addedAmount;
                break;
            }
            case 'allin': {
                const totalBet = data.action.totalBet ?? (previousBet + chipsBeforeAction);
                const addedAmount = Math.max(0, totalBet - previousBet);
                player.bet = totalBet;
                player.totalContribution += addedAmount;
                player.allIn = true;
                break;
            }
            default:
                break;
        }

        player.chips = data.chips ?? player.chips;
        if (player.chips === 0 && data.action?.type !== 'fold') {
            player.allIn = true;
        }

        this.state.pot = data.pot ?? this.state.pot;
        this.state.currentBet = data.currentBet ?? this.state.currentBet;
        this.state.currentPlayerIndex = -1;

        this.emit('action_executed', {
            playerId: player.id,
            action: cloneValue(data.action),
            playerState: cloneValue(player),
            chipsBeforeAction,
            pot: this.state.pot,
            currentBet: this.state.currentBet
        });
    }

    _handleCommunity(data) {
        if (!data) {
            return;
        }

        this.state.phase = data.phase ?? this.state.phase;
        this.state.communityCards = cloneValue(data.cards ?? []);
        this.state.displayedCommunityCards = 0;
        this.state.pot = this.state.pot;
        this.state.currentBet = 0;
        this.state.currentPlayerIndex = -1;
        this.state.minRaise = this.defaultBigBlind;

        for (const player of this.state.players) {
            player.bet = 0;
        }

        this.emit('phase_changed', {
            phase: this.state.phase,
            communityCards: cloneValue(this.state.communityCards)
        });
    }

    _handleHandComplete(data) {
        if (!data) {
            return;
        }

        for (const remotePlayer of data.players ?? []) {
            this._upsertRemotePlayer(remotePlayer);
        }

        this._syncPlayersFromRemotePlayers();

        if (this._pendingShowdown?.communityCards) {
            this.state.phase = 'showdown';
            this.state.communityCards = cloneValue(this._pendingShowdown.communityCards);

            for (const showdownPlayer of this._pendingShowdown.players ?? []) {
                const localPlayer = this._getLocalPlayerByRemoteId(showdownPlayer.id);
                if (!localPlayer) {
                    continue;
                }

                localPlayer.cards = cloneValue(showdownPlayer.cards ?? []);
                localPlayer.handResult = evaluateHand([
                    ...localPlayer.cards,
                    ...this.state.communityCards
                ]);
                localPlayer.folded = false;
            }
        }

        for (const player of this.state.players) {
            player.bet = 0;
        }

        this.state.pot = 0;
        this.state.currentBet = 0;
        this.state.currentPlayerIndex = -1;

        const winners = [];
        const amounts = {};

        for (const winner of data.winners ?? []) {
            const localSeat = this._localSeatByRemoteId.get(winner.playerId);

            if (localSeat === undefined) {
                continue;
            }

            winners.push(localSeat);
            amounts[localSeat] = winner.amount;
        }

        this.emit('hand_complete', {
            winners,
            amounts,
            players: cloneValue(this.state.players),
            settlementId: this.state.handNumber
        });

        this._pendingShowdown = null;
    }

    _resetRoomState() {
        this._remotePlayers = [];
        this._localSeatByRemoteId = new Map();
        this._pendingBlinds = null;
        this._pendingShowdown = null;
        this.state = createInitialOnlineState();
        this.currentRoomId = null;
    }

    _syncPlayersFromRemotePlayers({ resetRound = false } = {}) {
        const previousPlayersByRemoteId = new Map(
            this.state.players
                .filter(Boolean)
                .map(player => [player.remoteId, player])
        );
        const orderedRemotePlayers = this._getOrderedRemotePlayers();

        if (orderedRemotePlayers.length > this.maxSupportedPlayers) {
            this.emit('error', {
                message: `This client currently supports up to ${this.maxSupportedPlayers} seated players`
            });
            return;
        }

        this._localSeatByRemoteId = new Map();

        this.state.players = orderedRemotePlayers.map((remotePlayer, localSeat) => {
            const previousPlayer = previousPlayersByRemoteId.get(remotePlayer.id);
            const nextPlayer = createPlayer({
                id: localSeat,
                name: remotePlayer.username,
                displayName: remotePlayer.username,
                remoteId: remotePlayer.id,
                remoteSeat: remotePlayer.seat,
                chips: remotePlayer.chips ?? previousPlayer?.chips ?? 0,
                cards: resetRound
                    ? (remotePlayer.id === this.user?.id ? [] : createHiddenCards())
                    : (previousPlayer?.cards ?? []),
                bet: resetRound ? 0 : previousPlayer?.bet ?? 0,
                totalContribution: resetRound ? 0 : previousPlayer?.totalContribution ?? 0,
                folded: resetRound ? false : previousPlayer?.folded ?? false,
                isAI: false,
                aiLevel: null,
                allIn: resetRound ? false : previousPlayer?.allIn ?? false,
                isRemoved: false,
                stats: previousPlayer?.stats
            });

            this._localSeatByRemoteId.set(remotePlayer.id, localSeat);
            return nextPlayer;
        });
    }

    _getOrderedRemotePlayers() {
        const remotePlayers = this._remotePlayers
            .slice()
            .sort(sortBySeat);

        if (remotePlayers.length === 0) {
            return [];
        }

        const selfRemotePlayer = remotePlayers.find(player => player.id === this.user?.id) ?? remotePlayers[0];
        const highestSeat = remotePlayers.reduce((maxSeat, player) => Math.max(maxSeat, player.seat), 0);
        const seatCountHint = Math.max(highestSeat + 1, remotePlayers.length);

        return remotePlayers.sort((left, right) => {
            const leftOffset = (left.seat - selfRemotePlayer.seat + seatCountHint) % seatCountHint;
            const rightOffset = (right.seat - selfRemotePlayer.seat + seatCountHint) % seatCountHint;
            return leftOffset - rightOffset;
        });
    }

    _upsertRemotePlayer(player) {
        const nextPlayer = cloneValue(player);
        const existingIndex = this._remotePlayers.findIndex(entry => entry.id === nextPlayer.id);

        if (existingIndex === -1) {
            this._remotePlayers.push(nextPlayer);
            return;
        }

        this._remotePlayers[existingIndex] = {
            ...this._remotePlayers[existingIndex],
            ...nextPlayer
        };
    }

    _removeRemotePlayer(remotePlayerId) {
        this._remotePlayers = this._remotePlayers.filter(player => player.id !== remotePlayerId);
    }

    _getLocalPlayerByRemoteId(remotePlayerId) {
        const localSeat = this._localSeatByRemoteId.get(remotePlayerId);
        return localSeat === undefined ? null : this.state.players[localSeat] ?? null;
    }
}

export function createOnlineGameClient(options) {
    return new OnlineGameClient(options);
}
