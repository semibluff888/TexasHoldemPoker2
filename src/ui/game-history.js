import {
    renderHistoryEntries,
    appendHistoryEntry,
    updateHistoryNavigation,
    updatePanelHandNumber,
    clearPanelHandNumber
} from './game-shell-renderer.js';

function formatLogTime(now) {
    return now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
}

function formatCardsText(cards) {
    return cards.map(card => `${card.value}${card.suit}`).join(' ');
}

function getHandEntries(handHistories, handNumber) {
    return handHistories[handNumber - 1] || [];
}

export const gameHistory = {
    handNumber: 0,
    handHistories: [],
    currentViewingHand: 0,

    startHand({ currentLanguage, t }) {
        this.handNumber += 1;
        this.currentViewingHand = this.handNumber;
        this.handHistories[this.handNumber - 1] = [];

        renderHistoryEntries([]);
        this.syncPanel({ currentLanguage, t });
    },

    resetGame() {
        this.handNumber = 0;
        this.handHistories = [];
        this.currentViewingHand = 0;

        renderHistoryEntries([]);
        clearPanelHandNumber();
        updateHistoryNavigation({
            currentViewingHand: this.currentViewingHand,
            handNumber: this.handNumber
        });
    },

    syncPanel({ currentLanguage, t }) {
        if (this.handNumber <= 0) {
            clearPanelHandNumber();
            updateHistoryNavigation({
                currentViewingHand: this.currentViewingHand,
                handNumber: this.handNumber
            });
            return;
        }

        updatePanelHandNumber({
            currentLanguage,
            currentViewingHand: this.currentViewingHand,
            handNumber: this.handNumber,
            t
        });
        updateHistoryNavigation({
            currentViewingHand: this.currentViewingHand,
            handNumber: this.handNumber
        });
    },

    appendToCurrentHand(entryHTML) {
        if (this.handNumber <= 0) {
            if (this.currentViewingHand <= 0) {
                appendHistoryEntry(entryHTML);
            }
            return;
        }

        if (!this.handHistories[this.handNumber - 1]) {
            this.handHistories[this.handNumber - 1] = [];
        }

        this.handHistories[this.handNumber - 1].push(entryHTML);

        if (this.currentViewingHand === this.handNumber) {
            appendHistoryEntry(entryHTML);
        }
    },

    showMessage({ message, phaseKey, t, now = new Date() }) {
        if (!message) return;

        const time = formatLogTime(now);
        const phase = t(phaseKey) || phaseKey.toUpperCase();

        const entryHTML = `
        <div class="log-entry">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${phase}</span>
            </div>
            <div class="log-content">${message}</div>
        </div>
    `;

        this.appendToCurrentHand(entryHTML);
    },

    logAction({
        player,
        action,
        chipsBeforeAction = null,
        phaseKey,
        t,
        getTranslatedPlayerName,
        now = new Date()
    }) {
        const chipAmount = chipsBeforeAction !== null ? chipsBeforeAction : player.chips;
        const name = getTranslatedPlayerName(player);

        this.showMessage({
            message: `${name}($${chipAmount}): ${action}`,
            phaseKey,
            t,
            now
        });
    },

    logFoldWin({ winner, winAmount, t, getTranslatedPlayerName, now = new Date() }) {
        const time = formatLogTime(now);
        const winnerName = getTranslatedPlayerName(winner);

        const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('everyoneFolded')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('winnersHoleCards')}</strong>
                    <div class="player-hand winner-hand">
                        ${winnerName} \u2B50 ${formatCardsText(winner.cards)}
                    </div>
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerName}
                    <br><strong>${t('result')}</strong> ${t('everyoneFolded')}
                    <br><strong>${t('prize')}</strong> $${winAmount}
                </div>
            </div>
        </div>
    `;

        this.appendToCurrentHand(entryHTML);
    },

    logShowdown({
        playersInHand,
        winners,
        communityCards,
        totalWinAmounts,
        t,
        translateHandName,
        getTranslatedPlayerName,
        now = new Date()
    }) {
        const time = formatLogTime(now);
        const playersWithHands = [...playersInHand]
            .filter(player => player.handResult)
            .sort((a, b) => b.handResult.score - a.handResult.score);

        let playerCardsHTML = '';
        for (const player of playersWithHands) {
            const isWinner = winners.some(winner => winner.id === player.id);
            const winnerMark = isWinner ? ' \u2B50' : '';
            const playerName = getTranslatedPlayerName(player);
            const handName = translateHandName(player.handResult.name);

            playerCardsHTML += `
            <div class="player-hand ${isWinner ? 'winner-hand' : ''}">
                ${playerName}${winnerMark}: ${formatCardsText(player.cards)} (${handName})
            </div>
        `;
        }

        const winnersCardsInfo = winners.map(winner => {
            const bestCards = winner.handResult && winner.handResult.bestCards
                ? formatCardsText(winner.handResult.bestCards)
                : 'N/A';
            const winnerName = getTranslatedPlayerName(winner);
            return `${bestCards}(${winnerName})`;
        }).join('<br>');

        const prizeInfo = winners.map(winner => {
            const winAmount = totalWinAmounts[winner.id] || 0;
            const winnerName = getTranslatedPlayerName(winner);
            return `${winnerName}: $${winAmount}`;
        }).join('<br>');

        const winningHandsList = winners.map(winner => {
            const winnerName = getTranslatedPlayerName(winner);
            const translatedHand = winner.handResult
                ? translateHandName(winner.handResult.name)
                : '';
            return `${winnerName}: ${translatedHand}`;
        }).join('<br>');

        const winnerNames = winners.map(winner => getTranslatedPlayerName(winner)).join(' & ');

        const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('showdown')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('communityCards')}</strong> ${formatCardsText(communityCards)}
                </div>
                <div class="showdown-section">
                    <strong>${t('playersHoleCards')}</strong>
                    ${playerCardsHTML}
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerNames}
                    <br><strong>${t('winningHand')}</strong><br>${winningHandsList}
                    <br><strong>${t('best5Cards')}</strong><br>${winnersCardsInfo}
                    <br><strong>${t('prize')}</strong><br>${prizeInfo}
                </div>
            </div>
        </div>
    `;

        this.appendToCurrentHand(entryHTML);
    },

    navigate(direction, { currentLanguage, t }) {
        let targetHand = this.currentViewingHand + direction;

        if (targetHand < 1) targetHand = 1;
        if (targetHand > this.handNumber) targetHand = this.handNumber;
        if (targetHand === this.currentViewingHand) return;

        this.currentViewingHand = targetHand;

        renderHistoryEntries(getHandEntries(this.handHistories, targetHand));
        this.syncPanel({ currentLanguage, t });
    },

    returnToCurrent({ currentLanguage, t }) {
        if (this.currentViewingHand === this.handNumber) return;

        this.currentViewingHand = this.handNumber;

        renderHistoryEntries(getHandEntries(this.handHistories, this.handNumber));
        this.syncPanel({ currentLanguage, t });
    }
};
