export const SMALL_BLIND = 10;
export const BIG_BLIND = 20;
export const STARTING_CHIPS = 1000;

export function createDefaultStats() {
    return {
        handsPlayed: 0,
        vpipCount: 0,
        vpipCountedThisHand: false,
        pfrCount: 0,
        pfrCountedThisHand: false,
        threeBetCount: 0,
        threeBetCountedThisHand: false,
        facedOpenRaiseCount: 0,
        facedOpenRaiseCountedThisHand: false,
        cBetCount: 0,
        cBetCountedThisHand: false,
        cBetOpportunityCount: 0,
        cBetOpportunityCountedThisHand: false,
        cBetFaced: 0,
        cBetFacedCountedThisHand: false,
        foldToCBetCount: 0,
        showdownCount: 0
    };
}

export function createPlayer(overrides = {}) {
    return {
        id: -1,
        name: '',
        chips: STARTING_CHIPS,
        cards: [],
        bet: 0,
        totalContribution: 0,
        folded: false,
        isAI: false,
        aiLevel: 'medium',
        allIn: false,
        isRemoved: false,
        isPendingJoin: false,
        stats: createDefaultStats(),
        ...overrides,
        cards: overrides.cards ? [...overrides.cards] : [],
        stats: {
            ...createDefaultStats(),
            ...overrides.stats
        }
    };
}

export function createInitialGameState() {
    return {
        deck: [],
        players: [],
        communityCards: [],
        pot: 0,
        currentBet: 0,
        dealerIndex: 0,
        currentPlayerIndex: 0,
        phase: 'idle',
        minRaise: BIG_BLIND,
        displayedCommunityCards: 0,
        preflopRaiseCount: 0,
        preflopAggressorId: null,
        cBetActive: false
    };
}

export function resetPlayersForNewHand(players) {
    return players.map(player => {
        const updatedPlayer = {
            ...player,
            cards: [],
            bet: 0,
            totalContribution: 0,
            folded: false,
            allIn: false,
            isPendingJoin: false,
            stats: {
                ...createDefaultStats(),
                ...player.stats
            }
        };

        updatedPlayer.stats.vpipCountedThisHand = false;
        updatedPlayer.stats.pfrCountedThisHand = false;
        updatedPlayer.stats.threeBetCountedThisHand = false;
        updatedPlayer.stats.facedOpenRaiseCountedThisHand = false;
        updatedPlayer.stats.cBetCountedThisHand = false;
        updatedPlayer.stats.cBetOpportunityCountedThisHand = false;
        updatedPlayer.stats.cBetFacedCountedThisHand = false;

        if (updatedPlayer.isRemoved) {
            updatedPlayer.folded = true;
        } else if (updatedPlayer.chips <= 0) {
            updatedPlayer.chips = 0;
            updatedPlayer.folded = true;
        }

        if (!updatedPlayer.folded) {
            updatedPlayer.stats.handsPlayed++;
            updatedPlayer.stats.vpipCountedThisHand = false;
            updatedPlayer.stats.pfrCountedThisHand = false;
            updatedPlayer.stats.threeBetCountedThisHand = false;
            updatedPlayer.stats.facedOpenRaiseCountedThisHand = false;
            updatedPlayer.stats.cBetCountedThisHand = false;
            updatedPlayer.stats.cBetOpportunityCountedThisHand = false;
            updatedPlayer.stats.cBetFacedCountedThisHand = false;
        }

        return updatedPlayer;
    });
}
