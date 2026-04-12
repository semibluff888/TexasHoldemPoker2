import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SMALL_BLIND,
    BIG_BLIND,
    STARTING_CHIPS,
    createDefaultStats,
    createPlayer,
    createInitialGameState,
    resetPlayersForNewHand
} from '../../src/state/game-state.js';

test('createDefaultStats returns a fresh object each time', () => {
    const first = createDefaultStats();
    const second = createDefaultStats();

    assert.notStrictEqual(first, second);
    assert.deepEqual(first, second);

    first.handsPlayed = 99;

    assert.equal(second.handsPlayed, 0);
});

test('createPlayer applies overrides without losing defaults', () => {
    const player = createPlayer({
        name: 'AI Player 3',
        chips: 240,
        stats: {
            ...createDefaultStats(),
            showdownCount: 4
        }
    });

    assert.equal(player.id, -1);
    assert.equal(player.name, 'AI Player 3');
    assert.equal(player.isAI, false);
    assert.equal(player.aiLevel, 'medium');
    assert.equal(player.chips, 240);
    assert.deepEqual(player.cards, []);
    assert.equal(player.bet, 0);
    assert.equal(player.totalContribution, 0);
    assert.equal(player.folded, false);
    assert.equal(player.allIn, false);
    assert.equal(player.isRemoved, false);
    assert.equal(player.isPendingJoin, false);
    assert.equal(player.stats.showdownCount, 4);
    assert.equal(player.stats.handsPlayed, 0);
    assert.equal(player.stats.vpipCountedThisHand, false);
});

test('createInitialGameState sets blind-sensitive defaults', () => {
    const state = createInitialGameState();

    assert.deepEqual(state.deck, []);
    assert.deepEqual(state.players, []);
    assert.deepEqual(state.communityCards, []);
    assert.equal(state.pot, 0);
    assert.equal(state.currentBet, 0);
    assert.equal(state.dealerIndex, 0);
    assert.equal(state.currentPlayerIndex, 0);
    assert.equal(state.phase, 'idle');
    assert.equal(state.minRaise, BIG_BLIND);
    assert.equal(state.displayedCommunityCards, 0);
    assert.equal(state.preflopRaiseCount, 0);
    assert.equal(state.preflopAggressorId, null);
    assert.equal(state.cBetActive, false);
    assert.equal(SMALL_BLIND, 10);
    assert.equal(BIG_BLIND, 20);
    assert.equal(STARTING_CHIPS, 1000);
});

test('resetPlayersForNewHand clears transient state and increments active hands only', () => {
    const players = [
        createPlayer({
            id: 0,
            cards: [{ suit: 'hearts', value: 'A' }],
            bet: 30,
            totalContribution: 50,
            allIn: true,
            isPendingJoin: true,
            stats: {
                ...createDefaultStats(),
                handsPlayed: 4,
                vpipCountedThisHand: true,
                pfrCountedThisHand: true,
                threeBetCountedThisHand: true,
                facedOpenRaiseCountedThisHand: true,
                cBetCountedThisHand: true,
                cBetOpportunityCountedThisHand: true,
                cBetFacedCountedThisHand: true
            }
        }),
        createPlayer({
            id: 1,
            isAI: true,
            chips: 0,
            cards: [{ suit: 'spades', value: 'K' }],
            bet: 10,
            totalContribution: 100,
            allIn: true,
            stats: {
                ...createDefaultStats(),
                handsPlayed: 5,
                vpipCountedThisHand: true,
                pfrCountedThisHand: true
            }
        }),
        createPlayer({
            id: 2,
            isAI: true,
            isRemoved: true,
            cards: [{ suit: 'clubs', value: 'Q' }],
            bet: 20,
            totalContribution: 20,
            stats: {
                ...createDefaultStats(),
                handsPlayed: 7,
                cBetCountedThisHand: true,
                cBetFacedCountedThisHand: true
            }
        })
    ];

    const resetPlayers = resetPlayersForNewHand(players);

    assert.notStrictEqual(resetPlayers, players);
    assert.notStrictEqual(resetPlayers[0], players[0]);
    assert.notStrictEqual(resetPlayers[0].stats, players[0].stats);

    assert.deepEqual(resetPlayers[0].cards, []);
    assert.equal(resetPlayers[0].bet, 0);
    assert.equal(resetPlayers[0].totalContribution, 0);
    assert.equal(resetPlayers[0].allIn, false);
    assert.equal(resetPlayers[0].isPendingJoin, false);
    assert.equal(resetPlayers[0].folded, false);
    assert.equal(resetPlayers[0].stats.handsPlayed, 5);
    assert.equal(resetPlayers[0].stats.vpipCountedThisHand, false);
    assert.equal(resetPlayers[0].stats.pfrCountedThisHand, false);
    assert.equal(resetPlayers[0].stats.threeBetCountedThisHand, false);
    assert.equal(resetPlayers[0].stats.facedOpenRaiseCountedThisHand, false);
    assert.equal(resetPlayers[0].stats.cBetCountedThisHand, false);
    assert.equal(resetPlayers[0].stats.cBetOpportunityCountedThisHand, false);
    assert.equal(resetPlayers[0].stats.cBetFacedCountedThisHand, false);

    assert.equal(resetPlayers[1].chips, 0);
    assert.equal(resetPlayers[1].folded, true);
    assert.equal(resetPlayers[1].stats.handsPlayed, 5);
    assert.equal(resetPlayers[1].stats.vpipCountedThisHand, false);
    assert.equal(resetPlayers[1].stats.pfrCountedThisHand, false);

    assert.equal(resetPlayers[2].folded, true);
    assert.equal(resetPlayers[2].stats.handsPlayed, 7);
    assert.equal(resetPlayers[2].stats.cBetCountedThisHand, false);
    assert.equal(resetPlayers[2].stats.cBetFacedCountedThisHand, false);
});
