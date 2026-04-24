import { GameEngine } from '../../src/engine/game-engine.js';

function isSocketOpen(socket) {
    return Boolean(socket) && (socket.readyState === undefined || socket.readyState === 1);
}

function sortBySeat(left, right) {
    return left.seat - right.seat;
}

function isPresent(value) {
    return value !== null && value !== undefined;
}

export class GameSession {
    constructor({ roomId, config = {} }) {
        this.roomId = roomId;
        this.config = {
            name: 'Practice Table',
            maxPlayers: 6,
            smallBlind: 10,
            bigBlind: 20,
            startingChips: 1000,
            actionTimeoutMs: 30000,
            autoStartMinPlayers: 2,
            autoRestartDelayMs: 1500,
            ...config
        };
        this._setTimeout = this.config.setTimeout ?? globalThis.setTimeout;
        this._clearTimeout = this.config.clearTimeout ?? globalThis.clearTimeout;

        const engineConfig = {
            maxPlayers: this.config.maxPlayers,
            smallBlind: this.config.smallBlind,
            bigBlind: this.config.bigBlind,
            startingChips: this.config.startingChips,
            actionTimeoutMs: this.config.actionTimeoutMs
        };

        if (typeof this.config.deckFactory === 'function') {
            engineConfig.deckFactory = this.config.deckFactory;
        }

        if (typeof this.config.random === 'function') {
            engineConfig.random = this.config.random;
        }

        this.engine = new GameEngine(engineConfig);
        this.playersByUserId = new Map();
        this.userIdBySeat = new Map();
        this.connections = new Map();
        this.departedPlayersByUserId = new Map();
        this._autoRestartTimer = null;
        this._actionTimeout = null;
        this._pendingBlindMessage = null;
        this._pendingHandStartRecipients = 0;

        this._bindEngineEvents();
    }

    join({ userId, username, socket }) {
        if (this.playersByUserId.has(userId)) {
            const existingPlayer = this.playersByUserId.get(userId);
            this.connections.set(userId, socket);
            this._sendToUser(userId, this._createRoomJoinedMessage(existingPlayer.seat));
            return this._createJoinResult(existingPlayer.seat);
        }

        const returningPlayer = this._getReturningPlayer(userId);
        const seat = returningPlayer?.seat ?? this._findOpenSeat();

        this.playersByUserId.set(userId, {
            userId,
            username,
            seat
        });
        this.userIdBySeat.set(seat, userId);
        this.connections.set(userId, socket);
        if (returningPlayer) {
            this.engine.resumePlayer({
                id: seat,
                name: username,
                isAI: false
            });
        } else if (this.engine.state.phase === 'idle') {
            this.engine.addPlayer({
                id: seat,
                name: username,
                isAI: false,
                chips: this.config.startingChips
            });
        } else {
            this.engine.restorePlayer({
                id: seat,
                name: username,
                isAI: false,
                chips: this.config.startingChips
            });
        }

        this._sendToUser(userId, this._createRoomJoinedMessage(seat));
        this._broadcast({
            type: 'PLAYER_JOINED',
            data: {
                player: this._serializePlayer(userId)
            }
        }, { exceptUserId: userId });

        this._maybeStartHand();
        return this._createJoinResult(seat);
    }

    leave(userId, reason = 'left') {
        const player = this.playersByUserId.get(userId);

        if (!player) {
            return {
                roomId: this.roomId,
                becameEmpty: this.isEmpty()
            };
        }

        this._clearActionTimeout({ userId });
        this.playersByUserId.delete(userId);
        this.userIdBySeat.delete(player.seat);
        this.connections.delete(userId);
        if (this.engine.state.phase !== 'idle') {
            this.departedPlayersByUserId.set(userId, {
                seat: player.seat
            });
        }
        this.engine.removePlayer(player.seat);
        this._broadcast({
            type: 'PLAYER_LEFT',
            data: {
                playerId: userId,
                reason
            }
        });

        const becameEmpty = this.isEmpty();
        if (becameEmpty) {
            this.departedPlayersByUserId.clear();
            this.dispose();
        }

        return {
            roomId: this.roomId,
            becameEmpty
        };
    }

    handlePlayerAction(userId, action) {
        const player = this.playersByUserId.get(userId);

        if (!player) {
            throw new Error('Player is not seated in this room');
        }

        return this.engine.submitAction(player.seat, action);
    }

    getSummary() {
        return {
            roomId: this.roomId,
            name: this.config.name,
            playerCount: this.playersByUserId.size,
            maxPlayers: this.config.maxPlayers,
            smallBlind: this.config.smallBlind,
            bigBlind: this.config.bigBlind,
            status: this._getStatus()
        };
    }

    isEmpty() {
        return this.playersByUserId.size === 0;
    }

    dispose() {
        this._clearActionTimeout();
        if (this._autoRestartTimer) {
            this._clearTimeout(this._autoRestartTimer);
            this._autoRestartTimer = null;
        }
    }

