// ===== Texas Hold'em Poker Game =====

// Game Constants
const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
// Hand ranks are evaluated using numeric scores in evaluateFiveCards()

const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const STARTING_CHIPS = 1000;

// ===== Enhanced AI Constants =====
// Hand Buckets for preflop decisions (based on position-adjusted ranges)
const BUCKET_PREMIUM = [
    'AA', 'KK', 'QQ', 'JJ', 'TT',
    'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs',
    'AKo', 'AQo'
];

const BUCKET_STRONG = [
    '99', '88', '77', '66',
    'T9s', '98s', '87s', 'JTs', 'QTs', 'KTs',
    'A5s', 'A4s', 'A3s',
    'AJo', 'KQo'
];

const BUCKET_SPECULATIVE = [
    '55', '44', '33', '22',
    'A9s', 'A8s', 'A7s', 'A6s', 'A2s',
    'K9s', 'K8s', 'Q9s', 'J9s', 'T8s', '97s', '86s', '75s', '76s', '65s',
    'ATo', 'KTo', 'QTo', 'JTo', 'A9o', 'KJo', 'QJo',
    'T9o', '98o', 'J9o'
];

const BUCKET_WEAK = [
    'K7s', 'K6s', 'K5s', 'K4s', 'K3s',
    'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s',
    'J8s', 'J7s', 'J6s', 'J5s',
    'T7s', 'T6s', '96s', '85s', '74s', '64s', '63s', '53s', '54s', '43s',
    'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o',
    'K9o', 'K8o', 'K7o', 'K6o',
    'Q9o', 'Q8o', 'Q7o', 'J8o',
    'T8o', 'T7o', '97o', '87o', '86o', '76o', '75o', '65o'
];

// Bet sizing abstraction (as multipliers of pot)
const BET_SIZES = { HALF: 0.5, POT: 1.0, DOUBLE: 2.0 };


// ===== Game Mode Settings =====
const COUNTDOWN_DURATION = 15000; // 15 seconds for fast mode
document.documentElement.style.setProperty('--countdown-duration', (COUNTDOWN_DURATION / 1000) + 's');
let gameMode = localStorage.getItem('pokerGameMode') || 'fast'; // 'fast' or 'slow'
let countdownTimerId = null;
let countdownStartTime = null;

// Stats display toggle
let showAllStats = localStorage.getItem('showAllStats') === 'true';

// ===== Language System =====
let currentLanguage = localStorage.getItem('pokerLanguage') || 'en';

const TRANSLATIONS = {
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
        onlineUsers: 'Online Users'
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
        onlineUsers: '在线人数'
    }
};

// Get translated text
function t(key) {
    return TRANSLATIONS[currentLanguage][key] || TRANSLATIONS.en[key] || key;
}

// Translate hand name (for win badges and messages)
function translateHandName(englishName) {
    const handMap = {
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
    const key = handMap[englishName];
    return key ? t(key) : englishName;
}

// Get translated player name
function getTranslatedPlayerName(player) {
    return player.id === 0 ? t('you') : `${t('aiPlayer')} ${player.id}`;
}

// Switch language
function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
    localStorage.setItem('pokerLanguage', currentLanguage);
    updateLanguageUI();
}

// Update all UI text to current language
function updateLanguageUI() {
    // Update language button
    const langBtn = document.getElementById('btn-language');
    if (langBtn) {
        langBtn.textContent = currentLanguage === 'en' ? '中文' : 'EN';
    }

    // Update title
    const title = document.querySelector('.game-header h1');
    if (title) title.textContent = t('title');

    // Update NEW GAME button
    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn && !newGameBtn.classList.contains('cooldown')) {
        newGameBtn.textContent = t('newGame');
    }

    // Update betting buttons
    document.getElementById('btn-fold').textContent = t('fold');
    document.getElementById('btn-check').textContent = t('check');
    document.getElementById('btn-raise').textContent = t('raise');
    document.getElementById('btn-allin').textContent = t('allIn');

    // Call button has dynamic amount
    const callBtn = document.getElementById('btn-call');
    const callAmount = document.getElementById('call-amount').textContent;
    callBtn.innerHTML = `${t('call')} $<span id="call-amount">${callAmount}</span>`;

    // Update Continue button
    const continueBtn = document.getElementById('btn-continue');
    if (continueBtn) continueBtn.textContent = t('continue');

    // Update pot label
    const potLabel = document.querySelector('.pot-label');
    if (potLabel) potLabel.textContent = t('pot');

    // Update action history title
    const historyTitle = document.querySelector('.panel-header');
    if (historyTitle) historyTitle.textContent = t('actionHistory');

    // Update table title
    const tableTitle = document.querySelector('.table-title');
    if (tableTitle) tableTitle.textContent = t('tableTitle');

    // Update help popup
    const helpTitle = document.querySelector('.help-content h2');
    if (helpTitle) helpTitle.textContent = t('helpTitle');

    const helpSubtitle = document.querySelector('.help-subtitle');
    if (helpSubtitle) helpSubtitle.textContent = t('helpSubtitle');

    const helpOkBtn = document.getElementById('btn-help-ok');
    if (helpOkBtn) helpOkBtn.textContent = t('helpOk');

    // Update help popup hand rankings table
    const handNames = document.querySelectorAll('.hand-rankings-table .hand-name');
    const handDescs = document.querySelectorAll('.hand-rankings-table .hand-desc');
    const handKeys = ['royalFlush', 'straightFlush', 'fourOfAKind', 'fullHouse', 'flush', 'straight', 'threeOfAKind', 'twoPair', 'onePair', 'highCard'];

    handNames.forEach((el, i) => {
        if (handKeys[i]) el.textContent = t(handKeys[i]);
    });
    handDescs.forEach((el, i) => {
        if (handKeys[i]) el.textContent = t(handKeys[i] + 'Desc');
    });

    // Update player names
    for (let i = 0; i < gameState.players.length; i++) {
        const player = gameState.players[i];
        const nameEl = document.querySelector(`#player-${i} .player-name`);
        if (nameEl) {
            nameEl.textContent = i === 0 ? t('you') : `${t('aiPlayer')} ${i}`;
        }

        // Update level label if it's an AI
        if (player.isAI) {
            const levelEl = document.getElementById(`level-${player.id}`);
            if (levelEl) {
                levelEl.textContent = `(${t(player.aiLevel)})`;
                levelEl.title = t('changeDifficulty');
            }

            // Update Remove AI button tooltip
            const removeBtn = document.querySelector(`#player-${player.id} .btn-remove`);
            if (removeBtn) removeBtn.title = t('removeAI');

            // Update Add AI plus sign tooltip
            const plusSign = document.querySelector(`#player-${player.id} .player-add-plus`);
            if (plusSign) plusSign.title = t('addAI');
        }
    }

    // Update action history navigation buttons
    const btnPrev = document.getElementById('btn-prev-hand');
    const btnReturn = document.getElementById('btn-return-hand');
    const btnNext = document.getElementById('btn-next-hand');
    if (btnPrev) btnPrev.textContent = t('previous');
    if (btnReturn) btnReturn.textContent = t('returnText');
    if (btnNext) btnNext.textContent = t('next');

    // Update cursor effect dropdown
    const cursorSelect = document.getElementById('cursor-select');
    if (cursorSelect) {
        const options = cursorSelect.querySelectorAll('option');
        options.forEach(option => {
            const value = option.value;
            const key = 'cursor' + value.charAt(0).toUpperCase() + value.slice(1);
            option.textContent = t(key);
        });
    }

    // Update pot preset buttons
    const btnHalfPot = document.getElementById('btn-half-pot');
    const btnOnePot = document.getElementById('btn-one-pot');
    const btnTwoPot = document.getElementById('btn-two-pot');
    if (btnHalfPot) btnHalfPot.textContent = t('halfPot');
    if (btnOnePot) btnOnePot.textContent = t('onePot');
    if (btnTwoPot) btnTwoPot.textContent = t('twoPot');

    // Update game mode button
    updateGameModeUI();

    // Update hand number display
    updateHandNumberDisplay();

    // Update stats display with new language
    updateAllPlayerStatsDisplays();

    // Update hand rank name display (for best hand highlight)
    clearHighlightHumanBestHand();
    highlightHumanBestHand();

    // Update online count text
    const onlineCountEl = document.getElementById('online-count');
    if (onlineCountEl && onlineCountEl.dataset.count) {
        onlineCountEl.textContent = `🟢 ${t('onlineUsers')}: ${onlineCountEl.dataset.count}`;
    }
}

// Update hand number display with translation
function updateHandNumberDisplay() {
    const panelHandNumber = document.getElementById('panel-hand-number');
    if (panelHandNumber && handNumber > 0) {
        if (currentViewingHand === handNumber) {
            // Viewing current hand: "Hand #X" or "第X局"
            if (currentLanguage === 'zh') {
                panelHandNumber.textContent = `${t('hand')}${handNumber}${t('handSuffix') || ''}`;
            } else {
                panelHandNumber.textContent = `${t('hand')} #${handNumber}`;
            }
            panelHandNumber.classList.remove('viewing-past');
        } else {
            // Viewing past hand: "Hand #X of Y" or "第X局 / 共Y局"
            if (currentLanguage === 'zh') {
                panelHandNumber.textContent = `${t('hand')}${currentViewingHand}${t('handSuffix') || ''} / ${t('of')}${handNumber}${t('handSuffix') || ''}`;
            } else {
                panelHandNumber.textContent = `${t('hand')} #${currentViewingHand} ${t('of')} ${handNumber}`;
            }
            panelHandNumber.classList.add('viewing-past');
        }
    }
}

// ===== Sound Manager =====
const SoundManager = {
    // Sound URLs from free sources (Mixkit - royalty-free)
    sounds: {
        cardDeal: 'sound/card_deal.mp3',
        cardFlip: 'sound/card_deal.mp3',
        chips: 'sound/chips.mp3',
        check: 'sound/check.mp3',
        fold: 'sound/fold.mp3',
        win: 'sound/win.mp3',
        // win: 'sound/win2.wav',
        yourTurn: 'sound/ding.mp3',
        allIn: 'sound/all in.mp3'
    },

    // Background music (lofi/chill)
    musicUrl: 'sound/Jazz at Mladost Club - Blue Monk.mp3',

    // Audio elements cache
    audioCache: {},
    musicElement: null,

    // State
    musicEnabled: true,
    sfxEnabled: true,
    volume: 0.5,
    audioUnlocked: false, // Track if audio has been unlocked by user interaction

    // Initialize the sound manager
    init() {
        // Pre-load sounds
        for (const [name, url] of Object.entries(this.sounds)) {
            this.audioCache[name] = new Audio(url);
            this.audioCache[name].volume = this.volume;
            // Preload the audio
            this.audioCache[name].load();
        }

        // Setup background music
        this.musicElement = new Audio(this.musicUrl);
        this.musicElement.loop = true;
        this.musicElement.volume = this.volume * 0.5; // Music volume factor
        this.musicElement.load();

        // Setup UI controls
        this.setupControls();

        // Setup audio unlock on first user interaction (critical for Safari/iOS)
        this.setupAudioUnlock();
    },

    // Setup audio unlock for Safari/iOS
    // Safari requires user interaction before any audio can play
    setupAudioUnlock() {
        const unlockAudio = () => {
            if (this.audioUnlocked) return;

            // Try to play and immediately pause all audio to "unlock" them
            const unlockPromises = [];

            // Unlock all cached sound effects
            for (const audio of Object.values(this.audioCache)) {
                audio.muted = true;
                const promise = audio.play().then(() => {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.muted = false;
                }).catch(() => { });
                unlockPromises.push(promise);
            }

            // Unlock music element
            if (this.musicElement) {
                this.musicElement.muted = true;
                const promise = this.musicElement.play().then(() => {
                    this.musicElement.pause();
                    this.musicElement.currentTime = 0;
                    this.musicElement.muted = false;
                }).catch(() => { });
                unlockPromises.push(promise);
            }

            Promise.all(unlockPromises).then(() => {
                this.audioUnlocked = true;
                console.log('Audio unlocked successfully');
            });
        };

        // Listen for various user interaction events
        const events = ['click', 'touchstart', 'keydown'];
        const unlockHandler = () => {
            unlockAudio();
            // Remove listeners after first interaction
            events.forEach(e => document.removeEventListener(e, unlockHandler));
        };
        events.forEach(e => document.addEventListener(e, unlockHandler, { once: true }));
    },

    // Setup UI control event listeners
    setupControls() {
        const musicBtn = document.getElementById('btn-music');
        const sfxBtn = document.getElementById('btn-sfx');
        const volumeSlider = document.getElementById('volume-slider');

        if (musicBtn) {
            musicBtn.addEventListener('click', () => this.toggleMusic());
        }

        if (sfxBtn) {
            sfxBtn.addEventListener('click', () => this.toggleSfx());
        }

        if (volumeSlider) {
            volumeSlider.value = this.volume * 100;
            volumeSlider.addEventListener('input', (e) => {
                this.setVolume(e.target.value / 100);
            });
        }
    },

    // Toggle background music
    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
        const btn = document.getElementById('btn-music');

        if (this.musicEnabled) {
            btn.classList.remove('muted');
            btn.textContent = '🎵';
            // Restore volume (music was playing silently)
            if (this.musicElement) {
                this.musicElement.volume = this.volume * 0.5;
            }
        } else {
            btn.classList.add('muted');
            btn.textContent = '🎵';
            // Mute by setting volume to 0 (music keeps playing)
            if (this.musicElement) {
                this.musicElement.volume = 0;
            }
        }
    },

    // Toggle sound effects
    toggleSfx() {
        this.sfxEnabled = !this.sfxEnabled;
        const btn = document.getElementById('btn-sfx');

        if (this.sfxEnabled) {
            btn.classList.remove('muted');
            btn.textContent = '🔊';
        } else {
            btn.classList.add('muted');
            btn.textContent = '🔇';
        }
    },

    // Set volume (0-1)
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));

        // Update all cached audio volumes
        for (const audio of Object.values(this.audioCache)) {
            audio.volume = this.volume;
        }

        // Update music volume (only if music is enabled)
        if (this.musicElement && this.musicEnabled) {
            this.musicElement.volume = this.volume * 0.5;
        }
    },

    // Play a sound effect
    play(soundName) {
        if (!this.sfxEnabled) return;

        const audio = this.audioCache[soundName];
        if (audio) {
            // Clone and play to allow overlapping sounds
            const clone = audio.cloneNode();
            clone.volume = this.volume;
            clone.play().catch(() => { }); // Ignore autoplay errors
            // Clean up clone after playback to prevent memory leak
            clone.addEventListener('ended', () => clone.remove());
        }
    },

    // Start background music
    playMusic() {
        if (!this.musicEnabled || !this.musicElement) return;

        // Ensure audio element is ready
        if (this.musicElement.readyState < 2) {
            // Audio not ready yet, wait for it
            this.musicElement.addEventListener('canplaythrough', () => {
                this.musicElement.play().catch((err) => {
                    console.log('Music play failed:', err.message);
                });
            }, { once: true });
            this.musicElement.load();
        } else {
            this.musicElement.play().catch((err) => {
                // Autoplay blocked - will work after user interaction
                console.log('Music autoplay blocked:', err.message);
            });
        }
    },

    // Stop background music (fully stops and resets - used for game over, etc.)
    stopMusic() {
        if (this.musicElement) {
            this.musicElement.pause();
            this.musicElement.currentTime = 0;
        }
    },

    // Convenience methods for specific sounds
    playCardDeal() { this.play('cardDeal'); },
    playCardFlip() { this.play('cardFlip'); },
    playChips() { this.play('chips'); },
    playCheck() { this.play('check'); },
    playFold() { this.play('fold'); },
    playWin() { this.play('win'); },
    playYourTurn() { this.play('yourTurn'); },
    playAllIn() { this.play('allIn'); }
};

