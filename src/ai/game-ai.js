import { BIG_BLIND } from '../state/game-state.js';
import { getCardValue } from '../core/cards.js';
import { evaluateHand } from '../core/hand-evaluator.js';

const BUCKET_PREMIUM = [
    'AA', 'KK', 'QQ', 'JJ', 'TT',
    'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs',
    'AKo', 'AQo'
];

const BUCKET_STRONG = [
    '99', '88', '77', '66',
    'T9s', '98s', '87s', 'JTs', 'QTs', 'KTs',
    'A5s', 'A4s', 'A3s',
    'AJo', 'KQo'
];

const BUCKET_SPECULATIVE = [
    '55', '44', '33', '22',
    'A9s', 'A8s', 'A7s', 'A6s', 'A2s',
    'K9s', 'K8s', 'Q9s', 'J9s', 'T8s', '97s', '86s', '75s', '76s', '65s',
    'ATo', 'KTo', 'QTo', 'JTo', 'A9o', 'KJo', 'QJo',
    'T9o', '98o', 'J9o'
];

const BUCKET_WEAK = [
    'K7s', 'K6s', 'K5s', 'K4s', 'K3s',
    'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s',
    'J8s', 'J7s', 'J6s', 'J5s',
    'T7s', 'T6s', '96s', '85s', '74s', '64s', '63s', '53s', '54s', '43s',
    'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o',
    'K9o', 'K8o', 'K7o', 'K6o',
    'Q9o', 'Q8o', 'Q7o', 'J8o',
    'T8o', 'T7o', '97o', '87o', '86o', '76o', '75o', '65o'
];

const BET_SIZES = { HALF: 0.5, POT: 1.0, DOUBLE: 2.0 };

export function getHandNotation(card1, card2) {
    const v1 = card1.value === '10' ? 'T' : card1.value;
    const v2 = card2.value === '10' ? 'T' : card2.value;
    const val1 = getCardValue(card1.value);
    const val2 = getCardValue(card2.value);

    const [high, low] = val1 >= val2 ? [v1, v2] : [v2, v1];
    const suited = card1.suit === card2.suit;

    if (high === low) {
        return high + low;
    }

    return high + low + (suited ? 's' : 'o');
}

export function getHandBucket(card1, card2) {
    const notation = getHandNotation(card1, card2);

    if (BUCKET_PREMIUM.includes(notation)) return 'premium';
    if (BUCKET_STRONG.includes(notation)) return 'strong';
    if (BUCKET_SPECULATIVE.includes(notation)) return 'speculative';
    if (BUCKET_WEAK.includes(notation)) return 'weak';
    return 'trash';
}

export function getPosition({ players, dealerIndex, playerId }) {
    const seatedPlayers = players.filter(player => !player.isRemoved);
    const numSeated = seatedPlayers.length;
    const dealerSeatedIndex = seatedPlayers.findIndex(player => player.id === dealerIndex);
    const targetSeatedIndex = seatedPlayers.findIndex(player => player.id === playerId);

    if (dealerSeatedIndex === -1 || targetSeatedIndex === -1) {
        return 'late';
    }

    const posFromDealer =
        (targetSeatedIndex - dealerSeatedIndex + numSeated) % numSeated;

    if (numSeated <= 3) {
        if (posFromDealer === 0) return 'late';
        return 'blinds';
    }

    if (posFromDealer === 0) return 'late';
    if (posFromDealer <= 2) return 'blinds';
    if (posFromDealer === 3) return 'early';
    if (posFromDealer === 4) return 'middle';
    return 'late';
}

export function evaluateDraws(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const draws = {
        flushDraw: false,
        openEndedStraight: false,
        gutshot: false,
        backdoorFlush: false,
        outs: 0
    };

    if (communityCards.length < 3) return draws;

    const suitCounts = {};
    for (const card of allCards) {
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }

    for (const count of Object.values(suitCounts)) {
        if (count === 4) {
            draws.flushDraw = true;
            draws.outs += 9;
        } else if (count === 3 && communityCards.length === 3) {
            draws.backdoorFlush = true;
            draws.outs += 1.5;
        }
    }

    const values = allCards.map(card => getCardValue(card.value));
    const uniqueValues = [...new Set(values)].sort((left, right) => left - right);

    for (let index = 0; index <= uniqueValues.length - 4; index++) {
        const span = uniqueValues[index + 3] - uniqueValues[index];

        if (span === 3) {
            if (uniqueValues[index] > 2 && uniqueValues[index + 3] < 14) {
                draws.openEndedStraight = true;
                draws.outs += 8;
            } else {
                draws.gutshot = true;
                draws.outs += 4;
            }
            break;
        } else if (span === 4) {
            draws.gutshot = true;
            draws.outs += 4;
            break;
        }
    }

    return draws;
}

