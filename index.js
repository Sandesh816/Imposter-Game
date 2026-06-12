// Secret Word Imposter Game - Main Game Logic
// Supports both Local and Multiplayer modes

import * as MP from './multiplayer.js';
import * as League from './league.js';
import * as CustomCat from './customCategories.js';
import * as Auth from './auth.js';
import * as FX from './fx.js';
import * as Voice from './voice.js';

// ===============================================
// Game State
// ===============================================
const gameState = {
    mode: 'local', // 'local' or 'multiplayer'
    gameType: 'word', // 'word' or 'question'
    // Local mode state
    players: [],
    imposterCount: 1,
    selectedCategory: null,
    secretWord: null,
    secretQuestion: null, // { real, imposter } for question mode
    playerAnswers: [], // [playerIndex -> answer] for question mode
    imposterIndices: [],
    currentRevealIndex: 0,
    isRevealed: false,
    cardLocked: false, // blocks card taps while handing the phone over
    // Multiplayer state
    roomData: null,
    myPlayerId: null,
    mpImposterCount: 1,
    mpRevealed: false,
    selectedVote: null,
    chatMessages: [],
    unreadMessages: 0
};

// ===============================================
// DOM Elements
// ===============================================
const screens = {
    onboarding: document.getElementById('onboarding-screen'),
    welcome: document.getElementById('welcome-screen'),
    gameType: document.getElementById('game-type-screen'),
    players: document.getElementById('player-screen'),
    category: document.getElementById('category-screen'),
    reveal: document.getElementById('reveal-screen'),
    game: document.getElementById('game-screen'),
    // Multiplayer screens
    mpChoice: document.getElementById('mp-choice-screen'),
    mpCreate: document.getElementById('mp-create-screen'),
    mpJoin: document.getElementById('mp-join-screen'),
    mpLobby: document.getElementById('mp-lobby-screen'),
    mpCategory: document.getElementById('mp-category-screen'),
    mpWord: document.getElementById('mp-word-screen'),
    mpDiscussion: document.getElementById('mp-discussion-screen'),
    mpVoting: document.getElementById('mp-voting-screen'),
    mpResults: document.getElementById('mp-results-screen'),
    league: document.getElementById('league-screen'),
    leagueJoin: document.getElementById('league-join-screen'),
    leagueDetail: document.getElementById('league-detail-screen'),
    customCat: document.getElementById('custom-cat-screen'),
    customCreate: document.getElementById('custom-create-screen'),
    community: document.getElementById('community-screen'),
    profile: document.getElementById('profile-screen')
};

const elements = {
    // Onboarding
    landingLoginBtn: document.getElementById('landing-login-btn'),
    landingSignupBtn: document.getElementById('landing-signup-btn'),
    landingGuestBtn: document.getElementById('landing-guest-btn'),

    // Welcome / Mode Selection
    localModeBtn: document.getElementById('local-mode-btn'),
    multiplayerModeBtn: document.getElementById('multiplayer-mode-btn'),

    // Players (Local)
    backToWelcome: document.getElementById('back-to-welcome'),
    playerList: document.getElementById('player-list'),
    playerCount: document.getElementById('player-count'),
    addPlayerBtn: document.getElementById('add-player-btn'),
    imposterMinus: document.getElementById('imposter-minus'),
    imposterPlus: document.getElementById('imposter-plus'),
    imposterCount: document.getElementById('imposter-count'),
    imposterRandomize: document.getElementById('imposter-randomize'),
    continueToCategory: document.getElementById('continue-to-category'),

    // Category (Local)
    backToPlayers: document.getElementById('back-to-players'),
    categoryGrid: document.getElementById('category-grid'),

    // Reveal (Local)
    backToCategory: document.getElementById('back-to-category'),
    revealCard: document.getElementById('reveal-card'),
    playerAvatar: document.getElementById('player-avatar'),
    revealPlayerName: document.getElementById('reveal-player-name'),
    wordLabel: document.getElementById('word-label'),
    secretWord: document.getElementById('secret-word'),
    currentPlayerNum: document.getElementById('current-player-num'),
    totalPlayers: document.getElementById('total-players'),
    nextPlayerBtn: document.getElementById('next-player-btn'),
    nextPlayerText: document.getElementById('next-player-text'),
    revealWordContainer: document.getElementById('reveal-word-container'),
    revealQuestionContainer: document.getElementById('reveal-question-container'),
    revealQuestionText: document.getElementById('reveal-question-text'),
    revealAnswerInput: document.getElementById('reveal-answer-input'),
    revealInstruction: document.getElementById('reveal-instruction'),
    imposterHint: document.getElementById('imposter-hint'),

    // Handoff overlay (Local)
    handoffOverlay: document.getElementById('handoff-overlay'),
    handoffLabel: document.getElementById('handoff-label'),
    handoffAvatar: document.getElementById('handoff-avatar'),
    handoffName: document.getElementById('handoff-name'),
    handoffConfirmBtn: document.getElementById('handoff-confirm-btn'),
    handoffConfirmText: document.getElementById('handoff-confirm-text'),

    // Discussion timer (Local)
    timerTime: document.getElementById('timer-time'),
    timerRingProgress: document.getElementById('timer-ring-progress'),
    timerPresets: document.getElementById('timer-presets'),
    timerStartBtn: document.getElementById('timer-start-btn'),
    timerStartText: document.getElementById('timer-start-text'),


    // Game (Local)
    gameCategory: document.getElementById('game-category'),
    gamePlayerCount: document.getElementById('game-player-count'),
    gameImposterCount: document.getElementById('game-imposter-count'),
    gamePlayersGrid: document.getElementById('game-players-grid'),
    firstSpeaker: document.getElementById('first-speaker'),
    revealAnswerBtn: document.getElementById('reveal-answer-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    restartBtn: document.getElementById('restart-btn'),

    // Modal (Local) - Multi-step
    answerModal: document.getElementById('answer-modal'),
    modalStepVote: document.getElementById('modal-step-vote'),
    modalStepGuess: document.getElementById('modal-step-guess'),
    modalStepResults: document.getElementById('modal-step-results'),
    modalQuestionAnswers: document.getElementById('modal-question-answers'),
    modalRealQuestion: document.getElementById('modal-real-question'),
    modalAnswersList: document.getElementById('modal-answers-list'),
    modalVoteGrid: document.getElementById('modal-vote-grid'),
    modalConfirmVoteBtn: document.getElementById('modal-confirm-vote-btn'),
    modalSkipVoteBtn: document.getElementById('modal-skip-vote-btn'),
    imposterGuessArea: document.getElementById('imposter-guess-area'),
    modalSubmitGuessBtn: document.getElementById('modal-submit-guess-btn'),
    modalSkipGuessBtn: document.getElementById('modal-skip-guess-btn'),
    modalResultsTitle: document.getElementById('modal-results-title'),
    answerWord: document.getElementById('answer-word'),
    impostersList: document.getElementById('imposters-list'),
    guessResultsSection: document.getElementById('guess-results-section'),
    leaguePointsSummary: document.getElementById('league-points-summary'),
    pointsList: document.getElementById('points-list'),
    savePointsBtn: document.getElementById('save-points-btn'),
    leagueSelector: document.getElementById('league-selector'),
    leagueCheckboxList: document.getElementById('league-checkbox-list'),
    leagueSelectorHint: document.getElementById('league-selector-hint'),

    // League Hub
    leagueBtn: document.getElementById('league-btn'),
    leagueBackBtn: document.getElementById('league-back-btn'),
    leagueHubList: document.getElementById('league-hub-list'),
    leagueHubEmpty: document.getElementById('league-hub-empty'),
    createLeagueBtn: document.getElementById('create-league-btn'),
    joinLeagueBtn: document.getElementById('join-league-btn'),

    // League Create / Join
    leagueJoinBackBtn: document.getElementById('league-join-back-btn'),
    leagueJoinTitle: document.getElementById('league-join-title'),
    leagueCreateForm: document.getElementById('league-create-form'),
    leagueJoinForm: document.getElementById('league-join-form'),
    leagueNameInput: document.getElementById('league-name-input'),
    leagueCodeInput: document.getElementById('league-code-input'),
    leagueCreateSubmit: document.getElementById('league-create-submit'),
    leagueJoinSubmit: document.getElementById('league-join-submit'),
    leagueFormError: document.getElementById('league-form-error'),

    // League Detail
    leagueDetailBackBtn: document.getElementById('league-detail-back-btn'),
    leagueDetailName: document.getElementById('league-detail-name'),
    leagueDetailCode: document.getElementById('league-detail-code'),
    leagueCopyBtn: document.getElementById('league-copy-btn'),
    leagueDetailTable: document.getElementById('league-detail-table'),
    leagueDetailEmpty: document.getElementById('league-detail-empty'),
    leagueLeaveBtn: document.getElementById('league-leave-btn'),
    leagueDeleteBtn: document.getElementById('league-delete-btn'),

    // Multiplayer - Choice
    mpBackToWelcome: document.getElementById('mp-back-to-welcome'),
    createRoomBtn: document.getElementById('create-room-btn'),
    joinRoomBtn: document.getElementById('join-room-btn'),

    // Multiplayer - Create
    mpBackToChoiceFromCreate: document.getElementById('mp-back-to-choice-from-create'),
    hostNameInput: document.getElementById('host-name-input'),
    createRoomSubmitBtn: document.getElementById('create-room-submit-btn'),

    // Multiplayer - Join
    mpBackToChoiceFromJoin: document.getElementById('mp-back-to-choice-from-join'),
    roomCodeInput: document.getElementById('room-code-input'),
    joinNameInput: document.getElementById('join-name-input'),
    joinError: document.getElementById('join-error'),
    joinRoomSubmitBtn: document.getElementById('join-room-submit-btn'),

    // Multiplayer - Lobby
    mpLeaveLobby: document.getElementById('mp-leave-lobby'),
    lobbyRoomCode: document.getElementById('lobby-room-code'),
    copyCodeBtn: document.getElementById('copy-code-btn'),
    lobbyPlayerCount: document.getElementById('lobby-player-count'),
    lobbyPlayersList: document.getElementById('lobby-players-list'),
    lobbyCategoryValue: document.getElementById('lobby-category-value'),
    lobbyChangeCategoryBtn: document.getElementById('lobby-change-category-btn'),
    mpImposterSettings: document.getElementById('mp-imposter-settings'),
    mpImposterMinus: document.getElementById('mp-imposter-minus'),
    mpImposterCount: document.getElementById('mp-imposter-count'),
    mpImposterPlus: document.getElementById('mp-imposter-plus'),
    mpImposterRandomize: document.getElementById('mp-imposter-randomize'),
    hostControls: document.getElementById('host-controls'),
    mpStartGameBtn: document.getElementById('mp-start-game-btn'),
    mpHostHint: document.getElementById('mp-host-hint'),
    hostPostgameControls: document.getElementById('host-postgame-controls'),
    mpPlayAgainBtn: document.getElementById('mp-play-again-btn'),
    mpChangeSettingsBtn: document.getElementById('mp-change-settings-btn'),
    waitingMessage: document.getElementById('waiting-message'),
    playerReadyControls: document.getElementById('player-ready-controls'),
    mpLobbyReadyBtn: document.getElementById('mp-lobby-ready-btn'),
    mpLobbyReadyText: document.getElementById('mp-lobby-ready-text'),
    mpAnonymousVoting: document.getElementById('mp-anonymous-voting'),
    mpLeaveGameLobby: document.getElementById('mp-leave-game-lobby'),

    // Multiplayer - Category
    mpBackToLobby: document.getElementById('mp-back-to-lobby'),
    mpCategoryGrid: document.getElementById('mp-category-grid'),

    // Multiplayer - Results / Post-Game Lobby
    mpResultsLeaveBtn: document.getElementById('mp-results-leave-btn'),
    resultsCategoryValue: document.getElementById('results-category-value'),
    resultsChangeCategoryBtn: document.getElementById('results-change-category-btn'),
    resultsPlayersList: document.getElementById('results-players-list'),
    resultsReadyStatus: document.getElementById('results-ready-status'),
    mpResultsReadyBtn: document.getElementById('mp-results-ready-btn'),
    mpResultsReadyText: document.getElementById('mp-results-ready-text'),
    mpNewRoundText: document.getElementById('mp-new-round-text'),
    resultsHostControls: document.getElementById('results-host-controls'),
    resultsGameTypeWord: document.getElementById('results-game-type-word'),
    resultsGameTypeQuestion: document.getElementById('results-game-type-question'),
    resultsImposterMinus: document.getElementById('results-imposter-minus'),
    resultsImposterCount: document.getElementById('results-imposter-count'),
    resultsImposterPlus: document.getElementById('results-imposter-plus'),
    mpResultsAnonymousVoting: document.getElementById('mp-results-anonymous-voting'),

    // Multiplayer - Word
    mpRevealCard: document.getElementById('mp-reveal-card'),
    mpPlayerAvatar: document.getElementById('mp-player-avatar'),
    mpRevealPlayerName: document.getElementById('mp-reveal-player-name'),
    mpWordLabel: document.getElementById('mp-word-label'),
    mpSecretWord: document.getElementById('mp-secret-word'),
    mpPlayersSeen: document.getElementById('mp-players-seen'),
    mpReadyBtn: document.getElementById('mp-ready-btn'),
    mpReadyBtnText: document.getElementById('mp-ready-btn-text'),
    mpAnswerInput: document.getElementById('mp-answer-input'),
    mpSubmitAnswerBtn: document.getElementById('mp-submit-answer-btn'),
    mpSubmitAnswerText: document.getElementById('mp-submit-answer-text'),
    mpAnswerStatus: document.getElementById('mp-answer-status'),

    // Multiplayer - Discussion
    mpCategoryDisplay: document.getElementById('mp-category-display'),
    mpDiscussionPlayers: document.getElementById('mp-discussion-players'),
    mpSpeakingList: document.getElementById('mp-speaking-list'),
    mpHostVotingControls: document.getElementById('mp-host-voting-controls'),
    mpStartVotingBtn: document.getElementById('mp-start-voting-btn'),
    mpWaitingVoting: document.getElementById('mp-waiting-voting'),
    chatToggleBtn: document.getElementById('chat-toggle-btn'),

    // Multiplayer - Voting
    votesCast: document.getElementById('votes-cast'),
    votesTotal: document.getElementById('votes-total'),
    votingGrid: document.getElementById('voting-grid'),
    liveVotes: document.getElementById('live-votes'),
    submitVoteBtn: document.getElementById('submit-vote-btn'),
    skipVoteBtn: document.getElementById('skip-vote-btn'),
    voteWaiting: document.getElementById('vote-waiting'),

    // Multiplayer - Results
    resultsHeader: document.getElementById('results-header'),
    resultsTitle: document.getElementById('results-title'),
    resultsSubtitle: document.getElementById('results-subtitle'),
    resultsWord: document.getElementById('results-word'),
    resultsImposters: document.getElementById('results-imposters'),
    voteResults: document.getElementById('vote-results'),
    mpNewRoundBtn: document.getElementById('mp-new-round-btn'),
    mpReturnLobbyBtn: document.getElementById('mp-return-lobby-btn'),

    // Voice chat
    voiceBar: document.getElementById('voice-bar'),
    voiceJoinBtn: document.getElementById('voice-join-btn'),
    voiceJoinText: document.getElementById('voice-join-text'),
    voiceControls: document.getElementById('voice-controls'),
    voiceMicBtn: document.getElementById('voice-mic-btn'),
    voiceParticipants: document.getElementById('voice-participants'),
    voiceLeaveBtn: document.getElementById('voice-leave-btn'),

    // Chat
    chatSidebar: document.getElementById('chat-sidebar'),
    chatOverlay: document.getElementById('chat-overlay'),
    closeChatBtn: document.getElementById('close-chat-btn'),
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendChatBtn: document.getElementById('send-chat-btn'),
    chatBadge: document.getElementById('chat-badge'),

    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),

    // Custom Categories
    customCatBtn: document.getElementById('custom-cat-btn'),
    customCatBack: document.getElementById('custom-cat-back'),
    createCatBtn: document.getElementById('create-cat-btn'),
    browseCommunityBtn: document.getElementById('browse-community-btn'),
    myCategoriesList: document.getElementById('my-categories-list'),
    myCategoriesEmpty: document.getElementById('my-categories-empty'),
    createCatBack: document.getElementById('create-cat-back'),
    createCatTitle: document.getElementById('create-cat-title'),
    emojiPicker: document.getElementById('emoji-picker'),
    catNameInput: document.getElementById('cat-name-input'),
    wordInput: document.getElementById('word-input'),
    addWordBtn: document.getElementById('add-word-btn'),
    wordChipList: document.getElementById('word-chip-list'),
    wordCountBadge: document.getElementById('word-count-badge'),
    saveCatBtn: document.getElementById('save-cat-btn'),
    authorNameInput: document.getElementById('author-name-input'),
    publishCatBtn: document.getElementById('publish-cat-btn'),
    publishStatus: document.getElementById('publish-status'),
    createCatError: document.getElementById('create-cat-error'),
    communityBack: document.getElementById('community-back'),
    communitySearch: document.getElementById('community-search'),
    communityLoading: document.getElementById('community-loading'),
    communityList: document.getElementById('community-list'),
    communityEmpty: document.getElementById('community-empty'),

    // Auth / Profile
    authAvatarBtn: document.getElementById('auth-avatar-btn'),
    authDisplayName: document.getElementById('auth-display-name'),
    authAvatarEmoji: document.getElementById('auth-avatar-emoji'),
    profileBack: document.getElementById('profile-back'),
    profileAvatarLarge: document.getElementById('profile-avatar-large'),
    profileNameDisplay: document.getElementById('profile-name-display'),
    profileStatusBadge: document.getElementById('profile-status-badge'),
    profileNameInput: document.getElementById('profile-name-input'),
    profileSaveNameBtn: document.getElementById('profile-save-name-btn'),
    profileUpgradeSection: document.getElementById('profile-upgrade-section'),
    profileGoogleBtn: document.getElementById('profile-google-btn'),
    profileStats: document.getElementById('profile-stats'),
    statGames: document.getElementById('stat-games'),
    statWins: document.getElementById('stat-wins'),
    statPoints: document.getElementById('stat-points'),
    profileSignoutBtn: document.getElementById('profile-signout-btn')
};