// Game State
let gameState = {
    deck: [],
    players: [],
    communityCards: [],
    pot: 0,
    currentBet: 0,
    dealerIndex: 0,
    currentPlayerIndex: 0,
    phase: 'idle', // idle, preflop, flop, turn, river, showdown
    minRaise: BIG_BLIND,
    displayedCommunityCards: 0,
    preflopRaiseCount: 0, // Track number of raises in preflop (0=limp/blinds, 1=open raise, 2=3bet, 3=4bet)
    preflopAggressorId: null, // Player ID of the last raiser in preflop
    cBetActive: false // Flag if the current active bet is a C-bet
};

// Hand History State
let handNumber = 0; // Current hand number
let handHistories = []; // Array to store history for each hand
let currentViewingHand = 0; // Which hand history we're currently viewing
let currentGameId = 0; // Game ID to track and cancel previous games

// Initialize Players
function initPlayers() {
    const defaultStats = {
        handsPlayed: 0,
        vpipCount: 0,        // Voluntarily put money in pot
        vpipCountedThisHand: false, // Flag to ensure VPIP only counted once per hand
        pfrCount: 0,         // Pre-flop raise
        pfrCountedThisHand: false,  // Flag to ensure PFR only counted once per hand
        threeBetCount: 0,    // Pre-flop 3-bet (re-raise against open raise)
        threeBetCountedThisHand: false, // Flag to ensure 3-bet only counted once per hand
        facedOpenRaiseCount: 0, // Opportunities to 3-bet (faced exactly one raise)
        facedOpenRaiseCountedThisHand: false, // Flag to ensure opportunity only counted once per hand
        cBetCount: 0,        // Continuation bet (preflop aggressor bets on flop)
        cBetCountedThisHand: false,
        cBetOpportunityCount: 0, // Opportunity to C-bet
        cBetOpportunityCountedThisHand: false,
        cBetFaced: 0,        // Times faced a c-bet
        cBetFacedCountedThisHand: false,
        foldToCBetCount: 0,  // Folded to continuation bet
        showdownCount: 0    // Times went to showdown
    };

    gameState.players = [
        { id: 0, name: 'You', chips: STARTING_CHIPS, cards: [], bet: 0, totalContribution: 0, folded: false, isAI: false, allIn: false, isRemoved: false, isPendingJoin: false, stats: { ...defaultStats } },
        { id: 1, name: 'AI Player 1', chips: STARTING_CHIPS, cards: [], bet: 0, totalContribution: 0, folded: false, isAI: true, allIn: false, aiLevel: 'medium', isRemoved: false, isPendingJoin: false, stats: { ...defaultStats } },
        { id: 2, name: 'AI Player 2', chips: STARTING_CHIPS, cards: [], bet: 0, totalContribution: 0, folded: false, isAI: true, allIn: false, aiLevel: 'medium', isRemoved: false, isPendingJoin: false, stats: { ...defaultStats } },
        { id: 3, name: 'AI Player 3', chips: STARTING_CHIPS, cards: [], bet: 0, totalContribution: 0, folded: false, isAI: true, allIn: false, aiLevel: 'medium', isRemoved: false, isPendingJoin: false, stats: { ...defaultStats } },
        { id: 4, name: 'AI Player 4', chips: STARTING_CHIPS, cards: [], bet: 0, totalContribution: 0, folded: false, isAI: true, allIn: false, aiLevel: 'medium', isRemoved: false, isPendingJoin: false, stats: { ...defaultStats } }
    ];
}

// Reset a player's stats to default values
function resetPlayerStats(player) {
    player.stats = {
        handsPlayed: 0,
        vpipCount: 0,
        vpipCountedThisHand: false,
        pfrCount: 0,
        pfrCountedThisHand: false,
        threeBetCount: 0,
        threeBetCountedThisHand: false,
        facedOpenRaiseCount: 0,
        facedOpenRaiseCountedThisHand: false,
        cBetCount: 0,
        cBetCountedThisHand: false,
        cBetOpportunityCount: 0,
        cBetOpportunityCountedThisHand: false,
        cBetFaced: 0,
        cBetFacedCountedThisHand: false,
        foldToCBetCount: 0,
        showdownCount: 0
    };
}


// Create and Shuffle Deck
function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ suit, value });
        }
    }
    return shuffleDeck(deck);
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// Deal Cards
function dealCard() {
    return gameState.deck.pop();
}

// Get dealing order (clockwise, starting after dealer, dealer last)
function getDealingOrder() {
    const order = [];
    const numPlayers = gameState.players.length;
    // Clockwise: 0 -> 1 -> 2 -> 3 -> 4 -> 0
    let currentIndex = (gameState.dealerIndex + 1) % numPlayers;
    for (let i = 0; i < numPlayers; i++) {
        const player = gameState.players[currentIndex];
        // Include all-in players (chips >= 0) - they still need cards dealt
        if (!player.folded && player.chips >= 0) {
            order.push(currentIndex);
        }
        currentIndex = (currentIndex + 1) % numPlayers;
    }
    return order;
}

// Deal hole cards with animation (async)
async function dealHoleCards(thisGameId) {
    const dealingOrder = getDealingOrder();

    // Minimum time for dealer GIF to play (in ms)
    const MIN_GIF_DURATION = 2000;
    const startTime = Date.now();

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_PREFLOP, thisGameId);

    // Deal first card to each player
    for (const playerId of dealingOrder) {
        // Check if game was cancelled
        if (currentGameId !== thisGameId) {
            hideDealerAnimation(thisGameId);
            return;
        }

        const player = gameState.players[playerId];
        player.cards.push(dealCard());
        updatePlayerCardsAnimated(playerId);
        SoundManager.playCardDeal();
        await delay(200);
    }

    // Deal second card to each player
    for (const playerId of dealingOrder) {
        // Check if game was cancelled
        if (currentGameId !== thisGameId) {
            hideDealerAnimation(thisGameId);
            return;
        }

        const player = gameState.players[playerId];
        player.cards.push(dealCard());
        updatePlayerCardsAnimated(playerId);
        SoundManager.playCardDeal();
        await delay(200);
    }

    // Wait for minimum GIF duration if dealing was faster
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_GIF_DURATION) {
        await delay(MIN_GIF_DURATION - elapsed);
    }

    // Check if game was cancelled during extra wait
    if (currentGameId !== thisGameId) {
        hideDealerAnimation(thisGameId);
        return;
    }

    // Hide dealer animation
    hideDealerAnimation(thisGameId);
}

// Card Display
function getCardHTML(card, isHidden = false, animate = true) {
    const animClass = animate ? ' dealing' : '';
    if (isHidden) {
        return `<div class="card card-back${animClass}"></div>`;
    }
    const isRed = card.suit === '♥' || card.suit === '♦';
    return `
        <div class="card card-face ${isRed ? 'red' : 'black'}${animClass}">
            <span class="card-value">${card.value}</span>
            <span class="card-suit">${card.suit}</span>
        </div>
    `;
}

// Animate a card element from dealer gif position to its current position
function animateCardFromDealer(cardElement) {
    const dealerGif = document.getElementById('dealer-gif');
    if (!dealerGif || !cardElement) return;

    // Remove animation class temporarily
    cardElement.classList.remove('dealing');

    const dealerRect = dealerGif.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    // Calculate offset from dealer to card destination
    const offsetX = dealerRect.left + dealerRect.width / 2 - cardRect.left - cardRect.width / 2;
    const offsetY = dealerRect.top + dealerRect.height / 2 - cardRect.top - cardRect.height / 2;

    // Set CSS custom properties for the animation
    cardElement.style.setProperty('--deal-start-x', `${offsetX}px`);
    cardElement.style.setProperty('--deal-start-y', `${offsetY}px`);

    // Force reflow to ensure properties are applied before animation
    cardElement.offsetHeight;

    // Re-add animation class to trigger animation
    cardElement.classList.add('dealing');

    // Remove 'dealing' class after animation ends to enable hover effects
    // (CSS animations with 'forwards' fill mode take precedence over :hover transforms)
    cardElement.addEventListener('animationend', function handleAnimationEnd() {
        cardElement.classList.remove('dealing');
        cardElement.removeEventListener('animationend', handleAnimationEnd);
    });
}

function updatePlayerCards(playerId, isHidden = false) {
    const player = gameState.players[playerId];
    const cardsContainer = document.getElementById(`cards-${playerId}`);

    // Show placeholders for players with no cards OR folded AI players
    if (player.cards.length === 0 || (player.folded && player.isAI)) {
        cardsContainer.innerHTML = `
            <div class="card card-placeholder"></div>
            <div class="card card-placeholder"></div>
        `;
        return;
    }

    const hidden = isHidden && player.isAI && gameState.phase !== 'showdown';

    // Skip rebuild if cards already exist and match (preserves highlight classes)
    // But don't skip if player just folded (need to remove highlight classes)
    const existingCards = cardsContainer.querySelectorAll('.card-face');
    if (existingCards.length === player.cards.length && !hidden && !player.folded) {
        let allMatch = true;
        existingCards.forEach((el, i) => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (!valueEl || !suitEl ||
                valueEl.textContent !== player.cards[i].value ||
                suitEl.textContent !== player.cards[i].suit) {
                allMatch = false;
            }
        });
        if (allMatch) return; // Cards already displayed correctly, skip rebuild
    }

    cardsContainer.innerHTML = player.cards.map(card => getCardHTML(card, hidden, false)).join('');
}

// Update player cards with animation for the newly dealt card
function updatePlayerCardsAnimated(playerId) {
    const player = gameState.players[playerId];
    const cardsContainer = document.getElementById(`cards-${playerId}`);
    const hidden = player.isAI;

    let html = '';
    // Always show 2 card slots - placeholder underneath, card overlaid on top
    for (let i = 0; i < 2; i++) {
        if (i < player.cards.length) {
            // Only animate the last (newly dealt) card
            const shouldAnimate = (i === player.cards.length - 1);
            // Wrap in a container with placeholder underneath and card on top
            html += `<div class="card-slot">
                <div class="card card-placeholder"></div>
                ${getCardHTML(player.cards[i], hidden, shouldAnimate)}
            </div>`;
        } else {
            // Show just placeholder for undealt cards
            html += '<div class="card-slot"><div class="card card-placeholder"></div></div>';
        }
    }
    cardsContainer.innerHTML = html;

    // Set animation start position from dealer gif
    const dealingCard = cardsContainer.querySelector('.card.dealing');
    if (dealingCard) {
        animateCardFromDealer(dealingCard);
    }
}

function updateCommunityCards() {
    const container = document.getElementById('community-cards');

    // Check if we need to rebuild or just add new cards
    const existingSlots = container.querySelectorAll('.card-slot');
    const existingFaceCards = container.querySelectorAll('.card-face');

    // If existing cards match current state, skip rebuild (preserves highlight classes)
    if (existingFaceCards.length === gameState.communityCards.length &&
        gameState.displayedCommunityCards === gameState.communityCards.length) {
        let allMatch = true;
        existingFaceCards.forEach((el, i) => {
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (!valueEl || !suitEl ||
                valueEl.textContent !== gameState.communityCards[i].value ||
                suitEl.textContent !== gameState.communityCards[i].suit) {
                allMatch = false;
            }
        });
        if (allMatch) return; // Cards already displayed correctly, skip rebuild
    }

    // Clear ALL highlights (including hole cards) when rebuilding community cards
    // This ensures hole cards and community cards highlights are consistent during animation
    clearHighlightHumanBestHand();

    let html = '';

    for (let i = 0; i < 5; i++) {
        if (i < gameState.communityCards.length) {
            // Only animate newly dealt cards
            const shouldAnimate = i >= gameState.displayedCommunityCards;
            // Wrap in card-slot with placeholder underneath and card on top
            html += `<div class="card-slot community-slot">
                <div class="card card-placeholder"></div>
                ${getCardHTML(gameState.communityCards[i], false, shouldAnimate)}
            </div>`;
        } else {
            html += '<div class="card-slot community-slot"><div class="card card-placeholder"></div></div>';
        }
    }

    container.innerHTML = html;

    // Set animation start position from dealer gif for community cards
    const dealingCards = container.querySelectorAll('.card.dealing');
    dealingCards.forEach(card => animateCardFromDealer(card));

    // Update the count of displayed cards
    gameState.displayedCommunityCards = gameState.communityCards.length;
}

// Clear human player's best hand highlight and hand rank name
function clearHighlightHumanBestHand() {
    document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));
    const existingName = document.querySelector('.hand-rank-name');
    if (existingName) existingName.remove();
}

// Highlight best hand for human player (Flop/Turn/River only)
function highlightHumanBestHand() {
    // Only run in post-flop phases (flop, turn, river)
    const validPhases = ['flop', 'turn', 'river'];
    if (!validPhases.includes(gameState.phase)) return;

    const humanPlayer = gameState.players[0];
    if (humanPlayer.folded || humanPlayer.isRemoved) {
        clearHighlightHumanBestHand(); // Clear highlights when player folds
        return;
    }

    // Combine hole cards and community cards
    const allCards = [...humanPlayer.cards, ...gameState.communityCards];
    // Need at least 5 cards for a valid poker hand
    if (allCards.length < 5) return;

    const handResult = evaluateHand(allCards);

    // Remove existing hand name display if any
    const existingName = document.querySelector('.hand-rank-name');
    if (existingName) existingName.remove();

    // No need to highlight if hand rank is High Card
    if (handResult.name === 'High Card') {
        document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));
        return;
    }

    // Display corresponding hand rank name
    const handNameEl = document.createElement('div');
    handNameEl.className = 'hand-rank-name';
    handNameEl.textContent = translateHandName(handResult.name);

    // Append to Community Cards container
    const communityCardsEl = document.getElementById('community-cards');
    if (communityCardsEl) {
        communityCardsEl.appendChild(handNameEl);
    }

    // Highlight cards based on hand type
    // First clear any existing highlights to be safe
    document.querySelectorAll('.card.highlight').forEach(el => el.classList.remove('highlight'));

    // Determine which cards to highlight based on hand type
    let cardsToHighlight = [];
    const handName = handResult.name;
    const bestCards = handResult.bestCards;

    if (handName === 'One Pair') {
        // Find the pair (2 cards with same value)
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const pairValue = Object.keys(valueCounts).find(v => valueCounts[v] === 2);
        cardsToHighlight = bestCards.filter(card => card.value === pairValue);
    } else if (handName === 'Two Pair') {
        // Find both pairs (4 cards total)
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const pairValues = Object.keys(valueCounts).filter(v => valueCounts[v] === 2);
        cardsToHighlight = bestCards.filter(card => pairValues.includes(card.value));
    } else if (handName === 'Three of a Kind') {
        // Find the trips (3 cards with same value)
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const tripsValue = Object.keys(valueCounts).find(v => valueCounts[v] === 3);
        cardsToHighlight = bestCards.filter(card => card.value === tripsValue);
    } else if (handName === 'Four of a Kind') {
        // Find the quads (4 cards with same value)
        const valueCounts = {};
        bestCards.forEach(card => {
            valueCounts[card.value] = (valueCounts[card.value] || 0) + 1;
        });
        const quadsValue = Object.keys(valueCounts).find(v => valueCounts[v] === 4);
        cardsToHighlight = bestCards.filter(card => card.value === quadsValue);
    } else if (handName === 'Full House') {
        // Highlight all 5 cards (3 + 2)
        cardsToHighlight = bestCards;
    } else {
        // Straight, Flush, Straight Flush, Royal Flush - highlight all 5
        cardsToHighlight = bestCards;
    }

    // Helper to find and highlight a card in a container
    const highlightCardInContainer = (containerId, card) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const cardEls = container.querySelectorAll('.card');

        cardEls.forEach(el => {
            // Match by value and suit text content
            const valueEl = el.querySelector('.card-value');
            const suitEl = el.querySelector('.card-suit');
            if (valueEl && suitEl) {
                if (valueEl.textContent === card.value && suitEl.textContent === card.suit) {
                    el.classList.add('highlight');
                }
            }
        });
    };

    cardsToHighlight.forEach(card => {
        highlightCardInContainer('cards-0', card);
        highlightCardInContainer('community-cards', card);
    });
}

