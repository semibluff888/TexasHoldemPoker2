const HAND_NAME_KEYS = {
    'Royal Flush': 'royalFlush',
    'Straight Flush': 'straightFlush',
    'Four of a Kind': 'fourOfAKind',
    'Full House': 'fullHouse',
    'Flush': 'flush',
    'Straight': 'straight',
    'Three of a Kind': 'threeOfAKind',
    'Two Pair': 'twoPair',
    'One Pair': 'onePair',
    'High Card': 'highCard',
    'Everyone Folded': 'everyoneFolded'
};

export const TRANSLATIONS = {
    en: {
        // Header & Buttons
        title: '♠ Texas Hold\'em ♥',
        newGame: 'NEW GAME',
        continue: 'Continue',

        // Betting Buttons
        fold: 'FOLD',
        check: 'CHECK',
        call: 'CALL',
        raise: 'RAISE',
        allIn: 'ALL IN',

        // Player Names
        you: 'You',
        aiPlayer: 'AI Player',

        // Actions
        actionFold: 'Fold',
        actionCheck: 'Check',
        actionCall: 'Call',
        actionRaise: 'Raise',
        actionAllIn: 'All-In',
        actionSmallBlind: 'Small Blind',
        actionBigBlind: 'Big Blind',

        // Game Messages
        yourTurn: 'Your turn!',
        winner: 'Winner!',
        everyoneFolded: 'Everyone Folded',
        gameOver: 'Game Over!',
        wins: 'wins',
        with: 'with',

        // Hand Rankings
        royalFlush: 'Royal Flush',
        straightFlush: 'Straight Flush',
        fourOfAKind: 'Four of a Kind',
        fullHouse: 'Full House',
        flush: 'Flush',
        straight: 'Straight',
        threeOfAKind: 'Three of a Kind',
        twoPair: 'Two Pair',
        onePair: 'One Pair',
        highCard: 'High Card',
        everyoneFolded: 'Everyone Folded',

        // Help Popup
        helpTitle: '🃏 Poker Hand Rankings',
        helpSubtitle: 'From highest to lowest:',
        helpOk: 'OK',

        // Hand Descriptions
        royalFlushDesc: 'A, K, Q, J, 10 of the same suit',
        straightFlushDesc: 'Five consecutive cards of the same suit',
        fourOfAKindDesc: 'Four cards of the same rank',
        fullHouseDesc: 'Three of a kind plus a pair',
        flushDesc: 'Five cards of the same suit',
        straightDesc: 'Five consecutive cards of any suit',
        threeOfAKindDesc: 'Three cards of the same rank',
        twoPairDesc: 'Two different pairs',
        onePairDesc: 'Two cards of the same rank',
        highCardDesc: 'Highest card when no other hand is made',

        // Side Panel
        actionHistory: 'Action History',
        hand: 'Hand',
        handSuffix: '',
        of: 'of',
        previous: '◀ Previous',
        returnText: 'Return ↩',
        next: 'Next ▶',

        // Pot
        pot: 'POT',
        mainPot: 'Main Pot',
        sidePot: 'Side Pot',

        // Phases
        start: 'START',
        preflop: 'PRE-FLOP',
        flop: 'FLOP',
        turn: 'TURN',
        river: 'RIVER',
        showdown: 'SHOWDOWN',

        // Cursor Effects
        cursorSparkle: '✨ Sparkle',
        cursorComet: '☄️ Comet',
        cursorBubble: '🔮 Bubble',
        cursorNone: '❌ None',

        // Showdown Log
        communityCards: 'Community Cards:',
        playersHoleCards: "Players' Hole Cards:",
        winnerLabel: '🏆 Winner:',
        winningHand: 'Winning Hand:',
        best5Cards: 'Best 5 Cards:',
        prize: 'Prize:',
        winnersHoleCards: "Winner's Hole Cards:",
        result: 'Result:',

        // Messages
        startMessage: 'Click "New Game" to start playing Texas Hold\'em!',
        potWinMessage: '{pot}: {winner} wins ${amount} with {hand}',
        // Table
        tableTitle: 'SPY×FAMILY',

        // Pot Preset Buttons
        halfPot: '1/2 POT',
        onePot: '1 POT',
        twoPot: '2 POT',

        // Game Mode
        fastMode: 'FAST',
        slowMode: 'SLOW',

        // AI Levels
        easy: 'easy',
        medium: 'medium',
        hard: 'hard',

        // Tooltips
        changeDifficulty: 'Click to change difficulty',
        removeAI: 'Remove AI',
        addAI: 'Add AI',

        // AI Add/Remove
        aiJoined: '{name} has joined the game.',
        aiLeft: '{name} has left the game.',
        playerJoinedRoom: '{name} joined the room.',
        playerLeftRoom: '{name} left the room.',
        minAiRequired: 'The game requires at least one AI player to continue.',

        // Player Stats
        statsHands: 'Hands',
        statsVPIP: 'VPIP',
        statsPFR: 'PFR',
        stats3Bet: '3-Bet',
        statsCBet: 'C-Bet',
        statsFoldToCBet: 'Fold to CBet',
        statsShowdown: 'Showdown',

        // Online Count
        onlineUsers: 'Online Users',

        // Online Room Panel
        onlineRoomTabRoom: 'Room',
        onlineRoomTabLog: 'Log',
        onlineRoomTitle: 'Room Info',
        onlineRoomRefresh: 'Refresh',
        onlineRoomNamePlaceholder: 'Room name',
        onlineRoomPlayersOption: '{count} players',
        onlineRoomCreate: 'Create',
        onlineRoomLeave: 'Leave Room',
        onlineRoomEmpty: 'No rooms yet. Create one to start the loop.',
        onlineRoomPracticeTable: 'Practice Table',
        onlineRoomPlayers: 'players',
        onlineRoomStatusWaiting: 'waiting',
        onlineRoomStatusPlaying: 'playing',
        onlineRoomJoined: 'Joined',
        onlineRoomUnsupported: '5-seat only',
        onlineRoomFull: 'Full',
        onlineRoomJoin: 'Join',
        onlineStatusOffline: 'Offline mode',
        onlineStatusConnectingTo: 'Connecting to {url}...',
        onlineStatusConnectedAs: 'Connected as {username}',
        onlineStatusRefreshingRooms: 'Refreshing room list...',
        onlineStatusCreatingRoom: 'Creating "{roomName}"...',
        onlineStatusCreatedRoom: 'Created room {roomId}. Waiting for join...',
        onlineStatusJoiningRoom: 'Joining "{roomName}"...',
        onlineStatusJoinedRoom: 'Joined room {roomId}',
        onlineStatusLeavingRoom: 'Leaving room...',
        onlineStatusBackInLobby: 'Back in lobby',
        onlineStatusConnectionClosed: 'Connection closed',
        onlineStatusUnableToConnect: 'Unable to connect to the online server'
    },
    zh: {
        // Header & Buttons
        title: '♠ 德州扑克 ♥',
        newGame: '新游戏',
        continue: '继续',

        // Betting Buttons
        fold: '弃牌',
        check: '过牌',
        call: '跟注',
        raise: '加注',
        allIn: '全押',

        // Player Names
        you: '你',
        aiPlayer: 'AI玩家',

        // Actions
        actionFold: '弃牌',
        actionCheck: '过牌',
        actionCall: '跟注',
        actionRaise: '加注',
        actionAllIn: '全押',
        actionSmallBlind: '小盲注',
        actionBigBlind: '大盲注',

        // Game Messages
        yourTurn: '轮到你了！',
        winner: '赢家！',
        everyoneFolded: '全员弃牌',
        gameOver: '游戏结束！',
        wins: '赢得',
        with: '凭借',

        // Hand Rankings
        royalFlush: '皇家同花顺',
        straightFlush: '同花顺',
        fourOfAKind: '四条',
        fullHouse: '葫芦',
        flush: '同花',
        straight: '顺子',
        threeOfAKind: '三条',
        twoPair: '两对',
        onePair: '一对',
        highCard: '高牌',
        everyoneFolded: '全部弃牌',

        // Help Popup
        helpTitle: '🃏 扑克牌型排名',
        helpSubtitle: '从高到低：',
        helpOk: '确定',

        // Hand Descriptions
        royalFlushDesc: '同花色的 A, K, Q, J, 10',
        straightFlushDesc: '同花色的五张连续牌',
        fourOfAKindDesc: '四张相同点数的牌',
        fullHouseDesc: '三条加一对',
        flushDesc: '五张同花色的牌',
        straightDesc: '五张连续的牌（任意花色）',
        threeOfAKindDesc: '三张相同点数的牌',
        twoPairDesc: '两个不同的对子',
        onePairDesc: '两张相同点数的牌',
        highCardDesc: '没有成牌时的最大单牌',

        // Side Panel
        actionHistory: '行动记录',
        hand: '第',
        handSuffix: '局',
        of: '共',
        previous: '◀ 上一局',
        returnText: '返回 ↩',
        next: '下一局 ▶',

        // Pot
        pot: '奖池',
        mainPot: '主池',
        sidePot: '边池',

        // Phases
        start: '开始',
        preflop: '翻牌前',
        flop: '翻牌',
        turn: '转牌',
        river: '河牌',
        showdown: '摊牌',

        // Cursor Effects
        cursorSparkle: '✨ 火花',
        cursorComet: '☄️ 彗星',
        cursorBubble: '🔮 气泡',
        cursorNone: '❌ 无',

        // Showdown Log
        communityCards: '公共牌:',
        playersHoleCards: '玩家手牌:',
        winnerLabel: '🏆 赢家:',
        winningHand: '获胜牌型:',
        best5Cards: '最佳5张:',
        prize: '奖金:',
        winnersHoleCards: '赢家手牌:',
        result: '结果:',

        // Messages
        startMessage: '点击 "新游戏" 开始德州扑克!',
        potWinMessage: '{pot}: {winner} 以 {hand} 赢得 ${amount}',

        // Table
        tableTitle: '间谍过家家',

        // Pot Preset Buttons
        halfPot: '半池',
        onePot: '1倍底池',
        twoPot: '2倍底池',

        // Game Mode
        fastMode: '快速',
        slowMode: '慢速',

        // AI Levels
        easy: '简单',
        medium: '中等',
        hard: '困难',

        // Tooltips
        changeDifficulty: '点击修改难度',
        removeAI: '移除 AI',
        addAI: '添加 AI',

        // AI Add/Remove
        aiJoined: '{name} 已加入游戏',
        aiLeft: '{name} 已离开游戏',
        minAiRequired: '游戏至少需要一名 AI 玩家',

        // Player Stats
        statsHands: '牌局数',
        statsVPIP: '主动入池率',
        statsPFR: '翻前加注率',
        stats3Bet: '3-Bet',
        statsCBet: 'C-Bet',
        statsFoldToCBet: 'C-Bet弃牌率',
        statsShowdown: '摊牌率',

        // Online Count
        onlineUsers: '在线人数',

        // Online Room Panel
        onlineRoomTabRoom: '\u623f\u95f4',
        onlineRoomTabLog: '\u65e5\u5fd7',
        onlineRoomTitle: '\u623f\u95f4\u4fe1\u606f',
        onlineRoomRefresh: '\u5237\u65b0',
        onlineRoomNamePlaceholder: '\u623f\u95f4\u540d',
        onlineRoomPlayersOption: '{count} \u4eba',
        onlineRoomCreate: '\u521b\u5efa',
        onlineRoomLeave: '\u79bb\u5f00\u623f\u95f4',
        onlineRoomEmpty: '\u6682\u65e0\u623f\u95f4\u3002\u521b\u5efa\u4e00\u4e2a\u5f00\u59cb\u6e38\u620f\u3002',
        onlineRoomPracticeTable: '\u7ec3\u4e60\u684c',
        onlineRoomPlayers: '\u73a9\u5bb6',
        onlineRoomStatusWaiting: '\u7b49\u5f85\u4e2d',
        onlineRoomStatusPlaying: '\u6e38\u620f\u4e2d',
        onlineRoomJoined: '\u5df2\u52a0\u5165',
        onlineRoomUnsupported: '\u4ec5\u652f\u6301 5 \u4eba\u684c',
        onlineRoomFull: '\u5df2\u6ee1',
        onlineRoomJoin: '\u52a0\u5165',
        onlineStatusOffline: '\u79bb\u7ebf\u6a21\u5f0f',
        onlineStatusConnectingTo: '\u6b63\u5728\u8fde\u63a5 {url}...',
        onlineStatusConnectedAs: '\u5df2\u8fde\u63a5\u4e3a {username}',
        onlineStatusRefreshingRooms: '\u6b63\u5728\u5237\u65b0\u623f\u95f4\u5217\u8868...',
        onlineStatusCreatingRoom: '\u6b63\u5728\u521b\u5efa\u201c{roomName}\u201d...',
        onlineStatusCreatedRoom: '\u5df2\u521b\u5efa\u623f\u95f4 {roomId}\uff0c\u7b49\u5f85\u52a0\u5165...',
        onlineStatusJoiningRoom: '\u6b63\u5728\u52a0\u5165\u201c{roomName}\u201d...',
        onlineStatusJoinedRoom: '\u5df2\u52a0\u5165\u623f\u95f4 {roomId}',
        onlineStatusLeavingRoom: '\u6b63\u5728\u79bb\u5f00\u623f\u95f4...',
        onlineStatusBackInLobby: '\u5df2\u56de\u5230\u5927\u5385',
        onlineStatusConnectionClosed: '\u8fde\u63a5\u5df2\u5173\u95ed',
        onlineStatusUnableToConnect: '\u65e0\u6cd5\u8fde\u63a5\u5230\u5728\u7ebf\u670d\u52a1\u5668'
    }
};