export function evaluateAIHand({ player, communityCards }) {
    const allCards = [...player.cards, ...communityCards];

    if (allCards.length < 2) return 0.3;

    if (communityCards.length === 0) {
        const values = player.cards
            .map(card => getCardValue(card.value))
            .sort((left, right) => right - left);
        const suited = player.cards[0].suit === player.cards[1].suit;
        const paired = values[0] === values[1];

        let strength = 0.2;

        if (paired) {
            strength = 0.4 + (values[0] / 14) * 0.4;
        } else if (values[0] >= 12 && values[1] >= 10) {
            strength = 0.5 + (suited ? 0.1 : 0);
        } else if (values[0] >= 10) {
            strength = 0.35 + (suited ? 0.1 : 0);
        } else if (suited && Math.abs(values[0] - values[1]) <= 2) {
            strength = 0.35;
        }

        return strength;
    }

    const hand = evaluateHand(allCards);
    return hand.rank / 10;
}

export function getOpponentProfile(player) {
    const stats = player.stats;
    const hands = Math.max(1, stats.handsPlayed);

    return {
        vpip: stats.vpipCount / hands,
        pfr: stats.pfrCount / hands,
        threeBet: stats.threeBetCount / Math.max(1, stats.facedOpenRaiseCount),
        cBet: stats.cBetCount / Math.max(1, stats.cBetOpportunityCount),
        foldToCBet: stats.foldToCBetCount / Math.max(1, stats.cBetFaced),
        showdownRate: stats.showdownCount / hands,
        isTight: stats.vpipCount / hands < 0.20,
        isLoose: stats.vpipCount / hands > 0.40,
        isAggressive: stats.pfrCount / hands > 0.25
    };
}

export function calculateBetAmount({ gameState, playerId, multiplier }) {
    const player = gameState.players[playerId];
    const potSize = gameState.pot;
    const betAmount = Math.floor(potSize * multiplier);
    const minBet = gameState.currentBet + gameState.minRaise;
    const maxBet = player.chips + player.bet;

    return Math.min(maxBet, Math.max(minBet, betAmount));
}

export function calculateWinProbability({
    player,
    communityCards,
    phase,
    random = Math.random
}) {
    if (phase === 'preflop') {
        const bucket = getHandBucket(player.cards[0], player.cards[1]);

        switch (bucket) {
            case 'premium':
                return 0.75 + random() * 0.1;
            case 'strong':
                return 0.55 + random() * 0.1;
            case 'speculative':
                return 0.40 + random() * 0.1;
            case 'weak':
                return 0.30 + random() * 0.05;
            default:
                return 0.20 + random() * 0.05;
        }
    }

    const allCards = [...player.cards, ...communityCards];
    const hand = evaluateHand(allCards);
    const madeHandStrength = hand.rank / 10;
    const draws = evaluateDraws(player.cards, communityCards);

    let drawEquity = 0;
    const cardsToCome = phase === 'flop' ? 2 : (phase === 'turn' ? 1 : 0);
    if (cardsToCome > 0) {
        drawEquity = Math.min(0.45, (draws.outs * 2 * cardsToCome) / 100);
    }

    return Math.min(0.95, madeHandStrength + drawEquity * (1 - madeHandStrength));
}

function getMainOpponent(gameState, playerId) {
    const opponents = gameState.players.filter(
        player => player.id !== playerId && !player.folded && !player.isRemoved
    );

    return opponents[0] || gameState.players[0];
}