// UI Updates
function updateUI() {
    // Update pot
    document.getElementById('pot-amount').textContent = `$${gameState.pot}`;
    // Show/hide pot chip based on pot amount
    const potChip = document.querySelector('.pot-chip');
    if (potChip) {
        potChip.style.display = gameState.pot > 0 ? 'block' : 'none';
    }

    // Update all players
    for (const player of gameState.players) {
        document.getElementById(`chips-${player.id}`).textContent = player.chips;

        const playerEl = document.getElementById(`player-${player.id}`);
        playerEl.classList.toggle('folded', player.folded);
        playerEl.classList.toggle('removed', !!player.isRemoved);
        // Only show active state when game is in progress (not idle) and player can act
        const isActivePlayer = gameState.phase !== 'idle' &&
            gameState.currentPlayerIndex === player.id &&
            !player.folded && !player.allIn;
        playerEl.classList.toggle('active', isActivePlayer);
        // Add game mode class for styling (fast-mode or slow-mode)
        playerEl.classList.toggle('fast-mode', gameMode === 'fast');
        playerEl.classList.toggle('slow-mode', gameMode === 'slow');

        // Update dealer chip
        const dealerChip = document.getElementById(`dealer-${player.id}`);
        dealerChip.classList.toggle('visible', gameState.dealerIndex === player.id && !player.isRemoved);

        updatePlayerCards(player.id, true);
        updateBetDisplay(player.id);

        // Update AI Level and Add/Remove display
        if (player.isAI) {
            const levelEl = document.getElementById(`level-${player.id}`);
            const avatarContainer = document.getElementById(`avatar-${player.id}`);

            // Handle remove button
            let removeBtn = playerEl.querySelector('.btn-remove');
            if (!removeBtn) {
                removeBtn = document.createElement('button');
                removeBtn.className = 'btn-remove';
                removeBtn.innerHTML = '×';
                removeBtn.title = t('removeAI');
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeAIPlayer(player.id);
                };
                playerEl.querySelector('.player-info').appendChild(removeBtn);
            }
            removeBtn.style.display = player.isRemoved ? 'none' : 'block';

            // Handle plus sign for removed state
            let plusSign = playerEl.querySelector('.player-add-plus');
            if (!plusSign) {
                plusSign = document.createElement('div');
                plusSign.className = 'player-add-plus';
                plusSign.innerHTML = '+';
                plusSign.title = t('addAI');
                plusSign.onclick = (e) => {
                    e.stopPropagation();
                    addAIPlayer(player.id);
                };
                playerEl.querySelector('.player-info').appendChild(plusSign);
            }
            plusSign.style.display = player.isRemoved ? 'flex' : 'none';

            if (levelEl) {
                levelEl.textContent = `(${t(player.aiLevel)})`;
                levelEl.title = t('changeDifficulty');
                levelEl.className = `player-level ${player.aiLevel}`;
                levelEl.style.display = player.isRemoved ? 'none' : 'block';

                // Add click listener if not already added
                if (!levelEl.onclick) {
                    levelEl.onclick = (e) => {
                        e.stopPropagation();
                        toggleAILevel(player.id);
                    }
                }
            }

            // Hide normal details if removed
            const nameEl = playerEl.querySelector('.player-name');
            const chipsEl = playerEl.querySelector('.player-chips');
            if (nameEl) nameEl.style.display = player.isRemoved ? 'none' : 'block';
            if (chipsEl) chipsEl.style.display = player.isRemoved ? 'none' : 'block';
            if (avatarContainer) avatarContainer.style.display = player.isRemoved ? 'none' : 'flex';
        }
    }

    updateCommunityCards();
    updateControls();
    highlightHumanBestHand();
}

function updateBetDisplay(playerId) {
    const player = gameState.players[playerId];
    const betDisplay = document.getElementById(`bet-${playerId}`);
    const betAmount = betDisplay.querySelector('.bet-amount');

    if (player.bet > 0) {
        betAmount.textContent = `$${player.bet}`;
        betDisplay.classList.add('visible');
    } else {
        betDisplay.classList.remove('visible');
    }
}

function updateControls() {
    const controls = document.getElementById('controls');
    const player = gameState.players[0];

    // Always show controls (remove hidden class)
    controls.classList.remove('hidden');

    // Determine if controls should be active (user's turn and can act)
    const isUserTurn = gameState.currentPlayerIndex === 0;
    const canAct = gameState.phase !== 'idle' &&
        gameState.phase !== 'showdown' &&
        !player.folded &&
        !player.allIn;
    const isActive = isUserTurn && canAct;

    // Toggle disabled state on controls container
    controls.classList.toggle('disabled', !isActive);
    // Toggle active state for shining effect when player's turn
    controls.classList.toggle('active', isActive);

    const callAmount = gameState.currentBet - player.bet;
    const canCheck = callAmount === 0;

    document.getElementById('btn-check').style.display = canCheck ? 'block' : 'none';
    document.getElementById('btn-call').style.display = canCheck ? 'none' : 'block';
    document.getElementById('call-amount').textContent = Math.min(callAmount, player.chips);

    // Raise slider
    const slider = document.getElementById('raise-slider');
    const minRaise = gameState.currentBet + gameState.minRaise;
    slider.min = minRaise;
    slider.max = player.chips + player.bet;
    slider.value = minRaise;
    document.getElementById('raise-amount').textContent = minRaise;

    // Disable all buttons if not active, otherwise check individual conditions
    const allButtons = controls.querySelectorAll('.btn');
    allButtons.forEach(btn => btn.disabled = !isActive);

    // Special case: disable raise if can't afford (even when active)
    if (isActive) {
        document.getElementById('btn-raise').disabled = player.chips <= callAmount;
    }

    // Disable slider when not active
    slider.disabled = !isActive;
}

function showAction(playerId, action, chipsBeforeAction = null) {
    const actionEl = document.getElementById(`action-${playerId}`);
    actionEl.textContent = action;
    actionEl.classList.add('visible');

    setTimeout(() => {
        actionEl.classList.remove('visible');
    }, 2000);

    // Log the action with player's chip amount before the action
    const player = gameState.players[playerId];
    const name = playerId === 0 ? t('you') : `${t('aiPlayer')} ${playerId}`;
    // Use provided chipsBeforeAction, or fallback to current chips (for fold/check)
    const chipAmount = chipsBeforeAction !== null ? chipsBeforeAction : player.chips;
    showMessage(`${name}($${chipAmount}): ${action}`);
}

// Helper to append log entry HTML to current hand's history
// If viewing past hand, save to memory; if viewing current hand, also append to DOM
function appendToCurrentHandHistory(entryHTML) {
    // Initialize current hand's history array if needed
    if (!handHistories[handNumber - 1]) {
        handHistories[handNumber - 1] = [];
    }

    // Always save to the current hand's history array
    handHistories[handNumber - 1].push(entryHTML);

    // Only update the DOM if viewing the current hand
    if (currentViewingHand === handNumber) {
        const history = document.getElementById('action-history');
        if (history) {
            history.insertAdjacentHTML('beforeend', entryHTML);
            history.scrollTop = history.scrollHeight;
        }
    }
}

function showMessage(message, phaseOverride = null) {
    if (!message) return;

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });

    // Translate phase name
    const phaseKey = phaseOverride || (gameState.phase === 'idle' ? 'start' : gameState.phase);
    const phase = t(phaseKey) || phaseKey.toUpperCase();

    const entryHTML = `
        <div class="log-entry">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${phase}</span>
            </div>
            <div class="log-content">${message}</div>
        </div>
    `;

    appendToCurrentHandHistory(entryHTML);
}

// Hand Evaluation
function getCardValue(value) {
    const valueMap = { 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return valueMap[value] || parseInt(value);
}

function evaluateHand(cards) {
    if (cards.length < 5) return { rank: 0, name: 'Incomplete', highCards: [], bestCards: [] };

    // Get all 5-card combinations
    const combinations = getCombinations(cards, 5);
    let bestHand = { rank: 0, name: 'High Card', highCards: [], score: 0, bestCards: [] };

    for (const combo of combinations) {
        const hand = evaluateFiveCards(combo);
        hand.bestCards = combo; // Store the actual 5-card combo
        if (hand.score > bestHand.score) {
            bestHand = hand;
        }
    }

    return bestHand;
}

function getCombinations(arr, size) {
    const result = [];

    function combine(start, combo) {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }

    combine(0, []);
    return result;
}

function evaluateFiveCards(cards) {
    const values = cards.map(c => getCardValue(c.value)).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);

    const valueCounts = {};
    for (const v of values) {
        valueCounts[v] = (valueCounts[v] || 0) + 1;
    }

    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    const uniqueValues = [...new Set(values)].sort((a, b) => b - a);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = checkStraight(uniqueValues);
    const isAceLowStraight = JSON.stringify(uniqueValues) === JSON.stringify([14, 5, 4, 3, 2]);

    let rank, name, score;

    // Helper to get kickers (cards not part of the main hand)
    function getKickers(excludeValues) {
        return values.filter(v => !excludeValues.includes(v));
    }

    if (isFlush && isStraight && values[0] === 14 && values[1] === 13) {
        rank = 10; name = 'Royal Flush';
        score = 10000000;
    } else if (isFlush && (isStraight || isAceLowStraight)) {
        rank = 9; name = 'Straight Flush';
        score = 9000000 + (isAceLowStraight ? 5 : values[0]);
    } else if (counts[0] === 4) {
        rank = 8; name = 'Four of a Kind';
        const quadValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 4));
        const kicker = getKickers([quadValue])[0];
        // Score: quad value + kicker - use base-15 for lexicographic ordering
        score = 8000000 + quadValue * 15 + kicker;
    } else if (counts[0] === 3 && counts[1] === 2) {
        rank = 7; name = 'Full House';
        const tripValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 3));
        const pairValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
        // No kickers in full house - trips then pair, use base-15
        score = 7000000 + tripValue * 15 + pairValue;
    } else if (isFlush) {
        rank = 6; name = 'Flush';
        // All 5 cards matter for flush comparison - use base-15 for lexicographic ordering
        // Max: 14*50625 + 14*3375 + 14*225 + 14*15 + 14 = 759,374 (under 1M)
        score = 6000000 + values[0] * 50625 + values[1] * 3375 + values[2] * 225 + values[3] * 15 + values[4];
    } else if (isStraight || isAceLowStraight) {
        rank = 5; name = 'Straight';
        // Only high card matters for straight
        score = 5000000 + (isAceLowStraight ? 5 : values[0]);
    } else if (counts[0] === 3) {
        rank = 4; name = 'Three of a Kind';
        const tripValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 3));
        const kickers = getKickers([tripValue]);
        // Score: trip value + 2 kickers - use base-15 for lexicographic ordering
        score = 4000000 + tripValue * 3375 + kickers[0] * 225 + kickers[1] * 15;
    } else if (counts[0] === 2 && counts[1] === 2) {
        rank = 3; name = 'Two Pair';
        const pairs = Object.keys(valueCounts).filter(k => valueCounts[k] === 2).map(Number).sort((a, b) => b - a);
        const kicker = getKickers(pairs)[0];
        // Score: high pair + low pair + kicker - use base-15 for lexicographic ordering
        score = 3000000 + pairs[0] * 3375 + pairs[1] * 225 + kicker * 15;
    } else if (counts[0] === 2) {
        rank = 2; name = 'One Pair';
        const pairValue = parseInt(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
        const kickers = getKickers([pairValue]);
        // Score: pair value (most important) + 3 kickers in order
        // Multipliers use base-15 positions (15^3, 15^2, 15^1, 15^0) to ensure lexicographic ordering
        // Max: 14*3375 + 14*225 + 14*15 + 14 = 47,250 + 3,150 + 210 + 14 = 50,624 (well under 1M)
        score = 2000000 + pairValue * 3375 + kickers[0] * 225 + kickers[1] * 15 + kickers[2];
    } else {
        rank = 1; name = 'High Card';
        // All 5 cards matter - use base-15 for lexicographic ordering
        // Max: 14*50625 + 14*3375 + 14*225 + 14*15 + 14 = 759,374 (under 1M)
        score = 1000000 + values[0] * 50625 + values[1] * 3375 + values[2] * 225 + values[3] * 15 + values[4];
    }

    return { rank, name, highCards: values, score };
}

function checkStraight(values) {
    if (values.length !== 5) return false;
    for (let i = 0; i < values.length - 1; i++) {
        if (values[i] - values[i + 1] !== 1) return false;
    }
    return true;
}

// Betting Actions
function playerFold(playerId) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;

    // Trigger flying animation for AI players before marking as folded
    if (player.isAI) {
        animateFoldCards(playerId);
    }

    // Track "Fold to C-Bet"
    if (gameState.cBetActive) {
        player.stats.foldToCBetCount++;
    }

    player.folded = true;
    showAction(playerId, t('actionFold'), chipsBeforeAction);
    SoundManager.playFold();
    updateUI();
    updatePlayerStatsDisplay(playerId);
}

// Animate AI fold cards flying to center
function animateFoldCards(playerId) {
    const cardsContainer = document.getElementById(`cards-${playerId}`);
    const cards = cardsContainer.querySelectorAll('.card');
    const communityCards = document.querySelector('.community-cards');

    if (!communityCards || cards.length === 0) return;

    // Get the center of community cards area
    const communityRect = communityCards.getBoundingClientRect();
    const targetCenterX = communityRect.left + communityRect.width / 2;
    const targetCenterY = communityRect.top + communityRect.height / 2;

    cards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();

        // Starting position (card's current center)
        const startX = cardRect.left + cardRect.width / 2;
        const startY = cardRect.top + cardRect.height / 2;

        // Create a clone for animation
        const clone = card.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.left = `${startX - cardRect.width / 2}px`;
        clone.style.top = `${startY - cardRect.height / 2}px`;
        clone.style.width = `${cardRect.width}px`;
        clone.style.height = `${cardRect.height}px`;
        clone.style.zIndex = '2000';
        clone.style.pointerEvents = 'none';
        clone.style.margin = '0';

        document.body.appendChild(clone);

        // Use Web Animations API for reliable animation
        const animation = clone.animate([
            {
                left: `${startX - cardRect.width / 2}px`,
                top: `${startY - cardRect.height / 2}px`,
                opacity: 1,
                transform: 'scale(1) rotate(0deg)'
            },
            {
                left: `${targetCenterX - cardRect.width / 2}px`,
                top: `${targetCenterY - cardRect.height / 2}px`,
                opacity: 0,
                transform: 'scale(0.3) rotate(25deg)'
            }
        ], {
            duration: 500,
            delay: index * 80,
            easing: 'ease-in',
            fill: 'forwards'
        });

        // Remove clone after animation
        animation.onfinish = () => {
            clone.remove();
        };
    });

    // Hide original cards immediately by showing placeholders
    cardsContainer.innerHTML = `
        <div class="card card-placeholder"></div>
        <div class="card card-placeholder"></div>
    `;
}

