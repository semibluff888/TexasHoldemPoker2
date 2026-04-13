function getHistoryElement() {
    return document.getElementById('action-history');
}

export function renderHistoryEntries(entries) {
    const history = getHistoryElement();
    if (!history) return;

    history.innerHTML = Array.isArray(entries) && entries.length > 0
        ? entries.join('')
        : '';
}

export function appendHistoryEntry(entryHTML) {
    const history = getHistoryElement();
    if (!history) return;

    history.insertAdjacentHTML('beforeend', entryHTML);
    history.scrollTop = history.scrollHeight;
}

export function updateHistoryNavigation({ currentViewingHand, handNumber }) {
    const prevBtn = document.getElementById('btn-prev-hand');
    const nextBtn = document.getElementById('btn-next-hand');
    const returnBtn = document.getElementById('btn-return-hand');

    if (prevBtn) {
        prevBtn.disabled = currentViewingHand <= 1;
    }

    if (nextBtn) {
        nextBtn.disabled = currentViewingHand >= handNumber;
    }

    if (returnBtn) {
        returnBtn.disabled = currentViewingHand >= handNumber;
    }
}

export function updatePanelHandNumber({
    currentLanguage,
    currentViewingHand,
    handNumber,
    t
}) {
    const panelHandNumber = document.getElementById('panel-hand-number');
    if (!panelHandNumber) return;

    if (handNumber <= 0) {
        panelHandNumber.textContent = '';
        panelHandNumber.classList.remove('viewing-past');
        return;
    }

    if (currentViewingHand === handNumber) {
        if (currentLanguage === 'zh') {
            panelHandNumber.textContent = `${t('hand')}${handNumber}${t('handSuffix') || ''}`;
        } else {
            panelHandNumber.textContent = `${t('hand')} #${handNumber}`;
        }

        panelHandNumber.classList.remove('viewing-past');
        return;
    }

    if (currentLanguage === 'zh') {
        panelHandNumber.textContent =
            `${t('hand')}${currentViewingHand}${t('handSuffix') || ''} / ${t('of')}${handNumber}${t('handSuffix') || ''}`;
    } else {
        panelHandNumber.textContent = `${t('hand')} #${currentViewingHand} ${t('of')} ${handNumber}`;
    }

    panelHandNumber.classList.add('viewing-past');
}

export function clearPanelHandNumber() {
    const panelHandNumber = document.getElementById('panel-hand-number');
    if (!panelHandNumber) return;

    panelHandNumber.textContent = '';
    panelHandNumber.classList.remove('viewing-past');
}

export function setHelpPopupVisible(isVisible) {
    const helpPopup = document.getElementById('help-popup');
    if (!helpPopup) return;

    helpPopup.classList.toggle('visible', isVisible);
}

export function updateGameModeButton({ gameMode, t }) {
    const modeBtn = document.getElementById('btn-mode');
    if (!modeBtn) return;

    modeBtn.textContent = gameMode === 'fast' ? t('fastMode') : t('slowMode');
    modeBtn.classList.toggle('fast-active', gameMode === 'fast');
}

export function updateStatsToggleButton({ showAllStats }) {
    document.body.classList.toggle('show-all-stats', showAllStats);

    const statsToggleBtn = document.getElementById('btn-stats-toggle');
    if (statsToggleBtn) {
        statsToggleBtn.classList.toggle('active', showAllStats);
    }
}

function updatePlayerStatsDisplay({ player, t, getOpponentProfile }) {
    if (!player) return;

    const statsEl = document.getElementById(`stats-${player.id}`);
    if (!statsEl) return;

    const profile = getOpponentProfile(player);
    const hands = player.stats.handsPlayed;

    statsEl.innerHTML = `
        <div class="stat-row"><span class="stat-label">${t('statsHands')}</span><span class="stat-value">${hands}</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsVPIP')}</span><span class="stat-value">${(profile.vpip * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsPFR')}</span><span class="stat-value">${(profile.pfr * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('stats3Bet')}</span><span class="stat-value">${(profile.threeBet * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsCBet')}</span><span class="stat-value">${(profile.cBet * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsFoldToCBet')}</span><span class="stat-value">${(profile.foldToCBet * 100).toFixed(0)}%</span></div>
        <div class="stat-row"><span class="stat-label">${t('statsShowdown')}</span><span class="stat-value">${(profile.showdownRate * 100).toFixed(0)}%</span></div>
    `;
}

export function updateAllPlayerStatsDisplays({ players, t, getOpponentProfile }) {
    for (const player of players) {
        updatePlayerStatsDisplay({ player, t, getOpponentProfile });
    }
}