// ===============================================
// Utility Functions
// ===============================================
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const randomBuffer = new Uint32Array(1);
        window.crypto.getRandomValues(randomBuffer);
        const j = Math.floor((randomBuffer[0] / 4294967296) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const USED_WORDS_KEY = 'imposter-used-words';

// Pick a word while avoiding the most recently used ones in this category,
// so back-to-back rounds don't repeat.
function pickFreshWord(words, categoryKey) {
    let used = {};
    try { used = JSON.parse(localStorage.getItem(USED_WORDS_KEY)) || {}; } catch (e) { /* corrupt storage */ }
    const recent = Array.isArray(used[categoryKey]) ? used[categoryKey] : [];
    const fresh = words.filter(w => !recent.includes(w));
    const pool = fresh.length > 0 ? fresh : words;
    const word = pool[getRandomInt(0, pool.length - 1)];

    const memory = Math.min(words.length - 1, 12);
    used[categoryKey] = [word, ...recent.filter(w => w !== word)].slice(0, Math.max(memory, 0));
    try { localStorage.setItem(USED_WORDS_KEY, JSON.stringify(used)); } catch (e) { /* storage full */ }
    return word;
}

function getRandomWord(category) {
    // Support custom categories (prefixed with 'custom:')
    if (typeof category === 'string' && category.startsWith('custom:')) {
        const localCats = CustomCat.getLocalCategoriesSync();
        const cat = localCats.find(c => 'custom:' + c.id === category);
        if (cat && cat.words.length > 0) {
            return pickFreshWord(cat.words, category);
        }
        return 'Mystery';
    }
    const words = CATEGORIES[category].words;
    return pickFreshWord(words, category);
}

function getPlayerAvatars() {
    return ['😎', '🤠', '🥳', '😈', '🤖', '👽', '🦊', '🐱', '🐶', '🦁', '🐯', '🐮', '🐷', '🐸', '🐙', '🦄'];
}

function showLoading(text = 'Loading...') {
    elements.loadingText.textContent = text;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

// ===============================================
// Screen Navigation
// ===============================================
function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    if (screens[screenId]) {
        screens[screenId].classList.add('active');
    }
}

// ===============================================
// LOCAL MODE - Player Management
// ===============================================
function createPlayerElement(index, name = '') {
    const avatars = getPlayerAvatars();
    const avatar = avatars[index % avatars.length];

    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    playerItem.dataset.index = index;
    playerItem.style.setProperty('--i', index);

    playerItem.innerHTML = `
    <div class="player-number">${avatar}</div>
    <input 
      type="text" 
      class="player-input" 
      placeholder="Player ${index + 1}" 
      value="${name}"
      maxlength="20"
    >
    <button class="btn-remove-player" title="Remove player">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

    const input = playerItem.querySelector('.player-input');
    input.addEventListener('input', (e) => {
        const idx = parseInt(playerItem.dataset.index);
        gameState.players[idx] = e.target.value || `Player ${idx + 1}`;
    });

    const removeBtn = playerItem.querySelector('.btn-remove-player');
    removeBtn.addEventListener('click', () => {
        removePlayer(parseInt(playerItem.dataset.index));
    });

    return playerItem;
}

function addPlayer(name = '') {
    const index = gameState.players.length;
    const defaultName = name || `Player ${index + 1}`;
    gameState.players.push(defaultName);

    const playerElement = createPlayerElement(index, name);
    elements.playerList.appendChild(playerElement);

    updatePlayerCount();
    updateImposterLimits();

    setTimeout(() => {
        playerElement.querySelector('.player-input').focus();
    }, 100);
}

function removePlayer(index) {
    if (gameState.players.length <= 3) {
        return;
    }

    gameState.players.splice(index, 1);
    renderPlayerList();
    updatePlayerCount();
    updateImposterLimits();
}

function renderPlayerList() {
    elements.playerList.innerHTML = '';
    gameState.players.forEach((player, index) => {
        const playerElement = createPlayerElement(index, player);
        playerElement.dataset.index = index;
        elements.playerList.appendChild(playerElement);
    });
}

function updatePlayerCount() {
    if (elements.playerCount) elements.playerCount.textContent = gameState.players.length;
    if (elements.continueToCategory) elements.continueToCategory.disabled = gameState.players.length < 3;
}

function updateImposterLimits() {
    const maxImposters = Math.max(1, Math.floor((gameState.players.length - 1) / 2));

    if (gameState.imposterCount > maxImposters) {
        gameState.imposterCount = maxImposters;
        if (elements.imposterCount) elements.imposterCount.textContent = gameState.imposterCount;
    }

    if (elements.imposterMinus) elements.imposterMinus.disabled = gameState.imposterCount <= 1;
    if (elements.imposterPlus) elements.imposterPlus.disabled = gameState.imposterCount >= maxImposters;
}

function updateMPImposterLimits(playerCount) {
    const maxImposters = Math.max(1, Math.floor((playerCount - 1) / 2));

    if (gameState.mpImposterCount > maxImposters) {
        gameState.mpImposterCount = maxImposters;
        MP.updateImposterCount(maxImposters);
    }

    if (elements.mpImposterMinus) {
        elements.mpImposterMinus.disabled = gameState.mpImposterCount <= 1;
    }
    if (elements.mpImposterPlus) {
        elements.mpImposterPlus.disabled = gameState.mpImposterCount >= maxImposters;
    }
}

// ===============================================
// LOCAL MODE - Category Management
// ===============================================
function renderCategories(targetGrid = elements.categoryGrid, callback = selectCategory, gameTypeOverride = null) {
    targetGrid.innerHTML = '';
    const gType = gameTypeOverride ?? gameState.gameType;
    let cardIndex = 0;

    if (gType === 'question') {
        // Question mode: only question categories
        if (typeof QUESTION_CATEGORIES !== 'undefined') {
            Object.entries(QUESTION_CATEGORIES).forEach(([key, category]) => {
                const card = document.createElement('div');
                card.className = 'category-card';
                card.dataset.category = 'q:' + key;
                card.style.setProperty('--i', cardIndex++);
                card.innerHTML = `
          <div class="category-icon">${category.icon}</div>
          <div class="category-name">${category.name}</div>
          <div class="category-count">${category.questions?.length || 0} questions</div>
        `;
                card.addEventListener('click', () => callback('q:' + key));
                targetGrid.appendChild(card);
            });
        }
        return;
    }

    // Word mode: custom + built-in word categories
    const localCats = CustomCat.getLocalCategoriesSync();
    localCats.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'category-card custom-category-card';
        const key = 'custom:' + cat.id;
        card.dataset.category = key;
        card.style.setProperty('--i', cardIndex++);
        card.innerHTML = `
      <div class="category-icon">${cat.icon || '📝'}</div>
      <div class="category-name">${cat.name}</div>
      <div class="category-count">${cat.words.length} words</div>
      <div class="custom-category-badge">✏️ Custom</div>
    `;
        card.addEventListener('click', () => callback(key));
        targetGrid.appendChild(card);
    });

    Object.entries(CATEGORIES).forEach(([key, category]) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.category = key;
        card.style.setProperty('--i', cardIndex++);
        card.innerHTML = `
      <div class="category-icon">${category.icon}</div>
      <div class="category-name">${category.name}</div>
      <div class="category-count">${category.words.length} words</div>
    `;
        card.addEventListener('click', () => callback(key));
        targetGrid.appendChild(card);
    });
}

function selectCategory(categoryKey) {
    FX.play('tap');
    gameState.selectedCategory = categoryKey;
    if (gameState.gameType === 'question' && categoryKey.startsWith('q:')) {
        const qKey = categoryKey.slice(2);
        const pair = getRandomQuestion(qKey);
        if (pair) {
            gameState.secretQuestion = pair;
            gameState.playerAnswers = new Array(gameState.players.length).fill(null);
        }
    }
    startLocalGame();
}

// ===============================================
// LOCAL MODE - Game Logic
// ===============================================
function startLocalGame() {
    if (gameState.gameType === 'word') {
        gameState.secretWord = getRandomWord(gameState.selectedCategory);
        gameState.secretQuestion = null;
        gameState.playerAnswers = [];
    } else if (gameState.gameType === 'question' && gameState.selectedCategory?.startsWith('q:')) {
        const pair = getRandomQuestion(gameState.selectedCategory.slice(2));
        if (pair) {
            gameState.secretQuestion = pair;
            gameState.playerAnswers = new Array(gameState.players.length).fill(null);
        }
    }

    const playerIndices = gameState.players.map((_, index) => index);
    const shuffledIndices = shuffleArray(playerIndices);
    gameState.imposterIndices = shuffledIndices.slice(0, gameState.imposterCount);

    gameState.currentRevealIndex = 0;
    gameState.isRevealed = false;
    gameState.cardLocked = false;

    updateRevealScreen();
    showScreen('reveal');
    showHandoff(0, true);
}

function updateRevealScreen() {
    const currentPlayer = gameState.players[gameState.currentRevealIndex];
    const avatars = getPlayerAvatars();

    elements.revealCard.classList.remove('revealed');
    gameState.isRevealed = false;
    clearCardBack();

    elements.playerAvatar.textContent = avatars[gameState.currentRevealIndex % avatars.length];
    elements.revealPlayerName.textContent = currentPlayer;

    if (gameState.gameType === 'question') {
        elements.revealWordContainer?.classList.add('hidden');
        elements.revealQuestionContainer?.classList.remove('hidden');
        elements.revealInstruction?.classList.add('hidden');
        elements.revealAnswerInput.placeholder = 'Type your answer...';
    } else {
        elements.revealWordContainer?.classList.remove('hidden');
        elements.revealQuestionContainer?.classList.add('hidden');
        elements.revealInstruction?.classList.remove('hidden');
    }
    elements.nextPlayerBtn.disabled = true;

    elements.currentPlayerNum.textContent = gameState.currentRevealIndex + 1;
    elements.totalPlayers.textContent = gameState.players.length;

    if (gameState.currentRevealIndex === gameState.players.length - 1) {
        elements.nextPlayerText.textContent = "Start Discussion";
    } else {
        elements.nextPlayerText.textContent = "Next Player";
    }
}

// The secret only exists in the DOM while the card is face-up. This (plus the
// opaque handoff overlay) makes it impossible to glimpse the next player's role.
function populateCardBack() {
    const isImposter = gameState.imposterIndices.includes(gameState.currentRevealIndex);

    if (gameState.gameType === 'question') {
        const q = isImposter ? gameState.secretQuestion.imposter : gameState.secretQuestion.real;
        elements.revealQuestionText.textContent = q;
        elements.revealAnswerInput.value = gameState.playerAnswers[gameState.currentRevealIndex] || '';
        return;
    }

    if (isImposter) {
        elements.wordLabel.textContent = "You are the:";
        elements.secretWord.textContent = "IMPOSTER! 🕵️";
        elements.secretWord.classList.add('imposter');
        if (elements.imposterHint) {
            elements.imposterHint.textContent = `Category: ${getSelectedCategoryName()} — blend in!`;
            elements.imposterHint.classList.remove('hidden');
        }
    } else {
        elements.wordLabel.textContent = "Your word is:";
        elements.secretWord.textContent = gameState.secretWord;
        elements.secretWord.classList.remove('imposter');
        elements.imposterHint?.classList.add('hidden');
    }
}

function clearCardBack() {
    elements.secretWord.textContent = '•••••';
    elements.secretWord.classList.remove('imposter');
    elements.wordLabel.textContent = 'Your word is:';
    elements.imposterHint?.classList.add('hidden');
    if (elements.revealQuestionText) elements.revealQuestionText.textContent = '';
    if (elements.revealAnswerInput) elements.revealAnswerInput.value = '';
}

function updateNextPlayerBtnState() {
    if (!gameState.isRevealed) {
        elements.nextPlayerBtn.disabled = true;
        return;
    }
    if (gameState.gameType === 'question') {
        elements.nextPlayerBtn.disabled = !elements.revealAnswerInput?.value?.trim();
    } else {
        elements.nextPlayerBtn.disabled = false;
    }
}

function toggleReveal() {
    if (gameState.cardLocked) return;
    // In question mode, once revealed stay revealed (they need to type answer)
    if (gameState.gameType === 'question' && gameState.isRevealed) return;

    gameState.isRevealed = !gameState.isRevealed;
    FX.play('flip');
    FX.vibrate(15);

    if (gameState.isRevealed) {
        populateCardBack();
        elements.revealCard.classList.add('revealed');
        if (gameState.gameType === 'question') {
            setTimeout(() => elements.revealAnswerInput?.focus(), 300);
        }
    } else {
        elements.revealCard.classList.remove('revealed');
        // Wipe the secret once the flip-back animation has finished
        setTimeout(() => {
            if (!gameState.isRevealed) clearCardBack();
        }, 600);
    }
    updateNextPlayerBtnState();
}

// ---- Pass-the-phone handoff overlay ----
function showHandoff(index, isFirst = false) {
    const name = gameState.players[index];
    const avatars = getPlayerAvatars();

    elements.handoffLabel.textContent = isFirst ? 'Hand the phone to' : 'Pass the phone to';
    elements.handoffAvatar.textContent = avatars[index % avatars.length];
    elements.handoffName.textContent = name;
    elements.handoffConfirmText.textContent = `I'm ${name} — show my card`;

    elements.handoffOverlay.classList.remove('hidden');
    requestAnimationFrame(() => elements.handoffOverlay.classList.add('visible'));
}

function hideHandoff() {
    elements.handoffOverlay.classList.remove('visible');
    setTimeout(() => elements.handoffOverlay.classList.add('hidden'), 350);
}

function confirmHandoff() {
    FX.play('tap');
    FX.vibrate(10);
    hideHandoff();
}

function nextPlayer() {
    if (!gameState.isRevealed || gameState.cardLocked) return;

    // Question mode: save answer before advancing
    if (gameState.gameType === 'question') {
        const ans = elements.revealAnswerInput?.value?.trim();
        if (!ans) return;
        gameState.playerAnswers[gameState.currentRevealIndex] = ans;
        elements.revealAnswerInput.blur();
    }

    FX.play('whoosh');
    gameState.cardLocked = true;
    elements.nextPlayerBtn.disabled = true;

    const isLast = gameState.currentRevealIndex >= gameState.players.length - 1;

    if (isLast) {
        elements.revealCard.classList.remove('revealed');
        gameState.isRevealed = false;
        setTimeout(() => {
            clearCardBack();
            gameState.cardLocked = false;
            showGameScreen();
        }, 450);
        return;
    }

    // Cover the screen with the opaque handoff overlay first, THEN swap the
    // card content behind it with the flip transition disabled. The next
    // player's secret is never visible, not even for a frame.
    gameState.currentRevealIndex++;
    showHandoff(gameState.currentRevealIndex);

    setTimeout(() => {
        elements.revealCard.classList.add('no-flip');
        updateRevealScreen();
        void elements.revealCard.offsetWidth; // flush styles before re-enabling transitions
        elements.revealCard.classList.remove('no-flip');
        gameState.cardLocked = false;
    }, 400);
}

function getSelectedCategoryName() {
    const key = gameState.selectedCategory;
    if (typeof key === 'string' && key.startsWith('q:')) {
        return (typeof QUESTION_CATEGORIES !== 'undefined' && QUESTION_CATEGORIES[key.slice(2)]?.name) || key;
    }
    if (typeof key === 'string' && key.startsWith('custom:')) {
        const localCats = CustomCat.getLocalCategoriesSync();
        const cat = localCats.find(c => 'custom:' + c.id === key);
        return cat ? cat.name : 'Custom';
    }
    return CATEGORIES[key]?.name || key;
}

function showGameScreen() {
    const categoryName = getSelectedCategoryName();
    const category = { name: categoryName };

    elements.gameCategory.textContent = category.name;
    elements.gamePlayerCount.textContent = gameState.players.length;
    elements.gameImposterCount.textContent = gameState.imposterCount;

    elements.gamePlayersGrid.innerHTML = '';
    const avatars = getPlayerAvatars();

    gameState.players.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = 'game-player-card';
        card.style.setProperty('--i', index);
        card.innerHTML = `
      <div class="game-player-avatar">${avatars[index % avatars.length]}</div>
      <div class="game-player-name">${player}</div>
    `;
        elements.gamePlayersGrid.appendChild(card);
    });

    // Question mode: show the question and everyone's submitted answer for review
    const qaBlock = document.getElementById('game-question-answers');
    if (qaBlock) {
        if (gameState.gameType === 'question' && gameState.secretQuestion) {
            document.getElementById('game-real-question').textContent = gameState.secretQuestion.real;
            const list = document.getElementById('game-answers-list');
            list.innerHTML = '';
            gameState.players.forEach((player, idx) => {
                const item = document.createElement('div');
                item.className = 'modal-answer-item';
                const playerSpan = document.createElement('span');
                playerSpan.className = 'answer-player';
                playerSpan.textContent = `${avatars[idx % avatars.length]} ${player}`;
                const ansSpan = document.createElement('span');
                ansSpan.className = 'answer-text';
                ansSpan.textContent = `"${gameState.playerAnswers[idx] || '(no answer)'}"`;
                item.appendChild(playerSpan);
                item.appendChild(ansSpan);
                list.appendChild(item);
            });
            qaBlock.classList.remove('hidden');
        } else {
            qaBlock.classList.add('hidden');
        }
    }

    // Shuffled speaking order
    const order = shuffleArray(gameState.players.map((_, i) => i));
    elements.firstSpeaker.innerHTML = '';
    order.forEach((playerIdx, pos) => {
        const chip = document.createElement('span');
        chip.className = `speaker-chip ${pos === 0 ? 'first' : ''}`;
        chip.textContent = `${pos + 1}. ${avatars[playerIdx % avatars.length]} ${gameState.players[playerIdx]}`;
        elements.firstSpeaker.appendChild(chip);
    });

    resetDiscussionTimer();
    showScreen('game');
}