function playerCheck(playerId) {
    const player = gameState.players[playerId];
    showAction(playerId, t('actionCheck'), player.chips);
    SoundManager.playCheck();
    updateUI();
    updatePlayerStatsDisplay(playerId);
}

function playerCall(playerId) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;
    const callAmount = Math.min(gameState.currentBet - player.bet, player.chips);

    // Track stats for opponent modeling
    if (callAmount > 0) {
        // VPIP only counts preflop voluntary actions, and only once per hand
        if (gameState.phase === 'preflop' && !player.stats.vpipCountedThisHand) {
            player.stats.vpipCount++;
            player.stats.vpipCountedThisHand = true;
        }
    }

    player.chips -= callAmount;
    player.bet += callAmount;
    player.totalContribution += callAmount;
    gameState.pot += callAmount;

    if (player.chips === 0) {
        player.allIn = true;
        showAction(playerId, t('actionAllIn'), chipsBeforeAction);
        SoundManager.playAllIn();
    } else {
        showAction(playerId, `${t('actionCall')} $${callAmount}`, chipsBeforeAction);
        SoundManager.playChips();
    }

    updateUI();
    updatePlayerStatsDisplay(playerId);
}

function playerRaise(playerId, totalBet) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;
    const raiseAmount = totalBet - player.bet;
    const actualRaise = totalBet - gameState.currentBet;

    // Track stats for opponent modeling
    if (gameState.phase === 'preflop') {
        // VPIP only counts once per hand
        if (!player.stats.vpipCountedThisHand) {
            player.stats.vpipCount++;
            player.stats.vpipCountedThisHand = true;
        }
        // PFR only counts once per hand
        if (!player.stats.pfrCountedThisHand) {
            player.stats.pfrCount++;
            player.stats.pfrCountedThisHand = true;
        }

        // Track 3-bets (re-raise against an open raise)
        gameState.preflopRaiseCount++;
        // If this is the 2nd raise (1st was open raise), it's a 3-bet
        if (gameState.preflopRaiseCount === 2) {
            if (!player.stats.threeBetCountedThisHand) {
                player.stats.threeBetCount++;
                player.stats.threeBetCountedThisHand = true;
            }
        }

        // Track preflop aggressor (last player to raise preflop)
        gameState.preflopAggressorId = playerId;
    } else if (gameState.phase === 'flop') {
        // Track C-bet (Continuation Bet)
        // Must be preflop aggressor, first bet on flop (gameState.currentBet was 0 before this raise)
        // Note: playerRaise is called for both betting (opening) and raising
        if (playerId === gameState.preflopAggressorId &&
            !player.stats.cBetCountedThisHand &&
            gameState.currentBet === 0) {
            player.stats.cBetCount++;
            player.stats.cBetCountedThisHand = true;
            gameState.cBetActive = true;
        } else {
            // Any other flop raise resets C-bet status (now it's a raise over a c-bet, or standard raise)
            gameState.cBetActive = false;
        }
    } else {
        // Raises in other phases reset C-bet active status
        gameState.cBetActive = false;
    }

    player.chips -= raiseAmount;
    player.bet = totalBet;
    player.totalContribution += raiseAmount;
    gameState.pot += raiseAmount;
    gameState.currentBet = totalBet;
    gameState.minRaise = Math.max(gameState.minRaise, actualRaise);

    if (player.chips === 0) {
        player.allIn = true;
        showAction(playerId, t('actionAllIn'), chipsBeforeAction);
        SoundManager.playAllIn();
    } else {
        showAction(playerId, `${t('actionRaise')} $${totalBet}`, chipsBeforeAction);
        SoundManager.playChips();
    }

    updateUI();
    updatePlayerStatsDisplay(playerId);
}

function playerAllIn(playerId) {
    const player = gameState.players[playerId];
    const chipsBeforeAction = player.chips;
    const allInAmount = player.chips;
    const newBet = player.bet + allInAmount;

    if (newBet > gameState.currentBet) {
        gameState.minRaise = Math.max(gameState.minRaise, newBet - gameState.currentBet);
        gameState.currentBet = newBet;
    }

    player.chips = 0;
    player.bet = newBet;
    player.totalContribution += allInAmount;
    player.allIn = true;
    gameState.pot += allInAmount;

    showAction(playerId, t('actionAllIn'), chipsBeforeAction);
    SoundManager.playAllIn();
    updateUI();
    updatePlayerStatsDisplay(playerId);
}

// AI Logic
function aiDecision(playerId) {
    const player = gameState.players[playerId];
    if (player.folded || player.allIn) return;

    const callAmount = gameState.currentBet - player.bet;
    const handStrength = evaluateAIHand(player);

    // Simple AI logic
    const random = Math.random();

    if (handStrength > 0.7) {
        // Strong hand - raise
        if (random > 0.3) {
            const raiseAmount = Math.min(
                gameState.currentBet + gameState.minRaise + Math.floor(Math.random() * 50),
                player.chips + player.bet
            );
            playerRaise(playerId, raiseAmount);
        } else {
            playerCall(playerId);
        }
    } else if (handStrength > 0.4) {
        // Medium hand - mostly call
        if (callAmount === 0) {
            playerCheck(playerId);
        } else if (callAmount <= player.chips * 0.2 || random > 0.3) {
            playerCall(playerId);
        } else {
            playerFold(playerId);
        }
    } else if (handStrength > 0.2) {
        // Weak hand - sometimes bluff
        if (callAmount === 0) {
            if (random > 0.7) {
                const raiseAmount = gameState.currentBet + gameState.minRaise;
                if (raiseAmount <= player.chips + player.bet) {
                    playerRaise(playerId, raiseAmount);
                } else {
                    playerCheck(playerId);
                }
            } else {
                playerCheck(playerId);
            }
        } else if (callAmount <= player.chips * 0.1) {
            playerCall(playerId);
        } else {
            playerFold(playerId);
        }
    } else {
        // Very weak hand - usually fold
        if (callAmount === 0) {
            playerCheck(playerId);
        } else if (callAmount <= player.chips * 0.05 && random > 0.5) {
            playerCall(playerId);
        } else {
            playerFold(playerId);
        }
    }
}

function toggleAILevel(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || player.isRemoved) return;

    if (player.aiLevel === 'easy') {
        player.aiLevel = 'medium';
    } else if (player.aiLevel === 'medium') {
        player.aiLevel = 'hard';
    } else {
        player.aiLevel = 'easy';
    }

    updateUI();
}

function removeAIPlayer(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || player.isRemoved) return;

    // Check minimum AI requirement
    const activeAIs = gameState.players.filter(p => p.isAI && !p.isRemoved);
    if (activeAIs.length <= 1) {
        showMessage(t('minAiRequired'));
        return;
    }

    player.isRemoved = true;
    player.folded = true; // folded immediately

    // Reset player stats
    resetPlayerStats(player);
    updatePlayerStatsDisplay(playerId);

    // Action log
    const name = `${t('aiPlayer')} ${playerId}`;
    showMessage(t('aiLeft').replace('{name}', name));

    // Update UI
    updateUI();

    // If it was the player's turn, resolve it
    if (gameState.currentPlayerIndex === playerId && gameState.phase !== 'idle' && gameState.phase !== 'showdown') {
        if (playerActionResolver) {
            resolvePlayerAction();
        } else {
            // If AI's turn during runBettingRound, it will continue in the loop
            // but we might need to trigger nextPlayer manually if the loop is waiting
        }
    }

    // Check if hand is over (only 1 player remains) - wake up the loop to handle it correctly in showdown
    const playersInHand = getPlayersInHand();
    if (playersInHand.length === 1 && gameState.phase !== 'idle' && gameState.phase !== 'showdown') {
        resolvePlayerAction();
    }
}


function addAIPlayer(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || !player.isRemoved) return;

    player.isRemoved = false;
    player.isPendingJoin = true; // Will join next hand
    player.chips = STARTING_CHIPS;
    player.folded = true; // Stay out of current hand
    player.allIn = false;
    player.bet = 0;
    player.cards = [];

    // Random portrait
    const avatarContainer = document.getElementById(`avatar-${playerId}`);
    if (avatarContainer) {
        const img = avatarContainer.querySelector('img');
        if (img) {
            const shuffled = [...AI_PORTRAITS].sort(() => Math.random() - 0.5);
            img.src = shuffled[0];
        }
    }

    // Action log
    const name = `${t('aiPlayer')} ${playerId}`;
    showMessage(t('aiJoined').replace('{name}', name));

    updateUI();
}

function evaluateAIHand(player) {
    const allCards = [...player.cards, ...gameState.communityCards];

    if (allCards.length < 2) return 0.3;

    // Preflop evaluation
    if (gameState.communityCards.length === 0) {
        const values = player.cards.map(c => getCardValue(c.value)).sort((a, b) => b - a);
        const suited = player.cards[0].suit === player.cards[1].suit;
        const paired = values[0] === values[1];

        let strength = 0.2;

        if (paired) {
            strength = 0.4 + (values[0] / 14) * 0.4;
        } else if (values[0] >= 12 && values[1] >= 10) {
            strength = 0.5 + (suited ? 0.1 : 0);
        } else if (values[0] >= 10) {
            strength = 0.35 + (suited ? 0.1 : 0);
        } else if (suited && Math.abs(values[0] - values[1]) <= 2) {
            strength = 0.35;
        }

        return strength;
    }

    // Post-flop evaluation
    const hand = evaluateHand(allCards);
    return hand.rank / 10;
}

// ===== Enhanced AI System (Medium/Hard modes) =====

// Convert hole cards to hand notation (e.g., 'AKs', 'QJo', 'TT')
function getHandNotation(card1, card2) {
    const v1 = card1.value === '10' ? 'T' : card1.value;
    const v2 = card2.value === '10' ? 'T' : card2.value;
    const val1 = getCardValue(card1.value);
    const val2 = getCardValue(card2.value);

    // Order by value (higher first)
    const [high, low] = val1 >= val2 ? [v1, v2] : [v2, v1];
    const suited = card1.suit === card2.suit;

    if (high === low) {
        return high + low; // Pair like 'AA', 'KK'
    }
    return high + low + (suited ? 's' : 'o');
}

// Get hand bucket (premium, strong, speculative, weak, trash)
function getHandBucket(card1, card2) {
    const notation = getHandNotation(card1, card2);

    if (BUCKET_PREMIUM.includes(notation)) return 'premium';
    if (BUCKET_STRONG.includes(notation)) return 'strong';
    if (BUCKET_SPECULATIVE.includes(notation)) return 'speculative';
    if (BUCKET_WEAK.includes(notation)) return 'weak';
    return 'trash';
}

// Get player position relative to dealer
function getPosition(playerId) {
    // Get all seated players (not removed) - position is fixed at start of hand
    const seatedPlayers = gameState.players.filter(p => !p.isRemoved);
    const numSeated = seatedPlayers.length;

    // Find the dealer and target player indices within the seated players list
    const dealerSeatedIndex = seatedPlayers.findIndex(p => p.id === gameState.dealerIndex);
    const targetSeatedIndex = seatedPlayers.findIndex(p => p.id === playerId);

    // Fallback if player or dealer not found
    if (dealerSeatedIndex === -1 || targetSeatedIndex === -1) {
        return 'late';
    }

    // Calculate position from dealer (0 = dealer, 1 = SB, 2 = BB, etc.)
    let posFromDealer = (targetSeatedIndex - dealerSeatedIndex + numSeated) % numSeated;

    // Map to position categories
    if (numSeated <= 3) {
        // Short-handed: dealer is late, others are blinds
        if (posFromDealer === 0) return 'late';  // Dealer/Button
        return 'blinds';  // SB/BB
    }

    // Full ring approximation (4+ players)
    if (posFromDealer === 0) return 'late';   // Dealer/Button (best position)
    if (posFromDealer <= 2) return 'blinds';  // SB (1) / BB (2)
    if (posFromDealer === 3) return 'early';  // UTG (first to act preflop)
    if (posFromDealer === 4) return 'middle'; // UTG+1 or Hijack
    return 'late'; // Cutoff and beyond
}

// Check if hand should be played based on position
function shouldPlayHand(bucket, position) {
    switch (position) {
        case 'early':
            return bucket === 'premium';
        case 'middle':
            return bucket === 'premium' || bucket === 'strong';
        case 'late':
            return bucket !== 'trash';
        case 'blinds':
            return bucket !== 'trash'; // Defend wider from blinds
        default:
            return bucket === 'premium' || bucket === 'strong';
    }
}

// Evaluate draw potential (flush draw, straight draw)
function evaluateDraws(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const draws = {
        flushDraw: false,      // 4 to a flush (9 outs)
        openEndedStraight: false, // 8 outs
        gutshot: false,        // 4 outs
        backdoorFlush: false,  // 3 to a flush
        outs: 0
    };

    if (communityCards.length < 3) return draws;

    // Check flush draw
    const suitCounts = {};
    for (const card of allCards) {
        suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }
    for (const count of Object.values(suitCounts)) {
        if (count === 4) {
            draws.flushDraw = true;
            draws.outs += 9;
        } else if (count === 3 && communityCards.length === 3) {
            draws.backdoorFlush = true;
            draws.outs += 1.5; // Backdoor worth ~1.5 outs
        }
    }

    // Check straight draw
    const values = allCards.map(c => getCardValue(c.value));
    const uniqueVals = [...new Set(values)].sort((a, b) => a - b);

    // Check for open-ended straight draw (4 consecutive with room on both ends)
    for (let i = 0; i <= uniqueVals.length - 4; i++) {
        const span = uniqueVals[i + 3] - uniqueVals[i];
        if (span === 3) {
            // 4 consecutive - check if open-ended
            if (uniqueVals[i] > 2 && uniqueVals[i + 3] < 14) {
                draws.openEndedStraight = true;
                draws.outs += 8;
            } else {
                draws.gutshot = true;
                draws.outs += 4;
            }
            break;
        } else if (span === 4) {
            // Gutshot (one gap)
            draws.gutshot = true;
            draws.outs += 4;
            break;
        }
    }

    return draws;
}

// Calculate win probability based on hand strength and draws
function calculateWinProbability(player, communityCards) {
    const phase = gameState.phase;

    if (phase === 'preflop') {
        // Use bucket-based probability
        const bucket = getHandBucket(player.cards[0], player.cards[1]);
        switch (bucket) {
            case 'premium': return 0.75 + Math.random() * 0.1;
            case 'strong': return 0.55 + Math.random() * 0.1;
            case 'speculative': return 0.40 + Math.random() * 0.1;
            case 'weak': return 0.30 + Math.random() * 0.05;
            default: return 0.20 + Math.random() * 0.05;
        }
    }

    // Post-flop: combine made hand strength with draw equity
    const allCards = [...player.cards, ...communityCards];
    const hand = evaluateHand(allCards);
    const madeHandStrength = hand.rank / 10; // 0.1 to 1.0

    const draws = evaluateDraws(player.cards, communityCards);

    // Calculate draw equity
    let drawEquity = 0;
    const cardsTocome = phase === 'flop' ? 2 : (phase === 'turn' ? 1 : 0);
    if (cardsTocome > 0) {
        // Rule of 2 and 4: outs * 2 per card to come
        drawEquity = Math.min(0.45, (draws.outs * 2 * cardsTocome) / 100);
    }

    // Combine made hand and draw equity (don't double count if already made)
    return Math.min(0.95, madeHandStrength + drawEquity * (1 - madeHandStrength));
}