function decideEasyAction({ gameState, playerId, random }) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const handStrength = evaluateAIHand({
        player,
        communityCards: gameState.communityCards
    });
    const decisionRoll = random();

    if (handStrength > 0.7) {
        if (decisionRoll > 0.3) {
            const totalBet = Math.min(
                gameState.currentBet + gameState.minRaise + Math.floor(random() * 50),
                player.chips + player.bet
            );

            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'call' };
        }
        return { type: 'call' };
    }

    if (handStrength > 0.4) {
        if (callAmount === 0) {
            return { type: 'check' };
        } else if (callAmount <= player.chips * 0.2 || decisionRoll > 0.3) {
            return { type: 'call' };
        }
        return { type: 'fold' };
    }

    if (handStrength > 0.2) {
        if (callAmount === 0) {
            if (decisionRoll > 0.7) {
                const totalBet = gameState.currentBet + gameState.minRaise;
                if (totalBet <= player.chips + player.bet) {
                    return { type: 'raise', totalBet };
                }
            }
            return { type: 'check' };
        } else if (callAmount <= player.chips * 0.1) {
            return { type: 'call' };
        }
        return { type: 'fold' };
    }

    if (callAmount === 0) {
        return { type: 'check' };
    } else if (callAmount <= player.chips * 0.05 && decisionRoll > 0.5) {
        return { type: 'call' };
    }
    return { type: 'fold' };
}

function decideEnhancedPreflopAction({ gameState, playerId, random }) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const bucket = getHandBucket(player.cards[0], player.cards[1]);
    const position = getPosition({
        players: gameState.players,
        dealerIndex: gameState.dealerIndex,
        playerId
    });
    const decisionRoll = random();
    const opponentProfile = getOpponentProfile(getMainOpponent(gameState, playerId));

    const positionBonus = position === 'blinds'
        ? 0.15
        : (position === 'late' ? 0.1 : (position === 'middle' ? 0.025 : 0));
    const stealMore = opponentProfile.isTight ? 0.1 : 0;
    const trapMore = opponentProfile.isAggressive ? 0.15 : 0;

    if (bucket === 'premium') {
        if (decisionRoll < 0.20 + trapMore && callAmount > 0) {
            return { type: 'call' };
        }

        const sizeMult = opponentProfile.isLoose ? BET_SIZES.POT : BET_SIZES.HALF;
        const totalBet = calculateBetAmount({
            gameState,
            playerId,
            multiplier: sizeMult
        });

        return totalBet > gameState.currentBet
            ? { type: 'raise', totalBet }
            : { type: 'call' };
    } else if (bucket === 'strong') {
        if (callAmount === 0) {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.HALF
            });
            if (decisionRoll < 0.75 + positionBonus && totalBet > gameState.currentBet) {
                return { type: 'raise', totalBet };
            }
            return { type: 'check' };
        } else if (callAmount <= Math.max(player.chips * 0.15, BIG_BLIND)) {
            if (decisionRoll < 0.25) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.POT
                });
                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'call' };
            }
            return { type: 'call' };
        }
        return decisionRoll < 0.6 ? { type: 'call' } : { type: 'fold' };
    } else if (bucket === 'speculative') {
        if (callAmount === 0) {
            if (decisionRoll < 0.4 + positionBonus + stealMore) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.HALF
                });
                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'check' };
            }
            return { type: 'check' };
        } else if (callAmount <= Math.max(player.chips * 0.08, BIG_BLIND)) {
            return decisionRoll < 0.85 ? { type: 'call' } : { type: 'fold' };
        } else if (callAmount <= Math.max(player.chips * 0.15, BIG_BLIND)) {
            return decisionRoll < 0.5 ? { type: 'call' } : { type: 'fold' };
        }
        return decisionRoll < 0.25 ? { type: 'call' } : { type: 'fold' };
    } else if (bucket === 'weak') {
        if (callAmount === 0 && decisionRoll < 0.25 + stealMore && position === 'late') {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.HALF
            });
            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'check' };
        } else if (callAmount === 0) {
            return { type: 'check' };
        } else if (callAmount <= Math.max(player.chips * 0.05, BIG_BLIND)) {
            return decisionRoll < 0.5 ? { type: 'call' } : { type: 'fold' };
        } else if (callAmount <= Math.max(player.chips * 0.1, BIG_BLIND)) {
            return decisionRoll < 0.25 ? { type: 'call' } : { type: 'fold' };
        }
        return { type: 'fold' };
    }

    if (callAmount === 0) {
        return { type: 'check' };
    } else if (callAmount <= Math.max(player.chips * 0.03, BIG_BLIND)) {
        return decisionRoll < 0.2 ? { type: 'call' } : { type: 'fold' };
    }
    return { type: 'fold' };
}

