import { describe, expect, it } from 'vitest';
import { calculateRoundPoints, calculateVoteResults } from '../../multiplayerLogic.js';

function basePlayers() {
  return {
    a: { isImposter: false, vote: null },
    b: { isImposter: false, vote: null },
    c: { isImposter: true, vote: null },
    d: { isImposter: false, vote: null },
  };
}

describe('calculateVoteResults', () => {
  it('returns crew win when imposter gets most votes', () => {
    const players = basePlayers();
    players.a.vote = 'c';
    players.b.vote = 'c';
    players.c.vote = 'a';
    players.d.vote = 'c';

    const result = calculateVoteResults(players);
    expect(result.eliminated).toBe('c');
    expect(result.tie).toBe(false);
    expect(result.imposterWins).toBe(false);
    expect(result.votes).toEqual({ c: 3, a: 1 });
    expect(result.skippedVotes).toBe(0);
    expect(result.totalVotes).toBe(4);
  });

  it('marks tie when multiple targets share max votes', () => {
    const players = basePlayers();
    players.a.vote = 'c';
    players.b.vote = 'a';
    players.c.vote = 'a';
    players.d.vote = 'c';

    const result = calculateVoteResults(players);
    expect(result.tie).toBe(true);
    expect(result.imposterWins).toBe(true);
    expect(result.totalVotes).toBe(4);
    expect(result.votes).toEqual({ c: 2, a: 2 });
  });

  it('lets imposter win when skip has more votes than any player', () => {
    const players = basePlayers();
    players.a.vote = 'skip';
    players.b.vote = 'skip';
    players.c.vote = 'a';
    players.d.vote = 'c';

    const result = calculateVoteResults(players);
    expect(result.skippedVotes).toBe(2);
    expect(result.eliminated).toBe(null);
    expect(result.tie).toBe(false);
    expect(result.imposterWins).toBe(true);
  });

  it('treats skip equal to max votes as tie', () => {
    const players = basePlayers();
    players.a.vote = 'skip';
    players.b.vote = 'c';
    players.c.vote = 'c';
    players.d.vote = 'skip';

    const result = calculateVoteResults(players);
    expect(result.skippedVotes).toBe(2);
    expect(result.votes.c).toBe(2);
    expect(result.tie).toBe(true);
    expect(result.imposterWins).toBe(true);
  });

  it('returns imposter win when no one votes', () => {
    const result = calculateVoteResults(basePlayers());
    expect(result.totalVotes).toBe(0);
    expect(result.eliminated).toBe(null);
    expect(result.tie).toBe(false);
    expect(result.imposterWins).toBe(true);
  });
});

describe('calculateRoundPoints', () => {
  it('gives civilians +1 each when crew catches imposter', () => {
    const players = basePlayers();
    players.a.vote = 'c';
    players.b.vote = 'c';
    players.c.vote = 'a';
    players.d.vote = 'c';

    const votes = calculateVoteResults(players);
    const points = calculateRoundPoints(players, votes);
    expect(points).toEqual({ a: 1, b: 1, c: 0, d: 1 });
  });

  it('gives imposters +1 when wrong player is eliminated', () => {
    const players = basePlayers();
    players.a.vote = 'b';
    players.b.vote = 'a';
    players.c.vote = 'b';
    players.d.vote = 'b';

    const votes = calculateVoteResults(players);
    const points = calculateRoundPoints(players, votes);
    expect(votes.eliminated).toBe('b');
    expect(votes.imposterWins).toBe(true);
    expect(points).toEqual({ a: 0, b: 0, c: 1, d: 0 });
  });

  it('supports multiple imposters receiving points', () => {
    const players = {
      a: { isImposter: false, vote: 'b' },
      b: { isImposter: true, vote: 'a' },
      c: { isImposter: true, vote: 'a' },
      d: { isImposter: false, vote: 'a' },
    };

    const votes = calculateVoteResults(players);
    const points = calculateRoundPoints(players, votes);
    expect(votes.imposterWins).toBe(true);
    expect(points).toEqual({ a: 0, b: 1, c: 1, d: 0 });
  });
});
