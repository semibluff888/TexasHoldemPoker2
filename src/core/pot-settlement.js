export function calculatePots(players) {
    const contributionLevels = [...new Set(
        players
            .map(player => player.totalContribution)
            .filter(totalContribution => totalContribution > 0)
    )].sort((left, right) => left - right);

    const pots = [];
    let previousLevel = 0;

    for (const level of contributionLevels) {
        const contributors = players.filter(player => player.totalContribution >= level);
        const eligiblePlayerIds = players
            .filter(player => !player.folded && player.totalContribution >= level)
            .map(player => player.id);

        if (contributors.length === 0 || eligiblePlayerIds.length === 0) {
            previousLevel = level;
            continue;
        }

        pots.push({
            amount: (level - previousLevel) * contributors.length,
            eligiblePlayerIds,
            level
        });

        previousLevel = level;
    }

    return pots;
}

export function splitPot(amount, winnerIds, seatingOrder) {
    const uniqueWinnerIds = [...new Set(winnerIds)];

    if (uniqueWinnerIds.length === 0) {
        return [];
    }

    const orderedWinnerIds = seatingOrder.filter(playerId => uniqueWinnerIds.includes(playerId));
    const orderedUniqueWinnerCount = new Set(orderedWinnerIds).size;

    if (
        orderedWinnerIds.length !== uniqueWinnerIds.length ||
        orderedUniqueWinnerCount !== uniqueWinnerIds.length
    ) {
        throw new Error('splitPot seating order must contain every winner exactly once');
    }

    const baseShare = Math.floor(amount / orderedWinnerIds.length);
    let remainder = amount % orderedWinnerIds.length;

    return orderedWinnerIds.map(playerId => {
        const extraChip = remainder > 0 ? 1 : 0;
        remainder -= extraChip;

        return {
            playerId,
            amount: baseShare + extraChip
        };
    });
}
