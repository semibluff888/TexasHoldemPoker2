import test from 'node:test';
import assert from 'node:assert/strict';

import * as gameTranslations from '../../src/i18n/game-translations.js';

const {
    TRANSLATIONS,
    createGameTranslator
} = gameTranslations;

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

test('t() interpolates named placeholders while preserving unknown placeholders', () => {
    const { t } = createGameTranslator({
        getLanguage: () => 'en',
        translations: {
            en: {
                greeting: 'Hello {name}, room {roomId}, {missing}'
            },
            zh: {}
        }
    });

    assert.equal(
        t('greeting', { name: 'Alice', roomId: 'A-7' }),
        'Hello Alice, room A-7, {missing}'
    );
});

test('getTranslatedPlayerName() preserves online opponent display names while keeping the local seat translated', () => {
    const { getTranslatedPlayerName } = createGameTranslator({
        getLanguage: () => 'en'
    });

    assert.equal(
        getTranslatedPlayerName({ id: 0, remoteId: 'guest-self', displayName: 'Alice' }),
        TRANSLATIONS.en.you
    );
    assert.equal(
        getTranslatedPlayerName({ id: 2, remoteId: 'guest-bob', displayName: 'Bob' }),
        'Bob'
    );
});

test('t() falls back to English when the active language is unknown', () => {
    const { t } = createGameTranslator({
        getLanguage: () => 'xx'
    });

    assert.equal(t('newGame'), TRANSLATIONS.en.newGame);
});

test('online room membership history labels exist in both bundled languages', () => {
    for (const language of ['en', 'zh']) {
        assert.equal(typeof TRANSLATIONS[language].playerJoinedRoom, 'string');
        assert.notEqual(TRANSLATIONS[language].playerJoinedRoom, '');
        assert.equal(typeof TRANSLATIONS[language].playerLeftRoom, 'string');
        assert.notEqual(TRANSLATIONS[language].playerLeftRoom, '');
    }
});

test('online room panel labels exist in both bundled languages', () => {
    const keys = [
        'onlineRoomTabRoom',
        'onlineRoomTabLog',
        'onlineRoomTitle',
        'onlineRoomRefresh',
        'onlineRoomNamePlaceholder',
        'onlineRoomPlayersOption',
        'onlineRoomCreate',
        'onlineRoomLeave',
        'onlineRoomEmpty',
        'onlineRoomPracticeTable',
        'onlineRoomPlayers',
        'onlineRoomStatusWaiting',
        'onlineRoomStatusPlaying',
        'onlineRoomJoined',
        'onlineRoomUnsupported',
        'onlineRoomFull',
        'onlineRoomJoin',
        'onlineStatusOffline',
        'onlineStatusConnectingTo',
        'onlineStatusConnectedAs',
        'onlineStatusRefreshingRooms',
        'onlineStatusCreatingRoom',
        'onlineStatusCreatedRoom',
        'onlineStatusJoiningRoom',
        'onlineStatusJoinedRoom',
        'onlineStatusLeavingRoom',
        'onlineStatusBackInLobby',
        'onlineStatusConnectionClosed',
        'onlineStatusUnableToConnect'
    ];

    for (const language of ['en', 'zh']) {
        for (const key of keys) {
            assert.equal(typeof TRANSLATIONS[language][key], 'string', `${language}.${key}`);
            assert.notEqual(TRANSLATIONS[language][key], '', `${language}.${key}`);
        }
    }
});

test('online room panel state helpers return translation keys for known states', () => {
    const {
        getOnlineRoomActionTranslationKey,
        getOnlineRoomStatusTranslationKey
    } = gameTranslations;

    assert.equal(typeof getOnlineRoomStatusTranslationKey, 'function');
    assert.equal(typeof getOnlineRoomActionTranslationKey, 'function');

    assert.equal(getOnlineRoomStatusTranslationKey('waiting'), 'onlineRoomStatusWaiting');
    assert.equal(getOnlineRoomStatusTranslationKey('playing'), 'onlineRoomStatusPlaying');
    assert.equal(getOnlineRoomStatusTranslationKey('paused'), null);

    assert.equal(getOnlineRoomActionTranslationKey('joined'), 'onlineRoomJoined');
    assert.equal(getOnlineRoomActionTranslationKey('unsupported'), 'onlineRoomUnsupported');
    assert.equal(getOnlineRoomActionTranslationKey('full'), 'onlineRoomFull');
    assert.equal(getOnlineRoomActionTranslationKey('join'), 'onlineRoomJoin');
    assert.equal(getOnlineRoomActionTranslationKey('blocked'), null);
});
