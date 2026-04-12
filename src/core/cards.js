export const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];

export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck() {
    const deck = [];

    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }

    return deck;
}

export function shuffleDeck(deck) {
    const deckCopy = [...deck];

    for (let index = deck.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [deckCopy[index], deckCopy[swapIndex]] = [deckCopy[swapIndex], deckCopy[index]];
    }

    return deckCopy;
}

export function getCardValue(value) {
    const valueMap = { J: 11, Q: 12, K: 13, A: 14 };
    return valueMap[value] || Number.parseInt(value, 10);
}