    _bindEngineEvents() {
        this.engine.on('hand_start', ({ players }) => {
            this._pendingHandStartRecipients = players
                .filter(player => player && !player.isRemoved && player.chips > 0)
                .length;
            this._pendingBlindMessage = null;
        });

        this.engine.on('hole_cards_dealt', ({ playerId, cards }) => {
            const userId = this.userIdBySeat.get(playerId);
            if (userId) {
                this._sendToUser(userId, {
                    type: 'HAND_START',
                    data: {
                        handNumber: this.engine.state.handNumber,
                        dealerIndex: this.engine.state.dealerIndex,
                        players: this._serializePlayers(),
                        yourCards: cards
                    }
                });
            }

            this._pendingHandStartRecipients = Math.max(0, this._pendingHandStartRecipients - 1);
            if (this._pendingHandStartRecipients === 0 && this._pendingBlindMessage) {
                this._broadcast(this._pendingBlindMessage);
                this._pendingBlindMessage = null;
            }
        });

        this.engine.on('blinds_posted', ({ smallBlind, bigBlind }) => {
            const blindMessage = {
                type: 'BLINDS',
                data: {
                    smallBlind: {
                        playerId: this.userIdBySeat.get(smallBlind.playerId),
                        amount: smallBlind.amount
                    },
                    bigBlind: {
                        playerId: this.userIdBySeat.get(bigBlind.playerId),
                        amount: bigBlind.amount
                    },
                    pot: this.engine.state.pot
                }
            };

            if (this._pendingHandStartRecipients > 0) {
                this._pendingBlindMessage = blindMessage;
                return;
            }

            this._broadcast(blindMessage);
        });

        this.engine.on('action_required', ({
            playerId,
            validActions,
            timeLimit,
            callAmount,
            minRaiseTo,
            maxBet
        }) => {
            this._clearActionTimeout();
            const userId = this.userIdBySeat.get(playerId);
            if (!userId) {
                return;
            }

            const timeLimitSeconds = Math.ceil(timeLimit / 1000);

            this._sendToUser(userId, {
                type: 'YOUR_TURN',
                data: {
                    validActions,
                    callAmount,
                    minRaise: minRaiseTo,
                    maxBet,
                    pot: this.engine.state.pot,
                    currentBet: this.engine.state.currentBet,
                    timeLimit: timeLimitSeconds
                }
            });
            this._broadcast({
                type: 'TURN_STARTED',
                data: {
                    playerId: userId,
                    timeLimit: timeLimitSeconds
                }
            }, { exceptUserId: userId });
            this._scheduleActionTimeout({
                userId,
                playerId,
                timeLimit
            });
        });

        this.engine.on('action_executed', ({
            playerId,
            action,
            playerState,
            pot,
            currentBet
        }) => {
            this._clearActionTimeout();
            this._broadcast({
                type: 'ACTION',
                data: {
                    playerId: this.userIdBySeat.get(playerId),
                    action,
                    chips: playerState.chips,
                    pot,
                    currentBet
                }
            });
        });

        this.engine.on('phase_changed', ({ phase, communityCards }) => {
            this._clearActionTimeout();
            this._broadcast({
                type: 'COMMUNITY',
                data: {
                    phase,
                    cards: communityCards
                }
            });
        });

        this.engine.on('showdown', ({ results, pots, amounts }) => {
            this._broadcast({
                type: 'SHOWDOWN',
                data: {
                    players: results
                        .map(result => {
                            const userId = this.userIdBySeat.get(result.playerId);
                            if (!isPresent(userId)) {
                                return null;
                            }

                            return {
                                id: userId,
                                cards: this.engine.getFullState().players[result.playerId]?.cards ?? [],
                                handName: result.hand.name,
                                handRank: result.hand.rank
                            };
                        })
                        .filter(isPresent),
                    communityCards: this.engine.state.communityCards,
                    pots: pots.map((pot, index) => ({
                        name: index === 0 ? 'Main Pot' : `Side Pot ${index}`,
                        amount: pot.amount,
                        winners: Object.entries(amounts)
                            .filter(([playerId]) => pot.eligiblePlayerIds.includes(Number(playerId)))
                            .map(([playerId, amount]) => {
                                const userId = this.userIdBySeat.get(Number(playerId));
                                if (!isPresent(userId)) {
                                    return null;
                                }

                                return {
                                    playerId: userId,
                                    amount
                                };
                            })
                            .filter(isPresent)
                    }))
                }
            });
        });

        this.engine.on('hand_complete', ({ winners, amounts, players }) => {
            this._clearActionTimeout();
            this._broadcast({
                type: 'HAND_COMPLETE',
                data: {
                    winners: winners
                        .map(playerId => {
                            const userId = this.userIdBySeat.get(playerId);
                            if (!isPresent(userId)) {
                                return null;
                            }

                            return {
                                playerId: userId,
                                amount: amounts[playerId] ?? 0
                            };
                        })
                        .filter(isPresent),
                    players: players
                        .filter(Boolean)
                        .map(player => {
                            const userId = this.userIdBySeat.get(player.id);
                            if (!isPresent(userId)) {
                                return null;
                            }

                            return {
                                id: userId,
                                chips: player.chips
                            };
                        })
                        .filter(isPresent),
                    nextHandIn: this.config.autoRestartDelayMs
                }
            });

            this._scheduleNextHand();
        });

        this.engine.on('error', ({ playerId, message }) => {
            const userId = this.userIdBySeat.get(playerId);

            if (userId) {
                this._sendToUser(userId, {
                    type: 'ERROR',
                    message
                });
                return;
            }

            this._broadcast({
                type: 'ERROR',
                message
            });
        });
    }