// ===============================================
// LOCAL MODE - Discussion Timer
// ===============================================
const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * 54;
let timerTotalSecs = 120;
let timerRemaining = 120;
let timerInterval = null;

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function renderTimer() {
    if (!elements.timerTime) return;
    elements.timerTime.textContent = formatTime(timerRemaining);
    const progress = timerTotalSecs > 0 ? timerRemaining / timerTotalSecs : 0;
    elements.timerRingProgress.style.strokeDashoffset = TIMER_RING_CIRCUMFERENCE * (1 - progress);
    elements.timerRingProgress.classList.toggle('urgent', timerRemaining <= 10 && timerInterval !== null);
    elements.timerTime.classList.toggle('urgent', timerRemaining <= 10 && timerInterval !== null);
}

function setTimerDuration(secs) {
    timerTotalSecs = secs;
    timerRemaining = secs;
    stopTimerInterval();
    if (elements.timerStartText) elements.timerStartText.textContent = '▶ Start Timer';
    renderTimer();
}

function stopTimerInterval() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function resetDiscussionTimer() {
    setTimerDuration(timerTotalSecs);
}

function toggleDiscussionTimer() {
    FX.play('tap');
    if (timerInterval) {
        stopTimerInterval();
        if (elements.timerStartText) elements.timerStartText.textContent = '▶ Resume';
        renderTimer();
        return;
    }
    if (timerRemaining <= 0) timerRemaining = timerTotalSecs;
    if (elements.timerStartText) elements.timerStartText.textContent = '⏸ Pause';

    timerInterval = setInterval(() => {
        timerRemaining--;
        if (timerRemaining > 0 && timerRemaining <= 5) FX.play('tick');
        if (timerRemaining <= 0) {
            timerRemaining = 0;
            stopTimerInterval();
            FX.play('timeUp');
            FX.vibrate([180, 80, 180]);
            if (elements.timerStartText) elements.timerStartText.textContent = "🗳️ Time's up!";
        }
        renderTimer();
    }, 1000);
    renderTimer();
}

// ===============================================
// LOCAL MODE - League Modal Flow (3 Steps)
// ===============================================
let modalVotedPlayers = [];
let imposterGuesses = {};

function revealAnswer() {
    stopTimerInterval();
    FX.play('tap');

    // Reset modal state
    modalVotedPlayers = [];
    imposterGuesses = {};

    // Show step 1 (vote), hide others
    elements.modalStepVote.classList.remove('hidden');
    elements.modalStepGuess.classList.add('hidden');
    elements.modalStepResults.classList.add('hidden');
    elements.modalConfirmVoteBtn.disabled = true;

    // Question mode: show real question + all answers
    if (gameState.gameType === 'question' && gameState.secretQuestion) {
        elements.modalQuestionAnswers?.classList.remove('hidden');
        elements.modalRealQuestion.textContent = gameState.secretQuestion.real;
        elements.modalAnswersList.innerHTML = '';
        const avatars = getPlayerAvatars();
        gameState.players.forEach((player, idx) => {
            const item = document.createElement('div');
            item.className = 'modal-answer-item';
            const ans = gameState.playerAnswers[idx] || '(no answer)';
            const playerSpan = document.createElement('span');
            playerSpan.className = 'answer-player';
            playerSpan.textContent = `${avatars[idx % avatars.length]} ${player}`;
            const ansSpan = document.createElement('span');
            ansSpan.className = 'answer-text';
            ansSpan.textContent = `"${ans}"`;
            item.appendChild(playerSpan);
            item.appendChild(ansSpan);
            elements.modalAnswersList.appendChild(item);
        });
        document.getElementById('modal-vote-instruction').textContent = 'One person got a different question. Whose answer seems off? Vote below.';
    } else {
        elements.modalQuestionAnswers?.classList.add('hidden');
        document.getElementById('modal-vote-instruction').textContent = 'Tap the player(s) you think are the imposter(s), then confirm.';
    }

    // Build vote grid
    elements.modalVoteGrid.innerHTML = '';
    const avatars = getPlayerAvatars();
    gameState.players.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = 'vote-player-card';
        card.dataset.index = index;
        card.style.setProperty('--i', index);
        card.innerHTML = `
            <div class="vote-player-avatar">${avatars[index % avatars.length]}</div>
            <div class="vote-player-name">${player}</div>
        `;
        card.addEventListener('click', () => {
            card.classList.toggle('selected');
            const idx = parseInt(card.dataset.index);
            if (card.classList.contains('selected')) {
                modalVotedPlayers.push(idx);
            } else {
                modalVotedPlayers = modalVotedPlayers.filter(i => i !== idx);
            }
            elements.modalConfirmVoteBtn.disabled = modalVotedPlayers.length === 0;
        });
        elements.modalVoteGrid.appendChild(card);
    });

    elements.answerModal.classList.add('active');
}

function modalConfirmVote() {
    // Question mode: skip imposter guess (no secret word to guess)
    if (gameState.gameType === 'question') {
        imposterGuesses = {};
        finalizeLeaguePoints();
        return;
    }
    // Word mode: move to step 2 imposter guess
    showModalStep('guess');

    elements.imposterGuessArea.innerHTML = '';
    gameState.imposterIndices.forEach(idx => {
        const name = gameState.players[idx];
        const wrapper = document.createElement('div');
        wrapper.className = 'imposter-guess-item';
        wrapper.innerHTML = `
            <label class="guess-label">🕵️ ${name}'s guess:</label>
            <input type="text" class="form-input guess-input" data-index="${idx}" placeholder="Type the secret word..." maxlength="50" autocomplete="off">
        `;
        elements.imposterGuessArea.appendChild(wrapper);
    });

    const firstInput = elements.imposterGuessArea.querySelector('.guess-input');
    if (firstInput) setTimeout(() => firstInput.focus(), 200);
}

function modalSkipVote() {
    modalVotedPlayers = []; // no vote = imposter survives
    modalConfirmVote();
}

function modalSubmitGuess() {
    // Collect guesses
    const inputs = elements.imposterGuessArea.querySelectorAll('.guess-input');
    inputs.forEach(input => {
        const idx = parseInt(input.dataset.index);
        imposterGuesses[idx] = input.value.trim();
    });
    finalizeLeaguePoints();
}

function modalSkipGuess() {
    imposterGuesses = {};
    finalizeLeaguePoints();
}

function finalizeLeaguePoints() {
    // Determine outcomes
    const imposterIndicesSet = new Set(gameState.imposterIndices);

    // Did civilians correctly identify the imposter(s)?
    const votedSet = new Set(modalVotedPlayers);
    const correctVote = gameState.imposterIndices.length > 0 &&
        gameState.imposterIndices.every(i => votedSet.has(i)) &&
        modalVotedPlayers.every(i => imposterIndicesSet.has(i)) &&
        modalVotedPlayers.length > 0;

    const imposterWins = !correctVote;

    // Check imposter guesses
    const guessResults = {}; // idx -> boolean
    gameState.imposterIndices.forEach(idx => {
        const guess = (imposterGuesses[idx] || '').toLowerCase().trim();
        const actual = (gameState.secretWord || '').toLowerCase().trim();
        guessResults[idx] = guess.length > 0 && guess === actual;
    });

    // Calculate points
    const pointsMap = {}; // playerName -> { points, reasons[] }
    gameState.players.forEach((name, idx) => {
        pointsMap[idx] = { name, points: 0, reasons: [] };
    });

    if (correctVote) {
        // Civilians win: each civilian gets +1
        gameState.players.forEach((name, idx) => {
            if (!imposterIndicesSet.has(idx)) {
                pointsMap[idx].points += 1;
                pointsMap[idx].reasons.push('Caught imposter');
            }
        });
    } else {
        // Imposter wins: each imposter gets +1 for surviving
        gameState.imposterIndices.forEach(idx => {
            pointsMap[idx].points += 1;
            pointsMap[idx].reasons.push('Survived');
        });
    }

    // Imposter correct guess: +1 per correct guess
    gameState.imposterIndices.forEach(idx => {
        if (guessResults[idx]) {
            pointsMap[idx].points += 1;
            pointsMap[idx].reasons.push('Guessed word');
        }
    });

    // Points will be saved through the league selector on "Save & Done"

    // Show step 3: results
    showModalStep('results');

    // Header + celebration
    if (imposterWins) {
        elements.modalResultsTitle.textContent = '🕵️ Imposter Wins!';
        FX.play('sting');
        FX.vibrate([60, 40, 120]);
        FX.imposterConfetti();
    } else {
        elements.modalResultsTitle.textContent = '🎉 Crew Wins!';
        FX.play('fanfare');
        FX.vibrate([30, 30, 30, 30, 80]);
        FX.confetti();
    }

    // Secret word or question
    if (gameState.gameType === 'question') {
        document.getElementById('modal-answer-label').textContent = 'The question was:';
        elements.answerWord.textContent = gameState.secretQuestion?.real || '(unknown)';
        elements.answerWord.style.fontSize = '1rem';
        elements.answerWord.style.fontWeight = '500';
    } else {
        document.getElementById('modal-answer-label').textContent = 'The Secret Word was:';
        elements.answerWord.textContent = gameState.secretWord;
        elements.answerWord.style.fontSize = '';
        elements.answerWord.style.fontWeight = '';
    }

    // Imposters list
    elements.impostersList.innerHTML = '';
    gameState.imposterIndices.forEach(index => {
        const tag = document.createElement('span');
        tag.className = 'imposter-tag';
        tag.innerHTML = `🕵️ ${gameState.players[index]}`;
        elements.impostersList.appendChild(tag);
    });

    // Guess results
    elements.guessResultsSection.innerHTML = '';
    const hasGuesses = Object.keys(imposterGuesses).length > 0;
    if (hasGuesses) {
        const label = document.createElement('p');
        label.className = 'answer-label';
        label.textContent = 'Imposter Guesses:';
        elements.guessResultsSection.appendChild(label);

        gameState.imposterIndices.forEach(idx => {
            const guess = imposterGuesses[idx] || '(skipped)';
            const correct = guessResults[idx];
            const div = document.createElement('div');
            div.className = `guess-result ${correct ? 'correct' : 'wrong'}`;
            div.innerHTML = `${gameState.players[idx]}: "${guess}" ${correct ? '✅' : '❌'}`;
            elements.guessResultsSection.appendChild(div);
        });
    }

    // Points summary
    elements.pointsList.innerHTML = '';
    const avatars = getPlayerAvatars();
    gameState.players.forEach((name, idx) => {
        const entry = pointsMap[idx];
        const row = document.createElement('div');
        row.className = `points-row ${entry.points > 0 ? 'earned' : ''}`;
        const reasonText = entry.reasons.length > 0 ? entry.reasons.join(', ') : '—';
        row.innerHTML = `
            <span class="points-player">${avatars[idx % avatars.length]} ${name}</span>
            <span class="points-reason">${reasonText}</span>
            <span class="points-value ${entry.points > 0 ? 'positive' : ''}">+${entry.points}</span>
        `;
        elements.pointsList.appendChild(row);
    });

    // Build league selector checkboxes
    buildLeagueSelector(pointsMap, correctVote, imposterIndicesSet);
}

function showModalStep(step) {
    elements.modalStepVote.classList.add('hidden');
    elements.modalStepGuess.classList.add('hidden');
    elements.modalStepResults.classList.add('hidden');
    if (step === 'vote') elements.modalStepVote.classList.remove('hidden');
    if (step === 'guess') elements.modalStepGuess.classList.remove('hidden');
    if (step === 'results') elements.modalStepResults.classList.remove('hidden');
}

function closeModal() {
    elements.answerModal.classList.remove('active');
}

function newRound() {
    FX.play('tap');
    startLocalGame();
}

function restartGame() {
    stopTimerInterval();
    showScreen('players');
}

// Store current round data for save
let currentRoundPointsMap = null;
let currentRoundCorrectVote = false;
let currentRoundImposterSet = null;

