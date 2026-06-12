import { useEffect, useMemo, useRef, useState } from 'react';
import { createLocalRound, getRandomInt, getRandomWord } from '../../gameEngine.js';
import * as MP from '../../multiplayer.js';
import * as Auth from '../../auth.js';
import * as League from '../../league.js';
import * as CustomCat from '../../customCategories.js';
import * as AIGen from '../../aiGenerate.js';

const PLAYER_AVATARS = ['😎', '🤠', '🥳', '😈', '🤖', '👽', '🦊', '🐱', '🐶', '🦁', '🐯', '🐮', '🐷', '🐸', '🐙', '🦄'];
const DEFAULT_PLAYERS = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
const CUSTOM_CATEGORY_KEY = 'imposter-custom-categories';
const LEAGUE_MEDALS = ['🥇', '🥈', '🥉'];
const VALID_SCREENS = new Set([
  'onboarding',
  'welcome',
  'profile',
  'customCat',
  'customCreate',
  'community',
  'leagueHub',
  'leagueForm',
  'leagueDetail',
  'leaguePlay',
  'leaguePlayers',
  'gameType',
  'players',
  'category',
  'reveal',
  'game',
  'mpChoice',
  'mpCreate',
  'mpJoin',
  'mpLobby',
  'mpCategory',
  'mpWord',
  'mpDiscussion',
  'mpVoting',
  'mpResults',
]);
const CUSTOM_CATEGORY_EMOJIS = ['📝', '🎯', '🔥', '🌟', '💡', '🎭', '🏆', '🎵', '🍕', '🚀', '🌍', '⚡', '🎮', '🦁', '💎', '🌈'];

const initialModal = {
  open: false,
  step: 'vote',
  votedPlayers: [],
  guesses: {},
  summary: null,
};

