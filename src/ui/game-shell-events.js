export function bindGameShellEvents({
    onNavigateHistory,
    onReturnToCurrentHand,
    onOpenHelp,
    onCloseHelp,
    onToggleLanguage,
    onToggleGameMode,
    onToggleStats
}) {
    document.getElementById('btn-prev-hand').addEventListener('click', () => {
        onNavigateHistory(-1);
    });

    document.getElementById('btn-next-hand').addEventListener('click', () => {
        onNavigateHistory(1);
    });

    document.getElementById('btn-return-hand').addEventListener('click', onReturnToCurrentHand);

    document.getElementById('help-link').addEventListener('click', event => {
        event.preventDefault();
        onOpenHelp();
    });

    document.getElementById('btn-help-ok').addEventListener('click', onCloseHelp);

    document.getElementById('help-popup').addEventListener('click', event => {
        if (event.target.id === 'help-popup') {
            onCloseHelp();
        }
    });

    document.getElementById('btn-language').addEventListener('click', onToggleLanguage);
    document.getElementById('btn-mode').addEventListener('click', onToggleGameMode);
    document.getElementById('btn-stats-toggle').addEventListener('click', onToggleStats);
}