async function buildLeagueSelector(pointsMap, correctVote, imposterSet) {
    currentRoundPointsMap = pointsMap;
    currentRoundCorrectVote = correctVote;
    currentRoundImposterSet = imposterSet;

    const leagues = await League.getJoinedLeagues();
    elements.leagueCheckboxList.innerHTML = '';

    if (leagues.length === 0) {
        elements.leagueSelectorHint.classList.remove('hidden');
        return;
    }

    elements.leagueSelectorHint.classList.add('hidden');

    leagues.forEach(async league => {
        const members = await League.getLeagueMembers(league.code);
        const gamePlayers = gameState.players.map(p => p.trim().toLowerCase());

        // Check if all league members are present in the current game
        const missingMembers = members.filter(m => !gamePlayers.includes(m.toLowerCase()));
        const allPresent = members.length === 0 || missingMembers.length === 0;

        const label = document.createElement('label');
        label.className = `league-checkbox-item ${!allPresent ? 'disabled' : ''}`;
        label.innerHTML = `
            <input type="checkbox" value="${league.code}" ${allPresent ? 'checked' : 'disabled'}>
            <span class="league-checkbox-name">🏆 ${league.name}</span>
            <span class="league-checkbox-code">${league.code}</span>
            ${!allPresent ? `<span class="league-missing">Missing: ${missingMembers.join(', ')}</span>` : ''}
        `;
        elements.leagueCheckboxList.appendChild(label);
    });
}

async function savePointsAndClose() {
    // Get checked leagues
    const checkboxes = elements.leagueCheckboxList.querySelectorAll('input[type=checkbox]:checked');
    const leagueCodes = Array.from(checkboxes).map(cb => cb.value);

    if (leagueCodes.length > 0 && currentRoundPointsMap) {
        // Save points to each selected league
        for (const code of leagueCodes) {
            for (let idx = 0; idx < gameState.players.length; idx++) {
                const entry = currentRoundPointsMap[idx];
                const name = gameState.players[idx];
                if (entry.points > 0) {
                    const isWin = currentRoundCorrectVote
                        ? !currentRoundImposterSet.has(idx)
                        : currentRoundImposterSet.has(idx);
                    await League.addPoints(code, name, entry.points, isWin);
                } else {
                    await League.recordGame(code, name);
                }
            }
        }
    }

    currentRoundPointsMap = null;
    closeModal();
}

// ===============================================
// LEAGUE SCREENS
// ===============================================
let currentLeagueCode = null;

async function showLeagueHub() {
    showScreen('league');
    await renderLeagueHub();
}

async function renderLeagueHub() {
    const leagues = await League.getJoinedLeagues();
    elements.leagueHubList.innerHTML = '';

    if (leagues.length === 0) {
        elements.leagueHubEmpty.classList.remove('hidden');
        return;
    }

    elements.leagueHubEmpty.classList.add('hidden');

    leagues.forEach(league => {
        const card = document.createElement('div');
        card.className = 'league-hub-card';
        card.innerHTML = `
            <div class="league-hub-card-info">
                <span class="league-hub-card-name">🏆 ${league.name}</span>
                <span class="league-hub-card-code">${league.code}</span>
            </div>
            <span class="league-hub-card-arrow">›</span>
        `;
        card.addEventListener('click', () => showLeagueDetail(league.code));
        elements.leagueHubList.appendChild(card);
    });
}

function showCreateLeagueForm() {
    elements.leagueJoinTitle.textContent = 'Create League';
    elements.leagueCreateForm.classList.remove('hidden');
    elements.leagueJoinForm.classList.add('hidden');
    elements.leagueFormError.classList.add('hidden');
    elements.leagueNameInput.value = '';
    showScreen('leagueJoin');
    setTimeout(() => elements.leagueNameInput.focus(), 200);
}

function showJoinLeagueForm() {
    elements.leagueJoinTitle.textContent = 'Join League';
    elements.leagueCreateForm.classList.add('hidden');
    elements.leagueJoinForm.classList.remove('hidden');
    elements.leagueFormError.classList.add('hidden');
    elements.leagueCodeInput.value = '';
    showScreen('leagueJoin');
    setTimeout(() => elements.leagueCodeInput.focus(), 200);
}

async function submitCreateLeague() {
    const name = elements.leagueNameInput.value.trim();
    if (!name) {
        showLeagueFormError('Please enter a league name.');
        return;
    }
    try {
        elements.leagueCreateSubmit.disabled = true;
        const code = await League.createLeague(name);
        elements.leagueCreateSubmit.disabled = false;
        showLeagueDetail(code);
    } catch (e) {
        elements.leagueCreateSubmit.disabled = false;
        showLeagueFormError(e.message);
    }
}

async function submitJoinLeague() {
    const code = elements.leagueCodeInput.value.trim().toUpperCase();
    if (!code || code.length < 4) {
        showLeagueFormError('Please enter a valid league code.');
        return;
    }
    try {
        elements.leagueJoinSubmit.disabled = true;
        await League.joinLeague(code);
        elements.leagueJoinSubmit.disabled = false;
        showLeagueDetail(code);
    } catch (e) {
        elements.leagueJoinSubmit.disabled = false;
        showLeagueFormError(e.message);
    }
}

function showLeagueFormError(msg) {
    elements.leagueFormError.textContent = msg;
    elements.leagueFormError.classList.remove('hidden');
}

async function showLeagueDetail(code) {
    currentLeagueCode = code;
    showScreen('leagueDetail');
    await renderLeagueDetail(code);
}

async function renderLeagueDetail(code) {
    const detail = await League.getLeagueDetail(code);
    if (!detail) {
        showScreen('league');
        return;
    }

    elements.leagueDetailName.textContent = `🏆 ${detail.name}`;
    elements.leagueDetailCode.textContent = detail.code;

    const table = elements.leagueDetailTable;
    const existingRows = table.querySelectorAll('.league-row');
    existingRows.forEach(r => r.remove());

    if (detail.standings.length === 0) {
        elements.leagueDetailEmpty.classList.remove('hidden');
        return;
    }

    elements.leagueDetailEmpty.classList.add('hidden');
    const medals = ['🥇', '🥈', '🥉'];

    detail.standings.forEach((player, index) => {
        const row = document.createElement('div');
        row.className = `league-row ${index < 3 ? 'top-' + (index + 1) : ''}`;
        const rank = index < 3 ? medals[index] : `${index + 1}`;
        const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

        row.innerHTML = `
            <span class="league-rank">${rank}</span>
            <span class="league-name">${player.name}</span>
            <span class="league-stat league-points">${player.points} pts</span>
            <span class="league-stat league-games">${player.gamesPlayed} games</span>
            <span class="league-stat league-winrate">${winRate}%</span>
        `;
        table.insertBefore(row, elements.leagueDetailEmpty);
    });
}

function copyLeagueCode() {
    const code = elements.leagueDetailCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
        elements.leagueCopyBtn.textContent = '✅';
        setTimeout(() => { elements.leagueCopyBtn.textContent = '📋'; }, 1500);
    }).catch(() => {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        elements.leagueCopyBtn.textContent = '✅';
        setTimeout(() => { elements.leagueCopyBtn.textContent = '📋'; }, 1500);
    });
}

let deleteLeaguePending = false;
let deleteLeagueTimer = null;

function leagueLeave() {
    if (!currentLeagueCode) return;
    League.leaveLeague(currentLeagueCode);
    showLeagueHub();
}

async function leagueDeleteConfirm() {
    if (!currentLeagueCode) return;

    if (deleteLeaguePending) {
        clearTimeout(deleteLeagueTimer);
        deleteLeaguePending = false;
        await League.deleteLeague(currentLeagueCode);
        elements.leagueDeleteBtn.textContent = 'Delete League';
        elements.leagueDeleteBtn.classList.remove('confirming');
        showLeagueHub();
    } else {
        deleteLeaguePending = true;
        elements.leagueDeleteBtn.textContent = '⚠️ Tap again to delete';
        elements.leagueDeleteBtn.classList.add('confirming');
        deleteLeagueTimer = setTimeout(() => {
            deleteLeaguePending = false;
            elements.leagueDeleteBtn.textContent = 'Delete League';
            elements.leagueDeleteBtn.classList.remove('confirming');
        }, 3000);
    }
}

// ===============================================
// MULTIPLAYER MODE - Room Management
// ===============================================
async function createRoom() {
    const name = elements.hostNameInput.value.trim();
    if (!name) {
        elements.hostNameInput.focus();
        return;
    }

    showLoading('Creating room...');

    try {
        const { roomCode, playerId } = await MP.createRoom(name, gameState.mpImposterCount);
        gameState.myPlayerId = playerId;
        elements.lobbyRoomCode.textContent = roomCode;

        // Subscribe to room updates
        MP.subscribeToRoom(handleRoomUpdate);
        MP.subscribeToChat(handleChatUpdate);

        hideLoading();
        showScreen('mpLobby');
    } catch (error) {
        hideLoading();
        alert('Failed to create room: ' + error.message);
    }
}

async function joinRoom() {
    const code = elements.roomCodeInput.value.trim();
    const name = elements.joinNameInput.value.trim();

    if (!code || code.length !== 6) {
        elements.joinError.textContent = 'Please enter a valid 6-character room code.';
        elements.joinError.classList.remove('hidden');
        return;
    }

    if (!name) {
        elements.joinError.textContent = 'Please enter your name.';
        elements.joinError.classList.remove('hidden');
        return;
    }

    elements.joinError.classList.add('hidden');
    showLoading('Joining room...');

    try {
        const { roomCode, playerId } = await MP.joinRoom(code, name);
        gameState.myPlayerId = playerId;
        elements.lobbyRoomCode.textContent = roomCode;

        // Subscribe to room updates
        MP.subscribeToRoom(handleRoomUpdate);
        MP.subscribeToChat(handleChatUpdate);

        hideLoading();
        showScreen('mpLobby');
    } catch (error) {
        hideLoading();
        elements.joinError.textContent = error.message;
        elements.joinError.classList.remove('hidden');
    }
}

// Leaving a room discards room/round state, so always confirm. The host
// closing the room ends it for everyone — warn accordingly.
function confirmLeaveRoom() {
    const status = gameState.roomData?.status;
    const midRound = status === 'playing' || status === 'voting';
    let msg;
    if (MP.isHost()) {
        msg = midRound
            ? 'Leave and close the room? The current round will end for everyone.'
            : 'Leave and close the room for everyone?';
    } else {
        msg = midRound
            ? 'Leave mid-round? You won\'t be able to rejoin until the next game.'
            : 'Leave the room?';
    }
    if (confirm(msg)) leaveRoom();
}

async function leaveRoom() {
    showLoading('Leaving room...');
    try {
        await leaveVoiceChat();
        await MP.leaveRoom();
    } catch (e) {
        console.error('Error leaving room:', e);
    }
    hideVoiceBar();
    hideLoading();
    gameState.roomData = null;
    gameState.myPlayerId = null;
    showScreen('welcome');
}

function copyRoomCode() {
    const code = elements.lobbyRoomCode.textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = elements.copyCodeBtn;
        const originalText = btn.querySelector('span').textContent;
        btn.querySelector('span').textContent = 'Copied!';
        setTimeout(() => {
            btn.querySelector('span').textContent = originalText;
        }, 2000);
    });
}

// ===============================================
// MULTIPLAYER MODE - Room Update Handler
// ===============================================
function handleRoomUpdate(data) {
    if (!data) {
        // Room was deleted
        leaveVoiceChat();
        hideVoiceBar();
        alert('The host has closed the room.');
        gameState.roomData = null;
        showScreen('welcome');
        return;
    }

    gameState.roomData = data;
    showVoiceBar();
    const isHost = MP.isHost();
    const players = data.players || {};
    const playerCount = Object.keys(players).length;

    // Update lobby UI
    updateLobbyUI(data, isHost, players, playerCount);

    // Handle status transitions
    switch (data.status) {
        case 'lobby':
            // Navigate to lobby if not already on lobby or category
            if (!screens.mpLobby.classList.contains('active') &&
                !screens.mpCategory.classList.contains('active')) {
                showScreen('mpLobby');
            }
            break;

        case 'playing':
            if (!screens.mpWord.classList.contains('active') &&
                !screens.mpDiscussion.classList.contains('active')) {
                updateWordScreen(data);
                showScreen('mpWord');
            }
            updateWordScreenStatus(data);
            checkAllReady(data);
            break;

        case 'voting':
            if (!screens.mpVoting.classList.contains('active')) {
                updateVotingScreen(data);
                showScreen('mpVoting');
            }
            updateVotingStatus(data);
            checkAllVoted(data);
            break;

        case 'results': {
            // Always re-render so ready states / settings stay live,
            // but only celebrate on the first transition to results.
            const firstShow = !screens.mpResults.classList.contains('active');
            updateResultsScreen(data, firstShow);
            if (firstShow) showScreen('mpResults');
            break;
        }
    }
}

function updateLobbyUI(data, isHost, players, playerCount) {
    // Update player count
    elements.lobbyPlayerCount.textContent = playerCount;

    // Calculate ready count
    const readyCount = Object.values(players).filter(p => p.isReady).length;
    // RTDB drops null keys, so a fresh room has lastCategory === undefined;
    // use a loose check or new rooms would wrongly show the post-game controls
    const hasPlayedBefore = data.lastCategory != null;

    // Update players list
    elements.lobbyPlayersList.innerHTML = '';
    const avatars = getPlayerAvatars();
    let index = 0;

    Object.entries(players).forEach(([pid, player]) => {
        const isYou = pid === gameState.myPlayerId;
        const div = document.createElement('div');
        div.className = `lobby-player ${isYou ? 'is-you' : ''} ${player.isReady ? 'ready' : ''}`;
        div.innerHTML = `
            <div class="lobby-player-avatar">${avatars[index % avatars.length]}</div>
            <div class="lobby-player-name">${player.name}${isYou ? ' (You)' : ''}</div>
            ${player.isHost ? '<span class="lobby-player-badge">Host</span>' : ''}
            ${!player.isHost && player.isReady ? '<span class="lobby-player-badge ready-badge">Ready ✓</span>' : ''}
            <div class="lobby-player-status ${player.isConnected ? '' : 'disconnected'}"></div>
        `;
        elements.lobbyPlayersList.appendChild(div);
        index++;
    });

    // Update imposter count display
    elements.mpImposterCount.textContent = data.imposterCount || 1;
    gameState.mpImposterCount = data.imposterCount || 1;

    // Update imposter limits based on player count
    updateMPImposterLimits(playerCount);

    // Store room data for play again
    gameState.roomData = data;

    // Show/hide controls based on host status and game state
    // Update category display
    const categoryKey = data.category || 'countries';
    const gameType = data.gameType || 'word';
    let categoryName = 'Countries';
    if (gameType === 'question' && categoryKey.startsWith('q:')) {
        const qKey = categoryKey.slice(2);
        categoryName = QUESTION_CATEGORIES?.[qKey]?.name || qKey;
    } else {
        categoryName = CATEGORIES[categoryKey]?.name || 'Countries';
    }
    elements.lobbyCategoryValue.textContent = categoryName;

    // Update game type buttons (host can change, others see current)
    const lobbyGameTypeWord = document.getElementById('lobby-game-type-word');
    const lobbyGameTypeQuestion = document.getElementById('lobby-game-type-question');
    if (lobbyGameTypeWord) {
        lobbyGameTypeWord.classList.toggle('active', gameType === 'word');
        lobbyGameTypeWord.onclick = () => isHost && MP.setGameType('word');
        lobbyGameTypeWord.disabled = !isHost;
    }
    if (lobbyGameTypeQuestion) {
        lobbyGameTypeQuestion.classList.toggle('active', gameType === 'question');
        lobbyGameTypeQuestion.onclick = () => isHost && MP.setGameType('question');
        lobbyGameTypeQuestion.disabled = !isHost;
    }

    if (isHost) {
        elements.lobbyChangeCategoryBtn.classList.remove('hidden');
        elements.mpImposterSettings.classList.remove('hidden');

        // Host is always ready. Check if others are ready.
        const allReady = Object.values(players).every(p => p.isReady);
        elements.mpStartGameBtn.disabled = playerCount < 3 || !allReady;

        if (playerCount < 3) {
            elements.mpHostHint.textContent = 'Need at least 3 players to start';
        } else if (!allReady) {
            elements.mpHostHint.textContent = 'Waiting for players to be ready...';
        } else {
            elements.mpHostHint.textContent = 'All ready! You can start.';
        }

        elements.waitingMessage.classList.add('hidden');
        elements.playerReadyControls.classList.add('hidden'); // Host doesn't toggle ready

        if (hasPlayedBefore) {
            elements.hostControls.classList.add('hidden');
            elements.hostPostgameControls.classList.remove('hidden');
        } else {
            elements.hostControls.classList.remove('hidden');
            elements.hostPostgameControls.classList.add('hidden');
        }
    } else {
        elements.lobbyChangeCategoryBtn.classList.add('hidden');
        elements.mpImposterSettings.classList.add('hidden');
        elements.hostControls.classList.add('hidden');
        elements.hostPostgameControls.classList.add('hidden');

        // Non-host: Show Ready Controls
        elements.waitingMessage.classList.add('hidden');
        elements.playerReadyControls.classList.remove('hidden');

        const myPlayer = players[gameState.myPlayerId];
        if (myPlayer?.isReady) {
            elements.mpLobbyReadyBtn.classList.add('btn-ready-confirmed');
            elements.mpLobbyReadyText.textContent = "You're ready ✓";
            elements.mpLobbyReadyBtn.title = 'Tap to undo';
        } else {
            elements.mpLobbyReadyBtn.classList.remove('btn-ready-confirmed');
            elements.mpLobbyReadyText.textContent = "I'm ready";
            elements.mpLobbyReadyBtn.title = '';
        }
    }
}