function loadScriptOnce(id, src, type = 'text/javascript') {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.ready === '1') {
        resolve();
      } else {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.type = type;
    script.async = false;
    script.onload = () => {
      script.dataset.ready = '1';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function readCustomCategories() {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizePlayers(players) {
  return players.map((name, index) => {
    const trimmed = (name || '').trim();
    return trimmed || `Player ${index + 1}`;
  });
}

function categoryNameFromKey(categoryKey, categories, questionCategories, customCategories) {
  if (!categoryKey) return 'Unknown';
  if (categoryKey.startsWith('custom:')) {
    const found = customCategories.find((item) => `custom:${item.id}` === categoryKey);
    return found?.name || 'Custom';
  }
  if (categoryKey.startsWith('q:')) {
    return questionCategories[categoryKey.slice(2)]?.name || categoryKey;
  }
  return categories[categoryKey]?.name || categoryKey;
}

function toQuestionPair(categoryKey, questionCategories) {
  const questions = questionCategories?.[categoryKey]?.questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;
  return questions[getRandomInt(0, questions.length - 1)];
}

function pickQuestionPair(categoryKey, questionCategories) {
  const direct = toQuestionPair(categoryKey, questionCategories);
  if (direct) return direct;

  const firstKey = Object.keys(questionCategories || {})[0];
  if (!firstKey) return null;
  return toQuestionPair(firstKey, questionCategories);
}

function seededShuffle(array, seed) {
  let h = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  }
  const nextRandom = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h >>> 0) / 4294967296;
  };

  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function ensureGuestAuth() {
  const user = Auth.getCurrentUser();
  if (user) return user;
  return Auth.signInAsGuest();
}

function scoreRoundSummary(round, players, votedPlayers, guesses, gameType) {
  const imposterSet = new Set(round.imposterIndices);
  const votedSet = new Set(votedPlayers);

  const correctVote = round.imposterIndices.length > 0
    && round.imposterIndices.every((i) => votedSet.has(i))
    && votedPlayers.every((i) => imposterSet.has(i))
    && votedPlayers.length > 0;

  const imposterWins = !correctVote;

  const guessResults = {};
  round.imposterIndices.forEach((idx) => {
    const guess = (guesses[idx] || '').toLowerCase().trim();
    const actual = (round.secretWord || '').toLowerCase().trim();
    guessResults[idx] = guess.length > 0 && guess === actual;
  });

  const points = players.map((name) => ({
    name,
    points: 0,
    reasons: [],
  }));

  if (correctVote) {
    players.forEach((_, idx) => {
      if (!imposterSet.has(idx)) {
        points[idx].points += 1;
        points[idx].reasons.push('Caught imposter');
      }
    });
  } else {
    round.imposterIndices.forEach((idx) => {
      points[idx].points += 1;
      points[idx].reasons.push('Survived');
    });
  }

  round.imposterIndices.forEach((idx) => {
    if (guessResults[idx]) {
      points[idx].points += 1;
      points[idx].reasons.push('Guessed word');
    }
  });

  const guessRows = round.imposterIndices.map((idx) => ({
    player: players[idx],
    guess: guesses[idx] || '(skipped)',
    correct: !!guessResults[idx],
  }));

  return {
    title: imposterWins ? '🕵️ Imposter Wins!' : '🎉 Crew Wins!',
    answerLabel: gameType === 'question' ? 'The question was:' : 'The Secret Word was:',
    answerValue: gameType === 'question' ? (round.secretQuestion?.real || '(unknown)') : round.secretWord,
    imposters: round.imposterIndices.map((idx) => players[idx]),
    imposterQuestion: gameType === 'question' ? round.secretQuestion?.imposter || '' : '',
    guessRows: gameType === 'word' ? guessRows : [],
    pointsRows: points.map((entry, idx) => ({
      ...entry,
      avatar: PLAYER_AVATARS[idx % PLAYER_AVATARS.length],
    })),
  };
}

function normalizeNameKey(name) {
  return (name || '').trim().toLowerCase();
}

function localLeagueEntriesFromSummary(summary) {
  if (!summary) return [];
  const imposterSet = new Set((summary.imposters || []).map((name) => normalizeNameKey(name)));
  const crewWins = (summary.title || '').includes('Crew Wins');
  return (summary.pointsRows || []).map((row) => {
    const isImposter = imposterSet.has(normalizeNameKey(row.name));
    return {
      name: row.name,
      points: row.points || 0,
      isWin: crewWins ? !isImposter : isImposter,
    };
  });
}

function multiplayerLeagueEntries(roomData, voteResults) {
  if (!roomData?.players || !voteResults) return [];
  const imposterSet = new Set(voteResults.imposterIds || []);
  return Object.entries(roomData.players).map(([pid, player]) => {
    const isImposter = imposterSet.has(pid);
    const isWinner = voteResults.imposterWins ? isImposter : !isImposter;
    return {
      name: player.name,
      points: isWinner ? 1 : 0,
      isWin: isWinner,
    };
  });
}

export default function LocalModeApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [categories, setCategories] = useState({});
  const [questionCategories, setQuestionCategories] = useState({});
  const [customCategories, setCustomCategories] = useState([]);
  const [communityCategories, setCommunityCategories] = useState([]);

  const [screen, setScreen] = useState('onboarding');

  const [authUser, setAuthUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState('');
  const [profileNameInput, setProfileNameInput] = useState('');
  const [profileSavingName, setProfileSavingName] = useState(false);
  const [profileGoogleBusy, setProfileGoogleBusy] = useState(false);
  const [profileStats, setProfileStats] = useState({ games: '—', wins: '—', points: '—' });
  const [profileStatsVisible, setProfileStatsVisible] = useState(false);

  const [gameType, setGameType] = useState('word');
  const [players, setPlayers] = useState([]);
  const [imposterCount, setImposterCount] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [round, setRound] = useState(null);
  const [firstSpeakerIndex, setFirstSpeakerIndex] = useState(0);
  const [modal, setModal] = useState(initialModal);
  const [localSavingScores, setLocalSavingScores] = useState(false);

  const [isLeagueGame, setIsLeagueGame] = useState(false);
  const [leagueGameCode, setLeagueGameCode] = useState('');
  const [leagueGameName, setLeagueGameName] = useState('');
  const [leagueJoined, setLeagueJoined] = useState([]);
  const [leagueCurrentDetail, setLeagueCurrentDetail] = useState(null);
  const [leagueFormMode, setLeagueFormMode] = useState('create');
  const [leagueCreateMode, setLeagueCreateMode] = useState('cloud');
  const [leagueNameInput, setLeagueNameInput] = useState('');
  const [leagueCodeInput, setLeagueCodeInput] = useState('');
  const [leagueFormError, setLeagueFormError] = useState('');
  const [leagueSeedPlayers, setLeagueSeedPlayers] = useState([]);
  const [leagueSeedPlayerInput, setLeagueSeedPlayerInput] = useState('');
  const [leagueMembers, setLeagueMembers] = useState([]);
  const [leagueExtraPlayers, setLeagueExtraPlayers] = useState([]);
  const [leagueSelectedPlayers, setLeagueSelectedPlayers] = useState([]);
  const [leagueAddPlayerInput, setLeagueAddPlayerInput] = useState('');
  const [leagueManagePlayerInput, setLeagueManagePlayerInput] = useState('');
  const [leagueManageBusy, setLeagueManageBusy] = useState('');
  const [leagueImposterCount, setLeagueImposterCount] = useState(1);
  const [leagueCopyDone, setLeagueCopyDone] = useState(false);
  const [leagueDeletePending, setLeagueDeletePending] = useState(false);
  const [leaguePointsNotice, setLeaguePointsNotice] = useState('');
  const [leagueRoundStandings, setLeagueRoundStandings] = useState([]);
  const [localLeagueSavedRoundSignature, setLocalLeagueSavedRoundSignature] = useState('');

  const [mpHostName, setMpHostName] = useState('');
  const [mpJoinName, setMpJoinName] = useState('');
  const [mpJoinCode, setMpJoinCode] = useState('');
  const [mpJoinError, setMpJoinError] = useState('');
  const [mpBusyText, setMpBusyText] = useState('');
  const [mpErrorText, setMpErrorText] = useState('');
  const [mpRoomData, setMpRoomData] = useState(null);
  const [mpMyPlayerId, setMpMyPlayerId] = useState(null);
  const [mpRoomCode, setMpRoomCode] = useState('');
  const [mpSelectedVote, setMpSelectedVote] = useState(null);
  const [mpRevealed, setMpRevealed] = useState(false);
  const [mpAnswerInput, setMpAnswerInput] = useState('');
  const [mpCopiedCode, setMpCopiedCode] = useState(false);
  const [mpChatMessages, setMpChatMessages] = useState([]);
  const [mpChatOpen, setMpChatOpen] = useState(false);
  const [mpChatInput, setMpChatInput] = useState('');
  const [mpChatUnread, setMpChatUnread] = useState(0);

  const [customFormMode, setCustomFormMode] = useState('create');
  const [editingCustomCategoryId, setEditingCustomCategoryId] = useState('');
  const [customCategoryNameInput, setCustomCategoryNameInput] = useState('');
  const [customCategoryIcon, setCustomCategoryIcon] = useState(CUSTOM_CATEGORY_EMOJIS[0]);
  const [customWordInput, setCustomWordInput] = useState('');
  const [customWords, setCustomWords] = useState([]);
  const [customAuthorNameInput, setCustomAuthorNameInput] = useState('');
  const [customCreateError, setCustomCreateError] = useState('');
  const [customPublishStatus, setCustomPublishStatus] = useState('');
  const [customListActionById, setCustomListActionById] = useState({});
  const [communitySearchInput, setCommunitySearchInput] = useState('');
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityVotedById, setCommunityVotedById] = useState({});
  const [communityActionById, setCommunityActionById] = useState({});
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratingMore, setAiGeneratingMore] = useState(false);

  const screenRef = useRef(screen);
  const mpRoomUnsubscribeRef = useRef(null);
  const mpChatUnsubscribeRef = useRef(null);
  const mpChatCountRef = useRef(0);
  const mpChatOpenRef = useRef(false);
  const mpChatInitializedRef = useRef(false);
  const mpChatMessagesRef = useRef(null);
  const mpChatInputRef = useRef(null);
  const mpAutoShowResultsRef = useRef(false);
  const leagueDeleteTimerRef = useRef(null);
  const mpLeagueSavedRoundRef = useRef('');
  const localLeagueSavingRef = useRef('');
  const customPublishTimerRef = useRef(null);
  const profileSaveResetTimerRef = useRef(null);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    if (VALID_SCREENS.has(screen)) return;
    setScreen(authUser ? 'welcome' : 'onboarding');
  }, [screen, authUser]);

  const legacyHref = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('reactLocal');
    url.searchParams.set('legacy', '1');
    const qs = url.searchParams.toString();
    return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
  }, []);

  const authDisplayName = useMemo(() => {
    if (!authUser) return 'Guest';
    if (authUser.isAnonymous) return 'Guest';
    return authUser.displayName || authUser.email?.split('@')[0] || 'Player';
  }, [authUser]);

  const authAvatarEmoji = useMemo(() => {
    if (!authUser || authUser.isAnonymous) return '👤';
    return authUser.photoURL ? '🟢' : '🟣';
  }, [authUser]);
  const profileIsAnonymous = !!authUser?.isAnonymous;
  const profileDisplayName = authUser?.displayName || (profileIsAnonymous ? 'Guest' : 'Player');

  async function refreshCustomCategories() {
    setCustomCategories(readCustomCategories());
    try {
      const fetched = await CustomCat.getLocalCategories();
      if (Array.isArray(fetched)) {
        setCustomCategories(fetched);
      }
    } catch {
      // Keep local cache fallback.
    }
  }

  function resetCustomCreateForm() {
    if (customPublishTimerRef.current) {
      clearTimeout(customPublishTimerRef.current);
      customPublishTimerRef.current = null;
    }
    setCustomFormMode('create');
    setEditingCustomCategoryId('');
    setCustomCategoryNameInput('');
    setCustomCategoryIcon(CUSTOM_CATEGORY_EMOJIS[0]);
    setCustomWordInput('');
    setCustomWords([]);
    setCustomCreateError('');
    setCustomPublishStatus('');
    setAiDifficulty('medium');
    setAiGenerating(false);
    setAiGeneratingMore(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        await loadScriptOnce('legacy-categories-data', '/legacy/categories.js');
        await loadScriptOnce('legacy-question-categories-data', '/legacy/questionCategories.js');

        if (cancelled) return;

        setCategories(globalThis.CATEGORIES || {});
        setQuestionCategories(globalThis.QUESTION_CATEGORIES || {});
        setCustomCategories(readCustomCategories());
        try {
          const fetchedCustom = await CustomCat.getLocalCategories();
          if (!cancelled && Array.isArray(fetchedCustom)) {
            setCustomCategories(fetchedCustom);
          }
        } catch {
          // Keep local cache fallback.
        }
        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err.message || 'Failed to load game data.');
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
      if (leagueDeleteTimerRef.current) {
        clearTimeout(leagueDeleteTimerRef.current);
        leagueDeleteTimerRef.current = null;
      }
      if (mpRoomUnsubscribeRef.current) {
        mpRoomUnsubscribeRef.current();
        mpRoomUnsubscribeRef.current = null;
      }
      if (mpChatUnsubscribeRef.current) {
        mpChatUnsubscribeRef.current();
        mpChatUnsubscribeRef.current = null;
      }
      if (customPublishTimerRef.current) {
        clearTimeout(customPublishTimerRef.current);
        customPublishTimerRef.current = null;
      }
      if (profileSaveResetTimerRef.current) {
        clearTimeout(profileSaveResetTimerRef.current);
        profileSaveResetTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      screen === 'category'
      || screen === 'mpCategory'
      || screen === 'customCat'
      || screen === 'customCreate'
    ) {
      refreshCustomCategories();
    }
  }, [screen]);

  useEffect(() => {
    Auth.onAuthChange(async (user) => {
      if (!user) {
        setAuthUser(null);
        setProfileStatsVisible(false);
        setAuthError('');
        if (screenRef.current !== 'onboarding') {
          setScreen('onboarding');
        }
        return;
      }

      let nextUser = user;
      try {
        const profile = await Auth.getProfile();
        if (profile?.displayName) {
          nextUser = { ...user, displayName: profile.displayName };
        }
      } catch {
        // Best effort.
      }

      setAuthUser(nextUser);
      setCustomAuthorNameInput((prev) => {
        if (prev.trim().length > 0) return prev;
        return nextUser.displayName || '';
      });
      setAuthError('');
      if (screenRef.current === 'onboarding') {
        setScreen('welcome');
      }
    });
  }, []);

  const maxImposters = Math.max(1, Math.floor((players.length - 1) / 2));

  useEffect(() => {
    if (imposterCount > maxImposters) {
      setImposterCount(maxImposters);
    }
  }, [imposterCount, maxImposters]);

  useEffect(() => {
    const max = Math.max(1, Math.floor((leagueSelectedPlayers.length - 1) / 2));
    if (leagueImposterCount > max) {
      setLeagueImposterCount(max);
    }
  }, [leagueImposterCount, leagueSelectedPlayers.length]);

  useEffect(() => {
    if (screen === 'leagueDetail') return;
    if (leagueDeleteTimerRef.current) {
      clearTimeout(leagueDeleteTimerRef.current);
      leagueDeleteTimerRef.current = null;
    }
    setLeagueDeletePending(false);
  }, [screen]);

  const normalizedPlayers = useMemo(() => normalizePlayers(players), [players]);
  const currentRevealIndex = round?.currentRevealIndex || 0;
  const revealPlayerName = normalizedPlayers[currentRevealIndex] || 'Player';
  const revealPlayerAvatar = PLAYER_AVATARS[currentRevealIndex % PLAYER_AVATARS.length];
  const isCurrentImposter = round?.imposterIndices?.includes(currentRevealIndex) || false;
  const revealQuestionText = gameType === 'question' && round?.secretQuestion
    ? (isCurrentImposter ? round.secretQuestion.imposter : round.secretQuestion.real)
    : '';

  const canAdvanceReveal = Boolean(round?.isRevealed) && (
    gameType === 'word' || ((round?.playerAnswers?.[currentRevealIndex] || '').trim().length > 0)
  );

  const leagueCurrentCode = leagueCurrentDetail?.code || '';
  const leagueCurrentName = leagueCurrentDetail?.name || '';
  const leagueStandings = leagueCurrentDetail?.standings || [];
  const leagueCurrentMembers = leagueCurrentDetail?.members || [];
  const leagueCurrentIsLocal = !!leagueCurrentDetail?.isLocal;
  const leagueCurrentIsAdmin = leagueCurrentDetail?.isAdmin !== false;
  const leagueSeedCanAdd = leagueSeedPlayerInput.trim().length > 0;
  const leagueAllPlayers = useMemo(
    () => [...leagueMembers, ...leagueExtraPlayers],
    [leagueMembers, leagueExtraPlayers],
  );
  const leagueSelectedCount = leagueSelectedPlayers.length;
  const leagueMaxImposters = Math.max(1, Math.floor((leagueSelectedCount - 1) / 2));
  const canSaveCustomCategory = customCategoryNameInput.trim().length > 0 && customWords.length >= 5;
  const filteredCommunityCategories = useMemo(() => {
    const query = communitySearchInput.trim().toLowerCase();
    if (!query) return communityCategories;
    return communityCategories.filter((cat) => (
      (cat.name || '').toLowerCase().includes(query)
      || (cat.authorName || '').toLowerCase().includes(query)
    ));
  }, [communityCategories, communitySearchInput]);

  const mpPlayers = mpRoomData?.players || {};
  const mpPlayerEntries = Object.entries(mpPlayers);
  const mpPlayerCount = mpPlayerEntries.length;
  const mpIsHost = MP.isHost();
  const mpGameType = mpRoomData?.gameType || 'word';
  const mpCategoryKey = mpRoomData?.category || (mpGameType === 'question' ? 'q:twistAndTurn' : 'countries');
  const mpCategoryName = categoryNameFromKey(mpCategoryKey, categories, questionCategories, customCategories);
  const mpMyPlayer = mpPlayers[mpMyPlayerId] || null;
  const mpAnonymousVoting = !!mpRoomData?.anonymousVoting;
  const mpImposterCount = mpRoomData?.imposterCount || 1;
  const mpMaxImposters = Math.max(1, Math.floor((mpPlayerCount - 1) / 2));
  const mpHasPlayedBefore = mpRoomData?.lastCategory !== null && mpRoomData?.lastCategory !== undefined;
  const mpCanUseChat = screen === 'mpDiscussion' || screen === 'mpVoting';

  const mpWordSeenCount = mpPlayerEntries.filter(([, p]) => p.hasSeenWord).length;
  const mpReadyCount = mpPlayerEntries.filter(([, p]) => p.isReady).length;
  const mpAllReadyLobby = mpPlayerEntries.length > 0 && mpPlayerEntries.every(([, p]) => p.isReady);
  const mpCanStartFromLobby = mpIsHost && mpPlayerCount >= 3 && mpAllReadyLobby;

  const mpPlayingAllReady = useMemo(() => {
    if (mpRoomData?.status !== 'playing') return false;
    if (mpPlayerEntries.length < 3) return false;
    if (mpGameType === 'question') {
      return mpPlayerEntries.every(([, p]) => p.hasSeenWord && (p.answer || '').trim().length > 0);
    }
    return mpPlayerEntries.every(([, p]) => p.isReady);
  }, [mpRoomData?.status, mpPlayerEntries, mpGameType]);

  const mpVotingAllVoted = useMemo(() => {
    if (mpRoomData?.status !== 'voting') return false;
    return mpPlayerEntries.length > 0 && mpPlayerEntries.every(([, p]) => !!p.vote);
  }, [mpRoomData?.status, mpPlayerEntries]);

  const mpVoteResults = useMemo(() => {
    if (!mpRoomData?.players || mpRoomData.status !== 'results') return null;
    return MP.calculateVoteResults(mpRoomData.players);
  }, [mpRoomData]);

  const mpLiveVotes = useMemo(() => {
    if (!mpRoomData?.players) return [];
    const rows = [];
    Object.entries(mpRoomData.players).forEach(([pid, player]) => {
      if (!player.vote) return;
      if (player.vote === 'skip') {
        rows.push({ id: `${pid}-skip`, voter: player.name, skipped: true });
        return;
      }
      const target = mpRoomData.players[player.vote];
      if (!target) return;
      rows.push({
        id: `${pid}-${player.vote}`,
        voter: player.name,
        target: target.name,
        skipped: false,
      });
    });
    return rows;
  }, [mpRoomData]);

  const mpSpeakingOrder = useMemo(() => {
    if (!mpRoomData?.players) return [];
    const list = Object.entries(mpRoomData.players)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pid, p]) => ({ pid, name: p.name }));

    const seed = `${MP.getRoomCode() || ''}${mpRoomData.secretWord || ''}${mpRoomData.createdAt || ''}${mpRoomData.imposterCount || 1}`;
    return seededShuffle(list, seed);
  }, [mpRoomData]);

  const mpLeaderboard = useMemo(() => {
    if (!mpRoomData?.players) return [];
    const scores = mpRoomData.scores || {};
    return Object.entries(mpRoomData.players)
      .map(([pid, player]) => ({
        pid,
        name: player.name,
        points: scores[pid] || 0,
      }))
      .sort((a, b) => b.points - a.points);
  }, [mpRoomData]);

  const mpLeagueRoundSignature = useMemo(() => {
    if (!isLeagueGame || !leagueGameCode) return '';
    if (mpRoomData?.status !== 'results' || !mpVoteResults || !mpRoomData?.players) return '';
    const playersSignature = Object.entries(mpRoomData.players)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pid, player]) => `${pid}:${player.vote || '-'}:${player.isImposter ? '1' : '0'}`)
      .join('|');
    return `${MP.getRoomCode() || mpRoomCode}|${mpRoomData.secretWord || ''}|${mpRoomData.secretQuestion?.real || ''}|${playersSignature}`;
  }, [isLeagueGame, leagueGameCode, mpRoomCode, mpRoomData, mpVoteResults]);

  const localLeagueRoundSignature = useMemo(() => {
    if (!isLeagueGame || !leagueGameCode) return '';
    if (modal.step !== 'results' || !modal.summary) return '';
    return `${leagueGameCode}|${modal.summary.roundKey || ''}`;
  }, [isLeagueGame, leagueGameCode, modal.step, modal.summary]);

  const localLeagueRoundSaved = localLeagueRoundSignature.length > 0
    && localLeagueSavedRoundSignature === localLeagueRoundSignature;

  async function continueAsGuest() {
    setAuthBusy('guest');
    setAuthError('');
    try {
      await Auth.signInAsGuest();
      setScreen('welcome');
    } catch (err) {
      setAuthError(err.message || 'Guest sign-in failed.');
    } finally {
      setAuthBusy('');
    }
  }

  async function continueWithGoogle() {
    setAuthBusy('google');
    setAuthError('');
    try {
      const result = await Auth.signInWithGoogle();
      if (result?.user) {
        if (result.isNewUser) {
          setProfileNameInput(result.user.displayName || result.user.email?.split('@')[0] || 'Player');
          setScreen('profile');
          await loadProfileStats(result.user);
        } else {
          setScreen('welcome');
        }
      }
    } catch (err) {
      setAuthError(err.message || 'Google sign-in failed.');
    } finally {
      setAuthBusy('');
    }
  }

  async function loadProfileStats(user) {
    if (!user) {
      setProfileStatsVisible(false);
      return;
    }

    const isAnon = !!user.isAnonymous;
    const displayName = user.displayName || (isAnon ? 'Guest' : 'Player');
    if (isAnon) {
      setProfileStats({ games: '—', wins: '—', points: '—' });
      setProfileStatsVisible(false);
      return;
    }

    try {
      const profile = await Auth.getProfile();
      if (!profile?.leagues) {
        setProfileStats({ games: '0', wins: '0', points: '0' });
        setProfileStatsVisible(true);
        return;
      }

      const codes = Object.keys(profile.leagues);
      let totalGames = 0;
      let totalWins = 0;
      let totalPoints = 0;

      await Promise.all(codes.map(async (code) => {
        const detail = await League.getLeagueDetail(code);
        if (!detail) return;
        const me = detail.standings.find((player) => normalizeNameKey(player.name) === normalizeNameKey(displayName));
        if (!me) return;
        totalGames += me.gamesPlayed || 0;
        totalWins += me.wins || 0;
        totalPoints += me.points || 0;
      }));

      setProfileStats({
        games: String(totalGames),
        wins: String(totalWins),
        points: String(totalPoints),
      });
      setProfileStatsVisible(true);
    } catch {
      setProfileStatsVisible(false);
    }
  }

  async function openProfileScreen() {
    const user = Auth.getCurrentUser();
    if (!user || user.isAnonymous) {
      setScreen('onboarding');
      return;
    }

    const name = user.displayName || user.email?.split('@')[0] || 'Player';
    setProfileNameInput(name);
    setScreen('profile');
    await loadProfileStats(user);
  }

  async function saveProfileName() {
    const name = profileNameInput.trim();
    if (!name) return;
    setProfileSavingName(true);
    setAuthError('');
    try {
      await Auth.updateDisplayName(name);
      setAuthUser((prev) => {
        if (!prev) return prev;
        return { ...prev, displayName: name };
      });
      setCustomAuthorNameInput(name);
      if (profileSaveResetTimerRef.current) {
        clearTimeout(profileSaveResetTimerRef.current);
      }
      profileSaveResetTimerRef.current = setTimeout(() => {
        setProfileSavingName(false);
        profileSaveResetTimerRef.current = null;
      }, 600);
    } catch (err) {
      setProfileSavingName(false);
      setAuthError(err.message || 'Failed to save display name.');
    }
  }

  async function linkGoogleAccount() {
    setProfileGoogleBusy(true);
    setAuthError('');
    try {
      const result = await Auth.signInWithGoogle();
      if (result?.user) {
        setAuthUser(result.user);
        await openProfileScreen();
      }
    } catch (err) {
      setAuthError(err.message || 'Failed to link Google account.');
    } finally {
      setProfileGoogleBusy(false);
    }
  }

  async function signOutFromProfile() {
    setAuthError('');
    try {
      await Auth.signOut();
      setScreen('onboarding');
    } catch (err) {
      setAuthError(err.message || 'Failed to sign out.');
    }
  }

  function openCustomCategoryHub() {
    setCustomListActionById({});
    setCustomCreateError('');
    setCustomPublishStatus('');
    setScreen('customCat');
    refreshCustomCategories();
  }

  function openCreateCustomCategory() {
    resetCustomCreateForm();
    setScreen('customCreate');
  }

  function openEditCustomCategory(cat) {
    if (customPublishTimerRef.current) {
      clearTimeout(customPublishTimerRef.current);
      customPublishTimerRef.current = null;
    }
    setCustomFormMode('edit');
    setEditingCustomCategoryId(cat.id);
    setCustomCategoryNameInput(cat.name || '');
    setCustomCategoryIcon(cat.icon || CUSTOM_CATEGORY_EMOJIS[0]);
    setCustomWordInput('');
    setCustomWords(Array.isArray(cat.words) ? [...cat.words] : []);
    setCustomCreateError('');
    setCustomPublishStatus('');
    setScreen('customCreate');
  }

  function addCustomWord() {
    const nextWord = customWordInput.trim();
    if (!nextWord) return;
    const exists = customWords.some((word) => normalizeNameKey(word) === normalizeNameKey(nextWord));
    if (exists) {
      setCustomWordInput('');
      return;
    }
    setCustomWords((prev) => [...prev, nextWord]);
    setCustomWordInput('');
  }

  function removeCustomWord(index) {
    setCustomWords((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function generateCustomWords(count) {
    if (!customCategoryNameInput.trim()) {
      setCustomCreateError('Enter a category name first.');
      return;
    }
    setCustomCreateError('');
    if (count > 10) {
      setAiGenerating(true);
    } else {
      setAiGeneratingMore(true);
    }
    try {
      const words = await AIGen.generateWordsForCategory(
        customCategoryNameInput.trim(),
        null,
        count,
        aiDifficulty,
        customWords,
      );
      const seen = new Set(customWords.map((word) => normalizeNameKey(word)));
      const merged = [...customWords];
      words.forEach((word) => {
        const key = normalizeNameKey(word);
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(word);
      });
      setCustomWords(merged);
    } catch (err) {
      setCustomCreateError(err.message || 'AI generation failed.');
    } finally {
      setAiGenerating(false);
      setAiGeneratingMore(false);
    }
  }

  async function saveCustomCategory() {
    if (!canSaveCustomCategory) return;
    setCustomCreateError('');
    try {
      const payload = {
        id: editingCustomCategoryId || undefined,
        name: customCategoryNameInput.trim(),
        icon: customCategoryIcon || '📝',
        words: customWords.map((word) => word.trim()).filter((word) => word.length > 0),
      };
      await CustomCat.saveLocalCategory(payload);
      await refreshCustomCategories();
      setScreen('customCat');
    } catch (err) {
      setCustomCreateError(err.message || 'Failed to save category.');
    }
  }

  async function publishCustomCategory() {
    if (!canSaveCustomCategory) return;
    setCustomCreateError('');
    setCustomPublishStatus('⏳ Publishing...');
    try {
      if (!Auth.getCurrentUser()) {
        await Auth.signInAsGuest();
      }
      const payload = {
        id: editingCustomCategoryId || undefined,
        name: customCategoryNameInput.trim(),
        icon: customCategoryIcon || '📝',
        words: customWords.map((word) => word.trim()).filter((word) => word.length > 0),
      };
      const saved = await CustomCat.saveLocalCategory(payload);
      setEditingCustomCategoryId(saved.id);
      await CustomCat.publishCategory(saved, customAuthorNameInput.trim() || authDisplayName || 'Anonymous');
      await refreshCustomCategories();
      setCustomPublishStatus('✅ Published to Community Hub!');
      if (customPublishTimerRef.current) {
        clearTimeout(customPublishTimerRef.current);
      }
      customPublishTimerRef.current = setTimeout(() => {
        openCommunityHub();
      }, 1200);
    } catch (err) {
      setCustomPublishStatus(`❌ ${err.message || 'Failed to publish.'}`);
    }
  }

  async function publishFromCustomHub(cat) {
    const actionKey = `publish:${cat.id}`;
    setCustomListActionById((prev) => ({ ...prev, [cat.id]: actionKey }));
    try {
      if (!Auth.getCurrentUser()) {
        await Auth.signInAsGuest();
      }
      await CustomCat.publishCategory(cat, customAuthorNameInput.trim() || authDisplayName || 'Anonymous');
      await refreshCustomCategories();
      await openCommunityHub();
    } catch (err) {
      setMpErrorText(err.message || 'Failed to publish category.');
    } finally {
      setCustomListActionById((prev) => {
        const next = { ...prev };
        delete next[cat.id];
        return next;
      });
    }
  }

  async function deleteCustomCategory(id) {
    if (!window.confirm('Delete this category?')) return;
    setCustomListActionById((prev) => ({ ...prev, [id]: `delete:${id}` }));
    try {
      await CustomCat.deleteLocalCategory(id);
      await refreshCustomCategories();
    } catch (err) {
      setMpErrorText(err.message || 'Failed to delete category.');
    } finally {
      setCustomListActionById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function openCommunityHub() {
    setCommunitySearchInput('');
    setCommunityActionById({});
    setCommunityLoading(true);
    setScreen('community');
    try {
      const list = await CustomCat.fetchCommunityCategories();
      setCommunityCategories(Array.isArray(list) ? list : []);
      const voteRows = await Promise.all(
        (Array.isArray(list) ? list : []).map(async (cat) => {
          try {
            const voted = await CustomCat.hasUpvoted(cat.id);
            return [cat.id, voted];
          } catch {
            return [cat.id, false];
          }
        }),
      );
      setCommunityVotedById(Object.fromEntries(voteRows));
    } catch {
      setCommunityCategories([]);
      setCommunityVotedById({});
    } finally {
      setCommunityLoading(false);
    }
  }

  async function upvoteCommunityCategory(catId) {
    if (communityVotedById[catId]) return;
    if (communityActionById[catId] === 'upvote') return;
    setCommunityActionById((prev) => ({ ...prev, [catId]: 'upvote' }));
    try {
      if (!Auth.getCurrentUser()) {
        await Auth.signInAsGuest();
      }
      const result = await CustomCat.upvoteCategory(catId);
      if (result?.alreadyVoted) {
        setCommunityVotedById((prev) => ({ ...prev, [catId]: true }));
      } else {
        setCommunityVotedById((prev) => ({ ...prev, [catId]: true }));
        setCommunityCategories((prev) => prev.map((cat) => (
          cat.id === catId ? { ...cat, upvotes: result?.newCount ?? ((cat.upvotes || 0) + 1) } : cat
        )));
      }
    } catch (err) {
      setMpErrorText(err.message || 'Failed to upvote category.');
    } finally {
      setCommunityActionById((prev) => {
        const next = { ...prev };
        delete next[catId];
        return next;
      });
    }
  }

  async function importCommunityCategory(catId) {
    if (communityActionById[catId] === 'import') return;
    setCommunityActionById((prev) => ({ ...prev, [catId]: 'import' }));
    try {
      await CustomCat.importCategory(catId);
      await refreshCustomCategories();
      setCommunityActionById((prev) => ({ ...prev, [catId]: 'imported' }));
    } catch (err) {
      setMpErrorText(err.message || 'Failed to import category.');
      setCommunityActionById((prev) => {
        const next = { ...prev };
        delete next[catId];
        return next;
      });
    }
  }

  function clearLeagueGameState() {
    setIsLeagueGame(false);
    setLeagueGameCode('');
    setLeagueGameName('');
    setLeaguePointsNotice('');
    setLeagueRoundStandings([]);
    setLocalLeagueSavedRoundSignature('');
    mpLeagueSavedRoundRef.current = '';
    localLeagueSavingRef.current = '';
  }

  async function refreshLeagueHub() {
    setMpBusyText('Loading leagues...');
    try {
      const leagues = await League.getJoinedLeagues();
      setLeagueJoined(leagues);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to load leagues.');
    } finally {
      setMpBusyText('');
    }
  }

  async function openLeagueHub(resetLeagueGame = true) {
    if (resetLeagueGame) {
      clearLeagueGameState();
    }
    setLeagueFormError('');
    setLeagueDeletePending(false);
    setLeagueCurrentDetail(null);
    setLeagueManagePlayerInput('');
    setLeagueManageBusy('');
    setScreen('leagueHub');
    await refreshLeagueHub();
  }

  async function goHome() {
    setMpErrorText('');
    setMpJoinError('');
    setLeagueFormError('');
    setLeagueDeletePending(false);
    setModal(initialModal);

    const hasActiveRoom = Boolean(mpRoomData || mpRoomCode || MP.getRoomCode());
    if (hasActiveRoom) {
      await leaveMultiplayerRoom(true);
      return;
    }

    cleanupRoomSubscription();
    cleanupChatSubscription();
    resetMultiplayerState();
    clearLeagueGameState();
    setScreen(authUser ? 'welcome' : 'onboarding');
  }

  function openLeagueForm(mode) {
    setLeagueFormMode(mode);
    setLeagueFormError('');
    setLeagueNameInput('');
    setLeagueCodeInput('');
    setLeagueCreateMode('cloud');
    setLeagueSeedPlayers([]);
    setLeagueSeedPlayerInput('');
    setScreen('leagueForm');
  }

  function addLeagueSeedPlayer() {
    const trimmed = leagueSeedPlayerInput.trim();
    if (!trimmed) return;
    const duplicate = leagueSeedPlayers.some((name) => normalizeNameKey(name) === normalizeNameKey(trimmed));
    if (duplicate) {
      setLeagueSeedPlayerInput('');
      return;
    }
    setLeagueSeedPlayers((prev) => [...prev, trimmed]);
    setLeagueSeedPlayerInput('');
  }

  function removeLeagueSeedPlayer(index) {
    setLeagueSeedPlayers((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function submitLeagueForm() {
    if (leagueFormMode === 'create') {
      const name = leagueNameInput.trim();
      if (!name) {
        setLeagueFormError('Please enter a league name.');
        return;
      }
      setMpBusyText('Creating league...');
      try {
        if (leagueCreateMode === 'cloud') {
          await ensureGuestAuth();
        }
        const code = await League.createLeague(name, {
          mode: leagueCreateMode,
          playerNames: leagueSeedPlayers,
        });
        await openLeagueDetail(code);
      } catch (err) {
        setLeagueFormError(err.message || 'Failed to create league.');
      } finally {
        setMpBusyText('');
      }
      return;
    }

    const code = leagueCodeInput.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setLeagueFormError('Please enter a valid 6-character league code.');
      return;
    }

  setMpBusyText('Joining league...');
  try {
      await ensureGuestAuth();
      await League.joinLeague(code);
      await openLeagueDetail(code);
    } catch (err) {
      setLeagueFormError(err.message || 'Failed to join league.');
    } finally {
      setMpBusyText('');
    }
  }

  async function openLeagueDetail(code) {
    if (!code) return;
    setMpBusyText('Loading league...');
    try {
      const detail = await League.getLeagueDetail(code);
      if (!detail) {
        setMpErrorText('League not found.');
        await openLeagueHub();
        return;
      }
      setLeagueCurrentDetail(detail);
      setLeagueMembers(detail.members || []);
      setLeagueGameName(detail.name || 'League');
      setLeagueRoundStandings(detail.standings || []);
      setLocalLeagueSavedRoundSignature('');
      localLeagueSavingRef.current = '';
      setLeagueManagePlayerInput('');
      setLeagueManageBusy('');
      setLeagueCopyDone(false);
      setLeagueDeletePending(false);
      setScreen('leagueDetail');
    } catch (err) {
      setMpErrorText(err.message || 'Failed to load league.');
    } finally {
      setMpBusyText('');
    }
  }

  async function addCurrentLeagueMember() {
    const name = leagueManagePlayerInput.trim();
    if (!leagueCurrentCode || !name) return;
    setLeagueManageBusy(`add:${normalizeNameKey(name)}`);
    setMpBusyText('Adding player...');
    try {
      await League.addLeagueMember(leagueCurrentCode, name);
      setLeagueManagePlayerInput('');
      await openLeagueDetail(leagueCurrentCode);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to add player.');
    } finally {
      setLeagueManageBusy('');
      setMpBusyText('');
    }
  }

  async function removeCurrentLeagueMember(name) {
    if (!leagueCurrentCode || !name) return;
    if (!window.confirm(`Remove ${name} from this league?`)) return;
    setLeagueManageBusy(`remove:${normalizeNameKey(name)}`);
    setMpBusyText('Removing player...');
    try {
      await League.removeLeagueMember(leagueCurrentCode, name);
      await openLeagueDetail(leagueCurrentCode);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to remove player.');
    } finally {
      setLeagueManageBusy('');
      setMpBusyText('');
    }
  }

  async function renameCurrentLeagueMember(oldName) {
    if (!leagueCurrentCode || !oldName) return;
    const nextName = window.prompt('Rename player', oldName);
    if (!nextName || normalizeNameKey(nextName) === normalizeNameKey(oldName)) return;
    setLeagueManageBusy(`rename:${normalizeNameKey(oldName)}`);
    setMpBusyText('Renaming player...');
    try {
      await League.renameLeagueMember(leagueCurrentCode, oldName, nextName);
      await openLeagueDetail(leagueCurrentCode);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to rename player.');
    } finally {
      setLeagueManageBusy('');
      setMpBusyText('');
    }
  }

  async function copyLeagueCode() {
    if (!leagueCurrentCode || leagueCurrentIsLocal) return;
    try {
      await navigator.clipboard.writeText(leagueCurrentCode);
      setLeagueCopyDone(true);
      setTimeout(() => setLeagueCopyDone(false), 1500);
    } catch {
      setMpErrorText('Copy failed.');
    }
  }

  async function leaveCurrentLeague() {
    if (!leagueCurrentCode) return;
    if (leagueCurrentIsLocal) {
      await openLeagueHub();
      return;
    }
    setMpBusyText('Leaving league...');
    try {
      await League.leaveLeague(leagueCurrentCode);
      await openLeagueHub();
    } catch (err) {
      setMpErrorText(err.message || 'Failed to leave league.');
    } finally {
      setMpBusyText('');
    }
  }

  async function deleteCurrentLeague() {
    if (!leagueCurrentCode) return;
    if (!leagueDeletePending) {
      setLeagueDeletePending(true);
      if (leagueDeleteTimerRef.current) {
        clearTimeout(leagueDeleteTimerRef.current);
      }
      leagueDeleteTimerRef.current = setTimeout(() => {
        setLeagueDeletePending(false);
      }, 3000);
      return;
    }

    if (leagueDeleteTimerRef.current) {
      clearTimeout(leagueDeleteTimerRef.current);
      leagueDeleteTimerRef.current = null;
    }

    setMpBusyText('Deleting league...');
    try {
      await League.deleteLeague(leagueCurrentCode);
      setLeagueDeletePending(false);
      await openLeagueHub();
    } catch (err) {
      setLeagueDeletePending(false);
      setMpErrorText(err.message || 'Failed to delete league.');
    } finally {
      setMpBusyText('');
    }
  }

  async function openLeaguePlay() {
    if (!leagueCurrentCode) return;
    setIsLeagueGame(true);
    setLeagueGameCode(leagueCurrentCode);
    setLeagueGameName(leagueCurrentName || 'League');
    setLeaguePointsNotice('');
    setLocalLeagueSavedRoundSignature('');
    localLeagueSavingRef.current = '';
    mpLeagueSavedRoundRef.current = '';
    setLeagueMembers([]);
    setLeagueExtraPlayers([]);
    setLeagueSelectedPlayers([]);
    setLeagueImposterCount(1);
    setScreen('leaguePlay');
  }

  async function startLeagueLocalFlow() {
    if (!leagueGameCode) return;
    setMpBusyText('Loading players...');
    try {
      const members = await League.getLeagueMembers(leagueGameCode);
      setLeagueMembers(members);
      setLeagueExtraPlayers([]);
      setLeagueSelectedPlayers([...members]);
      setLeagueAddPlayerInput('');
      setLeagueImposterCount(1);
      setScreen('leaguePlayers');
    } catch (err) {
      setMpErrorText(err.message || 'Failed to load league players.');
    } finally {
      setMpBusyText('');
    }
  }

  function startLeagueMultiplayerFlow() {
    if (!leagueGameCode) return;
    cleanupRoomSubscription();
    cleanupChatSubscription();
    resetMultiplayerState();
    setLeaguePointsNotice('');
    mpLeagueSavedRoundRef.current = '';
    setScreen('mpChoice');
  }

  function toggleLeaguePlayerSelection(name) {
    setLeagueSelectedPlayers((prev) => {
      const exists = prev.some((item) => normalizeNameKey(item) === normalizeNameKey(name));
      if (exists) {
        return prev.filter((item) => normalizeNameKey(item) !== normalizeNameKey(name));
      }
      return [...prev, name];
    });
  }

  async function addLeaguePlayer() {
    const trimmed = leagueAddPlayerInput.trim();
    if (!trimmed) return;
    const duplicate = leagueAllPlayers.some((name) => normalizeNameKey(name) === normalizeNameKey(trimmed));
    if (duplicate) {
      setLeagueAddPlayerInput('');
      return;
    }

    if (leagueGameCode) {
      setMpBusyText('Adding player...');
      try {
        await League.addLeagueMember(leagueGameCode, trimmed);
        const members = await League.getLeagueMembers(leagueGameCode);
        setLeagueMembers(members);
        setLeagueExtraPlayers([]);
        setLeagueSelectedPlayers((prev) => {
          const exists = prev.some((name) => normalizeNameKey(name) === normalizeNameKey(trimmed));
          if (exists) return prev;
          return [...prev, trimmed];
        });
      } catch (err) {
        setMpErrorText(err.message || 'Failed to add player.');
      } finally {
        setMpBusyText('');
      }
      setLeagueAddPlayerInput('');
      return;
    }

    setLeagueExtraPlayers((prev) => [...prev, trimmed]);
    setLeagueSelectedPlayers((prev) => [...prev, trimmed]);
    setLeagueAddPlayerInput('');
  }

  function confirmLeaguePlayers() {
    if (leagueSelectedCount < 3) return;
    const selectedSet = new Set(leagueSelectedPlayers.map((name) => normalizeNameKey(name)));
    const orderedSelected = leagueAllPlayers.filter((name) => selectedSet.has(normalizeNameKey(name)));
    const normalized = normalizePlayers(orderedSelected);
    setLeaguePointsNotice('');
    setLocalLeagueSavedRoundSignature('');
    localLeagueSavingRef.current = '';
    setPlayers(normalized);
    setImposterCount(Math.max(1, Math.min(leagueImposterCount, Math.floor((normalized.length - 1) / 2))));
    setRound(null);
    setSelectedCategory(null);
    setModal(initialModal);
    setScreen('gameType');
  }

  function updateLeagueImposterCount(nextCount) {
    const bounded = Math.max(1, Math.min(leagueMaxImposters, nextCount));
    setLeagueImposterCount(bounded);
  }

  function randomizeLeagueImposters() {
    if (leagueSelectedCount < 3) return;
    setLeagueImposterCount(getRandomInt(1, leagueMaxImposters));
  }

  async function saveLeagueEntries(leagueCode, entries) {
    if (!leagueCode) return;
    for (const entry of entries) {
      if (entry.points > 0) {
        await League.addPoints(leagueCode, entry.name, entry.points, entry.isWin);
      } else {
        await League.recordGame(leagueCode, entry.name);
      }
    }
  }

  async function refreshRoundLeagueStandings(leagueCode) {
    if (!leagueCode) {
      setLeagueRoundStandings([]);
      return [];
    }
    const detail = await League.getLeagueDetail(leagueCode);
    const standings = detail?.standings || [];
    setLeagueRoundStandings(standings);
    return standings;
  }

  async function closeLocalResultsModal() {
    if (!isLeagueGame || !leagueGameCode || !modal.summary) {
      setModal(initialModal);
      return;
    }

    if (localLeagueRoundSaved) {
      setModal(initialModal);
      return;
    }

    if (localSavingScores || localLeagueSavingRef.current === localLeagueRoundSignature) {
      return;
    }

    setLocalSavingScores(true);
    setMpBusyText('Saving league points...');
    try {
      const entries = localLeagueEntriesFromSummary(modal.summary);
      await saveLeagueEntries(leagueGameCode, entries);
      const signature = localLeagueRoundSignature || `${leagueGameCode}|manual-${Date.now()}`;
      localLeagueSavingRef.current = '';
      setLocalLeagueSavedRoundSignature(signature);
      await refreshRoundLeagueStandings(leagueGameCode);
      setLeaguePointsNotice(`Points saved to 🏆 ${leagueGameName || 'League'}`);
      setModal(initialModal);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to save league points.');
    } finally {
      setLocalSavingScores(false);
      setMpBusyText('');
    }
  }

  function resetMultiplayerState() {
    setMpRoomData(null);
    setMpMyPlayerId(null);
    setMpRoomCode('');
    setMpSelectedVote(null);
    setMpRevealed(false);
    setMpAnswerInput('');
    setMpJoinError('');
    setMpErrorText('');
    setMpBusyText('');
    setMpChatMessages([]);
    setMpChatInput('');
    setMpChatOpen(false);
    setMpChatUnread(0);
    mpChatCountRef.current = 0;
    mpChatOpenRef.current = false;
    mpChatInitializedRef.current = false;
    mpAutoShowResultsRef.current = false;
    mpLeagueSavedRoundRef.current = '';
  }

  function cleanupRoomSubscription() {
    if (mpRoomUnsubscribeRef.current) {
      mpRoomUnsubscribeRef.current();
      mpRoomUnsubscribeRef.current = null;
    }
  }

  function cleanupChatSubscription() {
    if (mpChatUnsubscribeRef.current) {
      mpChatUnsubscribeRef.current();
      mpChatUnsubscribeRef.current = null;
    }
    mpChatInitializedRef.current = false;
  }

  function handleRoomUpdate(data) {
    if (!data) {
      cleanupRoomSubscription();
      cleanupChatSubscription();
      resetMultiplayerState();
      setMpErrorText('The room was closed by the host.');
      if (isLeagueGame) {
        setScreen('leaguePlay');
      } else {
        setScreen('welcome');
      }
      return;
    }

    setMpRoomData(data);

    if (data.status === 'lobby') {
      setLeaguePointsNotice('');
      if (screenRef.current !== 'mpCategory') {
        setScreen('mpLobby');
      }
      mpAutoShowResultsRef.current = false;
    } else if (data.status === 'playing') {
      setLeaguePointsNotice('');
      const stayOnDiscussion = screenRef.current === 'mpDiscussion';
      if (!stayOnDiscussion) {
        setScreen('mpWord');
      }
      setMpSelectedVote(null);
    } else if (data.status === 'voting') {
      setLeaguePointsNotice('');
      setMpSelectedVote(null);
      setScreen('mpVoting');
      mpAutoShowResultsRef.current = false;
    } else if (data.status === 'results') {
      setScreen('mpResults');
      setMpSelectedVote(null);
      setMpRevealed(false);
    }
  }

  useEffect(() => {
    if (mpRoomData?.status === 'playing' && mpPlayingAllReady) {
      setScreen('mpDiscussion');
    }
  }, [mpRoomData?.status, mpPlayingAllReady]);

  useEffect(() => {
    if (mpRoomData?.status !== 'voting') {
      mpAutoShowResultsRef.current = false;
      return;
    }

    if (mpIsHost && mpVotingAllVoted && !mpAutoShowResultsRef.current) {
      mpAutoShowResultsRef.current = true;
      MP.showResults().catch((err) => {
        setMpErrorText(err.message || 'Failed to show results.');
      });
    }
  }, [mpRoomData?.status, mpIsHost, mpVotingAllVoted]);

  useEffect(() => {
    if (!localLeagueRoundSignature || !modal.summary) return;
    if (localLeagueSavedRoundSignature === localLeagueRoundSignature) return;
    if (localLeagueSavingRef.current === localLeagueRoundSignature) return;

    let cancelled = false;
    localLeagueSavingRef.current = localLeagueRoundSignature;
    async function persistLocalLeagueRound() {
      setLocalSavingScores(true);
      setMpBusyText('Saving league points...');
      try {
        const entries = localLeagueEntriesFromSummary(modal.summary);
        await saveLeagueEntries(leagueGameCode, entries);
        if (cancelled) return;
        setLocalLeagueSavedRoundSignature(localLeagueRoundSignature);
        await refreshRoundLeagueStandings(leagueGameCode);
        if (cancelled) return;
        localLeagueSavingRef.current = '';
        setLeaguePointsNotice(`Points saved to 🏆 ${leagueGameName || 'League'}`);
      } catch (err) {
        if (!cancelled) {
          localLeagueSavingRef.current = '';
          setMpErrorText(err.message || 'Failed to save league points.');
        }
      } finally {
        if (!cancelled) {
          setLocalSavingScores(false);
          setMpBusyText('');
        }
      }
    }

    persistLocalLeagueRound();
    return () => {
      cancelled = true;
    };
  }, [localLeagueRoundSignature, modal.summary, leagueGameCode, leagueGameName]);

  useEffect(() => {
    if (!mpLeagueRoundSignature) return;
    if (mpLeagueSavedRoundRef.current === mpLeagueRoundSignature) return;

    let cancelled = false;
    async function persistLeagueRound() {
      setMpBusyText('Saving league points...');
      try {
        const entries = multiplayerLeagueEntries(mpRoomData, mpVoteResults);
        await saveLeagueEntries(leagueGameCode, entries);
        if (cancelled) return;
        mpLeagueSavedRoundRef.current = mpLeagueRoundSignature;
        await refreshRoundLeagueStandings(leagueGameCode);
        if (cancelled) return;
        setLeaguePointsNotice(`Points saved to 🏆 ${leagueGameName || 'League'}`);
      } catch (err) {
        if (!cancelled) {
          setMpErrorText(err.message || 'Failed to save league points.');
        }
      } finally {
        if (!cancelled) {
          setMpBusyText('');
        }
      }
    }

    persistLeagueRound();
    return () => {
      cancelled = true;
    };
  }, [mpLeagueRoundSignature, mpRoomData, mpVoteResults, leagueGameCode, leagueGameName]);

  useEffect(() => {
    if (mpRoomData?.status === 'results') return;
    mpLeagueSavedRoundRef.current = '';
  }, [mpRoomData?.status]);

  useEffect(() => {
    if (screen !== 'mpWord') return;
    if (mpGameType !== 'question') return;
    setMpAnswerInput(mpMyPlayer?.answer || '');
  }, [screen, mpGameType, mpMyPlayer?.answer]);

  useEffect(() => {
    if (screen !== 'mpDiscussion' && screen !== 'mpVoting') {
      setMpChatOpen(false);
    }
  }, [screen]);

  useEffect(() => {
    mpChatOpenRef.current = mpChatOpen;
    if (mpChatOpen) {
      setMpChatUnread(0);
      const timer = setTimeout(() => {
        mpChatInputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [mpChatOpen]);

  useEffect(() => {
    const node = mpChatMessagesRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [mpChatMessages, mpChatOpen]);

  async function subscribeRoom() {
    cleanupRoomSubscription();
    const unsubscribe = MP.subscribeToRoom(handleRoomUpdate);
    if (unsubscribe) {
      mpRoomUnsubscribeRef.current = unsubscribe;
    }
  }

  async function subscribeChat() {
    cleanupChatSubscription();
    mpChatCountRef.current = 0;
    mpChatInitializedRef.current = false;
    const unsubscribe = MP.subscribeToChat((messages) => {
      const nextMessages = Array.isArray(messages) ? messages : [];
      const prevCount = mpChatCountRef.current;
      const nextCount = nextMessages.length;
      const isInitialSnapshot = !mpChatInitializedRef.current;
      mpChatCountRef.current = nextCount;
      mpChatInitializedRef.current = true;

      if (!isInitialSnapshot && !mpChatOpenRef.current && nextCount > prevCount) {
        setMpChatUnread((prev) => prev + (nextCount - prevCount));
      }
      if (mpChatOpenRef.current) {
        setMpChatUnread(0);
      }
      setMpChatMessages(nextMessages);
    });
    if (unsubscribe) {
      mpChatUnsubscribeRef.current = unsubscribe;
    }
  }

  async function createMultiplayerRoom() {
    const name = mpHostName.trim();
    if (!name) return;

    setMpJoinError('');
    setMpErrorText('');
    setMpBusyText('Creating room...');

    try {
      await ensureGuestAuth();
      const { roomCode, playerId } = await MP.createRoom(name, 1, 'word');
      setMpRoomCode(roomCode);
      setMpMyPlayerId(playerId);
      await subscribeRoom();
      await subscribeChat();
      setScreen('mpLobby');
    } catch (err) {
      setMpErrorText(err.message || 'Failed to create room.');
    } finally {
      setMpBusyText('');
    }
  }

  async function joinMultiplayerRoom() {
    const code = mpJoinCode.trim().toUpperCase();
    const name = mpJoinName.trim();

    if (!code || code.length !== 6) {
      setMpJoinError('Please enter a valid 6-character room code.');
      return;
    }
    if (!name) {
      setMpJoinError('Please enter your name.');
      return;
    }

    setMpJoinError('');
    setMpErrorText('');
    setMpBusyText('Joining room...');

    try {
      await ensureGuestAuth();
      const { roomCode, playerId } = await MP.joinRoom(code, name);
      setMpRoomCode(roomCode);
      setMpMyPlayerId(playerId);
      await subscribeRoom();
      await subscribeChat();
      setScreen('mpLobby');
    } catch (err) {
      setMpJoinError(err.message || 'Failed to join room.');
    } finally {
      setMpBusyText('');
    }
  }

  async function leaveMultiplayerRoom(forceHome = false) {
    setMpBusyText('Leaving room...');
    try {
      await MP.leaveRoom();
    } catch {
      // Ignore leave errors; local state cleanup still needed.
    } finally {
      cleanupRoomSubscription();
      cleanupChatSubscription();
      resetMultiplayerState();
      setMpBusyText('');
      setLeaguePointsNotice('');
      if (forceHome) {
        clearLeagueGameState();
        setScreen(authUser ? 'welcome' : 'onboarding');
      } else if (isLeagueGame) {
        setScreen('leaguePlay');
      } else {
        setScreen('welcome');
      }
    }
  }

  async function copyRoomCode() {
    const code = mpRoomCode || MP.getRoomCode();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMpCopiedCode(true);
      setTimeout(() => setMpCopiedCode(false), 1600);
    } catch {
      setMpErrorText('Copy failed.');
    }
  }

  async function updateMpImposterCount(nextCount) {
    if (!mpIsHost) return;
    const bounded = Math.max(1, Math.min(mpMaxImposters, nextCount));
    try {
      await MP.updateImposterCount(bounded);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to update imposter count.');
    }
  }

  async function randomizeMpImposters() {
    if (!mpIsHost) return;
    const count = getRandomInt(1, mpMaxImposters);
    await updateMpImposterCount(count);
  }

  async function setMpGameType(nextType) {
    if (!mpIsHost) return;
    try {
      await MP.setGameType(nextType);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to update game mode.');
    }
  }

  async function setMpCategory(categoryKey) {
    if (!mpIsHost) return;
    setMpBusyText('Updating category...');
    try {
      await MP.setCategory(categoryKey);
      setScreen('mpLobby');
    } catch (err) {
      setMpErrorText(err.message || 'Failed to update category.');
    } finally {
      setMpBusyText('');
    }
  }

  async function startMultiplayerGame() {
    if (!mpIsHost || !mpRoomData) return;
    if (mpPlayerCount < 3) {
      setMpErrorText('Need at least 3 players to start.');
      return;
    }

    const gt = mpRoomData.gameType || 'word';
    let category = mpRoomData.category || (gt === 'question' ? 'q:twistAndTurn' : 'countries');
    const impCount = mpRoomData.imposterCount || 1;

    setMpBusyText('Starting game...');
    try {
      setLeaguePointsNotice('');
      mpLeagueSavedRoundRef.current = '';
      if (gt === 'question') {
        if (!category.startsWith('q:')) category = 'q:twistAndTurn';
        const qKey = category.slice(2);
        const pair = pickQuestionPair(qKey, questionCategories);
        await MP.startGame(category, null, impCount, 'question', pair);
      } else {
        const custom = readCustomCategories();
        const word = getRandomWord(category, categories, custom);
        await MP.startGame(category, word, impCount, 'word');
      }
    } catch (err) {
      setMpErrorText(err.message || 'Failed to start game.');
    } finally {
      setMpBusyText('');
    }
  }

  async function startMultiplayerNewRound() {
    if (!mpIsHost || !mpRoomData) return;
    if (mpPlayerCount < 3) {
      setMpErrorText('Need at least 3 players to start a new round.');
      return;
    }

    const gt = mpRoomData.gameType || 'word';
    let category = mpRoomData.category || (gt === 'question' ? 'q:twistAndTurn' : 'countries');
    const impCount = mpRoomData.imposterCount || 1;

    setMpBusyText('Starting new round...');
    try {
      setLeaguePointsNotice('');
      mpLeagueSavedRoundRef.current = '';
      if (gt === 'question') {
        if (!category.startsWith('q:')) category = 'q:twistAndTurn';
        const qKey = category.slice(2);
        const pair = pickQuestionPair(qKey, questionCategories);
        await MP.startGame(category, null, impCount, 'question', pair);
      } else {
        const custom = readCustomCategories();
        const word = getRandomWord(category, categories, custom);
        await MP.startGame(category, word, impCount, 'word');
      }
    } catch (err) {
      setMpErrorText(err.message || 'Failed to start new round.');
    } finally {
      setMpBusyText('');
    }
  }

  async function returnMpToLobby() {
    if (!mpIsHost) return;
    setMpBusyText('Returning to lobby...');
    try {
      setLeaguePointsNotice('');
      mpLeagueSavedRoundRef.current = '';
      await MP.returnToLobby();
    } catch (err) {
      setMpErrorText(err.message || 'Failed to return to lobby.');
    } finally {
      setMpBusyText('');
    }
  }

  async function toggleMpLobbyReady() {
    try {
      await MP.toggleLobbyReady();
    } catch (err) {
      setMpErrorText(err.message || 'Failed to update ready status.');
    }
  }

  async function toggleMpReveal() {
    if (!mpRoomData) return;
    if (mpGameType === 'question') {
      setMpRevealed(true);
      return;
    }

    setMpRevealed((prev) => {
      const next = !prev;
      if (next) {
        MP.markWordSeen().catch(() => {
          // best effort
        });
      }
      return next;
    });
  }

  async function markMpReady() {
    try {
      await MP.markReady();
    } catch (err) {
      setMpErrorText(err.message || 'Failed to mark ready.');
    }
  }

  async function submitMpAnswer() {
    if (!mpAnswerInput.trim()) return;
    try {
      await MP.submitAnswer(mpAnswerInput.trim());
    } catch (err) {
      setMpErrorText(err.message || 'Failed to submit answer.');
    }
  }

  async function startMpVoting() {
    if (!mpIsHost) return;
    setMpBusyText('Starting voting...');
    try {
      await MP.startVoting();
    } catch (err) {
      setMpErrorText(err.message || 'Failed to start voting.');
    } finally {
      setMpBusyText('');
    }
  }

  async function submitMpVote() {
    if (!mpSelectedVote) return;
    try {
      await MP.castVote(mpSelectedVote);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to submit vote.');
    }
  }

  async function skipMpVote() {
    try {
      await MP.castVote('skip');
    } catch (err) {
      setMpErrorText(err.message || 'Failed to skip vote.');
    }
  }

  async function setMpAnonymousVoting(enabled) {
    if (!mpIsHost) return;
    try {
      await MP.setAnonymousVoting(enabled);
    } catch (err) {
      setMpErrorText(err.message || 'Failed to update anonymous voting.');
    }
  }

  async function sendMpChatMessage() {
    const text = mpChatInput.trim();
    if (!text) return;
    try {
      await MP.sendChatMessage(text);
      setMpChatInput('');
    } catch (err) {
      setMpErrorText(err.message || 'Failed to send message.');
    }
  }

  function startGameType(type) {
    setGameType(type);
    setLeaguePointsNotice('');
    if (players.length === 0) {
      setPlayers([...DEFAULT_PLAYERS]);
    }
    setScreen('players');
  }

  function updatePlayer(index, value) {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addPlayer() {
    setPlayers((prev) => [...prev, `Player ${prev.length + 1}`]);
  }

  function removePlayer(index) {
    setPlayers((prev) => {
      if (prev.length <= 3) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }

  function buildRound(categoryKey) {
    const latestCustomCategories = readCustomCategories();
    const normalized = normalizePlayers(players);

    const nextRound = createLocalRound({
      gameType,
      selectedCategory: categoryKey,
      players: normalized,
      imposterCount,
      categories,
      questionCategories,
      customCategories: latestCustomCategories,
      getRandomQuestion: (key) => toQuestionPair(key, questionCategories),
      cryptoObj: window.crypto,
    });

    setPlayers(normalized);
    setCustomCategories(latestCustomCategories);
    setSelectedCategory(categoryKey);
    setRound(nextRound);
    setFirstSpeakerIndex(getRandomInt(0, Math.max(0, normalized.length - 1)));
    setModal(initialModal);
    setLeaguePointsNotice('');
    setScreen('reveal');
  }

  function toggleRevealCard() {
    setRound((prev) => {
      if (!prev) return prev;
      if (gameType === 'question' && prev.isRevealed) return prev;
      return { ...prev, isRevealed: !prev.isRevealed };
    });
  }

  function updateCurrentAnswer(value) {
    setRound((prev) => {
      if (!prev) return prev;
      const nextAnswers = [...prev.playerAnswers];
      nextAnswers[currentRevealIndex] = value;
      return { ...prev, playerAnswers: nextAnswers };
    });
  }

  function nextPlayer() {
    setRound((prev) => {
      if (!prev || !prev.isRevealed) return prev;

      if (gameType === 'question') {
        const answer = (prev.playerAnswers[currentRevealIndex] || '').trim();
        if (!answer) return prev;
      }

      if (prev.currentRevealIndex >= normalizedPlayers.length - 1) {
        setScreen('game');
        return prev;
      }

      return {
        ...prev,
        currentRevealIndex: prev.currentRevealIndex + 1,
        isRevealed: false,
      };
    });
  }

  function revealAnswerFlow() {
    setModal({
      open: true,
      step: 'vote',
      votedPlayers: [],
      guesses: {},
      summary: null,
    });
  }

  function toggleVote(index) {
    setModal((prev) => {
      const exists = prev.votedPlayers.includes(index);
      const votedPlayers = exists
        ? prev.votedPlayers.filter((item) => item !== index)
        : [...prev.votedPlayers, index];
      return { ...prev, votedPlayers };
    });
  }

  function finalizeRound(votedPlayers, guesses) {
    if (!round) return;
    const summary = {
      ...scoreRoundSummary(round, normalizedPlayers, votedPlayers, guesses, gameType),
      roundKey: Date.now(),
    };

    setModal((prev) => ({
      ...prev,
      open: true,
      step: 'results',
      summary,
      votedPlayers,
      guesses,
    }));
  }

  function confirmVote() {
    if (modal.votedPlayers.length === 0) return;
    if (gameType === 'question') {
      finalizeRound(modal.votedPlayers, {});
      return;
    }
    setModal((prev) => ({ ...prev, step: 'guess' }));
  }

  function skipVote() {
    if (gameType === 'question') {
      finalizeRound([], {});
      return;
    }
    setModal((prev) => ({ ...prev, votedPlayers: [], step: 'guess' }));
  }

  function submitGuesses() {
    finalizeRound(modal.votedPlayers, modal.guesses);
  }

  function skipGuesses() {
    finalizeRound(modal.votedPlayers, {});
  }

  function updateGuess(idx, value) {
    setModal((prev) => ({
      ...prev,
      guesses: {
        ...prev.guesses,
        [idx]: value,
      },
    }));
  }

  const questionCategoryEntries = Object.entries(questionCategories);
  const wordCategoryEntries = Object.entries(categories);

  if (isLoading) {
    return (
      <div className="react-loader-shell">
        <div className="react-loader-card">
          <div className="react-loader-icon">🕵️</div>
          <h2>Loading Game</h2>
          <p>Preparing categories and game data</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="react-loader-shell">
        <div className="react-loader-card">
          <div className="react-loader-icon">⚠️</div>
          <h2>Data Load Error</h2>
          <p>{loadError}</p>
          <a href={legacyHref} className="btn btn-secondary btn-large" style={{ marginTop: '1rem', display: 'inline-flex' }}>
            Open Legacy App
          </a>
        </div>
      </div>
    );
  }

  return (
    <div id="app">
      <div className="bg-gradient" />
      <div className="bg-particles" />

      {mpBusyText ? (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>{mpBusyText}</p>
        </div>
      ) : null}

      {mpErrorText ? (
        <div style={{ position: 'fixed', top: '12px', left: '12px', right: '12px', zIndex: 9999 }}>
          <div className="form-error" style={{ display: 'block' }}>{mpErrorText}</div>
        </div>
      ) : null}

      <button className="btn-home-global" onClick={goHome} aria-label="Go home">
        <span>🏠</span>
        <span>Home</span>
      </button>

      <section className={`screen ${screen === 'onboarding' ? 'active' : ''}`}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="logo-container" style={{ marginBottom: '2rem' }}>
            <div className="logo-icon blur-glow">🕵️</div>
            <h1 className="logo-text">Secret Word</h1>
            <p className="logo-subtitle">IMPOSTER</p>
          </div>

          <div className="onboarding-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px', margin: '0 auto' }}>
            <button type="button" className="btn btn-primary btn-large" disabled={authBusy.length > 0} onClick={continueWithGoogle}>
              <span>{authBusy === 'google' ? 'Connecting...' : 'Log In With Google'}</span>
            </button>
            <button type="button" className="btn btn-secondary btn-large" disabled={authBusy.length > 0} onClick={continueWithGoogle}>
              <span>{authBusy === 'google' ? 'Connecting...' : 'Create Account'}</span>
            </button>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '0.5rem 0', fontSize: '0.9rem' }}>- or -</div>
            <button
              type="button"
              className="btn btn-ghost btn-large"
              disabled={authBusy.length > 0}
              style={{ background: 'rgba(255, 255, 255, 0.05)' }}
              onClick={continueAsGuest}
            >
              <span>{authBusy === 'guest' ? 'Connecting...' : 'Continue as Guest'}</span>
            </button>
          </div>

          {authError ? <p className="form-error" style={{ display: 'block', marginTop: '1rem' }}>{authError}</p> : null}

          <a href={legacyHref} className="btn btn-ghost" style={{ marginTop: '1rem', alignSelf: 'center' }}>Open Legacy App</a>
        </div>
      </section>

      <section className={`screen ${screen === 'welcome' ? 'active' : ''}`}>
        <div className="container">
          <div className="auth-strip">
            <button
              className="auth-avatar-btn"
              title="Account"
              onClick={() => {
                const user = Auth.getCurrentUser();
                if (user && !user.isAnonymous) {
                  openProfileScreen();
                } else {
                  setScreen('onboarding');
                }
              }}
            >
              <span>{authAvatarEmoji}</span>
              <span className="auth-display-name">{authDisplayName}</span>
            </button>
          </div>

          <div className="logo-container">
            <div className="logo-icon">🕵️</div>
            <h1 className="logo-text">Secret Word</h1>
            <p className="logo-subtitle">IMPOSTER</p>
          </div>
          <p className="tagline">Find the imposter among your friends!</p>

          <div className="mode-selection">
            <button className="mode-card" onClick={() => { clearLeagueGameState(); setScreen('gameType'); }}>
              <div className="mode-icon">📱</div>
              <div className="mode-name">Local Mode</div>
              <div className="mode-desc">Pass the phone</div>
            </button>
            <button className="mode-card" onClick={() => { clearLeagueGameState(); setScreen('mpChoice'); }}>
              <div className="mode-icon">🌐</div>
              <div className="mode-name">Multiplayer</div>
              <div className="mode-desc">Play online</div>
            </button>
          </div>

          <div className="home-action-row">
            <button className="btn btn-league" onClick={() => openLeagueHub()}>
              <span className="league-btn-icon">🏆</span>
              <span>Leagues</span>
            </button>
            <button className="btn btn-custom-cat" onClick={openCustomCategoryHub}>
              <span className="league-btn-icon">🎨</span>
              <span>My Categories</span>
            </button>
          </div>

          <div className="how-to-play">
            <h3>How to Play</h3>
            <ol>
              <li>Add all players and choose a category</li>
              <li>Each player sees their word privately</li>
              <li>One player is the imposter with no word</li>
              <li>Discuss and vote to find the imposter</li>
            </ol>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'profile' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('welcome')}>←</button>
            <h2>👤 Profile</h2>
            <div className="spacer" />
          </div>

          <div className="profile-card">
            <div className="profile-avatar-large">{profileIsAnonymous ? '👤' : '🟣'}</div>
            <div className="profile-name-display">{profileDisplayName}</div>
            <div className="profile-status-badge">
              {profileIsAnonymous ? '👤 Guest' : '✅ Google Account'}
            </div>
          </div>

          <div className="profile-actions">
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <div className="form-row">
                <input
                  type="text"
                  className="form-input"
                  value={profileNameInput}
                  onChange={(e) => setProfileNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveProfileName();
                    }
                  }}
                  maxLength={24}
                  placeholder="Your name"
                />
                <button className="btn btn-secondary btn-small" disabled={profileSavingName} onClick={saveProfileName}>
                  {profileSavingName ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {profileIsAnonymous ? (
              <div id="profile-upgrade-section">
                <p className="profile-upgrade-hint">Link a Google account to sync your data across devices.</p>
                <button className="btn-google" disabled={profileGoogleBusy} onClick={linkGoogleAccount}>
                  {profileGoogleBusy ? '⏳ Opening Google...' : '🔗 Link Google Account'}
                </button>
              </div>
            ) : null}
          </div>

          {profileStatsVisible ? (
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="profile-stat-value">{profileStats.games}</span>
                <span className="profile-stat-label">Games</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profileStats.wins}</span>
                <span className="profile-stat-label">Wins</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profileStats.points}</span>
                <span className="profile-stat-label">Points</span>
              </div>
            </div>
          ) : null}

          <button className="btn btn-ghost btn-danger-text" style={{ marginTop: 'auto' }} onClick={signOutFromProfile}>
            Sign Out
          </button>
          {authError ? <p className="form-error" style={{ display: 'block', marginTop: '0.75rem' }}>{authError}</p> : null}
        </div>
      </section>

      <section className={`screen ${screen === 'customCat' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('welcome')}>←</button>
            <h2>🎨 My Categories</h2>
            <div className="spacer" />
          </div>

          <div className="custom-cat-actions">
            <button className="btn btn-primary btn-large" onClick={openCreateCustomCategory}>
              + Create Category
            </button>
            <button className="btn btn-secondary btn-large" onClick={openCommunityHub}>
              🌐 Community Hub
            </button>
          </div>

          <div className="my-categories-list">
            {customCategories.map((cat) => {
              const listAction = customListActionById[cat.id] || '';
              const isPublishing = listAction.startsWith('publish:');
              const isDeleting = listAction.startsWith('delete:');
              return (
                <div key={cat.id} className="my-cat-card">
                  <div className="my-cat-info">
                    <span className="my-cat-icon">{cat.icon || '📝'}</span>
                    <div>
                      <div className="my-cat-name">{cat.name}</div>
                      <div className="my-cat-meta">
                        {(cat.words || []).length} words{cat.communityId ? ' · 🌐 Published' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="my-cat-actions">
                    {!cat.communityId ? (
                      <button
                        className="btn btn-primary btn-small"
                        title="Publish to Community Hub"
                        disabled={isPublishing || isDeleting}
                        onClick={() => publishFromCustomHub(cat)}
                      >
                        {isPublishing ? '⏳' : '⬆️'}
                      </button>
                    ) : null}
                    <button className="btn btn-ghost btn-small" disabled={isDeleting} onClick={() => openEditCustomCategory(cat)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-small btn-danger-text" disabled={isDeleting || isPublishing} onClick={() => deleteCustomCategory(cat.id)}>
                      {isDeleting ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {customCategories.length === 0 ? (
            <div className="custom-cat-empty">
              <div className="empty-icon">📭</div>
              <p>No custom categories yet.</p>
              <p className="empty-hint">Create one or import from Community Hub.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`screen ${screen === 'customCreate' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('customCat')}>←</button>
            <h2>{customFormMode === 'edit' ? 'Edit Category' : 'Create Category'}</h2>
            <div className="spacer" />
          </div>

          <div className="form-container">
            <div className="form-group">
              <label className="form-label">Icon</label>
              <div className="emoji-picker">
                {CUSTOM_CATEGORY_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`emoji-option ${customCategoryIcon === emoji ? 'selected' : ''}`}
                    onClick={() => setCustomCategoryIcon(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Category Name</label>
              <input
                type="text"
                className="form-input"
                value={customCategoryNameInput}
                onChange={(e) => setCustomCategoryNameInput(e.target.value)}
                placeholder="e.g. Roman Emperors"
                maxLength={30}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Words <span className="word-count-badge">{customWords.length}</span>
              </label>
              <div className="word-add-row">
                <input
                  type="text"
                  className="form-input"
                  value={customWordInput}
                  onChange={(e) => setCustomWordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomWord();
                    }
                  }}
                  placeholder="Type a word and press Add"
                  maxLength={40}
                />
                <button className="btn btn-secondary btn-small" onClick={addCustomWord}>Add</button>
              </div>
              <div className="ai-generate-row">
                <select className="ai-difficulty-select" value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  disabled={aiGenerating || aiGeneratingMore}
                  onClick={() => generateCustomWords(20)}
                >
                  <span className="ai-btn-icon">{aiGenerating ? '⏳' : '✨'}</span>
                  <span>{aiGenerating ? 'Generating...' : 'Generate with AI'}</span>
                </button>
                {customWords.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={aiGenerating || aiGeneratingMore}
                    onClick={() => generateCustomWords(10)}
                  >
                    <span className="ai-btn-icon">{aiGeneratingMore ? '⏳' : '➕'}</span>
                    <span>{aiGeneratingMore ? 'Generating...' : 'Generate More'}</span>
                  </button>
                ) : null}
              </div>
              <div className="word-chip-list">
                {customWords.map((word, idx) => (
                  <span key={`${word}-${idx}`} className="word-chip">
                    {word}
                    <button className="word-chip-remove" onClick={() => removeCustomWord(idx)}>&times;</button>
                  </span>
                ))}
              </div>
              <p className="form-hint">Add at least 5 words. Aim for 20+.</p>
            </div>

            <div className="form-group publish-section">
              <label className="form-label">Share with Community</label>
              <div className="form-row">
                <input
                  type="text"
                  className="form-input"
                  value={customAuthorNameInput}
                  onChange={(e) => setCustomAuthorNameInput(e.target.value)}
                  placeholder="Your name (optional)"
                  maxLength={20}
                />
                <button className="btn btn-secondary btn-small" disabled={!canSaveCustomCategory} onClick={publishCustomCategory}>
                  Publish 🌐
                </button>
              </div>
              {customPublishStatus ? <p className="publish-status">{customPublishStatus}</p> : null}
            </div>

            {customCreateError ? <div className="form-error" style={{ display: 'block' }}>{customCreateError}</div> : null}

            <button className="btn btn-primary btn-large" disabled={!canSaveCustomCategory} onClick={saveCustomCategory}>
              Save Category
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'community' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('customCat')}>←</button>
            <h2>🌐 Community</h2>
            <div className="spacer" />
          </div>

          <div className="community-search-row">
            <input
              type="text"
              className="form-input"
              value={communitySearchInput}
              onChange={(e) => setCommunitySearchInput(e.target.value)}
              placeholder="🔍 Search categories..."
            />
          </div>

          {communityLoading ? (
            <div className="community-loading">
              <div className="waiting-spinner" />
              <span>Loading categories...</span>
            </div>
          ) : null}

          {!communityLoading ? (
            <div className="community-list">
              {filteredCommunityCategories.map((cat) => {
                const voted = !!communityVotedById[cat.id];
                const action = communityActionById[cat.id] || '';
                const upvoting = action === 'upvote';
                const importing = action === 'import';
                const imported = action === 'imported';
                return (
                  <div key={cat.id} className="community-card">
                    <div className="community-card-header">
                      <span className="community-card-icon">{cat.icon || '📝'}</span>
                      <div className="community-card-info">
                        <div className="community-card-name">{cat.name}</div>
                        <div className="community-card-meta">
                          by {cat.authorName || 'Anonymous'} · {(cat.words || []).length} words
                        </div>
                      </div>
                    </div>
                    <div className="community-card-footer">
                      <button
                        className={`btn-upvote ${voted ? 'voted' : ''}`}
                        disabled={voted || upvoting}
                        onClick={() => upvoteCommunityCategory(cat.id)}
                      >
                        👍 <span className="upvote-count">{cat.upvotes || 0}</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-small"
                        disabled={importing || imported}
                        onClick={() => importCommunityCategory(cat.id)}
                      >
                        {imported ? '✅ Imported' : (importing ? '⏳ Importing...' : '⬇️ Import')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!communityLoading && filteredCommunityCategories.length === 0 ? (
            <div className="custom-cat-empty">
              <div className="empty-icon">🌐</div>
              <p>No community categories found.</p>
              <p className="empty-hint">Try another search or publish your own category.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`screen ${screen === 'leagueHub' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('welcome')}>←</button>
            <h2>🏆 Leagues</h2>
            <div className="spacer" />
          </div>

          <div className="league-hub-actions">
            <button className="btn btn-primary btn-large" onClick={() => openLeagueForm('create')}>+ Create League</button>
            <button className="btn btn-secondary btn-large" onClick={() => openLeagueForm('join')}>🔗 Join League</button>
          </div>

          <div className="league-hub-list">
            {leagueJoined.map((league) => (
              <button
                key={league.code}
                className="league-hub-card"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => openLeagueDetail(league.code)}
              >
                <div className="league-hub-card-info">
                  <span className="league-hub-card-name">🏆 {league.name}</span>
                  <span className="league-hub-card-code">
                    {league.isLocal ? 'Offline League' : league.code}
                    {league.isAdmin ? ' · Admin' : ''}
                  </span>
                </div>
                <span className="league-hub-card-arrow">›</span>
              </button>
            ))}
          </div>

          {leagueJoined.length === 0 ? (
            <div className="league-empty">
              <p>No leagues yet!</p>
              <p className="league-empty-sub">Create a league or join one with a code.</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`screen ${screen === 'leagueForm' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => openLeagueHub()}>←</button>
            <h2>{leagueFormMode === 'create' ? 'Create League' : 'Join League'}</h2>
            <div className="spacer" />
          </div>

          <div className="league-form">
            {leagueFormMode === 'create' ? (
              <>
                <label className="form-label">League Type</label>
                <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    className={`btn btn-small ${leagueCreateMode === 'cloud' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLeagueCreateMode('cloud')}
                  >
                    Cloud (Code)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-small ${leagueCreateMode === 'local' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLeagueCreateMode('local')}
                  >
                    Local Offline
                  </button>
                </div>

                <label className="form-label">League Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={leagueNameInput}
                  onChange={(e) => setLeagueNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitLeagueForm();
                    }
                  }}
                  placeholder="e.g. Friday Night Crew"
                  maxLength={30}
                />

                <label className="form-label" style={{ marginTop: '1rem' }}>Saved Players (Optional)</label>
                <div className="league-add-player-row">
                  <input
                    type="text"
                    className="form-input"
                    value={leagueSeedPlayerInput}
                    onChange={(e) => setLeagueSeedPlayerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLeagueSeedPlayer();
                      }
                    }}
                    placeholder="Add player name..."
                    maxLength={20}
                  />
                  <button type="button" className="btn btn-secondary btn-small" disabled={!leagueSeedCanAdd} onClick={addLeagueSeedPlayer}>
                    + Add
                  </button>
                </div>
                <div className="league-members-list" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                  {leagueSeedPlayers.map((name, idx) => (
                    <div key={`${name}-${idx}`} className="league-member-item selected" style={{ width: '100%', textAlign: 'left' }}>
                      <div className="member-checkbox">✓</div>
                      <span className="member-name">{name}</span>
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => removeLeagueSeedPlayer(idx)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  {leagueSeedPlayers.length === 0 ? (
                    <p className="league-players-hint" style={{ marginBottom: 0 }}>Add names once, then reuse this roster every game.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <label className="form-label">League Code</label>
                <input
                  type="text"
                  className="form-input league-code-field"
                  value={leagueCodeInput}
                  onChange={(e) => setLeagueCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitLeagueForm();
                    }
                  }}
                  placeholder="ABC123"
                  maxLength={6}
                />
              </>
            )}

            {leagueFormError ? <p className="form-error" style={{ display: 'block' }}>{leagueFormError}</p> : null}

            <button className="btn btn-primary btn-large" onClick={submitLeagueForm}>
              {leagueFormMode === 'create'
                ? (leagueCreateMode === 'local' ? 'Create Local League' : 'Create Cloud League')
                : 'Join League'}
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'leagueDetail' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => openLeagueHub()}>←</button>
            <h2>{leagueCurrentName ? `🏆 ${leagueCurrentName}` : 'League'}</h2>
            <div className="spacer" />
          </div>

          {leagueCurrentIsLocal ? (
            <div className="league-code-display">
              <span className="league-code-label">League Type</span>
              <div className="league-code-box">
                <span>Offline (this device)</span>
              </div>
            </div>
          ) : (
            <div className="league-code-display">
              <span className="league-code-label">Share this code</span>
              <div className="league-code-box">
                <span>{leagueCurrentCode || '------'}</span>
                <button className="btn-copy" title="Copy code" onClick={copyLeagueCode}>
                  {leagueCopyDone ? '✅' : '📋'}
                </button>
              </div>
            </div>
          )}

          <div className="league-rules-card">
            <h4>Scoring Rules</h4>
            <ul className="league-rules-list">
              <li><span className="rule-icon">👥</span> Civilians catch imposter <strong>+1 pt</strong> each</li>
              <li><span className="rule-icon">🕵️</span> Imposter survives <strong>+1 pt</strong></li>
              <li><span className="rule-icon">🎯</span> Imposter guesses word <strong>+1 pt</strong></li>
            </ul>
          </div>

          <div className="league-play-action">
            <button className="btn btn-primary btn-large" onClick={openLeaguePlay}>🎮 Play League Game</button>
          </div>

          <div className="league-rules-card">
            <h4>League Players</h4>
            <div className="league-add-player-row" style={{ marginBottom: '0.75rem' }}>
              <input
                type="text"
                className="form-input"
                value={leagueManagePlayerInput}
                onChange={(e) => setLeagueManagePlayerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCurrentLeagueMember();
                  }
                }}
                placeholder={leagueCurrentIsAdmin ? 'Add player to roster...' : 'Roster is admin-managed'}
                maxLength={20}
                disabled={!leagueCurrentIsAdmin}
              />
              <button
                className="btn btn-secondary btn-small"
                disabled={!leagueCurrentIsAdmin || leagueManagePlayerInput.trim().length === 0 || leagueManageBusy.length > 0}
                onClick={addCurrentLeagueMember}
              >
                + Add
              </button>
            </div>
            <div className="league-members-list">
              {leagueCurrentMembers.map((name, idx) => {
                const key = normalizeNameKey(name);
                const isRemoving = leagueManageBusy === `remove:${key}`;
                const isRenaming = leagueManageBusy === `rename:${key}`;
                return (
                  <div key={`${name}-${idx}`} className="league-member-item" style={{ width: '100%', textAlign: 'left' }}>
                    <div className="member-checkbox">👤</div>
                    <span className="member-name">{name}</span>
                    {leagueCurrentIsAdmin ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-ghost btn-small"
                          disabled={leagueManageBusy.length > 0}
                          onClick={() => renameCurrentLeagueMember(name)}
                        >
                          {isRenaming ? '...' : 'Rename'}
                        </button>
                        <button
                          className="btn btn-ghost btn-small btn-danger-text"
                          disabled={leagueManageBusy.length > 0}
                          onClick={() => removeCurrentLeagueMember(name)}
                        >
                          {isRemoving ? '...' : 'Remove'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {leagueCurrentMembers.length === 0 ? (
                <p className="league-players-hint" style={{ marginBottom: 0 }}>No players in this roster yet.</p>
              ) : null}
            </div>
            {!leagueCurrentIsAdmin ? (
              <p className="league-empty-sub" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                This league is read-only for you. Ask an admin to manage the roster.
              </p>
            ) : null}
          </div>

          <div className="league-standings-table">
            {leagueStandings.map((player, index) => {
              const rank = index < 3 ? LEAGUE_MEDALS[index] : `${index + 1}`;
              const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;
              return (
                <div key={`${player.name}-${index}`} className={`league-row ${index < 3 ? `top-${index + 1}` : ''}`}>
                  <span className="league-rank">{rank}</span>
                  <span className="league-name">{player.name}</span>
                  <span className="league-stat league-points">{player.points} pts</span>
                  <span className="league-stat league-games">{player.gamesPlayed} games</span>
                  <span className="league-stat league-winrate">{winRate}%</span>
                </div>
              );
            })}

            {leagueStandings.length === 0 ? (
              <div className="league-empty">
                <p>No games played yet!</p>
                <p className="league-empty-sub">Play a game and record points to this league.</p>
              </div>
            ) : null}
          </div>

          <div className="league-detail-actions">
            {!leagueCurrentIsLocal ? (
              <button className="btn btn-ghost" onClick={leaveCurrentLeague}>Leave League</button>
            ) : null}
            {leagueCurrentIsAdmin ? (
              <button
                className={`btn btn-ghost btn-danger-text ${leagueDeletePending ? 'confirming' : ''}`}
                onClick={deleteCurrentLeague}
              >
                {leagueDeletePending ? '⚠️ Tap again to delete' : (leagueCurrentIsLocal ? 'Delete Local League' : 'Delete League')}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'leaguePlay' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => openLeagueDetail(leagueGameCode || leagueCurrentCode)}>←</button>
            <h2>{leagueGameName ? `🏆 ${leagueGameName}` : 'League Game'}</h2>
            <div className="spacer" />
          </div>

          <p className="league-play-subtitle">Choose how to play</p>

          <div className="mode-selection">
            <button className="mode-card" onClick={startLeagueLocalFlow}>
              <div className="mode-icon">📱</div>
              <div className="mode-name">Local Game</div>
              <div className="mode-desc">Pass the phone</div>
            </button>
            <button className="mode-card" onClick={startLeagueMultiplayerFlow}>
              <div className="mode-icon">🌐</div>
              <div className="mode-name">Multiplayer</div>
              <div className="mode-desc">Play online</div>
            </button>
          </div>

          {leaguePointsNotice ? <p className="league-auto-save-label">{leaguePointsNotice}</p> : null}
        </div>
      </section>

      <section className={`screen ${screen === 'leaguePlayers' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('leaguePlay')}>←</button>
            <h2>Select Players</h2>
            <div className="spacer" />
          </div>

          <p className="league-players-hint">Choose who's playing this round</p>

          <div className="league-members-list">
            {leagueAllPlayers.map((name, index) => {
              const selected = leagueSelectedPlayers.some((item) => normalizeNameKey(item) === normalizeNameKey(name));
              const isMember = index < leagueMembers.length;
              return (
                <button
                  key={`${name}-${index}`}
                  className={`league-member-item ${selected ? 'selected' : ''}`}
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => toggleLeaguePlayerSelection(name)}
                >
                  <div className="member-checkbox">{selected ? '✓' : ''}</div>
                  <span className="member-name">{name}</span>
                  <span className="member-badge" style={!isMember ? { color: 'var(--text-muted)' } : undefined}>
                    {isMember ? 'Member' : 'New'}
                  </span>
                </button>
              );
            })}

            {leagueAllPlayers.length === 0 ? (
              <p className="league-players-hint">No members yet. Add players below.</p>
            ) : null}
          </div>

          <div className="league-add-player-row">
            <input
              type="text"
              className="form-input"
              value={leagueAddPlayerInput}
              onChange={(e) => setLeagueAddPlayerInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLeaguePlayer();
                }
              }}
              placeholder="Add new player..."
              maxLength={20}
            />
            <button className="btn btn-secondary btn-small" onClick={addLeaguePlayer}>+ Add</button>
          </div>

          <div className="league-players-footer">
            <div className="imposter-controls">
              <span className="imposter-label">Imposters:</span>
              <button className="btn-circle" disabled={leagueImposterCount <= 1} onClick={() => updateLeagueImposterCount(leagueImposterCount - 1)}>−</button>
              <span className="imposter-number">{leagueImposterCount}</span>
              <button
                className="btn-circle"
                disabled={leagueSelectedCount < 3 || leagueImposterCount >= leagueMaxImposters}
                onClick={() => updateLeagueImposterCount(leagueImposterCount + 1)}
              >
                +
              </button>
              <button className="btn-circle" title="Randomize" disabled={leagueSelectedCount < 3} onClick={randomizeLeagueImposters}>🎲</button>
            </div>
            <p className="league-player-count">{leagueSelectedCount} players selected</p>
            <button className="btn btn-primary btn-large" disabled={leagueSelectedCount < 3} onClick={confirmLeaguePlayers}>
              Choose Category
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'gameType' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen(isLeagueGame ? 'leaguePlayers' : 'welcome')}>←</button>
            <h2>Choose Game Mode</h2>
            <div className="spacer" />
          </div>
          <div className="mode-selection">
            <button className="mode-card" onClick={() => startGameType('word')}>
              <div className="mode-icon">📝</div>
              <div className="mode-name">Secret Word</div>
              <div className="mode-desc">Classic imposter mode</div>
            </button>
            <button className="mode-card" onClick={() => startGameType('question')}>
              <div className="mode-icon">❓</div>
              <div className="mode-name">Question Imposter</div>
              <div className="mode-desc">One player gets a different question</div>
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'players' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('gameType')}>←</button>
            <h2>Players</h2>
            <div className="player-count-badge">{players.length}</div>
          </div>

          <div className="player-list">
            {players.map((player, index) => (
              <div key={`player-${index}`} className="player-item">
                <div className="player-number">{PLAYER_AVATARS[index % PLAYER_AVATARS.length]}</div>
                <input
                  type="text"
                  className="player-input"
                  value={player}
                  onChange={(e) => updatePlayer(index, e.target.value)}
                  placeholder={`Player ${index + 1}`}
                  maxLength={20}
                />
                <button className="btn-remove-player" title="Remove player" onClick={() => removePlayer(index)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button className="btn btn-secondary btn-add" onClick={addPlayer}>
            <span>Add Player</span>
          </button>

          <div className="imposter-settings">
            <label className="setting-label">
              <span>Number of Imposters</span>
              <div className="stepper">
                <button className="stepper-btn" onClick={() => setImposterCount((prev) => Math.max(1, prev - 1))}>−</button>
                <span>{imposterCount}</span>
                <button className="stepper-btn" onClick={() => setImposterCount((prev) => Math.min(maxImposters, prev + 1))}>+</button>
                <button className="stepper-btn stepper-randomize" onClick={() => setImposterCount(getRandomInt(1, maxImposters))}>🎲</button>
              </div>
            </label>
          </div>

          <button
            className="btn btn-primary btn-large"
            disabled={players.length < 3}
            onClick={() => setScreen('category')}
          >
            <span>Choose Category</span>
          </button>
        </div>
      </section>

      <section className={`screen ${screen === 'category' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('players')}>←</button>
            <h2>Choose Category</h2>
            <div className="spacer" />
          </div>

          <div className="category-grid">
            {gameType === 'question' && questionCategoryEntries.map(([key, category]) => (
              <button
                key={key}
                className="category-card"
                onClick={() => buildRound(`q:${key}`)}
              >
                <div className="category-icon">{category.icon}</div>
                <div className="category-name">{category.name}</div>
                <div className="category-count">{category.questions?.length || 0} questions</div>
              </button>
            ))}

            {gameType === 'word' && customCategories.map((category) => (
              <button
                key={category.id}
                className="category-card custom-category-card"
                onClick={() => buildRound(`custom:${category.id}`)}
              >
                <div className="category-icon">{category.icon || '📝'}</div>
                <div className="category-name">{category.name}</div>
                <div className="category-count">{(category.words || []).length} words</div>
                <div className="custom-category-badge">✏️ Custom</div>
              </button>
            ))}

            {gameType === 'word' && wordCategoryEntries.map(([key, category]) => (
              <button
                key={key}
                className="category-card"
                onClick={() => buildRound(key)}
              >
                <div className="category-icon">{category.icon}</div>
                <div className="category-name">{category.name}</div>
                <div className="category-count">{category.words?.length || 0} words</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'reveal' ? 'active' : ''}`}>
        <div className="container reveal-container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('category')}>←</button>
            <h2>Pass the Phone</h2>
            <div className="progress-indicator">
              <span>{currentRevealIndex + 1}</span>/<span>{normalizedPlayers.length}</span>
            </div>
          </div>

          <div
            className={`reveal-card ${round?.isRevealed ? 'revealed' : ''}`}
            onClick={toggleRevealCard}
            role="button"
            tabIndex={0}
          >
            <div className="reveal-front">
              <div className="player-avatar">{revealPlayerAvatar}</div>
              <h3 className="player-name">{revealPlayerName}</h3>
              <p className="reveal-instruction">Tap to reveal</p>
            </div>
            <div className="reveal-back">
              {gameType === 'word' ? (
                <div className="word-container">
                  <p className="word-label">{isCurrentImposter ? 'You are the:' : 'Your word is:'}</p>
                  <h2 className={`secret-word ${isCurrentImposter ? 'imposter' : ''}`}>
                    {isCurrentImposter ? 'IMPOSTER! 🕵️' : (round?.secretWord || 'WORD')}
                  </h2>
                </div>
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  <p className="word-label">Your question:</p>
                  <p className="reveal-question-text">{revealQuestionText}</p>
                  <input
                    type="text"
                    className="form-input"
                    value={round?.playerAnswers?.[currentRevealIndex] || ''}
                    onChange={(e) => updateCurrentAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    maxLength={100}
                  />
                </div>
              )}
              <p className="reveal-instruction">Memorize it, then continue</p>
            </div>
          </div>

          <button className="btn btn-primary btn-large" disabled={!canAdvanceReveal} onClick={nextPlayer}>
            <span>{currentRevealIndex === normalizedPlayers.length - 1 ? 'Start Discussion' : 'Next Player'}</span>
          </button>
        </div>
      </section>

      <section className={`screen ${screen === 'game' ? 'active' : ''}`}>
        <div className="container">
          <div className="game-header">
            <h2>Game On!</h2>
            <p className="game-subtitle">Find the imposter(s)!</p>
          </div>

          <div className="game-info-card">
            <div className="game-stat">
              <span className="stat-label">Category</span>
              <span className="stat-value">{categoryNameFromKey(selectedCategory || '', categories, questionCategories, customCategories)}</span>
            </div>
            <div className="game-stat">
              <span className="stat-label">Players</span>
              <span className="stat-value">{normalizedPlayers.length}</span>
            </div>
            <div className="game-stat">
              <span className="stat-label">Imposters</span>
              <span className="stat-value">{imposterCount}</span>
            </div>
          </div>

          {gameType === 'word' ? (
            <div className="speaking-order">
              <h3>🎤 First Speaker</h3>
              <p>{normalizedPlayers[firstSpeakerIndex]}</p>
            </div>
          ) : (
            <div className="modal-question-answers" style={{ marginBottom: '1.5rem' }}>
              <p className="modal-question-prompt">{round?.secretQuestion?.real}</p>
              <div className="modal-answers-list">
                {normalizedPlayers.map((player, idx) => (
                  <div key={`ans-${idx}`} className="modal-answer-item">
                    <span className="answer-player">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]} {player}</span>
                    <span className="answer-text">"{round?.playerAnswers?.[idx] || '(no answer)'}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="game-players-grid">
            {normalizedPlayers.map((player, index) => (
              <div key={`game-player-${index}`} className="game-player-card">
                <div className="game-player-avatar">{PLAYER_AVATARS[index % PLAYER_AVATARS.length]}</div>
                <div className="game-player-name">{player}</div>
              </div>
            ))}
          </div>

          <div className="game-actions">
            <button className="btn btn-danger" onClick={revealAnswerFlow}>
              <span>{gameType === 'question' ? 'Vote' : 'Reveal Answer'}</span>
            </button>
            <button className="btn btn-secondary" onClick={() => selectedCategory && buildRound(selectedCategory)}>
              <span>New Round</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setScreen(isLeagueGame ? 'leaguePlayers' : 'players')}>
              <span>Change Players</span>
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'mpChoice' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen(isLeagueGame ? 'leaguePlay' : 'welcome')}>←</button>
            <h2>Multiplayer</h2>
            <div className="spacer" />
          </div>

          <div className="mp-choice-container">
            <button className="mp-choice-card" onClick={() => setScreen('mpCreate')}>
              <div className="mp-choice-icon">🏠</div>
              <div className="mp-choice-name">Create Room</div>
              <div className="mp-choice-desc">Start and invite friends</div>
            </button>

            <button className="mp-choice-card" onClick={() => setScreen('mpJoin')}>
              <div className="mp-choice-icon">🚪</div>
              <div className="mp-choice-name">Join Room</div>
              <div className="mp-choice-desc">Enter room code</div>
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'mpCreate' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('mpChoice')}>←</button>
            <h2>Create Room</h2>
            <div className="spacer" />
          </div>

          <div className="form-container">
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                className="form-input"
                value={mpHostName}
                onChange={(e) => setMpHostName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
              />
            </div>
            <button className="btn btn-primary btn-large" onClick={createMultiplayerRoom}>
              <span>Create Room</span>
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'mpJoin' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('mpChoice')}>←</button>
            <h2>Join Room</h2>
            <div className="spacer" />
          </div>

          <div className="form-container">
            <div className="form-group">
              <label className="form-label">Room Code</label>
              <input
                type="text"
                className="form-input code-input"
                value={mpJoinCode}
                onChange={(e) => setMpJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                className="form-input"
                value={mpJoinName}
                onChange={(e) => setMpJoinName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
              />
            </div>
            {mpJoinError ? <div className="form-error" style={{ display: 'block' }}>{mpJoinError}</div> : null}
            <button className="btn btn-primary btn-large" onClick={joinMultiplayerRoom}>
              <span>Join Room</span>
            </button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'mpLobby' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={leaveMultiplayerRoom}>←</button>
            <h2>Lobby</h2>
            <div className="spacer" />
          </div>

          <div className="room-code-display">
            <span className="room-code-label">Room Code</span>
            <div className="room-code-value">{mpRoomCode || MP.getRoomCode() || '------'}</div>
            <button className="btn btn-ghost btn-small" onClick={copyRoomCode}>
              <span>{mpCopiedCode ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="lobby-game-type-section">
            <span className="category-label">Game Mode:</span>
            <div className="lobby-game-type-btns">
              <button
                className={`btn btn-ghost btn-small lobby-game-type-btn ${mpGameType === 'word' ? 'active' : ''}`}
                disabled={!mpIsHost}
                onClick={() => setMpGameType('word')}
              >
                Secret Word
              </button>
              <button
                className={`btn btn-ghost btn-small lobby-game-type-btn ${mpGameType === 'question' ? 'active' : ''}`}
                disabled={!mpIsHost}
                onClick={() => setMpGameType('question')}
              >
                Question Imposter
              </button>
            </div>
          </div>

          <div className="lobby-category-section">
            <div className="category-display-wrapper">
              <span className="category-label">Category:</span>
              <span className="category-value">{mpCategoryName}</span>
              {mpIsHost ? (
                <button className="btn-icon" onClick={() => setScreen('mpCategory')}>✎</button>
              ) : null}
            </div>
          </div>

          <div className="lobby-action-area">
            {mpIsHost ? (
              <div className="host-controls">
                <button className="btn btn-primary btn-large" disabled={!mpCanStartFromLobby} onClick={startMultiplayerGame}>
                  <span>{mpHasPlayedBefore ? 'Play' : 'Start Game'}</span>
                </button>
                <p className="host-hint">
                  {mpPlayerCount < 3
                    ? 'Need at least 3 players to start'
                    : mpAllReadyLobby
                      ? 'All ready!'
                      : 'Waiting for players to be ready...'}
                </p>
              </div>
            ) : (
              <div className="player-ready-controls">
                <button className={`btn btn-secondary btn-large ${mpMyPlayer?.isReady ? 'btn-ready-confirmed' : ''}`} onClick={toggleMpLobbyReady}>
                  <span>{mpMyPlayer?.isReady ? 'Ready!' : "I'm Ready"}</span>
                </button>
              </div>
            )}
          </div>

          <div className="lobby-players-section">
            <h3 className="section-title">Players ({mpPlayerCount})</h3>
            <div className="lobby-players-list">
              {mpPlayerEntries.map(([pid, player], idx) => {
                const isYou = pid === mpMyPlayerId;
                return (
                  <div key={pid} className={`lobby-player ${isYou ? 'is-you' : ''} ${player.isReady ? 'ready' : ''}`}>
                    <div className="lobby-player-avatar">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]}</div>
                    <div className="lobby-player-name">{player.name}{isYou ? ' (You)' : ''}</div>
                    {player.isHost ? <span className="lobby-player-badge">Host</span> : null}
                    {player.isReady && mpHasPlayedBefore ? <span className="lobby-player-badge ready-badge">Ready</span> : null}
                    <div className={`lobby-player-status ${player.isConnected ? '' : 'disconnected'}`} />
                  </div>
                );
              })}
            </div>
          </div>

          {mpIsHost ? (
            <div className="imposter-settings">
              <label className="setting-label">
                <span>Number of Imposters</span>
                <div className="stepper">
                  <button className="stepper-btn" onClick={() => updateMpImposterCount(mpImposterCount - 1)}>−</button>
                  <span>{mpImposterCount}</span>
                  <button className="stepper-btn" onClick={() => updateMpImposterCount(mpImposterCount + 1)}>+</button>
                  <button className="stepper-btn stepper-randomize" onClick={randomizeMpImposters}>🎲</button>
                </div>
              </label>
              <label className="setting-label">
                <span>Anonymous Voting</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={mpAnonymousVoting}
                    onChange={(e) => setMpAnonymousVoting(e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </div>
              </label>
            </div>
          ) : null}

          <div className="lobby-footer">
            <button className="btn btn-text-danger" onClick={leaveMultiplayerRoom}>Leave Room</button>
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'mpCategory' ? 'active' : ''}`}>
        <div className="container">
          <div className="screen-header">
            <button className="btn-back" onClick={() => setScreen('mpLobby')}>←</button>
            <h2>Choose Category</h2>
            <div className="spacer" />
          </div>

          <div className="category-grid">
            {mpGameType === 'question' && questionCategoryEntries.map(([key, category]) => (
              <button key={key} className="category-card" onClick={() => setMpCategory(`q:${key}`)}>
                <div className="category-icon">{category.icon}</div>
                <div className="category-name">{category.name}</div>
                <div className="category-count">{category.questions?.length || 0} questions</div>
              </button>
            ))}

            {mpGameType === 'word' && customCategories.map((category) => (
              <button key={category.id} className="category-card custom-category-card" onClick={() => setMpCategory(`custom:${category.id}`)}>
                <div className="category-icon">{category.icon || '📝'}</div>
                <div className="category-name">{category.name}</div>
                <div className="category-count">{(category.words || []).length} words</div>
                <div className="custom-category-badge">✏️ Custom</div>
              </button>
            ))}

            {mpGameType === 'word' && wordCategoryEntries.map(([key, category]) => (
              <button key={key} className="category-card" onClick={() => setMpCategory(key)}>
                <div className="category-icon">{category.icon}</div>
                <div className="category-name">{category.name}</div>
                <div className="category-count">{category.words?.length || 0} words</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`screen ${screen === 'mpWord' ? 'active' : ''}`}>
        <div className="container reveal-container relative-container">
          <button className="btn-top-left" onClick={leaveMultiplayerRoom}>Leave Room</button>
          <div className="screen-header">
            <div className="spacer" />
            <h2>Your Role</h2>
            <div className="spacer" />
          </div>

          <div className={`reveal-card ${mpRevealed ? 'revealed' : ''}`} onClick={toggleMpReveal}>
            <div className="reveal-front">
              <div className="player-avatar">{PLAYER_AVATARS[Math.max(0, mpPlayerEntries.findIndex(([pid]) => pid === mpMyPlayerId)) % PLAYER_AVATARS.length]}</div>
              <h3 className="player-name">{mpMyPlayer?.name || 'You'}</h3>
              <p className="reveal-instruction">Tap to reveal</p>
            </div>
            <div className="reveal-back" onClick={(e) => e.stopPropagation()}>
              {mpGameType === 'question' ? (
                <div>
                  <p className="word-label">Your question:</p>
                  <p className="reveal-question-text">
                    {mpMyPlayer?.isImposter ? mpRoomData?.secretQuestion?.imposter : mpRoomData?.secretQuestion?.real}
                  </p>
                  <input
                    type="text"
                    className="form-input"
                    value={mpAnswerInput}
                    onChange={(e) => setMpAnswerInput(e.target.value)}
                    placeholder="Type your answer..."
                    maxLength={100}
                  />
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={submitMpAnswer}>
                    {mpMyPlayer?.answer ? 'Submitted' : 'Submit Answer'}
                  </button>
                </div>
              ) : (
                <div className="word-container">
                  <p className="word-label">{mpMyPlayer?.isImposter ? 'You are the:' : 'Your word is:'}</p>
                  <h2 className={`secret-word ${mpMyPlayer?.isImposter ? 'imposter' : ''}`}>
                    {mpMyPlayer?.isImposter ? 'IMPOSTER! 🕵️' : (mpRoomData?.secretWord || 'WORD')}
                  </h2>
                </div>
              )}
            </div>
          </div>

          {mpGameType === 'word' ? (
            <div className="mp-word-status">
              <p>{mpWordSeenCount} of {mpPlayerCount} have seen their word. {mpReadyCount} ready.</p>
            </div>
          ) : null}

          {mpGameType === 'word' ? (
            <button
              className={`btn btn-primary btn-large ${mpMyPlayer?.isReady ? 'btn-ready-confirmed' : ''}`}
              disabled={!mpMyPlayer?.hasSeenWord || mpMyPlayer?.isReady}
              onClick={markMpReady}
            >
              <span>{mpMyPlayer?.isReady ? 'Waiting for others...' : 'Ready for Discussion'}</span>
            </button>
          ) : null}
        </div>
      </section>

      <section className={`screen ${screen === 'mpDiscussion' ? 'active' : ''}`}>
        <div className="container relative-container">
          <button className="btn-top-left" onClick={leaveMultiplayerRoom}>Leave Room</button>
          <div className="game-header">
            <h2>Discussion Time!</h2>
            <p className="game-subtitle">Category: {mpCategoryName}</p>
          </div>

          {mpGameType === 'question' ? (
            <div className="modal-question-answers" style={{ marginBottom: '1.5rem' }}>
              <p className="modal-question-prompt">{mpRoomData?.secretQuestion?.real}</p>
              <div className="modal-answers-list">
                {mpPlayerEntries.map(([pid, player], idx) => (
                  <div key={`mp-a-${pid}`} className="modal-answer-item">
                    <span className="answer-player">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]} {player.name}</span>
                    <span className="answer-text">"{player.answer || '(no answer)'}"</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="speaking-order">
              <h3>🎤 Speaking Order</h3>
              <ol id="mp-speaking-list">
                {mpSpeakingOrder.map((player) => (
                  <li key={player.pid} className={player.pid === mpMyPlayerId ? 'is-you' : ''}>{player.name}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="mp-players-grid">
            {mpPlayerEntries.map(([pid, player], idx) => (
              <div key={pid} className={`mp-player-card ${pid === mpMyPlayerId ? 'is-you' : ''}`}>
                <div className="mp-player-avatar">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]}</div>
                <div className="mp-player-name">{player.name}</div>
              </div>
            ))}
          </div>

          {mpIsHost ? (
            <div className="host-controls">
              <button className="btn btn-danger btn-large" onClick={startMpVoting}>
                <span>Start Voting</span>
              </button>
            </div>
          ) : (
            <div className="waiting-message">
              <div className="waiting-spinner" />
              <span>Discussing... Host will start voting</span>
            </div>
          )}
        </div>
      </section>

      <section className={`screen ${screen === 'mpVoting' ? 'active' : ''}`}>
        <div className="container relative-container">
          <button className="btn-top-left" onClick={leaveMultiplayerRoom}>Leave Room</button>
          <div className="game-header">
            <h2>🗳️ Vote!</h2>
            <p className="game-subtitle">Who is the imposter?</p>
          </div>

          <div className="voting-status">
            <span>{mpPlayerEntries.filter(([, p]) => p.vote).length}</span> of <span>{mpPlayerCount}</span> voted
          </div>

          <div className="voting-grid">
            {mpPlayerEntries.map(([pid, player], idx) => {
              const isYou = pid === mpMyPlayerId;
              const alreadyVoted = !!mpMyPlayer?.vote;
              const selected = mpSelectedVote === pid;
              const hasVoted = !!player.vote;
              return (
                <button
                  key={pid}
                  className={`voting-card ${isYou ? 'is-you' : ''} ${selected ? 'selected' : ''} ${hasVoted ? 'has-voted' : ''}`}
                  disabled={isYou || alreadyVoted}
                  onClick={() => setMpSelectedVote(pid)}
                >
                  <div className="voting-avatar">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]}</div>
                  <div className="voting-name">{player.name}</div>
                </button>
              );
            })}
          </div>

          <div className="live-votes">
            {mpAnonymousVoting ? (
              <div className="live-vote-item">
                Anonymous voting is on: {mpPlayerEntries.filter(([, player]) => player.vote).length} of {mpPlayerCount} votes submitted.
              </div>
            ) : (
              mpLiveVotes.map((item) => (
                <div key={item.id} className="live-vote-item">
                  <span className="voter">{item.voter}</span>
                  {item.skipped ? (
                    <span>skipped</span>
                  ) : (
                    <>
                      <span>voted for</span>
                      <span className="voted-for">{item.target}</span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="vote-buttons">
            <button className="btn btn-primary btn-large" disabled={!mpSelectedVote || !!mpMyPlayer?.vote} onClick={submitMpVote}>
              <span>Submit Vote</span>
            </button>
            <button className="btn btn-ghost" disabled={!!mpMyPlayer?.vote} onClick={skipMpVote}>
              <span>Skip Vote</span>
            </button>
          </div>

          {mpMyPlayer?.vote ? (
            <div className="waiting-message" style={{ marginTop: '1rem' }}>
              <div className="waiting-spinner" />
              <span>Waiting for all votes...</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`screen ${screen === 'mpResults' ? 'active' : ''}`}>
        <div className="container relative-container">
          <button className="btn-top-left" onClick={leaveMultiplayerRoom}>Leave Room</button>

          <div className={`results-header ${mpVoteResults?.imposterWins ? 'imposter-wins' : 'crew-wins'}`}>
            <div className="results-icon">🎭</div>
            <h2>{mpVoteResults?.imposterWins ? '🕵️ Imposter Wins!' : '🎉 Crew Wins!'}</h2>
            <p className="results-subtitle">
              {mpVoteResults?.tie
                ? 'The vote was tied.'
                : mpVoteResults?.imposterWins
                  ? 'Imposter survived.'
                  : 'The imposter was caught.'}
            </p>
          </div>

          <div className="results-card">
            <div className="results-section">
              <p className="results-label">{mpGameType === 'question' ? 'The question was:' : 'The Secret Word was:'}</p>
              <h3 className="results-word">{mpGameType === 'question' ? (mpRoomData?.secretQuestion?.real || '(unknown)') : (mpRoomData?.secretWord || '(unknown)')}</h3>
            </div>

            <div className="results-section">
              <p className="results-label">The Imposter(s):</p>
              <div className="imposters-list">
                {(mpVoteResults?.imposterIds || []).map((pid) => (
                  <span key={pid} className="imposter-tag">🕵️ {mpPlayers[pid]?.name || pid}</span>
                ))}
              </div>
            </div>

            {mpGameType === 'question' && mpRoomData?.secretQuestion?.imposter ? (
              <div className="results-section">
                <p className="results-label">The Imposter's Question was:</p>
                <h3 className="results-word" style={{ fontSize: '1rem', fontWeight: 500 }}>{mpRoomData.secretQuestion.imposter}</h3>
              </div>
            ) : null}

            <div className="results-section">
              <p className="results-label">Vote Results:</p>
              <div className="vote-results">
                {mpPlayerEntries.map(([pid, player], idx) => {
                  const votesReceived = mpVoteResults?.votes?.[pid] || 0;
                  if (votesReceived <= 0 && pid !== mpVoteResults?.eliminated) return null;
                  return (
                    <div key={`vr-${pid}`} className={`vote-result-item ${pid === mpVoteResults?.eliminated ? 'eliminated' : ''}`}>
                      {PLAYER_AVATARS[idx % PLAYER_AVATARS.length]} {player.name}: {votesReceived} vote{votesReceived !== 1 ? 's' : ''}
                    </div>
                  );
                })}
                {(mpVoteResults?.skippedVotes || 0) > 0 ? (
                  <div className="vote-result-item">⏭️ Skipped: {mpVoteResults.skippedVotes}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="results-section room-leaderboard">
            <h4 className="leaderboard-title">🏆 Room Leaderboard</h4>
            <div className="room-leaderboard-list">
              {mpLeaderboard.map((entry, idx) => (
                <div key={entry.pid} className={`room-leaderboard-row ${idx === 0 ? 'top-1' : ''}`}>
                  <span className="leaderboard-rank">#{idx + 1}</span>
                  <span className="leaderboard-name">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]} {entry.name}</span>
                  <span className="leaderboard-points">{entry.points} pt{entry.points !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>

          {isLeagueGame ? (
            <div className="results-section room-leaderboard">
              <h4 className="leaderboard-title">📊 League Leaderboard</h4>
              <div className="room-leaderboard-list">
                {leagueRoundStandings.length > 0 ? (
                  leagueRoundStandings.map((entry, idx) => (
                    <div key={`league-lb-${entry.name}-${idx}`} className={`room-leaderboard-row ${idx === 0 ? 'top-1' : ''}`}>
                      <span className="leaderboard-rank">{idx < 3 ? LEAGUE_MEDALS[idx] : `#${idx + 1}`}</span>
                      <span className="leaderboard-name">{entry.name}</span>
                      <span className="leaderboard-points">{entry.points} pt{entry.points !== 1 ? 's' : ''}</span>
                    </div>
                  ))
                ) : (
                  <div className="league-auto-save-label">Updating league leaderboard...</div>
                )}
              </div>
            </div>
          ) : null}

          {isLeagueGame ? (
            <p className="league-auto-save-label">
              {leaguePointsNotice || `Auto-saving points to 🏆 ${leagueGameName || 'League'}...`}
            </p>
          ) : null}

          <div className="results-lobby-area">
            <div className="lobby-category-section margin-bottom">
              <div className="category-display-wrapper">
                <span className="category-label">Next Category:</span>
                <span className="category-value">{mpCategoryName}</span>
                {mpIsHost ? <button className="btn-icon" onClick={() => setScreen('mpCategory')}>✎</button> : null}
              </div>
            </div>

            <div className="lobby-players-section margin-bottom">
              <h3 className="section-title">Players</h3>
              <div className="lobby-players-list">
                {mpPlayerEntries.map(([pid, player], idx) => (
                  <div key={`res-${pid}`} className="lobby-player-item">
                    <div className="lobby-player-avatar">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]}</div>
                    <div className="lobby-player-info">
                      <span className="lobby-player-name">{player.name}{player.isHost ? ' (Host)' : ''}</span>
                    </div>
                    {player.isReady ? <span className="ready-icon">✓</span> : <span className="not-ready-icon">…</span>}
                  </div>
                ))}
              </div>
            </div>

            {mpIsHost ? (
              <div id="results-host-controls" className="host-controls">
                <label className="setting-label margin-bottom">
                  <span>Anonymous Voting</span>
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={mpAnonymousVoting}
                      onChange={(e) => setMpAnonymousVoting(e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </div>
                </label>
                <button className="btn btn-primary btn-large" disabled={mpPlayerCount < 3 || !mpAllReadyLobby} onClick={startMultiplayerNewRound}>
                  <span>New Round</span>
                </button>
                <button className="btn btn-secondary btn-large" style={{ marginTop: '0.75rem' }} onClick={returnMpToLobby}>
                  <span>Return to Lobby</span>
                </button>
                <p className="host-hint">
                  {mpPlayerCount < 3
                    ? 'Need at least 3 players'
                    : mpAllReadyLobby
                      ? 'All ready!'
                      : 'Waiting for players...'}
                </p>
              </div>
            ) : (
              <div className="ready-controls">
                <button className={`btn btn-secondary btn-large ${mpMyPlayer?.isReady ? 'btn-ready-confirmed' : ''}`} onClick={toggleMpLobbyReady}>
                  {mpMyPlayer?.isReady ? 'Ready!' : "I'm Ready"}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {mpCanUseChat ? (
        <>
          <button className="chat-toggle-btn" onClick={() => setMpChatOpen((prev) => !prev)} aria-label="Toggle chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {!mpChatOpen && mpChatUnread > 0 ? <span className="chat-badge">{mpChatUnread}</span> : null}
          </button>

          <div className={`chat-sidebar ${mpChatOpen ? 'active' : ''}`}>
            <div className="chat-header">
              <h3>Chat</h3>
              <button className="btn-close" onClick={() => setMpChatOpen(false)} aria-label="Close chat">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="chat-messages" ref={mpChatMessagesRef}>
              {mpChatMessages.map((msg, index) => {
                const isOwnMessage = msg.playerId === mpMyPlayerId;
                return (
                  <div key={msg.id || `${msg.playerId || 'msg'}-${index}`} className={`chat-message ${isOwnMessage ? 'own' : ''}`}>
                    <div className="chat-message-sender">{msg.playerName}</div>
                    <div className="chat-message-text">{msg.text}</div>
                  </div>
                );
              })}
            </div>
            <div className="chat-input-container">
              <input
                ref={mpChatInputRef}
                type="text"
                className="chat-input"
                value={mpChatInput}
                onChange={(e) => setMpChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMpChatMessage();
                  }
                }}
                placeholder="Type a message..."
                maxLength={100}
              />
              <button className="btn btn-primary btn-small" onClick={sendMpChatMessage}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>

          <div
            className={`chat-overlay ${mpChatOpen ? 'active' : ''}`}
            onClick={() => setMpChatOpen(false)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setMpChatOpen(false);
              }
            }}
          />
        </>
      ) : null}

      <div className={`modal ${modal.open ? 'active' : ''}`}>
        <div className="modal-backdrop" />
        <div className="modal-content modal-content-league">
          <div className={`modal-step ${modal.step === 'vote' ? '' : 'hidden'}`}>
            <div className="modal-header">
              <h3>🗳️ Who's the Imposter?</h3>
            </div>
            <div className="modal-body">
              {gameType === 'question' ? (
                <div className="modal-question-answers">
                  <p className="modal-question-prompt">{round?.secretQuestion?.real}</p>
                  <div className="modal-answers-list">
                    {normalizedPlayers.map((player, idx) => (
                      <div key={`modal-answer-${idx}`} className="modal-answer-item">
                        <span className="answer-player">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]} {player}</span>
                        <span className="answer-text">"{round?.playerAnswers?.[idx] || '(no answer)'}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="modal-instruction">
                {gameType === 'question'
                  ? 'One person got a different question. Whose answer seems off?'
                  : 'Tap the player(s) you think are the imposter(s), then confirm.'}
              </p>

              <div className="vote-player-grid">
                {normalizedPlayers.map((player, idx) => {
                  const selected = modal.votedPlayers.includes(idx);
                  return (
                    <button
                      key={`vote-${idx}`}
                      className={`vote-player-card ${selected ? 'selected' : ''}`}
                      onClick={() => toggleVote(idx)}
                    >
                      <div className="vote-player-avatar">{PLAYER_AVATARS[idx % PLAYER_AVATARS.length]}</div>
                      <div className="vote-player-name">{player}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" disabled={modal.votedPlayers.length === 0} onClick={confirmVote}>Confirm Vote</button>
              <button className="btn btn-ghost" onClick={skipVote}>Skip (No Vote)</button>
            </div>
          </div>

          <div className={`modal-step ${modal.step === 'guess' ? '' : 'hidden'}`}>
            <div className="modal-header">
              <h3>🕵️ Imposter's Guess</h3>
            </div>
            <div className="modal-body">
              <p className="modal-instruction">Pass the phone to the imposter — can they guess the secret word?</p>
              <div>
                {round?.imposterIndices?.map((idx) => (
                  <div key={`guess-${idx}`} className="imposter-guess-item">
                    <label className="guess-label">🕵️ {normalizedPlayers[idx]}'s guess:</label>
                    <input
                      type="text"
                      className="form-input"
                      value={modal.guesses[idx] || ''}
                      onChange={(e) => updateGuess(idx, e.target.value)}
                      placeholder="Type the secret word..."
                      maxLength={50}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={submitGuesses}>Submit Guess</button>
              <button className="btn btn-ghost" onClick={skipGuesses}>Skip Guess</button>
            </div>
          </div>

          <div className={`modal-step ${modal.step === 'results' ? '' : 'hidden'}`}>
            <div className="modal-header">
              <h3>{modal.summary?.title || 'Results'}</h3>
            </div>
            <div className="modal-body">
              <div className="answer-section">
                <p className="answer-label">{modal.summary?.answerLabel}</p>
                <h2 className="answer-word">{modal.summary?.answerValue}</h2>
              </div>

              <div className="answer-section">
                <p className="answer-label">The Imposter(s):</p>
                <div className="imposters-list">
                  {(modal.summary?.imposters || []).map((name) => (
                    <span key={name} className="imposter-tag">🕵️ {name}</span>
                  ))}
                </div>
              </div>

              {modal.summary?.imposterQuestion ? (
                <div className="answer-section">
                  <p className="answer-label">The Imposter's Question was:</p>
                  <h2 className="answer-word imposter" style={{ fontSize: '1rem', fontWeight: 500 }}>{modal.summary.imposterQuestion}</h2>
                </div>
              ) : null}

              {(modal.summary?.guessRows || []).length > 0 ? (
                <div className="answer-section">
                  <p className="answer-label">Imposter Guesses:</p>
                  {(modal.summary?.guessRows || []).map((item) => (
                    <div key={item.player} className={`guess-result ${item.correct ? 'correct' : 'wrong'}`}>
                      {item.player}: "{item.guess}" {item.correct ? '✅' : '❌'}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="league-points-summary">
                <h4>🏆 Points This Round</h4>
                <div className="points-list">
                  {(modal.summary?.pointsRows || []).map((entry) => (
                    <div key={entry.name} className={`points-row ${entry.points > 0 ? 'earned' : ''}`}>
                      <span className="points-player">{entry.avatar} {entry.name}</span>
                      <span className="points-reason">{entry.reasons.length > 0 ? entry.reasons.join(', ') : '—'}</span>
                      <span className={`points-value ${entry.points > 0 ? 'positive' : ''}`}>+{entry.points}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isLeagueGame ? (
                <div className="league-points-summary">
                  <h4>📊 Updated League Leaderboard</h4>
                  <div className="points-list">
                    {leagueRoundStandings.length > 0 ? (
                      leagueRoundStandings.map((entry, idx) => {
                        const rank = idx < 3 ? LEAGUE_MEDALS[idx] : `#${idx + 1}`;
                        return (
                          <div key={`modal-league-${entry.name}-${idx}`} className="points-row">
                            <span className="points-player">{rank} {entry.name}</span>
                            <span className="points-reason">{entry.gamesPlayed} games · {entry.wins} wins</span>
                            <span className="points-value positive">{entry.points} pts</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="league-auto-save-label">Updating leaderboard...</div>
                    )}
                  </div>
                </div>
              ) : null}

              {isLeagueGame ? (
                <div className="league-auto-save-label">
                  {leaguePointsNotice || `Saving points to 🏆 ${leagueGameName || 'League'}...`}
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" disabled={localSavingScores} onClick={closeLocalResultsModal}>
                {localSavingScores ? 'Saving...' : (isLeagueGame ? (localLeagueRoundSaved ? 'Done' : 'Save & Done') : 'Done')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
