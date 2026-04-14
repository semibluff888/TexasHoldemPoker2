import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
    TRANSLATIONS,
    createGameTranslator
} from '../../src/i18n/game-translations.js';

test('t() uses the active language, falls back to English, and then returns the raw key', () => {
    let currentLanguage = 'en';
    const { t } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    assert.equal(t('newGame'), 'NEW GAME');

    currentLanguage = 'zh';
    assert.equal(t('newGame'), TRANSLATIONS.zh.newGame);

    const originalZhNewGame = TRANSLATIONS.zh.newGame;
    delete TRANSLATIONS.zh.newGame;
    try {
        assert.equal(t('newGame'), 'NEW GAME');
    } finally {
        TRANSLATIONS.zh.newGame = originalZhNewGame;
    }

    assert.equal(t('missingTranslationKey'), 'missingTranslationKey');
});

test('translateHandName() translates known hand ranks and preserves unknown names', () => {
    let currentLanguage = 'en';
    const { translateHandName } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    assert.equal(translateHandName('Royal Flush'), 'Royal Flush');

    currentLanguage = 'zh';
    assert.equal(translateHandName('Royal Flush'), TRANSLATIONS.zh.royalFlush);
    assert.equal(translateHandName('Everyone Folded'), TRANSLATIONS.zh.everyoneFolded);
    assert.equal(translateHandName('Mystery Hand'), 'Mystery Hand');
});

test('getTranslatedPlayerName() follows the live language getter without recreating the translator', () => {
    let currentLanguage = 'en';
    const { getTranslatedPlayerName } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    assert.equal(getTranslatedPlayerName({ id: 0 }), 'You');
    assert.equal(getTranslatedPlayerName({ id: 4 }), 'AI Player 4');

    currentLanguage = 'zh';
    assert.equal(getTranslatedPlayerName({ id: 0 }), TRANSLATIONS.zh.you);
    assert.equal(getTranslatedPlayerName({ id: 4 }), `${TRANSLATIONS.zh.aiPlayer} 4`);
});

test('game.js t() falls back to English when currentLanguage is unknown', () => {
    const gameSource = readFileSync(new URL('../../game.js', import.meta.url), 'utf8');
    const functionMatch = gameSource.match(/function t\(key\) \{[\s\S]*?\n\}/);

    assert.ok(functionMatch, 'Expected to find t() in game.js');

    const createGameT = new Function(
        'TRANSLATIONS',
        'currentLanguage',
        `${functionMatch[0]}; return t;`
    );
    const t = createGameT(TRANSLATIONS, 'xx');

    assert.equal(t('newGame'), 'NEW GAME');
});
