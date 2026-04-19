function getPlayer(gameState, playerId) {
    return gameState.players.find(player => player?.id === playerId);
}

export function validateAction(gameState, playerId, action) {
    const player = getPlayer(gameState, playerId);

    if (!player) {
        return { valid: false, reason: 'Player not found' };
    }

    if (player.folded) {
        return { valid: false, reason: 'Player already folded' };
    }

    if (player.allIn) {
        return { valid: false, reason: 'Player is all-in' };
    }

    if (gameState.currentPlayerIndex !== playerId) {
        return { valid: false, reason: 'Not your turn' };
    }

    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    const minRaiseTo = gameState.currentBet + gameState.minRaise;
    const maxBet = player.bet + player.chips;

    switch (action.type) {
        case 'fold':
            return { valid: true };
        case 'check':
            if (callAmount > 0) {
                return { valid: false, reason: 'Cannot check when facing a bet' };
            }
            return { valid: true };
        case 'call':
            if (callAmount <= 0) {
                return { valid: false, reason: 'Nothing to call' };
            }
            return { valid: true };
        case 'raise':
            if (!Number.isFinite(action.totalBet) || action.totalBet < minRaiseTo) {
                return {
                    valid: false,
                    reason: `Raise must be at least ${minRaiseTo}`
                };
            }

            if (action.totalBet > maxBet) {
                return { valid: false, reason: 'Not enough chips' };
            }

            return { valid: true };
        case 'allin':
            return { valid: true };
        default:
            return {
                valid: false,
                reason: `Unknown action type: ${action.type}`
            };
    }
}

export function getValidActions(gameState, playerId) {
    const player = getPlayer(gameState, playerId);

    if (!player || player.folded || player.allIn || player.chips <= 0) {
        return [];
    }

    const callAmount = Math.max(0, gameState.currentBet - player.bet);
    const minRaiseTo = gameState.currentBet + gameState.minRaise;
    const maxBet = player.bet + player.chips;
    const actions = ['fold'];

    if (callAmount === 0) {
        actions.push('check');
    } else {
        actions.push('call');
    }

    if (maxBet >= minRaiseTo && maxBet > gameState.currentBet) {
        actions.push('raise');
    }

    actions.push('allin');
    return actions;
}