    _scheduleNextHand() {
        if (this._autoRestartTimer) {
            this._clearTimeout(this._autoRestartTimer);
        }

        this._autoRestartTimer = this._setTimeout(() => {
            this._autoRestartTimer = null;
            this._maybeStartHand();
        }, this.config.autoRestartDelayMs);
        this._autoRestartTimer?.unref?.();
    }

    _scheduleActionTimeout({ userId, playerId, timeLimit }) {
        if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
            return;
        }

        const timeoutId = this._setTimeout(() => {
            const pendingTimeout = this._actionTimeout;
            if (!pendingTimeout || pendingTimeout.timeoutId !== timeoutId) {
                return;
            }

            this._actionTimeout = null;
            this._handleActionTimeout({ userId, playerId });
        }, timeLimit);
        timeoutId?.unref?.();

        this._actionTimeout = {
            timeoutId,
            userId,
            playerId
        };
    }

    _clearActionTimeout({ userId } = {}) {
        if (!this._actionTimeout) {
            return false;
        }

        if (userId && this._actionTimeout.userId !== userId) {
            return false;
        }

        this._clearTimeout(this._actionTimeout.timeoutId);
        this._actionTimeout = null;
        return true;
    }

    _handleActionTimeout({ userId, playerId }) {
        if (this.engine.state.currentPlayerIndex !== playerId) {
            return;
        }

        if (this.userIdBySeat.get(playerId) !== userId) {
            return;
        }

        const action = this._createTimedOutAction(playerId);
        if (!action) {
            return;
        }

        this.handlePlayerAction(userId, action);
    }

    _createTimedOutAction(playerId) {
        const player = this.engine.state.players[playerId];
        if (!player || player.folded || player.allIn || player.isRemoved) {
            return null;
        }

        const callAmount = Math.max(0, this.engine.state.currentBet - player.bet);
        return callAmount === 0
            ? { type: 'check' }
            : { type: 'fold' };
    }

    _maybeStartHand() {
        if (this.playersByUserId.size < this.config.autoStartMinPlayers) {
            return;
        }

        if (this.engine.state.phase !== 'idle' && this.engine.state.phase !== 'showdown') {
            return;
        }

        this.engine.startHand();
    }

    _findOpenSeat() {
        for (let seat = 0; seat < this.config.maxPlayers; seat += 1) {
            if (!this.userIdBySeat.has(seat)) {
                return seat;
            }
        }

        throw new Error('Room is full');
    }

    _getReturningPlayer(userId) {
        const departedPlayer = this.departedPlayersByUserId.get(userId);
        if (!departedPlayer) {
            return null;
        }

        const enginePlayer = this.engine.state.players[departedPlayer.seat];
        if (!enginePlayer || !enginePlayer.isRemoved || this.userIdBySeat.has(departedPlayer.seat)) {
            this.departedPlayersByUserId.delete(userId);
            return null;
        }

        this.departedPlayersByUserId.delete(userId);
        return departedPlayer;
    }

    _createJoinResult(seat) {
        return {
            roomId: this.roomId,
            seat,
            players: this._serializePlayers()
        };
    }

    _createRoomJoinedMessage(seat) {
        return {
            type: 'ROOM_JOINED',
            roomId: this.roomId,
            seat,
            players: this._serializePlayers()
        };
    }

    _serializePlayers() {
        return Array.from(this.playersByUserId.values())
            .slice()
            .sort(sortBySeat)
            .map(player => this._serializePlayer(player.userId));
    }

    _serializePlayer(userId) {
        const player = this.playersByUserId.get(userId);
        if (!player) {
            return null;
        }

        const enginePlayer = this.engine.getFullState().players[player.seat];

        return {
            id: player.userId,
            username: player.username,
            chips: enginePlayer?.chips ?? this.config.startingChips,
            seat: player.seat
        };
    }

    _getStatus() {
        return this.playersByUserId.size >= this.config.autoStartMinPlayers &&
            this.engine.state.phase !== 'idle'
            ? 'playing'
            : 'waiting';
    }

    _sendToUser(userId, message) {
        const socket = this.connections.get(userId);
        if (!isSocketOpen(socket)) {
            return;
        }

        socket.send(JSON.stringify(message));
    }

    _broadcast(message, { exceptUserId } = {}) {
        for (const userId of this.playersByUserId.keys()) {
            if (userId === exceptUserId) {
                continue;
            }

            this._sendToUser(userId, message);
        }
    }
}
