// Secret Word Imposter Game - Main Game Logic
// Supports both Local and Multiplayer modes

import * as MP from './multiplayer.js';

// ===============================================
// Game State
// ===============================================
const gameState = {
    mode: 'local', // 'local' or 'multiplayer'
    // Local mode state
    players: [],
    imposterCount: 1,
    selectedCategory: null,
    secretWord: null,
    imposterIndices: [],
    currentRevealIndex: 0,
    isRevealed: false,
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
    welcome: document.getElementById('welcome-screen'),
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
    mpResults: document.getElementById('mp-results-screen')
};

const elements = {
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

    // Game (Local)
    gameCategory: document.getElementById('game-category'),
    gamePlayerCount: document.getElementById('game-player-count'),
    gameImposterCount: document.getElementById('game-imposter-count'),
    gamePlayersGrid: document.getElementById('game-players-grid'),
    firstSpeaker: document.getElementById('first-speaker'),
    revealAnswerBtn: document.getElementById('reveal-answer-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    restartBtn: document.getElementById('restart-btn'),

    // Modal (Local)
    answerModal: document.getElementById('answer-modal'),
    answerWord: document.getElementById('answer-word'),
    impostersList: document.getElementById('imposters-list'),
    closeModalBtn: document.getElementById('close-modal-btn'),

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
    resultsReadyControls: document.getElementById('results-ready-controls'),
    mpResultsReadyBtn: document.getElementById('mp-results-ready-btn'),
    resultsWaiting: document.getElementById('results-waiting'),
    resultsHostControls: document.getElementById('results-host-controls'),
    resultsHostHint: document.getElementById('results-host-hint'),
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
    mpLeaveGameWord: document.getElementById('mp-leave-game-word'),

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
    resultsHostControls: document.getElementById('results-host-controls'),
    mpNewRoundBtn: document.getElementById('mp-new-round-btn'),
    mpReturnLobbyBtn: document.getElementById('mp-return-lobby-btn'),
    resultsWaiting: document.getElementById('results-waiting'),

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
    loadingText: document.getElementById('loading-text')
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

function getRandomWord(category) {
    const words = CATEGORIES[category].words;
    return words[getRandomInt(0, words.length - 1)];
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
    elements.playerCount.textContent = gameState.players.length;
    elements.continueToCategory.disabled = gameState.players.length < 3;
}

function updateImposterLimits() {
    const maxImposters = Math.max(1, Math.floor((gameState.players.length - 1) / 2));

    if (gameState.imposterCount > maxImposters) {
        gameState.imposterCount = maxImposters;
        elements.imposterCount.textContent = gameState.imposterCount;
    }

    elements.imposterMinus.disabled = gameState.imposterCount <= 1;
    elements.imposterPlus.disabled = gameState.imposterCount >= maxImposters;
}

// ===============================================
// LOCAL MODE - Category Management
// ===============================================
function renderCategories(targetGrid = elements.categoryGrid, callback = selectCategory) {
    targetGrid.innerHTML = '';

    Object.entries(CATEGORIES).forEach(([key, category]) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.dataset.category = key;

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
    gameState.selectedCategory = categoryKey;
    startLocalGame();
}

// ===============================================
// LOCAL MODE - Game Logic
// ===============================================
function startLocalGame() {
    gameState.secretWord = getRandomWord(gameState.selectedCategory);

    const playerIndices = gameState.players.map((_, index) => index);
    const shuffledIndices = shuffleArray(playerIndices);
    gameState.imposterIndices = shuffledIndices.slice(0, gameState.imposterCount);

    gameState.currentRevealIndex = 0;
    gameState.isRevealed = false;

    updateRevealScreen();
    showScreen('reveal');
}

function updateRevealScreen() {
    const currentPlayer = gameState.players[gameState.currentRevealIndex];
    const isImposter = gameState.imposterIndices.includes(gameState.currentRevealIndex);
    const avatars = getPlayerAvatars();

    elements.revealCard.classList.remove('revealed');
    gameState.isRevealed = false;

    elements.playerAvatar.textContent = avatars[gameState.currentRevealIndex % avatars.length];
    elements.revealPlayerName.textContent = currentPlayer;

    if (isImposter) {
        elements.wordLabel.textContent = "You are the:";
        elements.secretWord.textContent = "IMPOSTER! 🕵️";
        elements.secretWord.classList.add('imposter');
    } else {
        elements.wordLabel.textContent = "Your word is:";
        elements.secretWord.textContent = gameState.secretWord;
        elements.secretWord.classList.remove('imposter');
    }

    elements.currentPlayerNum.textContent = gameState.currentRevealIndex + 1;
    elements.totalPlayers.textContent = gameState.players.length;

    if (gameState.currentRevealIndex === gameState.players.length - 1) {
        elements.nextPlayerText.textContent = "Start Discussion";
    } else {
        elements.nextPlayerText.textContent = "Next Player";
    }
}

function toggleReveal() {
    gameState.isRevealed = !gameState.isRevealed;
    elements.revealCard.classList.toggle('revealed', gameState.isRevealed);
}

function nextPlayer() {
    if (!gameState.isRevealed) {
        return;
    }

    elements.revealCard.classList.remove('revealed');
    gameState.isRevealed = false;

    setTimeout(() => {
        if (gameState.currentRevealIndex < gameState.players.length - 1) {
            gameState.currentRevealIndex++;
            updateRevealScreen();
        } else {
            showGameScreen();
        }
    }, 650);
}

function showGameScreen() {
    const category = CATEGORIES[gameState.selectedCategory];

    elements.gameCategory.textContent = category.name;
    elements.gamePlayerCount.textContent = gameState.players.length;
    elements.gameImposterCount.textContent = gameState.imposterCount;

    elements.gamePlayersGrid.innerHTML = '';
    const avatars = getPlayerAvatars();

    gameState.players.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = 'game-player-card';
        card.innerHTML = `
      <div class="game-player-avatar">${avatars[index % avatars.length]}</div>
      <div class="game-player-name">${player}</div>
    `;
        elements.gamePlayersGrid.appendChild(card);
    });

    // Set random first speaker
    const randomIndex = Math.floor(Math.random() * gameState.players.length);
    elements.firstSpeaker.textContent = gameState.players[randomIndex];

    showScreen('game');
}

function revealAnswer() {
    elements.answerWord.textContent = gameState.secretWord;

    elements.impostersList.innerHTML = '';
    gameState.imposterIndices.forEach(index => {
        const tag = document.createElement('span');
        tag.className = 'imposter-tag';
        tag.innerHTML = `🕵️ ${gameState.players[index]}`;
        elements.impostersList.appendChild(tag);
    });

    elements.answerModal.classList.add('active');
}

function closeModal() {
    elements.answerModal.classList.remove('active');
}

function newRound() {
    startLocalGame();
}

function restartGame() {
    showScreen('players');
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

async function leaveRoom() {
    showLoading('Leaving room...');
    try {
        await MP.leaveRoom();
    } catch (e) {
        console.error('Error leaving room:', e);
    }
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
        alert('The host has closed the room.');
        gameState.roomData = null;
        showScreen('welcome');
        return;
    }

    gameState.roomData = data;
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

        case 'results':
            if (!screens.mpResults.classList.contains('active')) {
                updateResultsScreen(data);
                showScreen('mpResults');
            }
            break;
    }
}

