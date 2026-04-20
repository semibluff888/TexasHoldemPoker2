import { GameEngine } from '../../src/engine/game-engine.js';

function isSocketOpen(socket) {
    return Boolean(socket) && (socket.readyState === undefined || socket.readyState === 1);
}

function sortBySeat(left, right) {
    return left.seat - right.seat;
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

        this.engine = new GameEngine({
            maxPlayers: this.config.maxPlayers,
            smallBlind: this.config.smallBlind,
            bigBlind: this.config.bigBlind,
            startingChips: this.config.startingChips,
            actionTimeoutMs: this.config.actionTimeoutMs,
            deckFactory: this.config.deckFactory,
            random: this.config.random
        });
        this.playersByUserId = new Map();
        this.userIdBySeat = new Map();
        this.connections = new Map();
        this._autoRestartTimer = null;

        this._bindEngineEvents();
    }

    join({ userId, username, socket }) {
        if (this.playersByUserId.has(userId)) {
            const existingPlayer = this.playersByUserId.get(userId);
            this.connections.set(userId, socket);
            this._sendToUser(userId, this._createRoomJoinedMessage(existingPlayer.seat));
            return this._createJoinResult(existingPlayer.seat);
        }

        const seat = this._findOpenSeat();

        this.playersByUserId.set(userId, {
            userId,
            username,
            seat
        });
        this.userIdBySeat.set(seat, userId);
        this.connections.set(userId, socket);
        this.engine.addPlayer({
            id: seat,
            name: username,
            isAI: false,
            chips: this.config.startingChips
        });

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

        this.playersByUserId.delete(userId);
        this.userIdBySeat.delete(player.seat);
        this.connections.delete(userId);
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
        if (this._autoRestartTimer) {
            clearTimeout(this._autoRestartTimer);
            this._autoRestartTimer = null;
        }
    }

    _bindEngineEvents() {
        this.engine.on('hole_cards_dealt', ({ playerId, cards }) => {
            const userId = this.userIdBySeat.get(playerId);
            if (!userId) {
                return;
            }

            this._sendToUser(userId, {
                type: 'HAND_START',
                data: {
                    handNumber: this.engine.state.handNumber,
                    dealerIndex: this.engine.state.dealerIndex,
                    players: this._serializePlayers(),
                    yourCards: cards
                }
            });
        });

        this.engine.on('blinds_posted', ({ smallBlind, bigBlind }) => {
            this._broadcast({
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
            });
        });

        this.engine.on('action_required', ({
            playerId,
            validActions,
            timeLimit,
            callAmount,
            minRaiseTo,
            maxBet
        }) => {
            const userId = this.userIdBySeat.get(playerId);
            if (!userId) {
                return;
            }

            this._sendToUser(userId, {
                type: 'YOUR_TURN',
                data: {
                    validActions,
                    callAmount,
                    minRaise: minRaiseTo,
                    maxBet,
                    pot: this.engine.state.pot,
                    currentBet: this.engine.state.currentBet,
                    timeLimit: Math.ceil(timeLimit / 1000)
                }
            });
        });

        this.engine.on('action_executed', ({
            playerId,
            action,
            playerState,
            pot,
            currentBet
        }) => {
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
                    players: results.map(result => ({
                        id: this.userIdBySeat.get(result.playerId),
                        cards: this.engine.getFullState().players[result.playerId]?.cards ?? [],
                        handName: result.hand.name,
                        handRank: result.hand.rank
                    })),
                    communityCards: this.engine.state.communityCards,
                    pots: pots.map((pot, index) => ({
                        name: index === 0 ? 'Main Pot' : `Side Pot ${index}`,
                        amount: pot.amount,
                        winners: Object.entries(amounts)
                            .filter(([playerId]) => pot.eligiblePlayerIds.includes(Number(playerId)))
                            .map(([playerId, amount]) => ({
                                playerId: this.userIdBySeat.get(Number(playerId)),
                                amount
                            }))
                    }))
                }
            });
        });

        this.engine.on('hand_complete', ({ winners, amounts, players }) => {
            this._broadcast({
                type: 'HAND_COMPLETE',
                data: {
                    winners: winners.map(playerId => ({
                        playerId: this.userIdBySeat.get(playerId),
                        amount: amounts[playerId] ?? 0
                    })),
                    players: players
                        .filter(Boolean)
                        .map(player => ({
                            id: this.userIdBySeat.get(player.id),
                            chips: player.chips
                        })),
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
            clearTimeout(this._autoRestartTimer);
        }

        this._autoRestartTimer = setTimeout(() => {
            this._autoRestartTimer = null;
            this._maybeStartHand();
        }, this.config.autoRestartDelayMs);
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
