import { getCardValue } from './cards.js';

export function evaluateHand(cards) {
    if (cards.length < 5) {
        return { rank: 0, name: 'Incomplete', highCards: [], bestCards: [] };
    }

    const combinations = getCombinations(cards, 5);
    let bestHand = { rank: 0, name: 'High Card', highCards: [], score: 0, bestCards: [] };

    for (const combo of combinations) {
        const hand = evaluateFiveCards(combo);
        hand.bestCards = combo;

        if (hand.score > bestHand.score) {
            bestHand = hand;
        }
    }

    return bestHand;
}

export function getCombinations(arr, size) {
    const result = [];

    function combine(start, combo) {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }

        for (let index = start; index < arr.length; index++) {
            combo.push(arr[index]);
            combine(index + 1, combo);
            combo.pop();
        }
    }

    combine(0, []);
    return result;
}

export function evaluateFiveCards(cards) {
    const values = cards.map(card => getCardValue(card.value)).sort((left, right) => right - left);
    const suits = cards.map(card => card.suit);

    const valueCounts = {};
    for (const value of values) {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
    }

    const counts = Object.values(valueCounts).sort((left, right) => right - left);
    const uniqueValues = [...new Set(values)].sort((left, right) => right - left);

    const isFlush = suits.every(suit => suit === suits[0]);
    const isStraight = checkStraight(uniqueValues);
    const isAceLowStraight = JSON.stringify(uniqueValues) === JSON.stringify([14, 5, 4, 3, 2]);

    function getKickers(excludeValues) {
        return values.filter(value => !excludeValues.includes(value));
    }

    if (isFlush && isStraight && values[0] === 14 && values[1] === 13) {
        return { rank: 10, name: 'Royal Flush', highCards: values, score: 10000000 };
    }

    if (isFlush && (isStraight || isAceLowStraight)) {
        return {
            rank: 9,
            name: 'Straight Flush',
            highCards: values,
            score: 9000000 + (isAceLowStraight ? 5 : values[0])
        };
    }

    if (counts[0] === 4) {
        const quadValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 4), 10);
        const kicker = getKickers([quadValue])[0];

        return {
            rank: 8,
            name: 'Four of a Kind',
            highCards: values,
            score: 8000000 + quadValue * 15 + kicker
        };
    }

    if (counts[0] === 3 && counts[1] === 2) {
        const tripValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 3), 10);
        const pairValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 2), 10);

        return {
            rank: 7,
            name: 'Full House',
            highCards: values,
            score: 7000000 + tripValue * 15 + pairValue
        };
    }

    if (isFlush) {
        return {
            rank: 6,
            name: 'Flush',
            highCards: values,
            score: 6000000 + values[0] * 50625 + values[1] * 3375 + values[2] * 225 + values[3] * 15 + values[4]
        };
    }

    if (isStraight || isAceLowStraight) {
        return {
            rank: 5,
            name: 'Straight',
            highCards: values,
            score: 5000000 + (isAceLowStraight ? 5 : values[0])
        };
    }

    if (counts[0] === 3) {
        const tripValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 3), 10);
        const kickers = getKickers([tripValue]);

        return {
            rank: 4,
            name: 'Three of a Kind',
            highCards: values,
            score: 4000000 + tripValue * 3375 + kickers[0] * 225 + kickers[1] * 15
        };
    }

    if (counts[0] === 2 && counts[1] === 2) {
        const pairs = Object.keys(valueCounts)
            .filter(key => valueCounts[key] === 2)
            .map(Number)
            .sort((left, right) => right - left);
        const kicker = getKickers(pairs)[0];

        return {
            rank: 3,
            name: 'Two Pair',
            highCards: values,
            score: 3000000 + pairs[0] * 3375 + pairs[1] * 225 + kicker * 15
        };
    }

    if (counts[0] === 2) {
        const pairValue = Number.parseInt(Object.keys(valueCounts).find(key => valueCounts[key] === 2), 10);
        const kickers = getKickers([pairValue]);

        return {
            rank: 2,
            name: 'One Pair',
            highCards: values,
            score: 2000000 + pairValue * 3375 + kickers[0] * 225 + kickers[1] * 15 + kickers[2]
        };
    }

    return {
        rank: 1,
        name: 'High Card',
        highCards: values,
        score: 1000000 + values[0] * 50625 + values[1] * 3375 + values[2] * 225 + values[3] * 15 + values[4]
    };
}

export function checkStraight(values) {
    if (values.length !== 5) {
        return false;
    }

    for (let index = 0; index < values.length - 1; index++) {
        if (values[index] - values[index + 1] !== 1) {
            return false;
        }
    }

    return true;
}
