import {
    clearHighlightHumanBestHand,
    highlightHumanBestHand
} from './game-table-renderer.js';
import {
    updateGameModeButton,
    updateAllPlayerStatsDisplays
} from './game-shell-renderer.js';
import { gameCursorEffects } from './game-cursor-effects.js';
import { gameHistory } from './game-history.js';
import { createGameTranslator } from '../i18n/game-translations.js';

const LANGUAGE_STORAGE_KEY = 'pokerLanguage';

export function createGameLanguageUI({
    getGameState,
    getGameMode,
    getOpponentProfile
}) {
    let currentLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';

    const {
        t,
        translateHandName,
        getTranslatedPlayerName
    } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    function getCurrentLanguage() {
        return currentLanguage;
    }

    function syncUI() {
        const gameState = getGameState();
        const gameMode = getGameMode();

        const langBtn = document.getElementById('btn-language');
        if (langBtn) {
            langBtn.textContent = currentLanguage === 'en' ? '\u4e2d\u6587' : 'EN';
        }

        const title = document.querySelector('.game-header h1');
        if (title) title.textContent = t('title');

        const newGameBtn = document.getElementById('btn-new-game');
        if (newGameBtn && !newGameBtn.classList.contains('cooldown')) {
            newGameBtn.textContent = t('newGame');
        }

        document.getElementById('btn-fold').textContent = t('fold');
        document.getElementById('btn-check').textContent = t('check');
        document.getElementById('btn-raise').textContent = t('raise');
        document.getElementById('btn-allin').textContent = t('allIn');

        const callBtn = document.getElementById('btn-call');
        const callAmount = document.getElementById('call-amount').textContent;
        callBtn.innerHTML = `${t('call')} $<span id="call-amount">${callAmount}</span>`;

        const continueBtn = document.getElementById('btn-continue');
        if (continueBtn) continueBtn.textContent = t('continue');

        const potLabel = document.querySelector('.pot-label');
        if (potLabel) potLabel.textContent = t('pot');

        const historyTitle = document.querySelector('#action-history-panel .panel-header')
            ?? document.querySelector('.action-history-panel .panel-header')
            ?? document.querySelector('.panel-header');
        if (historyTitle) historyTitle.textContent = t('actionHistory');

        const tableTitle = document.querySelector('.table-title');
        if (tableTitle) tableTitle.textContent = t('tableTitle');

        const helpTitle = document.querySelector('.help-content h2');
        if (helpTitle) helpTitle.textContent = t('helpTitle');

        const helpSubtitle = document.querySelector('.help-subtitle');
        if (helpSubtitle) helpSubtitle.textContent = t('helpSubtitle');

        const helpOkBtn = document.getElementById('btn-help-ok');
        if (helpOkBtn) helpOkBtn.textContent = t('helpOk');

        const handNames = document.querySelectorAll('.hand-rankings-table .hand-name');
        const handDescs = document.querySelectorAll('.hand-rankings-table .hand-desc');
        const handKeys = ['royalFlush', 'straightFlush', 'fourOfAKind', 'fullHouse', 'flush', 'straight', 'threeOfAKind', 'twoPair', 'onePair', 'highCard'];

        handNames.forEach((element, index) => {
            if (handKeys[index]) {
                element.textContent = t(handKeys[index]);
            }
        });
        handDescs.forEach((element, index) => {
            if (handKeys[index]) {
                element.textContent = t(`${handKeys[index]}Desc`);
            }
        });

        for (let index = 0; index < gameState.players.length; index++) {
            const player = gameState.players[index];
            const nameEl = document.querySelector(`#player-${index} .player-name`);

            if (nameEl) {
                nameEl.textContent = getTranslatedPlayerName(player);
            }

            if (player.isAI) {
                const levelEl = document.getElementById(`level-${player.id}`);
                if (levelEl) {
                    levelEl.textContent = `(${t(player.aiLevel)})`;
                    levelEl.title = t('changeDifficulty');
                }

                const removeBtn = document.querySelector(`#player-${player.id} .btn-remove`);
                if (removeBtn) removeBtn.title = t('removeAI');

                const plusSign = document.querySelector(`#player-${player.id} .player-add-plus`);
                if (plusSign) plusSign.title = t('addAI');
            }
        }

        const btnPrev = document.getElementById('btn-prev-hand');
        const btnReturn = document.getElementById('btn-return-hand');
        const btnNext = document.getElementById('btn-next-hand');
        if (btnPrev) btnPrev.textContent = t('previous');
        if (btnReturn) btnReturn.textContent = t('returnText');
        if (btnNext) btnNext.textContent = t('next');

        gameCursorEffects.syncLabels({ t });

        const btnHalfPot = document.getElementById('btn-half-pot');
        const btnOnePot = document.getElementById('btn-one-pot');
        const btnTwoPot = document.getElementById('btn-two-pot');
        if (btnHalfPot) btnHalfPot.textContent = t('halfPot');
        if (btnOnePot) btnOnePot.textContent = t('onePot');
        if (btnTwoPot) btnTwoPot.textContent = t('twoPot');

        updateGameModeButton({ gameMode, t });
        gameHistory.syncPanel({ currentLanguage, t });
        updateAllPlayerStatsDisplays({
            players: gameState.players,
            t,
            getOpponentProfile
        });

        clearHighlightHumanBestHand();
        highlightHumanBestHand(gameState, { translateHandName });

        const onlineCountEl = document.getElementById('online-count');
        if (onlineCountEl && onlineCountEl.dataset.count) {
            onlineCountEl.textContent = `\uD83D\uDFE2 ${t('onlineUsers')}: ${onlineCountEl.dataset.count}`;
        }
    }

    function toggleLanguage() {
        currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
        localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
        syncUI();
    }

    return {
        t,
        translateHandName,
        getTranslatedPlayerName,
        getCurrentLanguage,
        toggleLanguage,
        syncUI
    };
}