function updateLobbyUI(data, isHost, players, playerCount) {
    // Update player count
    elements.lobbyPlayerCount.textContent = playerCount;

    // Calculate ready count
    const readyCount = Object.values(players).filter(p => p.isReady).length;
    const hasPlayedBefore = data.lastCategory !== null;

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
            ${player.isReady && hasPlayedBefore ? '<span class="lobby-player-badge ready-badge">Ready</span>' : ''}
            <div class="lobby-player-status ${player.isConnected ? '' : 'disconnected'}"></div>
        `;
        elements.lobbyPlayersList.appendChild(div);
        index++;
    });

    // Update imposter count display
    elements.mpImposterCount.textContent = data.imposterCount || 1;
    gameState.mpImposterCount = data.imposterCount || 1;

    // Store room data for play again
    gameState.roomData = data;

    // Show/hide controls based on host status and game state
    // Update category display
    const categoryKey = data.category || 'countries';
    const categoryName = CATEGORIES[categoryKey]?.name || 'Countries';
    elements.lobbyCategoryValue.textContent = categoryName;

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
            elements.mpLobbyReadyText.textContent = "Ready!";
        } else {
            elements.mpLobbyReadyBtn.classList.remove('btn-ready-confirmed');
            elements.mpLobbyReadyText.textContent = "I'm Ready";
        }
    }
}

// ===============================================
// MULTIPLAYER MODE - Category Selection
// ===============================================
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

    elements.mpPlayerAvatar.textContent = avatars[myIndex % avatars.length];
    elements.mpRevealPlayerName.textContent = myPlayer.name;

    // Reset card state
    elements.mpRevealCard.classList.remove('revealed');
    gameState.mpRevealed = false;

    // Reset ready button for new round
    elements.mpReadyBtn.classList.remove('btn-ready-confirmed');
    elements.mpReadyBtnText.textContent = 'Ready for Discussion';
    elements.mpReadyBtn.disabled = true; // Will be enabled when word is seen

    if (myPlayer.isImposter) {
        elements.mpWordLabel.textContent = "You are the:";
        elements.mpSecretWord.textContent = "IMPOSTER! 🕵️";
        elements.mpSecretWord.classList.add('imposter');
    } else {
        elements.mpWordLabel.textContent = "Your word is:";
        elements.mpSecretWord.textContent = data.secretWord;
        elements.mpSecretWord.classList.remove('imposter');
    }
}

function updateWordScreenStatus(data) {
    const players = data.players;
    const total = Object.keys(players).length;
    const seen = Object.values(players).filter(p => p.hasSeenWord).length;
    const ready = Object.values(players).filter(p => p.isReady).length;

    elements.mpPlayersSeen.textContent = `${seen} of ${total} have seen their word. ${ready} ready.`;

    const myPlayer = players[gameState.myPlayerId];
    elements.mpReadyBtn.disabled = !myPlayer.hasSeenWord;
}

function toggleMPReveal() {
    gameState.mpRevealed = !gameState.mpRevealed;
    elements.mpRevealCard.classList.toggle('revealed', gameState.mpRevealed);

    if (gameState.mpRevealed) {
        MP.markWordSeen();
    }
}

async function markReady() {
    await MP.markReady();
    // Update button to show ready state
    elements.mpReadyBtn.classList.add('btn-ready-confirmed');
    elements.mpReadyBtnText.textContent = 'Waiting for others...';
    elements.mpReadyBtn.disabled = true;
}

function checkAllReady(data) {
    const players = Object.values(data.players);
    const allReady = players.every(p => p.isReady);

    if (allReady && players.length >= 3) {
        // Transition to discussion
        updateDiscussionScreen(data);
        showScreen('mpDiscussion');
    }
}

// ===============================================
// MULTIPLAYER MODE - Discussion Screen
// ===============================================
function updateDiscussionScreen(data) {
    const category = CATEGORIES[data.category];
    elements.mpCategoryDisplay.textContent = `Category: ${category.name}`;

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
function updateResultsScreen(data) {
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

    // Show secret word
    elements.resultsWord.textContent = data.secretWord;

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
    const categoryName = CATEGORIES[categoryKey]?.name || 'Countries';
    elements.resultsCategoryValue.textContent = categoryName;

    // Players List (Similar to Lobby)
    elements.resultsPlayersList.innerHTML = '';
    let rIndex = 0;
    Object.entries(data.players).forEach(([pid, player]) => {
        const div = document.createElement('div');
        div.className = 'lobby-player-item';
        div.innerHTML = `
            <div class="lobby-player-avatar">${avatars[rIndex % avatars.length]}</div>
            <div class="lobby-player-info">
                <span class="lobby-player-name">${player.name}${player.isHost ? ' (Host)' : ''}</span>
            </div>
            ${player.isReady ? '<span class="ready-icon">✓</span>' : '<span class="not-ready-icon">…</span>'}
         `;
        elements.resultsPlayersList.appendChild(div);
        rIndex++;
    });

    // Controls
    if (MP.isHost()) {
        elements.resultsHostControls.classList.remove('hidden');
        elements.resultsWaiting.classList.add('hidden');
        elements.resultsReadyControls.classList.add('hidden');
        elements.resultsChangeCategoryBtn.classList.remove('hidden');
        elements.resultsSettings.classList.remove('hidden');
        if (elements.mpResultsAnonymousVoting) {
            elements.mpResultsAnonymousVoting.checked = data.anonymousVoting || false;
        }

        const allReady = Object.values(data.players).every(p => p.isReady);
        const playerCount = Object.keys(data.players).length;

        elements.mpNewRoundBtn.disabled = playerCount < 3 || !allReady;
        if (playerCount < 3) elements.resultsHostHint.textContent = "Need at least 3 players";
        else if (!allReady) elements.resultsHostHint.textContent = "Waiting for players...";
        else elements.resultsHostHint.textContent = "All ready!";

    } else {
        elements.resultsHostControls.classList.add('hidden');
        elements.resultsChangeCategoryBtn.classList.add('hidden');
        // elements.resultsSettings.classList.add('hidden');

        // Ready Toggle
        const myPlayer = data.players[gameState.myPlayerId];
        if (myPlayer?.isReady) {
            elements.resultsReadyControls.classList.remove('hidden');
            elements.mpResultsReadyBtn.classList.add('btn-ready-confirmed');
            elements.mpResultsReadyBtn.textContent = "Ready!";
            elements.resultsWaiting.classList.remove('hidden'); // "Waiting for host..."
        } else {
            elements.resultsReadyControls.classList.remove('hidden');
            elements.mpResultsReadyBtn.classList.remove('btn-ready-confirmed');
            elements.mpResultsReadyBtn.textContent = "I'm Ready";
            elements.resultsWaiting.classList.add('hidden');
        }
    }
}

async function mpNewRound() {
    const category = gameState.roomData.category || 'countries';
    const secretWord = getRandomWord(category); // Re-roll word
    const imposterCount = gameState.roomData.imposterCount || 1; // Use setting

    showLoading('Starting new round...');
    try {
        await MP.startGame(category, secretWord, imposterCount);
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
// Event Listeners
// ===============================================
function initEventListeners() {
    // Mode Selection
    elements.localModeBtn?.addEventListener('click', () => {
        gameState.mode = 'local';
        if (gameState.players.length === 0) {
            for (let i = 0; i < 4; i++) {
                addPlayer();
            }
        }
        showScreen('players');
    });

    elements.multiplayerModeBtn?.addEventListener('click', () => {
        gameState.mode = 'multiplayer';
        showScreen('mpChoice');
    });

    // Local Mode - Player screen
    elements.backToWelcome?.addEventListener('click', () => showScreen('welcome'));
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

    elements.continueToCategory?.addEventListener('click', () => {
        renderCategories();
        showScreen('category');
    });

    // Local Mode - Category screen
    elements.backToPlayers?.addEventListener('click', () => showScreen('players'));

    // Local Mode - Reveal screen
    elements.backToCategory?.addEventListener('click', () => showScreen('category'));
    elements.revealCard?.addEventListener('click', toggleReveal);
    elements.nextPlayerBtn?.addEventListener('click', nextPlayer);

    // Local Mode - Game screen
    elements.revealAnswerBtn?.addEventListener('click', revealAnswer);
    elements.newGameBtn?.addEventListener('click', newRound);
    elements.restartBtn?.addEventListener('click', restartGame);

    // Local Mode - Modal
    elements.closeModalBtn?.addEventListener('click', closeModal);
    elements.answerModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

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
    elements.mpLeaveLobby?.addEventListener('click', leaveRoom);
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

    // Start Game (First Time)
    elements.mpStartGameBtn?.addEventListener('click', async () => {
        const category = gameState.roomData.category || 'countries';
        const secretWord = getRandomWord(category);
        showLoading('Starting game...');
        try {
            await MP.startGame(category, secretWord, gameState.mpImposterCount);
            hideLoading();
        } catch (err) {
            hideLoading();
            alert('Failed to start game: ' + err.message);
        }
    });

    // Category Selection logic handled by selectMPCategory and lobby button
    elements.lobbyChangeCategoryBtn?.addEventListener('click', () => {
        renderCategories(elements.mpCategoryGrid, selectMPCategory);
        showScreen('mpCategory');
    });

    // Post-game "Play" button (Restart)
    elements.mpPlayAgainBtn?.addEventListener('click', async () => {
        const category = gameState.roomData?.category || 'countries';
        const secretWord = getRandomWord(category);
        showLoading('Starting new game...');
        try {
            await MP.playAgain(category, secretWord);
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
    elements.mpLeaveGameLobby?.addEventListener('click', leaveRoom);

    // Multiplayer - Category
    elements.mpBackToLobby?.addEventListener('click', () => showScreen('mpLobby'));

    // Multiplayer - Word
    elements.mpRevealCard?.addEventListener('click', toggleMPReveal);
    elements.mpReadyBtn?.addEventListener('click', markReady);

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
    elements.mpResultsLeaveBtn?.addEventListener('click', leaveRoom);

    elements.mpResultsReadyBtn?.addEventListener('click', () => MP.toggleLobbyReady());

    // Results Category Toggle
    elements.resultsChangeCategoryBtn?.addEventListener('click', () => {
        renderCategories(elements.mpCategoryGrid, (cat) => {
            // Inline handler for results screen category change
            // Similar to selectMPCategory but stays on Results screen logic?
            // Actually, selectMPCategory goes to 'mpLobby'.
            // We want to update category and STAY on 'mpResults'.
            showLoading('Updating category...');
            MP.setCategory(cat).then(() => {
                hideLoading();
                // Do not change screen, just update data (which triggers updateResultsScreen)
            });
        });
        showScreen('mpCategory'); // This goes to category screen.
        // Wait, if we go to category screen, how do we come BACK to Results?
        // Using mpBackToLobby? no.
        // If we reuse 'mpCategory' screen, 'mpBackToLobby' goes to 'mpLobby'.
        // We might need 'mpBackToResults' logic.
        // For simplicity, let's use the standard category picker which returns to Lobby.
        // User said: "They see category (non-editable). ... The host should see categories... (editable)".
        // If host edits, does it go to a picker screen? Yes appropriate.
        // But coming back?
        // selectMPCategory currently does `showScreen('mpLobby')`.
        // I should modify selectMPCategory or update the callback.
        // The helper `renderCategories` takes a callback.
        // The callback checks `currentScreen`? Or I pass a different callback.
        // See above: I passed a callback.
        // But `mpCategory` screen has a "Back" button. `mpBackToLobby`.
        // If I came from Results, I want to go back to Results.
        // This is complex state management.
        // Allow selectMPCategory to function as is -> it redirects to Lobby.
        // If it redirects to Lobby, we lose the "Results" context.
        // But Host "New Round" button is ON Results screen.
        // If we go to Lobby, we are in Lobby.
        // Does Lobby have "New Round"? No, it has "Start Game".
        // Basically, Results-as-Lobby is the same as Lobby.
        // If Host edits category and goes to Lobby, that's fine! 
        // The "Results" screen is just a transient state.
        // If Host goes to regular Lobby, they can start game from there.
        // User said: "The second image shows... New Round button."
        // If they edit category, they might expect to return to THIS screen.
        // But if `selectMPCategory` forces Lobby, they land in Lobby.
        // Given constraints, I'll let it go to Lobby. It's safer.
        // The callback I provided above `MP.setCategory(cat).then(...)` doesn't switch screen.
        // But the `showScreen('mpCategory')` DOES switch screen.
        // And the user must click a category.
        // The Category Screen "Back" button goes to Lobby.
        // So inevitably found in Lobby.
        // I will use `selectMPCategory` standard behavior to avoid stuck state.
    });

    // Also wire up Lobby Ready Button again
    elements.mpLobbyReadyBtn?.addEventListener('click', () => MP.toggleLobbyReady());

    // Settings listeners (Results)
    elements.mpResultsAnonymousVoting?.addEventListener('change', async (e) => {
        await MP.setAnonymousVoting(e.target.checked);
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
        if (e.key === ' ' && screens.reveal.classList.contains('active')) {
            e.preventDefault();
            toggleReveal();
        }
        if (e.key === 'Enter' && screens.reveal.classList.contains('active') && gameState.isRevealed) {
            nextPlayer();
        }
    });
}

// ===============================================
// Initialize
// ===============================================
function init() {
    initEventListeners();
    updatePlayerCount();
    updateImposterLimits();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