function decideEnhancedPostflopAction({ gameState, playerId, random }) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const winProb = calculateWinProbability({
        player,
        communityCards: gameState.communityCards,
        phase: gameState.phase,
        random
    });
    const position = getPosition({
        players: gameState.players,
        dealerIndex: gameState.dealerIndex,
        playerId
    });
    const decisionRoll = random();
    const opponentProfile = getOpponentProfile(getMainOpponent(gameState, playerId));

    const potOdds = callAmount > 0 ? callAmount / (gameState.pot + callAmount) : 0;
    const hasGoodOdds = winProb > potOdds;

    const positionBonus = position === 'late' ? 0.08 : 0;
    const bluffMore = opponentProfile.foldToCBet > 0.6 ? 0.15 : 0;
    const trapMore = opponentProfile.isAggressive ? 0.12 : 0;
    const valueOnly = opponentProfile.showdownRate > 0.35;

    const draws = evaluateDraws(player.cards, gameState.communityCards);
    const hasStrongDraw = draws.flushDraw || draws.openEndedStraight;

    if (winProb >= 0.7) {
        if (decisionRoll < 0.20 + trapMore && callAmount > 0) {
            return { type: 'call' };
        } else if (callAmount === 0) {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: decisionRoll < 0.5 ? BET_SIZES.HALF : BET_SIZES.POT
            });
            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'check' };
        } else if (decisionRoll < 0.6) {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.POT
            });
            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'call' };
        }
        return { type: 'call' };
    } else if (winProb >= 0.4 || hasStrongDraw) {
        if (callAmount === 0) {
            const betChance = hasStrongDraw ? 0.5 : 0.25;
            if (decisionRoll < betChance + positionBonus + bluffMore) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.HALF
                });
                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'check' };
            }
            return { type: 'check' };
        } else if (hasGoodOdds || hasStrongDraw) {
            if (decisionRoll < 0.15 && hasStrongDraw) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.POT
                });
                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'call' };
            }
            return { type: 'call' };
        } else if (decisionRoll < 0.3) {
            return { type: 'call' };
        }
        return { type: 'fold' };
    } else if (winProb >= 0.2) {
        if (callAmount === 0) {
            const bluffChance = valueOnly ? 0.02 : (0.08 + positionBonus + bluffMore);
            if (decisionRoll < bluffChance) {
                const totalBet = calculateBetAmount({
                    gameState,
                    playerId,
                    multiplier: BET_SIZES.HALF
                });
                return totalBet > gameState.currentBet
                    ? { type: 'raise', totalBet }
                    : { type: 'check' };
            }
            return { type: 'check' };
        } else if (hasGoodOdds && callAmount <= player.chips * 0.1) {
            return decisionRoll < 0.4 ? { type: 'call' } : { type: 'fold' };
        }
        return { type: 'fold' };
    }

    if (callAmount === 0) {
        const bluffChance = valueOnly ? 0 : (0.03 + bluffMore);
        if (decisionRoll < bluffChance && position === 'late') {
            const totalBet = calculateBetAmount({
                gameState,
                playerId,
                multiplier: BET_SIZES.HALF
            });
            return totalBet > gameState.currentBet
                ? { type: 'raise', totalBet }
                : { type: 'check' };
        }
        return { type: 'check' };
    }

    return { type: 'fold' };
}

export function decideAIAction({
    gameState,
    playerId,
    random = Math.random
}) {
    const player = gameState.players[playerId];

    if (!player || player.folded || player.allIn || player.isRemoved) {
        return null;
    }

    if (player.aiLevel === 'easy') {
        return decideEasyAction({ gameState, playerId, random });
    }

    if (gameState.phase === 'preflop') {
        return decideEnhancedPreflopAction({ gameState, playerId, random });
    }

    return decideEnhancedPostflopAction({ gameState, playerId, random });
}