// ===============================================
// MULTIPLAYER MODE - Category Selection
// ===============================================
// Always resolve to a category that's valid for the game type. A stale
// mismatch (e.g. a leftover 'q:' category in word mode) used to make the
// UI show "Countries" while the real category was unusable, crashing the
// word picker at game start.
function resolveMPCategory(gameType, category) {
    if (gameType === 'question') {
        return category && category.startsWith('q:') ? category : 'q:twistAndTurn';
    }
    return category && !category.startsWith('q:') ? category : 'countries';
}

function selectMPCategory(categoryKey) {
    showLoading('Updating category...');
    MP.setCategory(categoryKey)
        .then(() => {
            hideLoading();
            showScreen('mpLobby');
        })
        .catch(err => {
            hideLoading();
            alert('Failed to update category: ' + err.message);
        });
}

// ===============================================
// MULTIPLAYER MODE - Word Screen
// ===============================================
function updateWordScreen(data) {
    const myPlayer = data.players[gameState.myPlayerId];
    const avatars = getPlayerAvatars();
    const playerIds = Object.keys(data.players);
    const myIndex = playerIds.indexOf(gameState.myPlayerId);
    const gameType = data.gameType || 'word';

    elements.mpPlayerAvatar.textContent = avatars[myIndex % avatars.length];
    elements.mpRevealPlayerName.textContent = myPlayer.name;

    elements.mpRevealCard.classList.remove('revealed');
    gameState.mpRevealed = false;

    const mpWordContainer = document.getElementById('mp-word-container');
    const mpQuestionContainer = document.getElementById('mp-question-container');
    const mpReadyBtn = document.getElementById('mp-ready-btn');
    const mpWordStatus = document.getElementById('mp-word-status');

    if (gameType === 'question' && data.secretQuestion) {
        mpWordContainer?.classList.add('hidden');
        mpQuestionContainer?.classList.remove('hidden');
        document.getElementById('mp-reveal-front-instruction').textContent = 'Tap to see your question';
        document.getElementById('mp-reveal-instruction')?.classList.add('hidden');
        const q = myPlayer.isImposter ? data.secretQuestion.imposter : data.secretQuestion.real;
        document.getElementById('mp-question-text').textContent = q;
        elements.mpAnswerInput.value = myPlayer.answer || '';
        renderMPAnswerState(!!myPlayer.answer);
        mpReadyBtn?.classList.add('hidden');
        mpWordStatus?.classList.remove('hidden'); // shows "x of y have answered"
    } else {
        mpWordContainer?.classList.remove('hidden');
        mpQuestionContainer?.classList.add('hidden');
        const frontInst = document.getElementById('mp-reveal-front-instruction');
        if (frontInst) frontInst.textContent = 'Tap to reveal your word';
        document.getElementById('mp-reveal-instruction')?.classList.remove('hidden');
        elements.mpReadyBtn.classList.remove('btn-ready-confirmed');
        elements.mpReadyBtnText.textContent = 'Ready for Discussion';
        elements.mpReadyBtn.disabled = true;
        mpReadyBtn?.classList.remove('hidden');
        mpWordStatus?.classList.remove('hidden');

        const mpImposterHint = document.getElementById('mp-imposter-hint');
        if (myPlayer.isImposter) {
            elements.mpWordLabel.textContent = "You are the:";
            elements.mpSecretWord.textContent = "IMPOSTER! 🕵️";
            elements.mpSecretWord.classList.add('imposter');
            if (mpImposterHint) {
                const catName = CATEGORIES[data.category]?.name || data.category || '';
                mpImposterHint.textContent = catName ? `Category: ${catName} — blend in!` : 'Blend in!';
                mpImposterHint.classList.remove('hidden');
            }
        } else {
            elements.mpWordLabel.textContent = "Your word is:";
            elements.mpSecretWord.textContent = data.secretWord;
            elements.mpSecretWord.classList.remove('imposter');
            mpImposterHint?.classList.add('hidden');
        }
    }
}

// ---- Question-mode answer submission (Twist & Turn) ----
let mpAnswerSubmitting = false;

// Renders the persistent submission state (idle vs submitted). The transient
// "Submitting…" state is handled inside submitMPAnswer itself.
function renderMPAnswerState(submitted) {
    if (!elements.mpSubmitAnswerBtn) return;
    if (submitted) {
        elements.mpSubmitAnswerBtn.disabled = true;
        elements.mpSubmitAnswerBtn.classList.add('btn-ready-confirmed');
        elements.mpSubmitAnswerText.textContent = 'Submitted ✓';
        elements.mpAnswerInput.disabled = true;
        elements.mpAnswerStatus.textContent = 'Your answer is locked in — waiting for the others.';
        elements.mpAnswerStatus.className = 'mp-answer-status success';
    } else {
        elements.mpSubmitAnswerBtn.classList.remove('btn-ready-confirmed');
        elements.mpSubmitAnswerText.textContent = 'Submit Answer';
        elements.mpAnswerInput.disabled = false;
        elements.mpSubmitAnswerBtn.disabled = !elements.mpAnswerInput.value.trim();
        elements.mpAnswerStatus.className = 'mp-answer-status hidden';
    }
}

async function submitMPAnswer() {
    const ans = elements.mpAnswerInput?.value?.trim();
    const me = gameState.roomData?.players?.[gameState.myPlayerId];
    if (!ans || mpAnswerSubmitting || me?.answer) return; // no blank/duplicate submissions

    mpAnswerSubmitting = true;
    elements.mpSubmitAnswerBtn.disabled = true;
    elements.mpAnswerInput.disabled = true;
    elements.mpSubmitAnswerText.textContent = 'Submitting…';
    elements.mpAnswerStatus.className = 'mp-answer-status hidden';

    try {
        await MP.submitAnswer(ans);
        FX.play('chime');
        FX.vibrate(20);
        renderMPAnswerState(true);
    } catch (e) {
        console.error('Submit answer failed', e);
        renderMPAnswerState(false);
        elements.mpAnswerStatus.textContent = "Couldn't submit — check your connection and try again.";
        elements.mpAnswerStatus.className = 'mp-answer-status error';
    } finally {
        mpAnswerSubmitting = false;
    }
}

function updateWordScreenStatus(data) {
    const gameType = data.gameType || 'word';
    const players = data.players || {};
    const total = Object.keys(players).length;
    const myPlayer = players[gameState.myPlayerId];

    if (gameType === 'question') {
        const answered = Object.values(players).filter(p => p.answer).length;
        elements.mpPlayersSeen.textContent = `${answered} of ${total} have answered.`;
        // Server state is the source of truth (covers refresh/reconnect)
        if (myPlayer?.answer && !mpAnswerSubmitting) renderMPAnswerState(true);
        return;
    }

    const seen = Object.values(players).filter(p => p.hasSeenWord).length;
    const ready = Object.values(players).filter(p => p.isReady).length;

    elements.mpPlayersSeen.textContent = `${seen} of ${total} have seen their word. ${ready} ready.`;
    elements.mpReadyBtn.disabled = !myPlayer?.hasSeenWord;
}

function toggleMPReveal() {
    const gameType = gameState.roomData?.gameType || 'word';
    if (gameType === 'question') {
        gameState.mpRevealed = true;
        elements.mpRevealCard.classList.add('revealed');
        document.getElementById('mp-answer-input')?.focus();
        return;
    }
    gameState.mpRevealed = !gameState.mpRevealed;
    FX.play('flip');
    FX.vibrate(15);
    elements.mpRevealCard.classList.toggle('revealed', gameState.mpRevealed);
    if (gameState.mpRevealed) MP.markWordSeen();
}

async function markReady() {
    await MP.markReady();
    // Update button to show ready state
    elements.mpReadyBtn.classList.add('btn-ready-confirmed');
    elements.mpReadyBtnText.textContent = "You're ready ✓ — waiting for others";
    elements.mpReadyBtn.disabled = true;
}

function checkAllReady(data) {
    const gameType = data.gameType || 'word';
    const players = Object.values(data.players);

    const allReady = gameType === 'question'
        ? players.every(p => p.hasSeenWord && p.answer) // All submitted answers
        : players.every(p => p.isReady);

    if (allReady && players.length >= 3) {
        updateDiscussionScreen(data);
        showScreen('mpDiscussion');
    }
}

// ===============================================
// MULTIPLAYER MODE - Discussion Screen
// ===============================================
function updateDiscussionScreen(data) {
    const gameType = data.gameType || 'word';
    const categoryKey = data.category || 'countries';

    let categoryName = 'Countries';
    if (gameType === 'question' && categoryKey.startsWith('q:')) {
        const qKey = categoryKey.slice(2);
        categoryName = QUESTION_CATEGORIES?.[qKey]?.name || qKey;
    } else {
        categoryName = CATEGORIES[categoryKey]?.name || 'Countries';
    }
    elements.mpCategoryDisplay.textContent = `Category: ${categoryName}`;

    // Question mode: show real question + all answers
    const mpQuestionAnswers = document.getElementById('mp-question-answers');
    const mpRealQuestion = document.getElementById('mp-real-question');
    const mpAnswersList = document.getElementById('mp-answers-list');
    const mpSpeakingOrder = document.getElementById('mp-speaking-order');

    if (gameType === 'question' && data.secretQuestion) {
        mpQuestionAnswers?.classList.remove('hidden');
        mpRealQuestion.textContent = data.secretQuestion.real;
        mpAnswersList.innerHTML = '';
        const avatars = getPlayerAvatars();
        let idx = 0;
        Object.entries(data.players).forEach(([pid, player]) => {
            const item = document.createElement('div');
            item.className = 'modal-answer-item';
            const ans = player.answer || '(no answer)';
            const playerSpan = document.createElement('span');
            playerSpan.className = 'answer-player';
            playerSpan.textContent = `${avatars[idx % avatars.length]} ${player.name}`;
            const ansSpan = document.createElement('span');
            ansSpan.className = 'answer-text';
            ansSpan.textContent = `"${ans}"`;
            item.appendChild(playerSpan);
            item.appendChild(ansSpan);
            mpAnswersList.appendChild(item);
            idx++;
        });
        mpSpeakingOrder?.classList.add('hidden');
    } else {
        mpQuestionAnswers?.classList.add('hidden');
        mpSpeakingOrder?.classList.remove('hidden');
    }

    // Render players
    elements.mpDiscussionPlayers.innerHTML = '';
    const avatars = getPlayerAvatars();
    let index = 0;

    Object.entries(data.players).forEach(([pid, player]) => {
        const isYou = pid === gameState.myPlayerId;
        const card = document.createElement('div');
        card.className = `mp-player-card ${isYou ? 'is-you' : ''}`;
        card.innerHTML = `
            <div class="mp-player-avatar">${avatars[index % avatars.length]}</div>
            <div class="mp-player-name">${player.name}</div>
        `;
        elements.mpDiscussionPlayers.appendChild(card);
        index++;
    });

    // Generate and render speaking order
    // Use a deterministic shuffle so everyone sees the same order
    // Seed using room creation time + secret word (or category if word is null)
    // Seed using room creation time + secret word + room code + round specific data
    // Sort players by ID to ensure consistent shuffling base
    const playersList = Object.entries(data.players)
        .sort(([pidA], [pidB]) => pidA.localeCompare(pidB))
        .map(([pid, p]) => ({ pid, name: p.name }));

    const seedString = data.roomCode + (data.secretWord || '') + (data.createdAt || '') + (data.imposterCount || 1);

    // Deterministic shuffle
    const shuffledPlayers = seededShuffle(playersList, seedString);

    elements.mpSpeakingList.innerHTML = '';
    shuffledPlayers.forEach(player => {
        const isYou = player.pid === gameState.myPlayerId;
        const li = document.createElement('li');
        li.textContent = player.name;
        if (isYou) li.className = 'is-you';
        elements.mpSpeakingList.appendChild(li);
    });

    // Show/hide host controls
    if (MP.isHost()) {
        elements.mpHostVotingControls.classList.remove('hidden');
        elements.mpWaitingVoting.classList.add('hidden');
    } else {
        elements.mpHostVotingControls.classList.add('hidden');
        elements.mpWaitingVoting.classList.remove('hidden');
    }
}

// Helper: Seeded Shuffle
function seededShuffle(array, seed) {
    // Simple hash function for seed
    let h = 0xdeadbeef;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
    }
    const nextRandom = () => {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return (h >>> 0) / 4294967296;
    };

    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(nextRandom() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function startVoting() {
    showLoading('Starting voting...');
    try {
        await MP.startVoting();
        hideLoading();
    } catch (err) {
        hideLoading();
        alert('Failed to start voting: ' + err.message);
    }
}

// ===============================================
// MULTIPLAYER MODE - Voting Screen
// ===============================================
function updateVotingScreen(data) {
    gameState.selectedVote = null;
    elements.votingGrid.innerHTML = '';
    const avatars = getPlayerAvatars();
    let index = 0;

    Object.entries(data.players).forEach(([pid, player]) => {
        const isYou = pid === gameState.myPlayerId;
        const card = document.createElement('div');
        card.className = `voting-card ${isYou ? 'is-you' : ''}`;
        card.dataset.playerId = pid;
        card.innerHTML = `
            <div class="voting-avatar">${avatars[index % avatars.length]}</div>
            <div class="voting-name">${player.name}</div>
            <div class="voting-vote-count"></div>
        `;

        if (!isYou) {
            card.addEventListener('click', () => selectVote(pid));
        }

        elements.votingGrid.appendChild(card);
        index++;
    });
}

function updateVotingStatus(data) {
    const players = data.players;
    const total = Object.keys(players).length;
    const voted = Object.values(players).filter(p => p.vote).length;

    elements.votesCast.textContent = voted;
    elements.votesTotal.textContent = total;

    // Update voting cards to show who has voted
    const cards = elements.votingGrid.querySelectorAll('.voting-card');
    cards.forEach(card => {
        const pid = card.dataset.playerId;
        const player = players[pid];
        if (player.vote) {
            card.classList.add('has-voted');
        } else {
            card.classList.remove('has-voted');
        }
    });

    // Show waiting message if you've voted
    const myPlayer = players[gameState.myPlayerId];
    if (myPlayer.vote) {
        elements.voteWaiting.classList.remove('hidden');
        elements.submitVoteBtn.disabled = true;
        elements.skipVoteBtn.disabled = true;
    } else {
        elements.voteWaiting.classList.add('hidden');
        elements.submitVoteBtn.disabled = gameState.selectedVote === null;
        elements.skipVoteBtn.disabled = false;
    }

    // Show live votes if not anonymous
    const isAnonymous = gameState.roomData?.anonymousVoting;
    elements.liveVotes.innerHTML = '';

    if (!isAnonymous) {
        Object.entries(players).forEach(([pid, player]) => {
            if (player.vote && player.vote !== 'skip') {
                const votedFor = players[player.vote];
                if (votedFor) {
                    const div = document.createElement('div');
                    div.className = 'live-vote-item';
                    div.innerHTML = `
                        <span class="voter">${player.name}</span>
                        <span>voted for</span>
                        <span class="voted-for">${votedFor.name}</span>
                    `;
                    elements.liveVotes.appendChild(div);
                }
            } else if (player.vote === 'skip') {
                const div = document.createElement('div');
                div.className = 'live-vote-item';
                div.innerHTML = `
                    <span class="voter">${player.name}</span>
                    <span>skipped</span>
                `;
                elements.liveVotes.appendChild(div);
            }
        });
    }
}

function selectVote(targetId) {
    const myPlayer = gameState.roomData.players[gameState.myPlayerId];
    if (myPlayer.vote) return; // Already voted

    // Update UI
    const cards = elements.votingGrid.querySelectorAll('.voting-card');
    cards.forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.playerId === targetId) {
            card.classList.add('selected');
        }
    });

    gameState.selectedVote = targetId;
    elements.submitVoteBtn.disabled = false;
}