// Get opponent tendencies from stats
function getOpponentProfile(player) {
    const stats = player.stats;
    const hands = Math.max(1, stats.handsPlayed);

    return {
        vpip: stats.vpipCount / hands,           // Voluntarily put in pot %
        pfr: stats.pfrCount / hands,             // Pre-flop raise %
        threeBet: stats.threeBetCount / Math.max(1, stats.facedOpenRaiseCount), // Pre-flop 3-bet %
        cBet: stats.cBetCount / Math.max(1, stats.cBetOpportunityCount), // Continuation bet %
        foldToCBet: stats.foldToCBetCount / Math.max(1, stats.cBetFaced),
        showdownRate: stats.showdownCount / hands,
        isTight: stats.vpipCount / hands < 0.20,
        isLoose: stats.vpipCount / hands > 0.40,
        isAggressive: stats.pfrCount / hands > 0.25
    };
}

// Update player stats display tooltip
function updatePlayerStatsDisplay(playerId) {
    const player = gameState.players[playerId];
    if (!player) return;

    const statsEl = document.getElementById(`stats-${playerId}`);
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

// Update all player stats displays
function updateAllPlayerStatsDisplays() {
    for (let i = 0; i < gameState.players.length; i++) {
        updatePlayerStatsDisplay(i);
    }
}

// Toggle show all stats
function toggleShowAllStats() {
    showAllStats = !showAllStats;
    localStorage.setItem('showAllStats', showAllStats);
    document.body.classList.toggle('show-all-stats', showAllStats);
    document.getElementById('btn-stats-toggle').classList.toggle('active', showAllStats);
    updateAllPlayerStatsDisplays();
}

// Calculate bet amount based on pot size and multiplier
function calculateBetAmount(multiplier, playerId) {
    const player = gameState.players[playerId];
    const potSize = gameState.pot;
    const betAmount = Math.floor(potSize * multiplier);
    const minBet = gameState.currentBet + gameState.minRaise;
    const maxBet = player.chips + player.bet;

    return Math.min(maxBet, Math.max(minBet, betAmount));
}

// Enhanced preflop decision
function preflopDecisionEnhanced(playerId) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const bucket = getHandBucket(player.cards[0], player.cards[1]);
    const position = getPosition(playerId);
    const random = Math.random();

    // Get main opponent profile (human player or strongest opponent)
    const opponents = gameState.players.filter(p => p.id !== playerId && !p.folded && !p.isRemoved);
    const mainOpponent = opponents[0] || gameState.players[0];
    const opponentProfile = getOpponentProfile(mainOpponent);

    // Position-based adjustments
    const positionBonus = position === 'blinds' ? 0.15 : (position === 'late' ? 0.1 : (position === 'middle' ? 0.025 : 0));

    // Opponent-based adjustments
    const stealMore = opponentProfile.isTight ? 0.1 : 0;
    const trapMore = opponentProfile.isAggressive ? 0.15 : 0;

    if (bucket === 'premium') {
        // Premium hands: mostly raise, sometimes trap
        if (random < 0.20 + trapMore && callAmount > 0) {
            // Slow play to trap aggressive opponents
            playerCall(playerId);
        } else {
            // Raise - use larger size vs loose opponents
            const sizeMult = opponentProfile.isLoose ? BET_SIZES.POT : BET_SIZES.HALF;
            const raiseAmount = calculateBetAmount(sizeMult, playerId);
            if (raiseAmount > gameState.currentBet) {
                playerRaise(playerId, raiseAmount);
            } else {
                playerCall(playerId);
            }
        }
    } else if (bucket === 'strong') {
        // Strong hands: raise or call based on position
        if (callAmount === 0) {
            // Open raise
            const raiseAmount = calculateBetAmount(BET_SIZES.HALF, playerId);
            if (random < 0.75 + positionBonus && raiseAmount > gameState.currentBet) {
                playerRaise(playerId, raiseAmount);
            } else {
                playerCheck(playerId);
            }
        } else if (callAmount <= Math.max(player.chips * 0.15, BIG_BLIND)) {
            // Facing a bet - call or 3-bet
            if (random < 0.25) {
                const raiseAmount = calculateBetAmount(BET_SIZES.POT, playerId);
                if (raiseAmount > gameState.currentBet) {
                    playerRaise(playerId, raiseAmount);
                } else {
                    playerCall(playerId);
                }
            } else {
                playerCall(playerId);
            }
        } else {
            // Large bet facing us
            if (random < 0.6) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        }
    } else if (bucket === 'speculative') {
        // Speculative hands: play from late position, call small bets
        if (callAmount === 0) {
            if (random < 0.4 + positionBonus + stealMore) {
                const raiseAmount = calculateBetAmount(BET_SIZES.HALF, playerId);
                if (raiseAmount > gameState.currentBet) {
                    playerRaise(playerId, raiseAmount);
                } else {
                    playerCheck(playerId);
                }
            } else {
                playerCheck(playerId);
            }
        } else if (callAmount <= Math.max(player.chips * 0.08, BIG_BLIND)) {
            // Small bet - mostly call
            if (random < 0.85) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        } else if (callAmount <= Math.max(player.chips * 0.15, BIG_BLIND)) {
            // Medium bet - call half the time
            if (random < 0.5) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        } else {
            // Large bet - usually fold
            if (random < 0.25) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        }
    } else if (bucket === 'weak') {
        // Weak hands: steal from button, call small bets
        if (callAmount === 0 && random < 0.25 + stealMore && position === 'late') {
            const raiseAmount = calculateBetAmount(BET_SIZES.HALF, playerId);
            if (raiseAmount > gameState.currentBet) {
                playerRaise(playerId, raiseAmount);
            } else {
                playerCheck(playerId);
            }
        } else if (callAmount === 0) {
            playerCheck(playerId);
        } else if (callAmount <= Math.max(player.chips * 0.05, BIG_BLIND)) {
            // Very small bet - call half the time
            if (random < 0.5) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        } else if (callAmount <= Math.max(player.chips * 0.1, BIG_BLIND)) {
            // Small bet - call sometimes
            if (random < 0.25) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        } else {
            playerFold(playerId);
        }
    } else {
        // Trash hands: fold (except free check)
        if (callAmount === 0) {
            playerCheck(playerId);
        } else if (callAmount <= Math.max(player.chips * 0.03, BIG_BLIND)) {
            // Tiny bet - occasionally call
            if (random < 0.2) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        } else {
            playerFold(playerId);
        }
    }
}

// Enhanced postflop decision
function postflopDecisionEnhanced(playerId) {
    const player = gameState.players[playerId];
    const callAmount = gameState.currentBet - player.bet;
    const winProb = calculateWinProbability(player, gameState.communityCards);
    const position = getPosition(playerId);
    const random = Math.random();

    // Get opponent profile
    const opponents = gameState.players.filter(p => p.id !== playerId && !p.folded && !p.isRemoved);
    const mainOpponent = opponents[0] || gameState.players[0];
    const opponentProfile = getOpponentProfile(mainOpponent);

    // Pot odds calculation
    const potOdds = callAmount > 0 ? callAmount / (gameState.pot + callAmount) : 0;
    const hasGoodOdds = winProb > potOdds;

    // Position and opponent adjustments
    const positionBonus = position === 'late' ? 0.08 : 0;
    const bluffMore = opponentProfile.foldToCBet > 0.6 ? 0.15 : 0;
    const trapMore = opponentProfile.isAggressive ? 0.12 : 0;
    const valueOnly = opponentProfile.showdownRate > 0.35; // Don't bluff showdown stations

    // Check for draws
    const draws = evaluateDraws(player.cards, gameState.communityCards);
    const hasStrongDraw = draws.flushDraw || draws.openEndedStraight;

    if (winProb >= 0.7) {
        // Strong hand - mostly bet for value
        if (random < 0.20 + trapMore && callAmount > 0) {
            // Trap aggressive opponents
            playerCall(playerId);
        } else if (callAmount === 0) {
            // Bet for value
            const sizeMult = random < 0.5 ? BET_SIZES.HALF : BET_SIZES.POT;
            const betAmount = calculateBetAmount(sizeMult, playerId);
            if (betAmount > gameState.currentBet) {
                playerRaise(playerId, betAmount);
            } else {
                playerCheck(playerId);
            }
        } else {
            // Facing bet - raise or call
            if (random < 0.6) {
                const raiseAmount = calculateBetAmount(BET_SIZES.POT, playerId);
                if (raiseAmount > gameState.currentBet) {
                    playerRaise(playerId, raiseAmount);
                } else {
                    playerCall(playerId);
                }
            } else {
                playerCall(playerId);
            }
        }
    } else if (winProb >= 0.4 || hasStrongDraw) {
        // Medium hand or draw - mix of betting and calling
        if (callAmount === 0) {
            // Consider betting (semi-bluff with draws)
            const betChance = hasStrongDraw ? 0.5 : 0.25;
            if (random < betChance + positionBonus + bluffMore) {
                const betAmount = calculateBetAmount(BET_SIZES.HALF, playerId);
                if (betAmount > gameState.currentBet) {
                    playerRaise(playerId, betAmount);
                } else {
                    playerCheck(playerId);
                }
            } else {
                playerCheck(playerId);
            }
        } else if (hasGoodOdds || hasStrongDraw) {
            // Call if odds are good or we have a draw
            if (random < 0.15 && hasStrongDraw) {
                // Semi-bluff raise with draws
                const raiseAmount = calculateBetAmount(BET_SIZES.POT, playerId);
                if (raiseAmount > gameState.currentBet) {
                    playerRaise(playerId, raiseAmount);
                } else {
                    playerCall(playerId);
                }
            } else {
                playerCall(playerId);
            }
        } else {
            // Odds not good
            if (random < 0.3) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        }
    } else if (winProb >= 0.2) {
        // Weak hand - mostly check/fold, occasional bluff
        if (callAmount === 0) {
            const bluffChance = valueOnly ? 0.02 : (0.08 + positionBonus + bluffMore);
            if (random < bluffChance) {
                const betAmount = calculateBetAmount(BET_SIZES.HALF, playerId);
                if (betAmount > gameState.currentBet) {
                    playerRaise(playerId, betAmount);
                } else {
                    playerCheck(playerId);
                }
            } else {
                playerCheck(playerId);
            }
        } else if (hasGoodOdds && callAmount <= player.chips * 0.1) {
            if (random < 0.4) {
                playerCall(playerId);
            } else {
                playerFold(playerId);
            }
        } else {
            playerFold(playerId);
        }
    } else {
        // Trash hand - check or fold
        if (callAmount === 0) {
            // Rare bluff
            const bluffChance = valueOnly ? 0 : (0.03 + bluffMore);
            if (random < bluffChance && position === 'late') {
                const betAmount = calculateBetAmount(BET_SIZES.HALF, playerId);
                if (betAmount > gameState.currentBet) {
                    playerRaise(playerId, betAmount);
                } else {
                    playerCheck(playerId);
                }
            } else {
                playerCheck(playerId);
            }
        } else {
            playerFold(playerId);
        }
    }
}

// Main enhanced AI decision function (for medium/hard modes)
function aiDecisionEnhance(playerId) {
    const player = gameState.players[playerId];
    if (player.folded || player.allIn) return;

    if (gameState.phase === 'preflop') {
        preflopDecisionEnhanced(playerId);
    } else {
        postflopDecisionEnhanced(playerId);
    }
}


function nextPlayer() {
    const numPlayers = gameState.players.length;
    let attempts = 0;
    do {
        // Clockwise direction: 0 -> 1 -> 2 -> 3 -> 4 -> 0
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % numPlayers;
        attempts++;
    } while (
        (gameState.players[gameState.currentPlayerIndex].folded ||
            gameState.players[gameState.currentPlayerIndex].allIn ||
            gameState.players[gameState.currentPlayerIndex].isRemoved) &&
        attempts < numPlayers
    );

    return attempts < numPlayers;
}

function getActivePlayers() {
    return gameState.players.filter(p => !p.folded && p.chips >= 0 && !p.isRemoved);
}

function getPlayersInHand() {
    return gameState.players.filter(p => !p.folded && !p.isRemoved);
}

// Animate bets moving to pot
async function animateBetsToPot() {
    const potDisplay = document.querySelector('.pot-display');
    if (!potDisplay) return;

    const potRect = potDisplay.getBoundingClientRect();
    const animations = [];

    for (const player of gameState.players) {
        if (player.bet > 0) {
            const betDisplay = document.getElementById(`bet-${player.id}`);
            if (!betDisplay || !betDisplay.classList.contains('visible')) continue;

            const betRect = betDisplay.getBoundingClientRect();

            // Create a clone for animation
            const clone = document.createElement('div');
            clone.className = 'bet-clone';
            clone.innerHTML = `<span class="bet-amount">$${player.bet}</span>`;
            clone.style.left = `${betRect.left}px`;
            clone.style.top = `${betRect.top}px`;
            clone.style.width = `${betRect.width}px`;
            clone.style.height = `${betRect.height}px`;

            document.body.appendChild(clone);

            // Calculate target position (center of pot)
            const targetX = potRect.left + potRect.width / 2 - betRect.width / 2;
            const targetY = potRect.top + potRect.height / 2 - betRect.height / 2;

            // Hide original bet display
            betDisplay.classList.remove('visible');

            // Animate clone to pot
            const animation = new Promise(resolve => {
                // Force reflow
                clone.offsetHeight;

                clone.style.transition = 'all 0.4s ease-in-out';
                clone.style.left = `${targetX}px`;
                clone.style.top = `${targetY}px`;
                clone.style.transform = 'scale(0.5)';
                clone.style.opacity = '0';

                setTimeout(() => {
                    clone.remove();
                    resolve();
                }, 400);
            });

            animations.push(animation);
        }
    }

    // Wait for all animations to complete
    if (animations.length > 0) {
        await Promise.all(animations);
    }
}

async function resetBets(thisGameId) {
    // Check if game was cancelled before proceeding
    if (thisGameId !== undefined && currentGameId !== thisGameId) return;

    // Animate bets moving to pot first
    await animateBetsToPot();

    // Check again after animation in case game was cancelled
    if (thisGameId !== undefined && currentGameId !== thisGameId) return;

    // Reset C-bet active status at start of betting round
    gameState.cBetActive = false;

    for (const player of gameState.players) {
        player.bet = 0;
    }
    gameState.currentBet = 0;
    gameState.minRaise = BIG_BLIND;

    // Clear all bet displays
    for (let i = 0; i < gameState.players.length; i++) {
        updateBetDisplay(i);
    }
}

