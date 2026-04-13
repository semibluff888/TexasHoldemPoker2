export function bindGameTableEvents({
    onFold,
    onCheck,
    onCall,
    onRaise,
    onAllIn,
    onSetPotPreset,
    onResetAndStartNewGame
}) {
    document.getElementById('btn-fold').addEventListener('click', onFold);
    document.getElementById('btn-check').addEventListener('click', onCheck);
    document.getElementById('btn-call').addEventListener('click', onCall);

    document.getElementById('btn-raise').addEventListener('click', () => {
        const raiseAmount = Number.parseInt(document.getElementById('raise-slider').value, 10);
        onRaise(raiseAmount);
    });

    document.getElementById('btn-allin').addEventListener('click', onAllIn);

    document.getElementById('raise-slider').addEventListener('input', (event) => {
        document.getElementById('raise-amount').textContent = event.target.value;
    });

    document.getElementById('btn-half-pot').addEventListener('click', () => {
        onSetPotPreset(0.5);
    });

    document.getElementById('btn-one-pot').addEventListener('click', () => {
        onSetPotPreset(1);
    });

    document.getElementById('btn-two-pot').addEventListener('click', () => {
        onSetPotPreset(2);
    });

    document.getElementById('btn-new-game').addEventListener('click', onResetAndStartNewGame);
    document.getElementById('btn-continue').addEventListener('click', onResetAndStartNewGame);
}