async function submitVote() {
    if (!gameState.selectedVote) return;

    const myPlayer = gameState.roomData.players[gameState.myPlayerId];
    if (myPlayer.vote) return;

    elements.submitVoteBtn.disabled = true;
    await MP.castVote(gameState.selectedVote);
}

async function skipVote() {
    const myPlayer = gameState.roomData.players[gameState.myPlayerId];
    if (myPlayer.vote) return;

    elements.skipVoteBtn.disabled = true;
    await MP.castVote('skip');
}

function checkAllVoted(data) {
    const players = Object.values(data.players);
    const allVoted = players.every(p => p.vote);

    if (allVoted && MP.isHost()) {
        // Auto-show results
        MP.showResults();
    }
}

// ===============================================
// MULTIPLAYER MODE - Results Screen
// ===============================================
function updateResultsScreen(data, celebrate = false) {
    const results = MP.calculateVoteResults(data.players);
    const avatars = getPlayerAvatars();

    // Update header
    if (results.imposterWins) {
        elements.resultsHeader.className = 'results-header imposter-wins';
        elements.resultsTitle.textContent = '🕵️ Imposter Wins!';
        elements.resultsSubtitle.textContent = results.tie ? 'The vote was tied!' : 'Wrong person was voted out!';
    } else {
        elements.resultsHeader.className = 'results-header crew-wins';
        elements.resultsTitle.textContent = '🎉 Crew Wins!';
        elements.resultsSubtitle.textContent = 'The imposter was caught!';
    }

    if (celebrate) {
        const me = data.players[gameState.myPlayerId];
        const iWon = results.imposterWins ? !!me?.isImposter : !me?.isImposter;
        if (iWon) {
            FX.play('fanfare');
            FX.vibrate([30, 30, 30, 30, 80]);
            FX.confetti();
        } else {
            FX.play('lose');
            FX.vibrate(120);
        }
    }

    // Show secret word or question
    const gameType = data.gameType || 'word';
    const resultsWordLabel = document.getElementById('results-word-label');
    if (gameType === 'question' && data.secretQuestion) {
        elements.resultsWord.textContent = data.secretQuestion.real;
        if (resultsWordLabel) resultsWordLabel.textContent = 'The question was:';
    } else {
        elements.resultsWord.textContent = data.secretWord;
        if (resultsWordLabel) resultsWordLabel.textContent = 'The Secret Word was:';
    }

    // Show imposters
    elements.resultsImposters.innerHTML = '';
    const playerIds = Object.keys(data.players);

    results.imposterIds.forEach(pid => {
        const player = data.players[pid];
        const tag = document.createElement('span');
        tag.className = 'imposter-tag';
        tag.innerHTML = `🕵️ ${player.name}`;
        elements.resultsImposters.appendChild(tag);
    });

    // Show vote distribution
    elements.voteResults.innerHTML = '';
    let index = 0;
    Object.entries(data.players).forEach(([pid, player]) => {
        const votesReceived = results.votes[pid] || 0;
        if (votesReceived > 0 || pid === results.eliminated) {
            const item = document.createElement('div');
            item.className = `vote-result-item ${pid === results.eliminated ? 'eliminated' : ''}`;
            item.innerHTML = `${avatars[index % avatars.length]} ${player.name}: ${votesReceived} vote${votesReceived !== 1 ? 's' : ''}`;
            elements.voteResults.appendChild(item);
        }
        index++;
    });

    if (results.skippedVotes > 0) {
        const skipItem = document.createElement('div');
        skipItem.className = 'vote-result-item';
        skipItem.innerHTML = `⏭️ Skipped: ${results.skippedVotes}`;
        elements.voteResults.appendChild(skipItem);
    }

    // === POST-GAME LOBBY AREA ===

    // Category
    const categoryKey = data.category || 'countries';
    const gameTypeRes = data.gameType || 'word';
    let categoryName = 'Countries';
    if (gameTypeRes === 'question' && categoryKey.startsWith('q:')) {
        categoryName = QUESTION_CATEGORIES?.[categoryKey.slice(2)]?.name || categoryKey;
    } else {
        categoryName = CATEGORIES[categoryKey]?.name || 'Countries';
    }
    elements.resultsCategoryValue.textContent =
        `${gameTypeRes === 'question' ? '❓ Question Imposter' : '📝 Secret Word'} · ${categoryName}`;

    // Players List (Similar to Lobby) — hosts count as ready implicitly
    elements.resultsPlayersList.innerHTML = '';
    let rIndex = 0;
    Object.entries(data.players).forEach(([pid, player]) => {
        const isYou = pid === gameState.myPlayerId;
        const statusBadge = player.isHost
            ? '<span class="lobby-player-badge">Host</span>'
            : (player.isReady
                ? '<span class="lobby-player-badge ready-badge">Ready ✓</span>'
                : '<span class="lobby-player-badge waiting-badge">Not ready</span>');
        const div = document.createElement('div');
        div.className = 'lobby-player-item';
        div.innerHTML = `
            <div class="lobby-player-avatar">${avatars[rIndex % avatars.length]}</div>
            <div class="lobby-player-info">
                <span class="lobby-player-name">${player.name}${isYou ? ' (You)' : ''}</span>
            </div>
            ${statusBadge}
         `;
        elements.resultsPlayersList.appendChild(div);
        rIndex++;
    });

    // === Ready strip (top) + host settings panel ===
    const playerEntries = Object.entries(data.players);
    const totalPlayers = playerEntries.length;
    // The host has no ready button, so they count as ready implicitly
    const othersNotReady = playerEntries.filter(([, p]) => !p.isHost && !p.isReady).length;
    const readyCount = totalPlayers - othersNotReady;
    const allOthersReady = othersNotReady === 0;

    if (elements.resultsReadyStatus) {
        if (totalPlayers < 3) {
            elements.resultsReadyStatus.textContent = 'Need at least 3 players';
        } else if (allOthersReady) {
            elements.resultsReadyStatus.textContent = "Everyone's ready!";
        } else {
            elements.resultsReadyStatus.textContent = `${readyCount}/${totalPlayers} players ready`;
        }
    }

    if (MP.isHost()) {
        elements.mpResultsReadyBtn?.classList.add('hidden');
        elements.mpNewRoundBtn?.classList.remove('hidden');

        const canStart = totalPlayers >= 3 && allOthersReady;
        elements.mpNewRoundBtn.disabled = !canStart;
        if (elements.mpNewRoundText) {
            elements.mpNewRoundText.textContent = canStart
                ? '▶ Start New Round'
                : `Start New Round (${readyCount}/${totalPlayers} ready)`;
        }

        // Host settings for the next round
        elements.resultsHostControls.classList.remove('hidden');
        elements.resultsChangeCategoryBtn.classList.remove('hidden');
        if (elements.mpResultsAnonymousVoting) {
            elements.mpResultsAnonymousVoting.checked = data.anonymousVoting || false;
        }
        elements.resultsGameTypeWord?.classList.toggle('active', gameTypeRes !== 'question');
        elements.resultsGameTypeQuestion?.classList.toggle('active', gameTypeRes === 'question');

        const imposterCount = data.imposterCount || 1;
        const maxImposters = Math.max(1, Math.floor((totalPlayers - 1) / 2));
        if (elements.resultsImposterCount) elements.resultsImposterCount.textContent = imposterCount;
        if (elements.resultsImposterMinus) elements.resultsImposterMinus.disabled = imposterCount <= 1;
        if (elements.resultsImposterPlus) elements.resultsImposterPlus.disabled = imposterCount >= maxImposters;
    } else {
        elements.mpNewRoundBtn?.classList.add('hidden');
        elements.resultsHostControls.classList.add('hidden');
        elements.resultsChangeCategoryBtn.classList.add('hidden');

        // Ready toggle for non-host players
        elements.mpResultsReadyBtn?.classList.remove('hidden');
        const myPlayer = data.players[gameState.myPlayerId];
        if (myPlayer?.isReady) {
            elements.mpResultsReadyBtn.classList.add('btn-ready-confirmed');
            elements.mpResultsReadyText.textContent = "You're ready ✓";
            elements.mpResultsReadyBtn.title = 'Tap to undo';
        } else {
            elements.mpResultsReadyBtn.classList.remove('btn-ready-confirmed');
            elements.mpResultsReadyText.textContent = "I'm ready";
            elements.mpResultsReadyBtn.title = '';
        }
    }
}

async function mpNewRound() {
    const gameType = gameState.roomData?.gameType || 'word';
    const category = resolveMPCategory(gameType, gameState.roomData?.category);
    const imposterCount = gameState.roomData?.imposterCount || 1;

    showLoading('Starting new round...');
    try {
        if (gameType === 'question') {
            const qKey = category.startsWith('q:') ? category.slice(2) : 'twistAndTurn';
            const secretQuestion = getRandomQuestion(qKey);
            await MP.startGame(category, null, imposterCount, 'question', secretQuestion);
        } else {
            await MP.startGame(category, getRandomWord(category), imposterCount);
        }
        hideLoading();
    } catch (err) {
        hideLoading();
        alert('Failed to start new round: ' + err.message);
    }
}

async function mpReturnToLobby() {
    showLoading('Returning to lobby...');
    try {
        await MP.returnToLobby();
        hideLoading();
    } catch (err) {
        hideLoading();
        alert('Failed to return to lobby: ' + err.message);
    }
}

// ===============================================
// MULTIPLAYER MODE - Chat
// ===============================================
function handleChatUpdate(messages) {
    gameState.chatMessages = messages;

    // Render messages
    elements.chatMessages.innerHTML = '';
    messages.forEach(msg => {
        const isOwn = msg.playerId === gameState.myPlayerId;
        const div = document.createElement('div');
        div.className = `chat-message ${isOwn ? 'own' : ''}`;
        div.innerHTML = `
            <div class="chat-message-sender">${msg.playerName}</div>
            <div class="chat-message-text">${msg.text}</div>
        `;
        elements.chatMessages.appendChild(div);
    });

    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;

    // Update unread badge if chat is closed
    if (!elements.chatSidebar.classList.contains('active')) {
        gameState.unreadMessages++;
        elements.chatBadge.textContent = gameState.unreadMessages;
        elements.chatBadge.classList.remove('hidden');
    }
}

function toggleChat() {
    const isActive = elements.chatSidebar.classList.toggle('active');
    elements.chatOverlay.classList.toggle('active', isActive);

    if (isActive) {
        gameState.unreadMessages = 0;
        elements.chatBadge.classList.add('hidden');
        elements.chatInput.focus();
    }
}

function closeChat() {
    elements.chatSidebar.classList.remove('active');
    elements.chatOverlay.classList.remove('active');
}

async function sendChatMessage() {
    const text = elements.chatInput.value.trim();
    if (!text) return;

    elements.chatInput.value = '';
    await MP.sendChatMessage(text);
}

// ===============================================
// MULTIPLAYER MODE - Voice Chat
// ===============================================
function showVoiceBar() {
    elements.voiceBar?.classList.remove('hidden');
    document.body.classList.add('voice-bar-visible');
}

function hideVoiceBar() {
    elements.voiceBar?.classList.add('hidden');
    document.body.classList.remove('voice-bar-visible');
}

async function joinVoiceChat() {
    const roomCode = MP.getRoomCode();
    const myId = gameState.myPlayerId;
    if (!roomCode || !myId || Voice.isInVoice()) return;

    elements.voiceJoinBtn.disabled = true;
    elements.voiceJoinText.textContent = 'Connecting…';

    try {
        await Voice.joinVoice(roomCode, myId, {
            onRoster: renderVoiceRoster,
            onSpeaking: setVoiceSpeaking
        });
        FX.play('chime');
        FX.vibrate(20);
        elements.voiceJoinBtn.classList.add('hidden');
        elements.voiceControls.classList.remove('hidden');
        elements.voiceMicBtn.textContent = '🎤';
        elements.voiceMicBtn.classList.remove('muted');
    } catch (err) {
        console.warn('Voice join failed:', err);
        elements.voiceJoinText.textContent =
            err?.name === 'NotAllowedError' ? 'Mic blocked 🚫' : 'Couldn’t connect';
        setTimeout(() => { elements.voiceJoinText.textContent = 'Join Voice'; }, 2500);
    } finally {
        elements.voiceJoinBtn.disabled = false;
    }
}

async function leaveVoiceChat() {
    if (!Voice.isInVoice()) return;
    await Voice.leaveVoice();
    elements.voiceControls?.classList.add('hidden');
    elements.voiceJoinBtn?.classList.remove('hidden');
    if (elements.voiceJoinText) elements.voiceJoinText.textContent = 'Join Voice';
    if (elements.voiceParticipants) elements.voiceParticipants.innerHTML = '';
}

function renderVoiceRoster(users) {
    if (!elements.voiceParticipants) return;
    const players = gameState.roomData?.players || {};
    const playerIds = Object.keys(players);
    const avatars = getPlayerAvatars();

    elements.voiceParticipants.innerHTML = '';
    Object.entries(users).forEach(([pid, info]) => {
        const idx = playerIds.indexOf(pid);
        const chip = document.createElement('div');
        chip.className = `voice-chip ${info.muted ? 'muted' : ''}`;
        chip.dataset.pid = pid;
        chip.title = players[pid]?.name || 'Player';
        chip.textContent = idx >= 0 ? avatars[idx % avatars.length] : '🎧';
        if (info.muted) {
            const badge = document.createElement('span');
            badge.className = 'voice-chip-muted';
            badge.textContent = '🔇';
            chip.appendChild(badge);
        }
        elements.voiceParticipants.appendChild(chip);
    });
}

function setVoiceSpeaking(pid, speaking) {
    const chip = elements.voiceParticipants?.querySelector(`[data-pid="${pid}"]`);
    chip?.classList.toggle('speaking', speaking);
}

function toggleVoiceMic() {
    const muted = Voice.toggleMute();
    elements.voiceMicBtn.textContent = muted ? '🔇' : '🎤';
    elements.voiceMicBtn.classList.toggle('muted', muted);
    FX.play('tap');
}