async function runBettingRound() {
    // Store the game ID at the very start - if it changes, abort this round
    const thisGameId = currentGameId;

    // Get players who can still act (not folded, not all-in, have chips)
    const getActingPlayers = () => gameState.players.filter(p => !p.folded && !p.allIn && p.chips > 0);

    // If only one or zero players can act and all bets are matched, skip the round
    const initialActingPlayers = getActingPlayers();
    if (initialActingPlayers.length === 0) {
        return;
    }
    if (initialActingPlayers.length === 1 && initialActingPlayers.every(p => p.bet === gameState.currentBet)) {
        return;
    }

    // Track which players have acted since the last raise/bet
    // When someone raises, everyone else needs to respond
    // Start empty - every player must act at least once per round
    let playersActedSinceLastRaise = new Set();

    while (true) {
        // Check if a new game started - if so, abort this betting round
        if (currentGameId !== thisGameId) {
            return;
        }

        const player = gameState.players[gameState.currentPlayerIndex];

        // If only one player remains in hand (not folded), end the round
        if (getPlayersInHand().length === 1) {
            break;
        }

        // Check if this player can act
        if (!player.folded && !player.allIn && player.chips > 0) {
            // Track "Faced Open Raise" stat
            // If it's preflop, exactly one raise has occurred, and we haven't counted this yet for this player
            if (gameState.phase === 'preflop' &&
                gameState.preflopRaiseCount === 1 &&
                !player.stats.facedOpenRaiseCountedThisHand) {
                player.stats.facedOpenRaiseCount++;
                player.stats.facedOpenRaiseCountedThisHand = true;
            }

            // Track C-bet Opportunity
            // Preflop aggressor, on flop, facing no bet (opportunity to open)
            if (gameState.phase === 'flop' &&
                gameState.preflopAggressorId === player.id &&
                gameState.currentBet === 0 &&
                !player.stats.cBetOpportunityCountedThisHand) {
                player.stats.cBetOpportunityCount++;
                player.stats.cBetOpportunityCountedThisHand = true;
            }

            // Track "Faced C-Bet"
            if (gameState.cBetActive && !player.stats.cBetFacedCountedThisHand) {
                player.stats.cBetFaced++;
                player.stats.cBetFacedCountedThisHand = true;
            }

            const previousCurrentBet = gameState.currentBet;

            if (player.isAI) {
                // Update UI to show active state for AI player
                updateUI();
                await delay(800);
                // Check again after await in case game was cancelled during delay
                if (currentGameId !== thisGameId) return;
                // Route to appropriate AI based on difficulty level
                if (player.aiLevel === 'easy') {
                    aiDecision(player.id);
                } else {
                    // medium and hard use enhanced AI
                    aiDecisionEnhance(player.id);
                }
            } else {
                // Play notification sound for human player's turn
                SoundManager.playYourTurn();
                updateUI();
                // Start countdown timer in fast mode
                startCountdown();
                await waitForPlayerAction();
                // Check again after await in case game was cancelled during wait
                if (currentGameId !== thisGameId) return;
            }

            // Mark this player as having acted
            playersActedSinceLastRaise.add(player.id);

            // If a raise occurred (current bet increased), reset tracking
            // Everyone except the raiser needs to act again
            if (gameState.currentBet > previousCurrentBet) {
                playersActedSinceLastRaise = new Set([player.id]);
            }
        }

        // Check gameId AGAIN before calling nextPlayer - critical to prevent
        // old game's loop from modifying new game's currentPlayerIndex
        if (currentGameId !== thisGameId) return;

        // Move to next player
        if (!nextPlayer()) break;

        // Check gameId again after nextPlayer in case game was cancelled
        if (currentGameId !== thisGameId) return;

        // Check if round is complete:
        // All active players have acted since last raise AND all bets are matched
        const actingPlayers = getActingPlayers();

        if (actingPlayers.length === 0) {
            // No one can act anymore (all folded or all-in)
            break;
        }

        const allHaveActed = actingPlayers.every(p => playersActedSinceLastRaise.has(p.id));
        const allBetsMatched = actingPlayers.every(p => p.bet === gameState.currentBet);

        if (allHaveActed && allBetsMatched) {
            break;
        }
    }

    // Clear countdown timer when betting round ends
    clearCountdown();
    // Reset currentPlayerIndex so no player is marked as active
    gameState.currentPlayerIndex = -1;
    updateUI(); // Remove active class to stop flowing border animation
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== AI Player Portraits =====
const AI_PORTRAITS = [
    'pic/portrait/Becky_Blackbell_Portrait.png',
    'pic/portrait/Bond_Forger_Portrait.png',
    'pic/portrait/Camilla_Portrait.png',
    'pic/portrait/Damian_Desmond_Portrait.png',
    'pic/portrait/Dominic_Portrait.png',
    'pic/portrait/Ewen_Egeburg_Portrait.png',
    'pic/portrait/Fiona_Frost_Portrait.png',
    'pic/portrait/Franky_Franklin_Portrait.png',
    'pic/portrait/Henry_Henderson_Portrait.png',
    'pic/portrait/Loid_Forger_Portrait.png',
    'pic/portrait/Sylvia_Sherwood_Portrait.png',
    'pic/portrait/Yor_Forger_Portrait.png',
    'pic/portrait/Yuri_Briar_Portrait.png'
];

// Randomize AI player portraits
function randomizeAIPortraits() {
    // Get number of AI players (all players except human at index 0)
    const aiPlayerCount = gameState.players.length - 1;

    // Shuffle array and pick unique portraits for each AI
    const shuffled = [...AI_PORTRAITS].sort(() => Math.random() - 0.5);

    for (let i = 1; i <= aiPlayerCount; i++) {
        const avatarContainer = document.getElementById(`avatar-${i}`);
        if (avatarContainer) {
            const img = avatarContainer.querySelector('img');
            if (img) {
                img.src = shuffled[i - 1];
            }
        }
    }
}

// Dealer Animation Control
const DEALER_GIF_PREFLOP = 'pic/dealing_preflop.gif';
const DEALER_GIF_FLOP = 'pic/dealing_left.gif';
const DEALER_GIF_TURN_RIVER = 'pic/dealing_right.gif';
const DEALER_STATIC_SRC = 'pic/dealing.png';

// Track which game started the current animation
let dealerAnimationGameId = null;
let winAnimationTimeoutId = null;

function showDealerAnimation(gifSrc, gameId) {
    const gif = document.getElementById('dealer-gif');
    if (gif) {
        // Track which game owns this animation
        dealerAnimationGameId = gameId || currentGameId;
        // Start the animated gif with unique query param to force restart
        gif.src = gifSrc + '?t=' + Date.now();
    }
}

function hideDealerAnimation(gameId) {
    const gif = document.getElementById('dealer-gif');
    if (gif) {
        // Only hide if this is from the current game (or if no gameId provided)
        // This prevents old game's hide call from affecting new game's animation
        if (gameId === undefined || gameId === dealerAnimationGameId) {
            // Replace with static image to stop the animation
            gif.src = DEALER_STATIC_SRC;
            dealerAnimationGameId = null;
        }
    }
}

let playerActionResolver = null;

function waitForPlayerAction() {
    return new Promise(resolve => {
        playerActionResolver = resolve;
    });
}

function resolvePlayerAction() {
    if (playerActionResolver) {
        // Clear countdown timer if running
        clearCountdown();

        // Immediately disable controls after user takes action
        const controls = document.getElementById('controls');
        controls.classList.add('disabled');
        controls.classList.remove('active');

        playerActionResolver();
        playerActionResolver = null;
    }
}

// ===== Countdown Timer for Fast Mode =====
function startCountdown() {
    if (gameMode !== 'fast') return;

    clearCountdown(); // Clear any existing timer
    countdownStartTime = Date.now();

    countdownTimerId = setTimeout(() => {
        handleCountdownExpired();
    }, COUNTDOWN_DURATION);
}

function clearCountdown() {
    if (countdownTimerId) {
        clearTimeout(countdownTimerId);
        countdownTimerId = null;
    }
    countdownStartTime = null;
}

function handleCountdownExpired() {
    const player = gameState.players[0]; // Human player
    const callAmount = gameState.currentBet - player.bet;

    if (callAmount > 0) {
        // Facing a raise - auto fold
        playerFold(0);
    } else {
        // No raise - auto check
        playerCheck(0);
    }

    resolvePlayerAction();
}

// ===== Game Mode Toggle =====
function toggleGameMode() {
    gameMode = gameMode === 'fast' ? 'slow' : 'fast';
    localStorage.setItem('pokerGameMode', gameMode);
    updateGameModeUI();
    updateUI(); // Refresh player mode classes
}

function updateGameModeUI() {
    const modeBtn = document.getElementById('btn-mode');
    if (modeBtn) {
        modeBtn.textContent = gameMode === 'fast' ? t('fastMode') : t('slowMode');
        modeBtn.classList.toggle('fast-active', gameMode === 'fast');
    }
}

// Game Phases
async function startNewGame(randomizeDealer = false) {
    // Increment game ID to cancel any previous game's async operations
    currentGameId++;

    // Start background music (only plays if user has enabled it)
    SoundManager.playMusic();

    // Clear any pending win animation timeout to prevent it from interrupting dealing
    if (winAnimationTimeoutId) {
        clearTimeout(winAnimationTimeoutId);
        winAnimationTimeoutId = null;
    }

    // Clear any pending player action resolver from previous game
    if (playerActionResolver) {
        playerActionResolver(); // Resolve it to unblock, but the game ID check will abort the old game
        playerActionResolver = null;
    }

    // Increment hand counter (previous hand's history is already saved in array)
    handNumber++;
    currentViewingHand = handNumber;

    // Initialize new hand's history array
    handHistories[handNumber - 1] = [];

    // Clear action history display
    const history = document.getElementById('action-history');
    if (history) {
        history.innerHTML = '';
    }

    // Update hand number in panel header (stays visible when scrolling)
    updateHandNumberDisplay();

    // Update navigation buttons
    updateHistoryNavigation();

    // Clear any previous winner highlights
    clearWinnerHighlights();
    // Restore pot display visibility (hidden during pot animation)
    const potDisplay = document.querySelector('.pot-display');
    if (potDisplay) potDisplay.style.visibility = 'visible';

    // Reset game state
    gameState.deck = createDeck();
    gameState.communityCards = [];
    gameState.displayedCommunityCards = 0;
    gameState.pot = 0;
    gameState.currentBet = 0;
    gameState.phase = 'preflop';
    gameState.minRaise = BIG_BLIND;
    gameState.preflopRaiseCount = 0; // Reset raise count
    gameState.preflopAggressorId = null; // Reset preflop aggressor
    gameState.cBetActive = false; // Reset C-bet flag
    gameState.currentPlayerIndex = -1; // No active player until blinds are posted

    // Reset all player stats if this is a fresh New Game (randomizeDealer = true)
    if (randomizeDealer) {
        for (const player of gameState.players) {
            resetPlayerStats(player);
        }
    }

    // Clear isPendingJoin flags and reset states for all players
    for (const player of gameState.players) {
        if (player.isPendingJoin) {
            player.isPendingJoin = false;
        }

        player.cards = [];
        player.bet = 0;
        player.totalContribution = 0;
        player.folded = player.isRemoved; // Removed players stay folded
        player.allIn = false;

        // Eliminate players with no chips (if not removed)
        if (!player.isRemoved && player.chips <= 0) {
            player.chips = 0;
            player.folded = true;
        }

        // Update stats for active players starting a new hand
        if (!player.folded) {
            player.stats.handsPlayed++;
            // Reset per-hand stats flags
            player.stats.vpipCountedThisHand = false;
            player.stats.pfrCountedThisHand = false;
            player.stats.threeBetCountedThisHand = false;
            player.stats.facedOpenRaiseCountedThisHand = false;
            player.stats.cBetCountedThisHand = false;
            player.stats.cBetOpportunityCountedThisHand = false;
            player.stats.cBetFacedCountedThisHand = false;
        }
    }

    // Update stats display after handsPlayed is incremented
    updateAllPlayerStatsDisplays();

    // Check if game can continue (at least human + 1 active AI)
    const playersWithChips = gameState.players.filter(p => !p.isRemoved && p.chips > 0);
    if (playersWithChips.length < 2) {
        showMessage('Game Over! ' + (playersWithChips[0]?.name || 'No one') + ' wins!');
        document.getElementById('btn-new-game').textContent = 'RESTART GAME';
        initPlayers();
        updateUI();
        return;
    }

    // Set dealer position
    if (randomizeDealer) {
        // Random dealer position for fresh game
        const eligibleDealers = gameState.players.map((p, i) => ({ player: p, index: i }))
            .filter(p => !p.player.isRemoved && p.player.chips > 0);
        if (eligibleDealers.length > 0) {
            const randomPlayerIndex = Math.floor(Math.random() * eligibleDealers.length);
            gameState.dealerIndex = eligibleDealers[randomPlayerIndex].index;
        }
    } else {
        // Move dealer clockwise for next round
        do {
            gameState.dealerIndex = (gameState.dealerIndex + 1) % gameState.players.length;
        } while (gameState.players[gameState.dealerIndex].isRemoved || gameState.players[gameState.dealerIndex].chips <= 0);
    }

    // Post blinds
    const sbIndex = getNextActivePlayer(gameState.dealerIndex);
    const bbIndex = getNextActivePlayer(sbIndex);

    postBlind(sbIndex, SMALL_BLIND);
    postBlind(bbIndex, BIG_BLIND);

    gameState.currentBet = BIG_BLIND;
    // Don't set currentPlayerIndex yet - wait until after dealing

    // Update UI before dealing to show blinds (no active player yet)
    updateUI();

    // Store game ID at the start of this game
    const thisGameId = currentGameId;

    // Deal hole cards with animation
    await dealHoleCards(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after hole cards are dealt)
    gameState.currentPlayerIndex = getNextActivePlayer(bbIndex);

    // Run betting rounds
    await runBettingRound();

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    if (getPlayersInHand().length > 1) {
        await dealFlop(thisGameId);
    }

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    if (getPlayersInHand().length > 1) {
        await dealTurn(thisGameId);
    }

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    if (getPlayersInHand().length > 1) {
        await dealRiver(thisGameId);
    }

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    await showdown(thisGameId);
}

function getNextActivePlayer(fromIndex) {
    const numPlayers = gameState.players.length;
    // Clockwise direction: 0 -> 1 -> 2 -> 3 -> 4 -> 0
    let index = (fromIndex + 1) % numPlayers;
    let attempts = 0;
    // Skip only folded players - all-in players (chips=0 but allIn=true) are still in the hand
    while (gameState.players[index].folded && attempts < numPlayers) {
        index = (index + 1) % numPlayers;
        attempts++;
    }
    return index;
}

function postBlind(playerIndex, amount) {
    const player = gameState.players[playerIndex];
    const chipsBeforeAction = player.chips;
    const blindAmount = Math.min(amount, player.chips);

    player.chips -= blindAmount;
    player.bet = blindAmount;
    player.totalContribution += blindAmount;
    gameState.pot += blindAmount;

    if (player.chips === 0) {
        player.allIn = true;
    }

    showAction(playerIndex, amount === SMALL_BLIND ? t('actionSmallBlind') : t('actionBigBlind'), chipsBeforeAction);
}

async function dealFlop(thisGameId) {
    gameState.phase = 'flop';
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_FLOP, thisGameId);

    // Burn and deal 3 cards
    dealCard(); // Burn
    for (let i = 0; i < 3; i++) {
        gameState.communityCards.push(dealCard());
    }

    // Update community cards display (but don't set active player yet)
    updateCommunityCards();
    SoundManager.playCardFlip();

    // Wait for GIF animation to complete one loop
    await delay(1000);

    // Hide dealer animation
    hideDealerAnimation(thisGameId);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after animation completes)
    gameState.currentPlayerIndex = getNextActivePlayer(gameState.dealerIndex);

    await runBettingRound();
}

async function dealTurn(thisGameId) {
    gameState.phase = 'turn';
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_TURN_RIVER, thisGameId);

    // Burn and deal 1 card
    dealCard(); // Burn
    gameState.communityCards.push(dealCard());

    // Update community cards display (but don't set active player yet)
    updateCommunityCards();
    SoundManager.playCardFlip();

    // Wait for GIF animation to complete one loop
    await delay(1000);

    // Hide dealer animation
    hideDealerAnimation(thisGameId);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after animation completes)
    gameState.currentPlayerIndex = getNextActivePlayer(gameState.dealerIndex);

    await runBettingRound();
}