TRANSLATIONS.en.playerJoinedRoom ??= '{name} joined the room.';
TRANSLATIONS.en.playerLeftRoom ??= '{name} left the room.';
TRANSLATIONS.zh.playerJoinedRoom ??= '{name} \u5DF2\u52A0\u5165\u623F\u95F4';
TRANSLATIONS.zh.playerLeftRoom ??= '{name} \u5DF2\u79BB\u5F00\u623F\u95F4';

export function createGameTranslator({ getLanguage, translations = TRANSLATIONS }) {
    function t(key) {
        const currentTranslations = translations[getLanguage()] || translations.en || {};
        const englishTranslations = translations.en || {};

        if (Object.prototype.hasOwnProperty.call(currentTranslations, key)) {
            return currentTranslations[key];
        }

        if (Object.prototype.hasOwnProperty.call(englishTranslations, key)) {
            return englishTranslations[key];
        }

        return key;
    }

    function translateHandName(englishName) {
        const key = HAND_NAME_KEYS[englishName];
        return key ? t(key) : englishName;
    }

    function getTranslatedPlayerName(player) {
        if (player?.remoteId) {
            return player.id === 0
                ? t('you')
                : (player.displayName || player.name || `${t('aiPlayer')} ${player.id}`);
        }

        return player.id === 0 ? t('you') : `${t('aiPlayer')} ${player.id}`;
    }

    return {
        t,
        translateHandName,
        getTranslatedPlayerName
    };
}