// ===============================================
// Event Listeners
// ===============================================
function initEventListeners() {
    // Mode Selection
    elements.localModeBtn?.addEventListener('click', () => {
        gameState.mode = 'local';
        showScreen('gameType');
    });

    elements.multiplayerModeBtn?.addEventListener('click', () => {
        gameState.mode = 'multiplayer';
        showScreen('mpChoice');
    });

    // Game Type Selection
    document.getElementById('back-from-game-type')?.addEventListener('click', () => showScreen('welcome'));
    document.getElementById('game-type-word-btn')?.addEventListener('click', () => {
        gameState.gameType = 'word';
        if (gameState.players.length === 0) {
            for (let i = 0; i < 4; i++) addPlayer();
        }
        showScreen('players');
    });
    document.getElementById('game-type-question-btn')?.addEventListener('click', () => {
        gameState.gameType = 'question';
        if (gameState.players.length === 0) {
            for (let i = 0; i < 4; i++) addPlayer();
        }
        showScreen('players');
    });

    // Local Mode - Player screen
    elements.backToWelcome?.addEventListener('click', () => showScreen('gameType'));
    elements.addPlayerBtn?.addEventListener('click', () => addPlayer());

    elements.imposterMinus?.addEventListener('click', () => {
        if (gameState.imposterCount > 1) {
            gameState.imposterCount--;
            elements.imposterCount.textContent = gameState.imposterCount;
            updateImposterLimits();
        }
    });

    elements.imposterPlus?.addEventListener('click', () => {
        const maxImposters = Math.max(1, Math.floor((gameState.players.length - 1) / 2));
        if (gameState.imposterCount < maxImposters) {
            gameState.imposterCount++;
            elements.imposterCount.textContent = gameState.imposterCount;
            updateImposterLimits();
        }
    });

    elements.imposterRandomize?.addEventListener('click', () => {
        const maxImposters = Math.max(1, Math.floor((gameState.players.length - 1) / 2));
        // Generate random number between 1 and maxImposters (inclusive)
        gameState.imposterCount = Math.floor(Math.random() * maxImposters) + 1;
        elements.imposterCount.textContent = gameState.imposterCount;
        updateImposterLimits();
    });

    elements.continueToCategory?.addEventListener('click', () => {
        renderCategories();
        showScreen('category');
    });

    // Local Mode - Category screen
    elements.backToPlayers?.addEventListener('click', () => showScreen('players'));

    // Local Mode - Reveal screen
    elements.backToCategory?.addEventListener('click', () => {
        // Words have already been dealt — going back abandons the round
        if (confirm('Go back? This round will be abandoned and roles re-dealt.')) {
            showScreen('category');
        }
    });
    elements.revealCard?.addEventListener('click', toggleReveal);
    elements.nextPlayerBtn?.addEventListener('click', nextPlayer);
    elements.revealAnswerInput?.addEventListener('input', updateNextPlayerBtnState);
    elements.revealAnswerInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') nextPlayer();
    });
    elements.handoffConfirmBtn?.addEventListener('click', confirmHandoff);

    // Discussion timer
    elements.timerStartBtn?.addEventListener('click', toggleDiscussionTimer);
    elements.timerPresets?.querySelectorAll('.timer-preset[data-secs]').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.timerPresets.querySelectorAll('.timer-preset[data-secs]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            setTimerDuration(parseInt(btn.dataset.secs, 10));
            FX.play('tap');
        });
    });

    // Sound toggles (welcome strip + timer card)
    const soundToggles = document.querySelectorAll('.sound-toggle');
    const renderSoundToggles = () => {
        soundToggles.forEach(btn => {
            btn.textContent = FX.isMuted() ? '🔇' : '🔊';
            btn.classList.toggle('muted', FX.isMuted());
        });
    };
    renderSoundToggles();
    soundToggles.forEach(btn => btn.addEventListener('click', () => {
        FX.toggleMuted();
        renderSoundToggles();
        FX.play('tap');
    }));

    // Local Mode - Game screen
    elements.revealAnswerBtn?.addEventListener('click', revealAnswer);
    elements.newGameBtn?.addEventListener('click', newRound);
    elements.restartBtn?.addEventListener('click', restartGame);

    // Local Mode - Modal (multi-step)
    elements.modalConfirmVoteBtn?.addEventListener('click', modalConfirmVote);
    elements.modalSkipVoteBtn?.addEventListener('click', modalSkipVote);
    elements.modalSubmitGuessBtn?.addEventListener('click', modalSubmitGuess);
    elements.modalSkipGuessBtn?.addEventListener('click', modalSkipGuess);
    elements.savePointsBtn?.addEventListener('click', savePointsAndClose);
    elements.answerModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

    // League Hub
    elements.leagueBtn?.addEventListener('click', showLeagueHub);
    elements.leagueBackBtn?.addEventListener('click', () => showScreen('welcome'));
    elements.createLeagueBtn?.addEventListener('click', showCreateLeagueForm);
    elements.joinLeagueBtn?.addEventListener('click', showJoinLeagueForm);

    // League Create / Join
    elements.leagueJoinBackBtn?.addEventListener('click', () => showLeagueHub());
    elements.leagueCreateSubmit?.addEventListener('click', submitCreateLeague);
    elements.leagueJoinSubmit?.addEventListener('click', submitJoinLeague);
    elements.leagueNameInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitCreateLeague(); });
    elements.leagueCodeInput?.addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase(); });
    elements.leagueCodeInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') submitJoinLeague(); });

    // League Detail
    elements.leagueDetailBackBtn?.addEventListener('click', () => showLeagueHub());
    elements.leagueCopyBtn?.addEventListener('click', copyLeagueCode);
    elements.leagueLeaveBtn?.addEventListener('click', leagueLeave);
    elements.leagueDeleteBtn?.addEventListener('click', leagueDeleteConfirm);

    // Multiplayer - Choice
    elements.mpBackToWelcome?.addEventListener('click', () => showScreen('welcome'));
    elements.createRoomBtn?.addEventListener('click', () => showScreen('mpCreate'));
    elements.joinRoomBtn?.addEventListener('click', () => showScreen('mpJoin'));

    // Multiplayer - Create
    elements.mpBackToChoiceFromCreate?.addEventListener('click', () => showScreen('mpChoice'));
    elements.createRoomSubmitBtn?.addEventListener('click', createRoom);
    elements.hostNameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createRoom();
    });

    // Multiplayer - Join
    elements.mpBackToChoiceFromJoin?.addEventListener('click', () => showScreen('mpChoice'));
    elements.joinRoomSubmitBtn?.addEventListener('click', joinRoom);
    elements.roomCodeInput?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
    elements.joinNameInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });

    // Multiplayer - Lobby
    elements.mpLeaveLobby?.addEventListener('click', confirmLeaveRoom);

    // Mid-round leave buttons (word / discussion / voting screens)
    document.querySelectorAll('.mp-leave-mid').forEach(btn => {
        btn.addEventListener('click', confirmLeaveRoom);
    });
    elements.copyCodeBtn?.addEventListener('click', copyRoomCode);

    elements.mpImposterMinus?.addEventListener('click', async () => {
        if (gameState.mpImposterCount > 1) {
            gameState.mpImposterCount--;
            await MP.updateImposterCount(gameState.mpImposterCount);
        }
    });

    elements.mpImposterPlus?.addEventListener('click', async () => {
        const playerCount = Object.keys(gameState.roomData?.players || {}).length;
        const maxImposters = Math.max(1, Math.floor((playerCount - 1) / 2));
        if (gameState.mpImposterCount < maxImposters) {
            gameState.mpImposterCount++;
            await MP.updateImposterCount(gameState.mpImposterCount);
        }
    });

    elements.mpImposterRandomize?.addEventListener('click', async () => {
        const playerCount = Object.keys(gameState.roomData?.players || {}).length;
        const maxImposters = Math.max(1, Math.floor((playerCount - 1) / 2));
        // Generate random number between 1 and maxImposters (inclusive)
        const randomCount = Math.floor(Math.random() * maxImposters) + 1;
        gameState.mpImposterCount = randomCount;
        await MP.updateImposterCount(randomCount);
    });

    // Start Game (First Time)
    elements.mpStartGameBtn?.addEventListener('click', async () => {
        const gameType = gameState.roomData?.gameType || 'word';
        const category = resolveMPCategory(gameType, gameState.roomData?.category);
        showLoading('Starting game...');
        try {
            if (gameType === 'question') {
                const qKey = category.startsWith('q:') ? category.slice(2) : 'twistAndTurn';
                const secretQuestion = getRandomQuestion(qKey);
                await MP.startGame(category, null, gameState.mpImposterCount, 'question', secretQuestion);
            } else {
                const secretWord = getRandomWord(category);
                await MP.startGame(category, secretWord, gameState.mpImposterCount);
            }
            hideLoading();
        } catch (err) {
            hideLoading();
            alert('Failed to start game: ' + err.message);
        }
    });

    // Category Selection logic handled by selectMPCategory and lobby button
    elements.lobbyChangeCategoryBtn?.addEventListener('click', () => {
        const gameType = gameState.roomData?.gameType || 'word';
        renderCategories(elements.mpCategoryGrid, selectMPCategory, gameType);
        showScreen('mpCategory');
    });

    // Post-game "Play" button (Restart)
    elements.mpPlayAgainBtn?.addEventListener('click', async () => {
        const gameType = gameState.roomData?.gameType || 'word';
        const category = resolveMPCategory(gameType, gameState.roomData?.category);
        showLoading('Starting new game...');
        try {
            if (gameType === 'question') {
                const qKey = category.startsWith('q:') ? category.slice(2) : 'twistAndTurn';
                const secretQuestion = getRandomQuestion(qKey);
                await MP.playAgain(category, null, 'question', secretQuestion);
            } else {
                await MP.playAgain(category, getRandomWord(category));
            }
            hideLoading();
        } catch (err) {
            hideLoading();
            alert('Failed to start game: ' + err.message);
        }
    });



    // Anonymous voting toggle
    elements.mpAnonymousVoting?.addEventListener('change', async (e) => {
        await MP.setAnonymousVoting(e.target.checked);
    });

    // Leave lobby button
    elements.mpLeaveGameLobby?.addEventListener('click', confirmLeaveRoom);

    // Multiplayer - Category
    elements.mpBackToLobby?.addEventListener('click', () => showScreen('mpLobby'));

    // Multiplayer - Word
    elements.mpRevealCard?.addEventListener('click', toggleMPReveal);
    elements.mpReadyBtn?.addEventListener('click', markReady);
    elements.mpSubmitAnswerBtn?.addEventListener('click', submitMPAnswer);
    elements.mpAnswerInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitMPAnswer();
    });
    elements.mpAnswerInput?.addEventListener('input', () => {
        // Only gate on input while the answer hasn't been submitted yet
        const me = gameState.roomData?.players?.[gameState.myPlayerId];
        if (!me?.answer && !mpAnswerSubmitting) {
            elements.mpSubmitAnswerBtn.disabled = !elements.mpAnswerInput.value.trim();
        }
    });

    // Multiplayer - Discussion
    elements.mpStartVotingBtn?.addEventListener('click', startVoting);
    elements.chatToggleBtn?.addEventListener('click', toggleChat);

    // Multiplayer - Voting
    elements.submitVoteBtn?.addEventListener('click', submitVote);
    elements.skipVoteBtn?.addEventListener('click', skipVote);

    // Multiplayer - Results
    // Multiplayer - Results
    elements.mpNewRoundBtn?.addEventListener('click', mpNewRound);
    elements.mpReturnLobbyBtn?.addEventListener('click', mpReturnToLobby);
    elements.mpResultsLeaveBtn?.addEventListener('click', confirmLeaveRoom);

    elements.mpResultsReadyBtn?.addEventListener('click', () => {
        FX.play('tap');
        MP.toggleLobbyReady();
    });

    // Results — host settings for the next round
    elements.resultsGameTypeWord?.addEventListener('click', () => {
        if (MP.isHost()) MP.setGameType('word').catch(err => alert(err.message));
    });
    elements.resultsGameTypeQuestion?.addEventListener('click', () => {
        if (MP.isHost()) MP.setGameType('question').catch(err => alert(err.message));
    });
    elements.resultsImposterMinus?.addEventListener('click', () => {
        const count = gameState.roomData?.imposterCount || 1;
        if (count > 1) MP.updateImposterCount(count - 1).catch(err => alert(err.message));
    });
    elements.resultsImposterPlus?.addEventListener('click', () => {
        const count = gameState.roomData?.imposterCount || 1;
        const playerCount = Object.keys(gameState.roomData?.players || {}).length;
        const max = Math.max(1, Math.floor((playerCount - 1) / 2));
        if (count < max) MP.updateImposterCount(count + 1).catch(err => alert(err.message));
    });

    // Results Category Toggle — host picks a new category, then lands back in
    // the lobby flow (the category screen's back button also goes to lobby).
    elements.resultsChangeCategoryBtn?.addEventListener('click', () => {
        const gameType = gameState.roomData?.gameType || 'word';
        renderCategories(elements.mpCategoryGrid, selectMPCategory, gameType);
        showScreen('mpCategory');
    });

    // Also wire up Lobby Ready Button again
    elements.mpLobbyReadyBtn?.addEventListener('click', () => MP.toggleLobbyReady());

    // Settings listeners (Results)
    elements.mpResultsAnonymousVoting?.addEventListener('change', async (e) => {
        await MP.setAnonymousVoting(e.target.checked);
    });

    // Voice chat
    elements.voiceJoinBtn?.addEventListener('click', joinVoiceChat);
    elements.voiceMicBtn?.addEventListener('click', toggleVoiceMic);
    elements.voiceLeaveBtn?.addEventListener('click', () => {
        FX.play('tap');
        leaveVoiceChat();
    });

    // Chat
    elements.closeChatBtn?.addEventListener('click', closeChat);
    elements.chatOverlay?.addEventListener('click', closeChat);
    elements.sendChatBtn?.addEventListener('click', sendChatMessage);
    elements.chatInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeChat();
        }
        // Never hijack keys while the user is typing in a field
        if (e.target.matches?.('input, textarea')) return;

        const handoffVisible = !elements.handoffOverlay?.classList.contains('hidden');
        if (e.key === 'Enter' && handoffVisible) {
            confirmHandoff();
            return;
        }
        if (e.key === ' ' && screens.reveal.classList.contains('active') && !handoffVisible) {
            e.preventDefault();
            toggleReveal();
        }
        if (e.key === 'Enter' && screens.reveal.classList.contains('active') && !handoffVisible && gameState.isRevealed) {
            nextPlayer();
        }
    });

    // ---- Custom Categories ----
    elements.customCatBtn?.addEventListener('click', showCustomCatHub);
    elements.customCatBack?.addEventListener('click', () => showScreen('welcome'));
    elements.createCatBtn?.addEventListener('click', openCreateCat);
    elements.browseCommunityBtn?.addEventListener('click', showCommunityHub);
    elements.createCatBack?.addEventListener('click', () => showScreen('customCat'));
    elements.communityBack?.addEventListener('click', () => showScreen('customCat'));

    // Emoji picker
    elements.emojiPicker?.querySelectorAll('.emoji-option').forEach(btn => {
        btn.addEventListener('click', () => {
            elements.emojiPicker.querySelectorAll('.emoji-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });

    // Word input — add on Enter
    elements.wordInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addWordChip();
    });
    elements.addWordBtn?.addEventListener('click', addWordChip);

    // Category name input — update save button state
    elements.catNameInput?.addEventListener('input', updateSaveCatBtn);

    // Save category
    elements.saveCatBtn?.addEventListener('click', saveCustomCategory);

    // Publish
    elements.publishCatBtn?.addEventListener('click', publishCustomCategory);

    // Community search
    elements.communitySearch?.addEventListener('input', filterCommunityResults);
}

// ===============================================
// CUSTOM CATEGORIES — Hub
// ===============================================
function showCustomCatHub() {
    showScreen('customCat');
    renderMyCategoriesList();
}

function renderMyCategoriesList() {
    const cats = CustomCat.getLocalCategoriesSync();
    elements.myCategoriesList.innerHTML = '';

    if (cats.length === 0) {
        elements.myCategoriesEmpty.classList.remove('hidden');
        return;
    }
    elements.myCategoriesEmpty.classList.add('hidden');

    cats.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'my-cat-card';
        card.innerHTML = `
            <div class="my-cat-info">
                <span class="my-cat-icon">${cat.icon || '📝'}</span>
                <div>
                    <div class="my-cat-name">${cat.name}</div>
                    <div class="my-cat-meta">${cat.words.length} words${cat.communityId ? ' · 🌐 Published' : ''}</div>
                </div>
            </div>
            <div class="my-cat-actions">
                ${!cat.communityId ? `<button class="btn btn-primary btn-small" data-publish="${cat.id}" title="Publish to Community Hub">⬆️</button>` : ''}
                <button class="btn btn-ghost btn-small" data-edit="${cat.id}">Edit</button>
                <button class="btn btn-ghost btn-small btn-danger-text" data-delete="${cat.id}">Delete</button>
            </div>
        `;
        const publishBtn = card.querySelector('[data-publish]');
        if (publishBtn) {
            publishBtn.addEventListener('click', async () => {
                publishBtn.disabled = true;
                publishBtn.textContent = '⏳';
                try {
                    const authorName = elements.authorNameInput?.value?.trim() || 'Anonymous';
                    await CustomCat.publishCategory(cat, authorName);
                    renderMyCategoriesList();
                    setTimeout(() => showCommunityHub(), 800);
                } catch (e) {
                    publishBtn.disabled = false;
                    publishBtn.textContent = '❌';
                    console.error("Publish failed", e);
                }
            });
        }
        card.querySelector('[data-edit]').addEventListener('click', () => openEditCat(cat));
        card.querySelector('[data-delete]').addEventListener('click', () => deleteCustomCategory(cat.id));
        elements.myCategoriesList.appendChild(card);
    });
}