async function dealRiver(thisGameId) {
    gameState.phase = 'river';
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    // Show dealer animation
    showDealerAnimation(DEALER_GIF_TURN_RIVER, thisGameId);

    // Burn and deal 1 card
    dealCard(); // Burn
    gameState.communityCards.push(dealCard());

    // Update community cards display (but don't set active player yet)
    updateCommunityCards();
    SoundManager.playCardFlip();

    // Wait for GIF animation to complete one loop
    await delay(1000);

    // Hide dealer animation
    hideDealerAnimation(thisGameId);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    // Now set the active player (after animation completes)
    gameState.currentPlayerIndex = getNextActivePlayer(gameState.dealerIndex);

    await runBettingRound();
}

async function showdown(thisGameId) {
    gameState.phase = 'showdown';
    clearHighlightHumanBestHand(); // Clear post-flop highlights before showdown

    // Animate final bets to pot before showdown
    await resetBets(thisGameId);

    // Check if game was cancelled
    if (currentGameId !== thisGameId) return;

    const playersInHand = getPlayersInHand();

    // Track showdownCount - only if multiple players reach showdown (actual hand comparison)
    if (playersInHand.length > 1) {
        for (const player of playersInHand) {
            player.stats.showdownCount++;
        }
    }

    // Update stats display after showdownCount
    updateAllPlayerStatsDisplays();

    // Reveal all cards
    for (const player of playersInHand) {
        updatePlayerCards(player.id, false);
    }

    await delay(500);

    // Check if game was cancelled after delay
    if (currentGameId !== thisGameId) return;

    if (playersInHand.length === 1) {
        // Everyone folded - highlight winner and their hole cards
        const winner = playersInHand[0];
        const winAmount = gameState.pot;

        // Play win sound
        SoundManager.playWin();

        // Show win animation if human player wins
        if (winner.id === 0) {
            showWinAnimation();
        }

        // Show joy animation if AI player wins by fold (50% chance)
        if (winner.isAI && Math.random() < 0.5) {
            showAIEmotionGif(winner.id, 'joy.gif');
        }

        // Reveal winner's cards
        updatePlayerCards(winner.id, false);

        // Highlight winner (with "Everyone Folded" badge instead of hand name)
        const playerEl = document.getElementById(`player-${winner.id}`);
        playerEl.classList.add('winner');

        const badge = document.createElement('div');
        badge.className = 'hand-rank-badge';
        badge.textContent = t('everyoneFolded');
        badge.id = `hand-badge-${winner.id}`;
        playerEl.appendChild(badge);

        // Highlight winner's hole cards
        const playerCardsContainer = document.getElementById(`cards-${winner.id}`);
        const playerCardEls = playerCardsContainer.querySelectorAll('.card');
        playerCardEls.forEach(card => card.classList.add('winning-card'));

        // Show immediate message for feedback (consistent with other wins)
        showMessage(t('potWinMessage')
            .replace('{pot}', t('mainPot') || 'Main Pot')
            .replace('{winner}', getTranslatedPlayerName(winner))
            .replace('{amount}', winAmount)
            .replace('{hand}', t('everyoneFolded')),
            'everyoneFolded');

        // Log fold win details in showdown style
        logFoldWinDetails(winner, winAmount);

        // Animate pot to winner
        await animatePotToWinners([winner], [winAmount]);

        // Check if game was cancelled after animation
        if (currentGameId !== thisGameId) return;

        // Update chips after animation
        winner.chips += winAmount;
    } else {
        // Evaluate all hands first
        for (const player of playersInHand) {
            const allCards = [...player.cards, ...gameState.communityCards];
            const hand = evaluateHand(allCards);
            player.handResult = hand;
        }

        // Calculate pots (main pot and side pots)
        // Pass all players so folded contributions are included
        const pots = calculatePots(gameState.players);

        let allWinners = [];
        let firstHandName = '';
        let totalWinAmounts = {};

        // Award each pot to its winner(s)
        for (let i = 0; i < pots.length; i++) {
            const pot = pots[i];
            const potName = i === 0 ? 'Main Pot' : `Side Pot ${i}`;

            // Find best hand among eligible players for this pot
            let bestScore = -1;
            let potWinners = [];

            for (const player of pot.eligiblePlayers) {
                if (player.handResult.score > bestScore) {
                    bestScore = player.handResult.score;
                    potWinners = [player];
                } else if (player.handResult.score === bestScore) {
                    potWinners.push(player);
                }
            }

            const winAmount = Math.floor(pot.amount / potWinners.length);
            const handName = potWinners[0].handResult.name;

            if (i === 0) firstHandName = handName;

            // Track all winners and their total winnings
            for (const winner of potWinners) {
                if (!allWinners.includes(winner)) {
                    allWinners.push(winner);
                }
                totalWinAmounts[winner.id] = (totalWinAmounts[winner.id] || 0) + winAmount;
                winner.chips += winAmount;
            }

            // Log each pot award - translate all parts
            const translatedPotName = i === 0 ? t('mainPot') : `${t('sidePot')} ${i}`;
            const translatedWinnerNames = potWinners.map(w => getTranslatedPlayerName(w)).join(' & ');
            const translatedHandName = translateHandName(handName);

            // Use translated message format
            const message = t('potWinMessage')
                .replace('{pot}', translatedPotName)
                .replace('{winner}', translatedWinnerNames)
                .replace('{amount}', winAmount)
                .replace('{hand}', translatedHandName);
            showMessage(message);
        }

        // Log showdown details to action history (pass individual win amounts)
        logShowdownDetails(playersInHand, allWinners, firstHandName, totalWinAmounts);

        // Highlight all winners
        highlightWinners(allWinners);

        // Animate pot to all winners (simplified - just show total)
        await animatePotToWinners(allWinners, allWinners.map(w => totalWinAmounts[w.id]));

        // Check if game was cancelled after animation
        if (currentGameId !== thisGameId) return;

        // Show cry animation for AI players who lost and have 0 chips
        for (const player of playersInHand) {
            if (player.isAI && player.chips === 0 && !allWinners.some(w => w.id === player.id)) {
                showAIEmotionGif(player.id, 'cry.gif');
            }
        }
    }

    // Finalize showdown - update chips display and start next game
    await finalizeShowdown();
}

// Calculate main pot and side pots based on player contributions
// Includes contributions from folded players in pot amounts
function calculatePots(allPlayers) {
    // Separate folded and active players
    const activePlayers = allPlayers.filter(p => !p.folded);
    const foldedContributions = allPlayers
        .filter(p => p.folded)
        .reduce((sum, p) => sum + p.totalContribution, 0);

    // Sort active players by contribution (lowest first)
    const playerContributions = activePlayers.map(p => ({
        player: p,
        contribution: p.totalContribution
    })).sort((a, b) => a.contribution - b.contribution);

    const pots = [];
    let previousLevel = 0;

    for (let i = 0; i < playerContributions.length; i++) {
        const currentLevel = playerContributions[i].contribution;

        if (currentLevel > previousLevel) {
            // Calculate pot amount at this level
            const levelContribution = currentLevel - previousLevel;
            const eligibleCount = playerContributions.length - i;
            let potAmount = levelContribution * eligibleCount;

            // Add folded players' contributions to the main pot (first pot only)
            if (pots.length === 0) {
                potAmount += foldedContributions;
            }

            // Get eligible players for this pot (all players at or above this contribution level)
            const eligiblePlayers = playerContributions
                .slice(i)
                .map(pc => pc.player);

            pots.push({
                amount: potAmount,
                eligiblePlayers: eligiblePlayers,
                level: currentLevel
            });

            previousLevel = currentLevel;
        }
    }

    return pots;
}

// Helper function to format cards as text string
function formatCardsText(cards) {
    return cards.map(card => `${card.value}${card.suit}`).join(' ');
}

