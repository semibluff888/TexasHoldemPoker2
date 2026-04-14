import test from 'node:test';
import assert from 'node:assert/strict';

import {
    TRANSLATIONS,
    createGameTranslator
} from '../../src/i18n/game-translations.js';

test('t() preserves empty-string translations, falls back to English, and then returns the raw key', () => {
    let currentLanguage = 'en';
    const translations = JSON.parse(JSON.stringify(TRANSLATIONS));
    translations.en.blankValue = '';
    delete translations.zh.newGame;
    delete translations.zh.blankValue;

    const { t } = createGameTranslator({
        getLanguage: () => currentLanguage,
        translations
    });

    assert.equal(t('newGame'), translations.en.newGame);
    assert.equal(t('blankValue'), '');

    currentLanguage = 'zh';
    assert.equal(t('newGame'), translations.en.newGame);
    assert.equal(t('blankValue'), '');

    assert.equal(t('missingTranslationKey'), 'missingTranslationKey');
});

test('translateHandName() translates known hand ranks and preserves unknown names', () => {
    let currentLanguage = 'en';
    const { translateHandName } = createGameTranslator({
        getLanguage: () => currentLanguage
    });

    assert.equal(translateHandName('Royal Flush'), TRANSLATIONS.en.royalFlush);

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

    assert.equal(getTranslatedPlayerName({ id: 0 }), TRANSLATIONS.en.you);
    assert.equal(getTranslatedPlayerName({ id: 4 }), `${TRANSLATIONS.en.aiPlayer} 4`);

    currentLanguage = 'zh';
    assert.equal(getTranslatedPlayerName({ id: 0 }), TRANSLATIONS.zh.you);
    assert.equal(getTranslatedPlayerName({ id: 4 }), `${TRANSLATIONS.zh.aiPlayer} 4`);
});

test('t() falls back to English when the active language is unknown', () => {
    const { t } = createGameTranslator({
        getLanguage: () => 'xx'
    });

    assert.equal(t('newGame'), TRANSLATIONS.en.newGame);
});