// ===============================================
// CUSTOM CATEGORIES — Creator / Editor
// ===============================================
let editingCatId = null;
let currentWords = [];

function openCreateCat() {
    editingCatId = null;
    currentWords = [];
    elements.createCatTitle.textContent = 'Create Category';
    elements.catNameInput.value = '';
    elements.wordChipList.innerHTML = '';
    elements.wordCountBadge.textContent = '0';
    elements.createCatError.classList.add('hidden');
    elements.publishStatus.classList.add('hidden');
    elements.publishCatBtn.disabled = true;
    elements.saveCatBtn.disabled = true;
    // Reset emoji to first
    elements.emojiPicker.querySelectorAll('.emoji-option').forEach((b, i) => {
        b.classList.toggle('selected', i === 0);
    });
    showScreen('customCreate');
}

function openEditCat(cat) {
    editingCatId = cat.id;
    currentWords = [...cat.words];
    elements.createCatTitle.textContent = 'Edit Category';
    elements.catNameInput.value = cat.name;
    elements.createCatError.classList.add('hidden');
    elements.publishStatus.classList.add('hidden');
    // Set emoji
    elements.emojiPicker.querySelectorAll('.emoji-option').forEach(b => {
        b.classList.toggle('selected', b.dataset.emoji === cat.icon);
    });
    renderWordChips();
    updateSaveCatBtn();
    showScreen('customCreate');
}

function getSelectedEmoji() {
    const sel = elements.emojiPicker?.querySelector('.emoji-option.selected');
    return sel ? sel.dataset.emoji : '📝';
}

function addWordChip() {
    const val = elements.wordInput.value.trim();
    if (!val) return;
    if (currentWords.includes(val)) {
        elements.wordInput.value = '';
        return;
    }
    currentWords.push(val);
    elements.wordInput.value = '';
    renderWordChips();
    updateSaveCatBtn();
    elements.wordInput.focus();
}

function renderWordChips() {
    elements.wordChipList.innerHTML = '';
    elements.wordCountBadge.textContent = currentWords.length;
    currentWords.forEach((word, idx) => {
        const chip = document.createElement('span');
        chip.className = 'word-chip';
        chip.innerHTML = `${word} <button class="word-chip-remove" data-idx="${idx}">&times;</button>`;
        chip.querySelector('.word-chip-remove').addEventListener('click', () => {
            currentWords.splice(idx, 1);
            renderWordChips();
            updateSaveCatBtn();
        });
        elements.wordChipList.appendChild(chip);
    });
}

function updateSaveCatBtn() {
    const hasName = elements.catNameInput.value.trim().length > 0;
    const hasWords = currentWords.length >= 5;
    elements.saveCatBtn.disabled = !(hasName && hasWords);
    elements.publishCatBtn.disabled = !(hasName && hasWords);
}

async function saveCustomCategory() {
    const name = elements.catNameInput.value.trim();
    if (!name || currentWords.length < 5) return;

    const cat = {
        id: editingCatId || undefined,
        name,
        icon: getSelectedEmoji(),
        words: [...currentWords]
    };

    const saved = await CustomCat.saveLocalCategory(cat);
    editingCatId = saved.id;
    elements.publishCatBtn.disabled = false;

    // Show brief success
    elements.createCatError.classList.add('hidden');
    showScreen('customCat');
    renderMyCategoriesList();
}

async function publishCustomCategory() {
    const name = elements.catNameInput.value.trim();
    if (!name || currentWords.length < 5) return;

    // Save first if unsaved
    const cat = {
        id: editingCatId || undefined,
        name,
        icon: getSelectedEmoji(),
        words: [...currentWords]
    };
    const saved = await CustomCat.saveLocalCategory(cat);
    editingCatId = saved.id;

    const authorName = elements.authorNameInput.value.trim() || 'Anonymous';
    elements.publishCatBtn.disabled = true;
    elements.publishStatus.textContent = '⏳ Publishing...';
    elements.publishStatus.classList.remove('hidden');

    try {
        await CustomCat.publishCategory(saved, authorName);
        elements.publishStatus.textContent = '✅ Published to Community Hub!';
        setTimeout(() => {
            showCommunityHub();
        }, 1200);
    } catch (e) {
        elements.publishStatus.textContent = '❌ Failed to publish. Try again.';
        elements.publishCatBtn.disabled = false;
    }
}

function deleteCustomCategory(id) {
    if (!confirm('Delete this category?')) return;
    CustomCat.deleteLocalCategory(id);
    renderMyCategoriesList();
}

// ===============================================
// CUSTOM CATEGORIES — Community Hub
// ===============================================
let allCommunityCategories = [];

async function showCommunityHub() {
    showScreen('community');
    elements.communityLoading.classList.remove('hidden');
    elements.communityList.classList.add('hidden');
    elements.communityEmpty.classList.add('hidden');
    elements.communitySearch.value = '';

    try {
        allCommunityCategories = await CustomCat.fetchCommunityCategories();
        renderCommunityList(allCommunityCategories);
    } catch (e) {
        elements.communityLoading.classList.add('hidden');
        elements.communityEmpty.classList.remove('hidden');
    }
}

function renderCommunityList(cats) {
    elements.communityLoading.classList.add('hidden');
    elements.communityList.innerHTML = '';

    if (!cats || cats.length === 0) {
        elements.communityEmpty.classList.remove('hidden');
        elements.communityList.classList.add('hidden');
        return;
    }

    elements.communityEmpty.classList.add('hidden');
    elements.communityList.classList.remove('hidden');

    cats.forEach(cat => {
        const alreadyVoted = CustomCat.hasUpvoted(cat.id);
        const card = document.createElement('div');
        card.className = 'community-card';
        card.dataset.communityId = cat.id;
        card.innerHTML = `
            <div class="community-card-header">
                <span class="community-card-icon">${cat.icon || '📝'}</span>
                <div class="community-card-info">
                    <div class="community-card-name">${cat.name}</div>
                    <div class="community-card-meta">by ${cat.authorName || 'Anonymous'} · ${cat.words.length} words</div>
                </div>
            </div>
            <div class="community-card-footer">
                <button class="btn-upvote ${alreadyVoted ? 'voted' : ''}" data-upvote="${cat.id}">
                    ${alreadyVoted ? '👍' : '👍'} <span class="upvote-count">${cat.upvotes || 0}</span>
                </button>
                <button class="btn btn-secondary btn-small" data-import="${cat.id}">⬇️ Import</button>
            </div>
        `;

        const upvoteBtn = card.querySelector('[data-upvote]');
        upvoteBtn.addEventListener('click', async () => {
            if (upvoteBtn.classList.contains('voted')) return;
            try {
                const result = await CustomCat.upvoteCategory(cat.id);
                if (!result.alreadyVoted) {
                    upvoteBtn.classList.add('voted');
                    upvoteBtn.querySelector('.upvote-count').textContent = result.newCount;
                }
            } catch (e) { /* silent */ }
        });

        const importBtn = card.querySelector('[data-import]');
        importBtn.addEventListener('click', async () => {
            importBtn.disabled = true;
            importBtn.textContent = '✅ Imported';
            try {
                await CustomCat.importCategory(cat.id);
            } catch (e) {
                importBtn.textContent = '❌ Failed';
                importBtn.disabled = false;
            }
        });

        elements.communityList.appendChild(card);
    });
}

function filterCommunityResults() {
    const q = elements.communitySearch.value.toLowerCase().trim();
    if (!q) {
        renderCommunityList(allCommunityCategories);
        return;
    }
    const filtered = allCommunityCategories.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.authorName || '').toLowerCase().includes(q)
    );
    renderCommunityList(filtered);
}

// ===============================================
// Auth — Runtime logic
// ===============================================

/** Update the auth strip on the welcome screen to reflect signed-in state */
function updateAuthStrip(user) {
    if (!user || user.isAnonymous) {
        elements.authDisplayName.textContent = 'Guest';
        elements.authAvatarEmoji.textContent = '👤';
        return;
    }
    const name = user.displayName || user.email?.split('@')[0] || 'Player';
    elements.authDisplayName.textContent = name;
    elements.authAvatarEmoji.textContent = user.photoURL ? '🟢' : '🟣';
}

/** Populate the profile screen with current user data */
async function populateProfileScreen(user) {
    if (!user) return;

    const isAnon = user.isAnonymous;
    const name = user.displayName || (isAnon ? 'Guest' : 'Player');

    elements.profileNameDisplay.textContent = name;
    elements.profileNameInput.value = name;
    elements.profileStatusBadge.textContent = isAnon ? '👤 Guest' : '✅ Google Account';
    elements.profileStatusBadge.style.background = isAnon
        ? 'rgba(255,255,255,0.08)'
        : 'rgba(34,197,94,0.12)';
    elements.profileStatusBadge.style.color = isAnon ? 'var(--text-muted)' : 'var(--success)';

    // Avatar
    elements.profileAvatarLarge.textContent = isAnon ? '👤' : '🟣';

    // Show/hide upgrade section
    if (isAnon) {
        elements.profileUpgradeSection.classList.remove('hidden');
    } else {
        elements.profileUpgradeSection.classList.add('hidden');
    }

    // Aggregate stats across all leagues the user belongs to
    try {
        const profile = await Auth.getProfile();
        if (profile?.leagues) {
            const codes = Object.keys(profile.leagues);
            let totalGames = 0, totalWins = 0, totalPoints = 0;
            await Promise.all(codes.map(async code => {
                const detail = await League.getLeagueDetail(code);
                if (detail) {
                    const me = detail.standings.find(p =>
                        p.name.toLowerCase() === name.toLowerCase()
                    );
                    if (me) {
                        totalGames += me.gamesPlayed || 0;
                        totalWins += me.wins || 0;
                        totalPoints += me.points || 0;
                    }
                }
            }));
            elements.statGames.textContent = totalGames;
            elements.statWins.textContent = totalWins;
            elements.statPoints.textContent = totalPoints;
            elements.profileStats.classList.remove('hidden');
        }
    } catch (e) {
        console.warn('Failed to load profile stats:', e);
    }
}

// ===============================================
// Initialize
// ===============================================
function init() {
    // Attach landing button listeners FIRST (before anything that might throw)
    attachLandingListeners();

    try {
        initEventListeners();
        updatePlayerCount();
        updateImposterLimits();
    } catch (e) {
        console.error('Init error:', e);
    }
    initAuth();
}

function attachLandingListeners() {
    const guestBtn = document.getElementById('landing-guest-btn');
    const loginBtn = document.getElementById('landing-login-btn');
    const signupBtn = document.getElementById('landing-signup-btn');

    if (guestBtn) {
        guestBtn.addEventListener('click', async () => {
            localStorage.setItem('imposter-has-visited', '1');
            const originalText = guestBtn.querySelector('span')?.textContent;
            try {
                guestBtn.disabled = true;
                if (guestBtn.querySelector('span')) guestBtn.querySelector('span').textContent = 'Connecting...';
                await Auth.signInAsGuest();
                showScreen('welcome');
            } catch (e) {
                console.warn('Guest sign-in failed:', e);
                guestBtn.disabled = false;
                if (guestBtn.querySelector('span')) guestBtn.querySelector('span').textContent = originalText || 'Continue as Guest';
            }
        });
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            localStorage.setItem('imposter-has-visited', '1');
            const originalText = loginBtn.querySelector('span')?.textContent;
            try {
                loginBtn.disabled = true;
                if (loginBtn.querySelector('span')) loginBtn.querySelector('span').textContent = 'Connecting...';
                const result = await Auth.signInWithGoogle();
                if (result?.user) {
                    showScreen(result.isNewUser ? 'profile' : 'welcome');
                    if (result.isNewUser) populateProfileScreen(result.user);
                }
            } catch (e) {
                loginBtn.disabled = false;
                if (loginBtn.querySelector('span')) loginBtn.querySelector('span').textContent = originalText || 'Log In';
                console.error(e);
            }
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', async () => {
            localStorage.setItem('imposter-has-visited', '1');
            const originalText = signupBtn.querySelector('span')?.textContent;
            try {
                signupBtn.disabled = true;
                if (signupBtn.querySelector('span')) signupBtn.querySelector('span').textContent = 'Connecting...';
                const result = await Auth.signInWithGoogle();
                if (result?.user) {
                    showScreen(result.isNewUser ? 'profile' : 'welcome');
                    if (result.isNewUser) populateProfileScreen(result.user);
                }
            } catch (e) {
                signupBtn.disabled = false;
                if (signupBtn.querySelector('span')) signupBtn.querySelector('span').textContent = originalText || 'Create Account';
                console.error(e);
            }
        });
    }
}

function initAuth() {

    // Single auth state listener: update UI
    Auth.onAuthChange(async user => {
        // Only run auto-guest logic here if we know there's no auth yet
        if (!user) {
            const hasVisited = localStorage.getItem('imposter-has-visited');
            if (!hasVisited) {
                showScreen('onboarding');
            } else {
                try {
                    await Auth.signInAsGuest();
                    showScreen('welcome');
                } catch (e) {
                    console.warn('Guest sign-in failed:', e);
                    showScreen('onboarding');
                }
            }
            return;
        }

        if (user) {
            // Fetch DB profile to ensure we have the most up to date display name, rather than stale cached user.displayName
            const profile = await Auth.getProfile();
            if (profile && profile.displayName) {
                user.displayName = profile.displayName; // sync local object
            }

            updateAuthStrip(user);
            if (user.displayName && elements.authorNameInput) {
                elements.authorNameInput.placeholder = user.displayName;
            }

            if (document.querySelector('.screen.active')?.id === 'onboarding-screen') {
                showScreen('welcome');
            }
        }
    });

    // Auth chip (avatar) — opens the profile screen (guests can rename
    // themselves or link a Google account from there)
    elements.authAvatarBtn?.addEventListener('click', () => {
        const user = Auth.getCurrentUser();
        showScreen('profile');
        if (user) populateProfileScreen(user);
    });

    // Landing buttons are attached in attachLandingListeners() (called first in init)

    // Profile — back button
    elements.profileBack.addEventListener('click', () => showScreen('welcome'));

    // Profile — save display name
    elements.profileSaveNameBtn.addEventListener('click', async () => {
        const name = elements.profileNameInput.value.trim();
        if (!name) return;
        elements.profileSaveNameBtn.disabled = true;
        elements.profileSaveNameBtn.textContent = '✅';
        try {
            await Auth.updateDisplayName(name);
            elements.profileNameDisplay.textContent = name;
            elements.authDisplayName.textContent = name;
        } catch (e) {
            console.error('Failed to update name:', e);
        } finally {
            setTimeout(() => {
                elements.profileSaveNameBtn.disabled = false;
                elements.profileSaveNameBtn.textContent = 'Save';
            }, 1500);
        }
    });

    // Profile — link Google Account
    elements.profileGoogleBtn.addEventListener('click', async () => {
        elements.profileGoogleBtn.disabled = true;
        elements.profileGoogleBtn.textContent = '⏳ Opening Google…';
        try {
            await Auth.signInWithGoogle();
        } catch (e) {
            console.error('Link failed:', e);
            elements.profileGoogleBtn.textContent = '❌ ' + (e.message || 'Failed. Try again.');
            setTimeout(() => {
                elements.profileGoogleBtn.disabled = false;
                elements.profileGoogleBtn.textContent = '🔗 Link Google Account';
            }, 3000);
        }
    });

    // Profile — sign out
    elements.profileSignoutBtn.addEventListener('click', async () => {
        await Auth.signOut();
        showScreen('onboarding');
    });
}

// Voice diagnostics for automated tests / debugging from the console
window.__voiceDebug = Voice.getDebugInfo;

// Start the app
document.addEventListener('DOMContentLoaded', init);

