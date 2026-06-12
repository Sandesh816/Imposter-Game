import { useCallback, useMemo, useState } from 'react';
import { createLocalRound } from '../../gameEngine.js';

const initialLocalState = {
  gameType: 'word',
  players: [],
  imposterCount: 1,
  selectedCategory: null,
  secretWord: null,
  secretQuestion: null,
  playerAnswers: [],
  imposterIndices: [],
  currentRevealIndex: 0,
  isRevealed: false,
};

export function useLocalGameEngine({
  categories = {},
  questionCategories = {},
  customCategories = [],
  getRandomQuestion,
} = {}) {
  const [state, setState] = useState(initialLocalState);

  const canStart = useMemo(() => {
    return state.players.length >= 3 && !!state.selectedCategory;
  }, [state.players.length, state.selectedCategory]);

  const setGameType = useCallback((gameType) => {
    setState((prev) => ({ ...prev, gameType }));
  }, []);

  const setPlayers = useCallback((players) => {
    setState((prev) => ({ ...prev, players: [...players] }));
  }, []);

  const setImposterCount = useCallback((imposterCount) => {
    setState((prev) => ({ ...prev, imposterCount }));
  }, []);

  const setSelectedCategory = useCallback((selectedCategory) => {
    setState((prev) => ({ ...prev, selectedCategory }));
  }, []);

  const setPlayerAnswer = useCallback((playerIndex, answer) => {
    setState((prev) => {
      const nextAnswers = [...prev.playerAnswers];
      nextAnswers[playerIndex] = answer;
      return { ...prev, playerAnswers: nextAnswers };
    });
  }, []);

  const revealCurrent = useCallback(() => {
    setState((prev) => ({ ...prev, isRevealed: true }));
  }, []);

  const advanceReveal = useCallback(() => {
    setState((prev) => {
      if (!prev.isRevealed) return prev;
      if (prev.currentRevealIndex >= prev.players.length - 1) return prev;
      return {
        ...prev,
        currentRevealIndex: prev.currentRevealIndex + 1,
        isRevealed: false,
      };
    });
  }, []);

  const startLocalRound = useCallback(() => {
    setState((prev) => {
      const round = createLocalRound({
        gameType: prev.gameType,
        selectedCategory: prev.selectedCategory,
        players: prev.players,
        imposterCount: prev.imposterCount,
        categories,
        questionCategories,
        customCategories,
        getRandomQuestion,
      });

      return {
        ...prev,
        secretWord: round.secretWord,
        secretQuestion: round.secretQuestion,
        playerAnswers: round.playerAnswers,
        imposterIndices: round.imposterIndices,
        currentRevealIndex: round.currentRevealIndex,
        isRevealed: round.isRevealed,
      };
    });
  }, [categories, questionCategories, customCategories, getRandomQuestion]);

  const resetLocalState = useCallback(() => {
    setState(initialLocalState);
  }, []);

  return {
    state,
    canStart,
    actions: {
      setGameType,
      setPlayers,
      setImposterCount,
      setSelectedCategory,
      setPlayerAnswer,
      revealCurrent,
      advanceReveal,
      startLocalRound,
      resetLocalState,
    },
  };
}