// Log fold win details in showdown-style format
function logFoldWinDetails(winner, winAmount) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
    const winnerName = getTranslatedPlayerName(winner);

    const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('everyoneFolded')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('winnersHoleCards')}</strong>
                    <div class="player-hand winner-hand">
                        ${winnerName} ⭐: ${formatCardsText(winner.cards)}
                    </div>
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerName}
                    <br><strong>${t('result')}</strong> ${t('everyoneFolded')}
                    <br><strong>${t('prize')}</strong> $${winAmount}
                </div>
            </div>
        </div>
    `;

    appendToCurrentHandHistory(entryHTML);
}

// Log detailed showdown information to action history
function logShowdownDetails(playersInHand, winners, handName, totalWinAmounts) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });

    // Build player hole cards HTML, sorted by hand strength (best first)
    // Evaluate each player's hand and sort by score descending
    const playersWithHands = playersInHand.map(player => {
        const allCards = [...player.cards, ...gameState.communityCards];
        const handResult = evaluateHand(allCards);
        return { player, handResult };
    }).sort((a, b) => b.handResult.score - a.handResult.score);

    let playerCardsHTML = '';
    for (const { player, handResult } of playersWithHands) {
        const isWinner = winners.some(w => w.id === player.id);
        const winnerMark = isWinner ? ' ⭐' : '';
        const playerName = getTranslatedPlayerName(player);
        const handName = translateHandName(handResult.name);
        playerCardsHTML += `
            <div class="player-hand ${isWinner ? 'winner-hand' : ''}">
                ${playerName}${winnerMark}: ${formatCardsText(player.cards)} (${handName})
            </div>
        `;
    }

    // Build best cards info for each winner with their prize
    const winnersCardsInfo = winners.map(w => {
        const bestCards = w.handResult && w.handResult.bestCards ? formatCardsText(w.handResult.bestCards) : 'N/A';
        const winnerName = getTranslatedPlayerName(w);
        return `${bestCards}(${winnerName})`;
    }).join('<br>');

    // Build prize info for each winner
    const prizeInfo = winners.map(w => {
        const winAmount = totalWinAmounts[w.id] || 0;
        const winnerName = getTranslatedPlayerName(w);
        return `${winnerName}: $${winAmount}`;
    }).join('<br>');

    // Build winning hands list for each winner
    const winningHandsList = winners.map(w => {
        const winnerName = getTranslatedPlayerName(w);
        const translatedHand = w.handResult ? translateHandName(w.handResult.name) : translateHandName(handName);
        return `${winnerName}: ${translatedHand}`;
    }).join('<br>');

    // Build winner names list
    const winnerNames = winners.map(w => getTranslatedPlayerName(w)).join(' & ');

    const entryHTML = `
        <div class="log-entry showdown-details">
            <div class="log-time">
                <span>${time}</span>
                <span class="log-phase">${t('showdown')}</span>
            </div>
            <div class="log-content">
                <div class="showdown-section">
                    <strong>${t('communityCards')}</strong> ${formatCardsText(gameState.communityCards)}
                </div>
                <div class="showdown-section">
                    <strong>${t('playersHoleCards')}</strong>
                    ${playerCardsHTML}
                </div>
                <div class="showdown-section winner-section">
                    <strong>${t('winnerLabel')}</strong> ${winnerNames}
                    <br><strong>${t('winningHand')}</strong><br>${winningHandsList}
                    <br><strong>${t('best5Cards')}</strong><br>${winnersCardsInfo}
                    <br><strong>${t('prize')}</strong><br>${prizeInfo}
                </div>
            </div>
        </div>
    `;

    appendToCurrentHandHistory(entryHTML);
}

// Update chips display only after showdown (called within showdown)
async function finalizeShowdown() {
    // Store game ID to check if user started a new game during the delay
    const thisGameId = currentGameId;

    // Update chips display only (don't call updateUI which would rebuild cards and remove highlights)
    for (const player of gameState.players) {
        document.getElementById(`chips-${player.id}`).textContent = player.chips;
    }

    // Wait 5 seconds to let player see the winner highlights, then start next game
    await delay(5000);

    // Only start next game if user didn't already click New Game
    if (currentGameId === thisGameId) {
        startNewGame();
    }
}

// Highlight winning players and their winning cards
function highlightWinners(winners) {
    // Play win sound
    SoundManager.playWin();

    // Check if human player (id 0) is among winners - show win animation
    const humanWinner = winners.find(w => w.id === 0);
    if (humanWinner) {
        showWinAnimation();
    }

    for (const winner of winners) {
        const playerEl = document.getElementById(`player-${winner.id}`);
        playerEl.classList.add('winner');

        // Add hand rank badge - use each winner's own hand result name (translated)
        const badge = document.createElement('div');
        badge.className = 'hand-rank-badge';
        badge.textContent = winner.handResult ? translateHandName(winner.handResult.name) : t('winner');
        badge.id = `hand-badge-${winner.id}`;
        playerEl.appendChild(badge);

        // Highlight winning cards (only if we have a real hand result)
        if (winner.handResult && winner.handResult.bestCards && winner.handResult.bestCards.length > 0) {
            highlightWinningCards(winner);
        }

        // Show emotion animation for AI winners based on hand strength
        if (winner.isAI && winner.handResult) {
            const handName = winner.handResult.name;
            const betterThanStraight = ['Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];

            if (handName === 'High Card') {
                showAIEmotionGif(winner.id, 'sweat.gif');
            } else if (betterThanStraight.includes(handName)) {
                showAIEmotionGif(winner.id, 'star.gif');
            } else {
                // 30% chance to show grin for normal wins
                if (Math.random() < 0.3) {
                    showAIEmotionGif(winner.id, 'grin.gif');
                }
            }
        }
    }
}

// Show emotion gif animation for AI player
function showAIEmotionGif(playerId, gifName = 'grin.gif') {
    const playerEl = document.getElementById(`player-${playerId}`);
    if (!playerEl) return;

    // Remove any existing emotion gif for this player
    const existingGif = document.getElementById(`emotion-${playerId}`);
    if (existingGif) existingGif.remove();

    // Create emotion gif element
    const emotionGif = document.createElement('img');
    emotionGif.src = `pic/${gifName}?` + Date.now(); // Cache-bust to restart animation
    emotionGif.className = 'ai-winner-grin';
    emotionGif.id = `emotion-${playerId}`;

    // Append to player element
    playerEl.appendChild(emotionGif);

    // Remove after animation (approximately 1.5 seconds)
    setTimeout(() => {
        const gif = document.getElementById(`emotion-${playerId}`);
        if (gif) gif.remove();
    }, 1500);
}

// Show win animation for human player
function showWinAnimation() {
    const gif = document.getElementById('dealer-gif');
    if (gif) {
        // Clear any existing win animation timeout
        if (winAnimationTimeoutId) {
            clearTimeout(winAnimationTimeoutId);
        }

        // Change src with cache-bust to restart animation
        gif.src = 'pic/user_win.gif?t=' + Date.now();

        // Auto-hide after animation plays (approximately cost 1.6 seconds)
        winAnimationTimeoutId = setTimeout(() => {
            gif.src = DEALER_STATIC_SRC;
            winAnimationTimeoutId = null;
        }, 1600);
    }
}

// Highlight the 5 cards that make up the winning hand
function highlightWinningCards(winner) {
    const bestCards = winner.handResult.bestCards;

    // Get player's hole cards (exclude placeholders)
    const playerCardsContainer = document.getElementById(`cards-${winner.id}`);
    const playerCardEls = playerCardsContainer.querySelectorAll('.card:not(.card-placeholder)');

    // Get community cards (exclude placeholders)
    const communityContainer = document.getElementById('community-cards');
    const communityCardEls = communityContainer.querySelectorAll('.card:not(.card-placeholder)');

    // Check each of the best 5 cards and highlight matching ones
    for (const bestCard of bestCards) {
        // Check player's hole cards
        for (let i = 0; i < winner.cards.length; i++) {
            if (winner.cards[i].suit === bestCard.suit && winner.cards[i].value === bestCard.value) {
                if (playerCardEls[i]) {
                    playerCardEls[i].classList.add('winning-card');
                }
            }
        }

        // Check community cards
        for (let i = 0; i < gameState.communityCards.length; i++) {
            if (gameState.communityCards[i].suit === bestCard.suit &&
                gameState.communityCards[i].value === bestCard.value) {
                if (communityCardEls[i]) {
                    communityCardEls[i].classList.add('winning-card');
                }
            }
        }
    }
}

// Animate pot moving to winners
async function animatePotToWinners(winners, winAmounts) {
    const potDisplay = document.querySelector('.pot-display');
    const potRect = potDisplay.getBoundingClientRect();

    // Hide original pot display during animation
    potDisplay.style.visibility = 'hidden';

    for (let i = 0; i < winners.length; i++) {
        const winner = winners[i];
        const winAmount = winAmounts[i];

        // Get winner's position
        const playerEl = document.getElementById(`player-${winner.id}`);
        const playerRect = playerEl.getBoundingClientRect();

        // Create pot clone
        const potClone = document.createElement('div');
        potClone.className = 'pot-clone';
        potClone.innerHTML = `
            <span class="pot-label">${winners.length > 1 ? 'SPLIT' : 'POT'}</span>
            <span class="pot-amount">$${winAmount}</span>
        `;

        // Position at pot's location
        potClone.style.left = `${potRect.left}px`;
        potClone.style.top = `${potRect.top}px`;

        document.body.appendChild(potClone);

        // Calculate target position (center of player element)
        const targetX = playerRect.left + playerRect.width / 2 - potRect.width / 2;
        const targetY = playerRect.top + playerRect.height / 2 - potRect.height / 2;

        // Animate to player
        potClone.style.transition = 'all 0.6s ease-out';

        // Force reflow
        potClone.offsetHeight;

        potClone.style.left = `${targetX}px`;
        potClone.style.top = `${targetY}px`;

        // Wait for animation
        await delay(600);

        // Fade out
        potClone.classList.add('animating');
        await delay(400);

        // Remove clone
        potClone.remove();

        // Small delay between multiple winners
        if (i < winners.length - 1) {
            await delay(200);
        }
    }

    // Clear pot display
    gameState.pot = 0;
    document.getElementById('pot-amount').textContent = '$0';
}

// Clear all winner highlights (call at start of new game)
function clearWinnerHighlights() {
    // Remove winner class from all players
    document.querySelectorAll('.player.winner').forEach(el => {
        el.classList.remove('winner');
    });

    // Remove hand rank badges
    document.querySelectorAll('.hand-rank-badge').forEach(el => {
        el.remove();
    });

    // Remove winning card highlights
    document.querySelectorAll('.card.winning-card').forEach(el => {
        el.classList.remove('winning-card');
    });
}

// Event Listeners
document.getElementById('btn-fold').addEventListener('click', () => {
    playerFold(0);
    resolvePlayerAction();
});

document.getElementById('btn-check').addEventListener('click', () => {
    playerCheck(0);
    resolvePlayerAction();
});

document.getElementById('btn-call').addEventListener('click', () => {
    playerCall(0);
    resolvePlayerAction();
});

document.getElementById('btn-raise').addEventListener('click', () => {
    const raiseAmount = parseInt(document.getElementById('raise-slider').value);
    playerRaise(0, raiseAmount);
    resolvePlayerAction();
});

document.getElementById('btn-allin').addEventListener('click', () => {
    playerAllIn(0);
    resolvePlayerAction();
});

document.getElementById('raise-slider').addEventListener('input', (e) => {
    document.getElementById('raise-amount').textContent = e.target.value;
});

// ===== Pot Preset Buttons =====
// Set slider to a fraction/multiple of the pot amount, capped at player's max chips
function setPotPreset(multiplier) {
    const player = gameState.players[0];
    const slider = document.getElementById('raise-slider');

    // Calculate target bet based on pot
    let targetBet = Math.floor(gameState.pot * multiplier);

    // Ensure target bet is at least the minimum raise
    const minRaise = parseInt(slider.min);
    if (targetBet < minRaise) {
        targetBet = minRaise;
    }

    // Cap at player's maximum available bet (current chips + already bet)
    const maxBet = player.chips + player.bet;
    if (targetBet > maxBet) {
        targetBet = maxBet;
    }

    // Also cap at slider max
    const sliderMax = parseInt(slider.max);
    if (targetBet > sliderMax) {
        targetBet = sliderMax;
    }

    // Update slider and display
    slider.value = targetBet;
    document.getElementById('raise-amount').textContent = targetBet;
}

document.getElementById('btn-half-pot').addEventListener('click', () => {
    setPotPreset(0.5);
});

document.getElementById('btn-one-pot').addEventListener('click', () => {
    setPotPreset(1);
});

document.getElementById('btn-two-pot').addEventListener('click', () => {
    setPotPreset(2);
});

// Helper for reset and start new game
let lastNewGameClickTime = 0;
let cooldownIntervalId = null;
const NEW_GAME_DEBOUNCE_MS = 5000; // 5 seconds cooldown

function resetAndStartNewGame() {
    // Debounce: prevent double-clicking within cooldown period
    const now = Date.now();
    if (now - lastNewGameClickTime < NEW_GAME_DEBOUNCE_MS) {
        return; // Ignore rapid clicks
    }
    lastNewGameClickTime = now;

    // Add cooldown visual style to button with countdown timer
    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) {
        newGameBtn.classList.add('cooldown');

        // Start countdown timer
        let secondsRemaining = Math.ceil(NEW_GAME_DEBOUNCE_MS / 1000);
        newGameBtn.textContent = `${t('newGame')} (${secondsRemaining})`;

        // Clear any existing interval
        if (cooldownIntervalId) {
            clearInterval(cooldownIntervalId);
        }

        cooldownIntervalId = setInterval(() => {
            secondsRemaining--;
            if (secondsRemaining > 0) {
                newGameBtn.textContent = `${t('newGame')} (${secondsRemaining})`;
            } else {
                // Cooldown finished
                newGameBtn.textContent = t('newGame');
                newGameBtn.classList.remove('cooldown');
                clearInterval(cooldownIntervalId);
                cooldownIntervalId = null;
            }
        }, 1000);
    }

    document.getElementById('winner-popup').classList.remove('visible');
    for (const player of gameState.players) {
        player.chips = STARTING_CHIPS;
    }

    // Reset hand counter and clear all history IMMEDIATELY
    handNumber = 0;
    handHistories = [];
    currentViewingHand = 0;

    // Clear action history display immediately to prevent old actions from appearing
    const history = document.getElementById('action-history');
    if (history) {
        history.innerHTML = '';
    }

    // Clear panel hand number display
    const panelHandNumber = document.getElementById('panel-hand-number');
    if (panelHandNumber) {
        panelHandNumber.textContent = '';
        panelHandNumber.classList.remove('viewing-past');
    }

    // Randomize AI player portraits for this new game
    randomizeAIPortraits();

    // Show all player elements and controls (remove pre-game hidden state)
    showGameElements();

    startNewGame(true);
}

document.getElementById('btn-new-game').addEventListener('click', resetAndStartNewGame);
document.getElementById('btn-continue').addEventListener('click', resetAndStartNewGame);

// ===== Hand History Navigation =====

// Update navigation buttons state
function updateHistoryNavigation() {
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
        // Return button is only enabled when viewing a past hand
        returnBtn.disabled = currentViewingHand >= handNumber;
    }
}

// Navigate to previous or next hand
function navigateToHand(direction) {
    const history = document.getElementById('action-history');
    if (!history) return;

    // Calculate target hand
    let targetHand = currentViewingHand + direction;

    // Clamp to valid range
    if (targetHand < 1) targetHand = 1;
    if (targetHand > handNumber) targetHand = handNumber;

    // No change needed
    if (targetHand === currentViewingHand) return;

    currentViewingHand = targetHand;

    // Load the target hand's history from array
    const handHistory = handHistories[targetHand - 1];
    if (handHistory && Array.isArray(handHistory) && handHistory.length > 0) {
        history.innerHTML = handHistory.join('');
    } else {
        history.innerHTML = '';
    }

    // Update hand number display with translation
    updateHandNumberDisplay();

    // Update navigation buttons
    updateHistoryNavigation();
}

// Navigation button event listeners
document.getElementById('btn-prev-hand').addEventListener('click', () => navigateToHand(-1));
document.getElementById('btn-next-hand').addEventListener('click', () => navigateToHand(1));

// Return to current hand
function returnToCurrentHand() {
    if (currentViewingHand === handNumber) return;

    const history = document.getElementById('action-history');
    if (!history) return;

    currentViewingHand = handNumber;

    // Load current hand's history from array
    const handHistory = handHistories[handNumber - 1];
    if (handHistory && Array.isArray(handHistory) && handHistory.length > 0) {
        history.innerHTML = handHistory.join('');
    } else {
        history.innerHTML = '';
    }

    // Update hand number display with translation
    updateHandNumberDisplay();

    // Update navigation buttons
    updateHistoryNavigation();
}

document.getElementById('btn-return-hand').addEventListener('click', returnToCurrentHand);

// ===== Help Popup =====
document.getElementById('help-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('help-popup').classList.add('visible');
});

document.getElementById('btn-help-ok').addEventListener('click', () => {
    document.getElementById('help-popup').classList.remove('visible');
});

// Close help popup when clicking outside the content
document.getElementById('help-popup').addEventListener('click', (e) => {
    if (e.target.id === 'help-popup') {
        document.getElementById('help-popup').classList.remove('visible');
    }
});

// ===== Language Toggle =====
document.getElementById('btn-language').addEventListener('click', toggleLanguage);

// ===== Cursor Trail Effect =====
const cursorTrailContainer = document.getElementById('cursor-trail');
let particleCount = 0;
const MAX_PARTICLES = 50;
let currentCursorEffect = localStorage.getItem('cursorEffect') || 'sparkle';
let lastMouseX = 0;
let lastMouseY = 0;

// Initialize cursor effect selector
const cursorSelect = document.getElementById('cursor-select');
if (cursorSelect) {
    cursorSelect.value = currentCursorEffect;
    cursorSelect.addEventListener('change', (e) => {
        currentCursorEffect = e.target.value;
        localStorage.setItem('cursorEffect', currentCursorEffect);
        // Clear existing particles
        cursorTrailContainer.innerHTML = '';
        particleCount = 0;
    });
}

document.addEventListener('mousemove', (e) => {
    // Store for comet rotation
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    // Skip if effect is none or too many particles
    if (currentCursorEffect === 'none' || particleCount >= MAX_PARTICLES) return;

    createCursorParticle(e.clientX, e.clientY, e.movementX, e.movementY);
});

function createCursorParticle(x, y, moveX = 0, moveY = 0) {
    const particle = document.createElement('div');

    switch (currentCursorEffect) {
        case 'sparkle':
            createSparkleParticle(particle, x, y);
            break;
        case 'comet':
            createCometParticle(particle, x, y, moveX, moveY);
            break;
        case 'bubble':
            createBubbleParticle(particle, x, y);
            break;
        default:
            return;
    }

    cursorTrailContainer.appendChild(particle);
    particleCount++;

    // Get animation duration based on effect
    const duration = currentCursorEffect === 'bubble' ? 1200 :
        currentCursorEffect === 'comet' ? 600 : 800;

    setTimeout(() => {
        if (particle.parentNode) particle.remove();
        particleCount = Math.max(0, particleCount - 1); // Prevent negative drift
    }, duration);
}

function createSparkleParticle(particle, x, y) {
    particle.className = 'cursor-particle';

    const offsetX = (Math.random() - 0.5) * 10;
    const offsetY = (Math.random() - 0.5) * 10;

    particle.style.left = `${x + offsetX}px`;
    particle.style.top = `${y + offsetY}px`;

    const size = 6 + Math.random() * 10;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
}

function createCometParticle(particle, x, y, moveX, moveY) {
    particle.className = 'cursor-comet';

    // Calculate rotation based on movement direction
    const angle = Math.atan2(moveY, moveX) * (180 / Math.PI);

    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.transform = `rotate(${angle}deg)`;

    // Vary the length based on speed
    const speed = Math.sqrt(moveX * moveX + moveY * moveY);
    const length = 10 + Math.min(speed * 2, 30);
    particle.style.width = `${length}px`;
}

function createBubbleParticle(particle, x, y) {
    particle.className = 'cursor-bubble';

    const offsetX = (Math.random() - 0.5) * 20;

    particle.style.left = `${x + offsetX}px`;
    particle.style.top = `${y}px`;

    const size = 8 + Math.random() * 16;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
}

// ===== Pre-Game Element Visibility =====
// Hide player info and controls before game starts
function hideGameElements() {
    // Hide all player info elements (portraits, names, chips)
    const playerInfos = document.querySelectorAll('.player-info');
    playerInfos.forEach(info => {
        info.classList.add('pre-game-hidden');
        info.classList.remove('game-started');
    });

    // Hide controls
    const controls = document.getElementById('controls');
    if (controls) {
        controls.classList.add('pre-game-hidden');
        controls.classList.remove('game-started');
    }
}

// Show player info and controls when game starts
function showGameElements() {
    // Show all player info elements
    const playerInfos = document.querySelectorAll('.player-info');
    playerInfos.forEach(info => {
        info.classList.remove('pre-game-hidden');
        info.classList.add('game-started');
    });

    // Show controls
    const controls = document.getElementById('controls');
    if (controls) {
        controls.classList.remove('pre-game-hidden');
        controls.classList.add('game-started');
    }
}

// ===== Online User Count =====
function initOnlineCount() {
    const userIdKey = 'poker_online_user_id';
    let userId = localStorage.getItem(userIdKey);
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(userIdKey, userId);
    }

    const updateCount = async () => {
        try {
            const response = await fetch('/api/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });

            if (response.ok) {
                const data = await response.json();
                const countEl = document.getElementById('online-count');
                if (countEl && data.count) {
                    countEl.dataset.count = data.count; // Store count for translation updates
                    countEl.textContent = `🟢 ${t('onlineUsers')}: ${data.count}`;
                }
            }
        } catch (e) {
            // Quietly fail for local dev (no API)
            const countEl = document.getElementById('online-count');
            if (countEl && !countEl.dataset.count) {
                countEl.dataset.count = 1;
                countEl.textContent = `🟢 ${t('onlineUsers')}: 1`;
            }
        }
    };

    // Update immediately
    updateCount();

    // Poll every 15 seconds
    setInterval(updateCount, 15000);
}

// Initialize
initPlayers();
SoundManager.init();
initOnlineCount();
hideGameElements(); // Hide player elements initially
updateUI();
updateLanguageUI(); // Apply saved language preference
updateGameModeUI(); // Apply saved game mode preference
showMessage(t('startMessage'));

// Mode toggle event listener
document.getElementById('btn-mode').addEventListener('click', toggleGameMode);

// Stats toggle event listener
document.getElementById('btn-stats-toggle').addEventListener('click', toggleShowAllStats);

// Initialize stats toggle state
if (showAllStats) {
    document.body.classList.add('show-all-stats');
    document.getElementById('btn-stats-toggle').classList.add('active');
}

// Initialize stats display with default values
updateAllPlayerStatsDisplays();
