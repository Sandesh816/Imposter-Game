// Multiplayer core game logic helpers (pure functions).
// This file intentionally avoids Firebase/browser dependencies.

function calculateVoteResults(playersInput) {
    const players = playersInput && typeof playersInput === 'object' ? playersInput : {};
    const votes = {};
    let totalVotes = 0;
    let skippedVotes = 0;

    Object.entries(players).forEach(([_, player]) => {
        if (!player) return;
        if (player.vote === 'skip') {
            skippedVotes++;
            totalVotes++;
        } else if (player.vote) {
            votes[player.vote] = (votes[player.vote] || 0) + 1;
            totalVotes++;
        }
    });

    let maxVotes = 0;
    let eliminated = null;
    let tie = false;

    Object.entries(votes).forEach(([pid, count]) => {
        if (count > maxVotes) {
            maxVotes = count;
            eliminated = pid;
            tie = false;
        } else if (count === maxVotes) {
            tie = true;
        }
    });

    if (skippedVotes > maxVotes) {
        eliminated = null;
        tie = false;
    } else if (skippedVotes === maxVotes && skippedVotes > 0) {
        tie = true;
    }

    const imposterIds = Object.entries(players)
        .filter(([_, p]) => !!p?.isImposter)
        .map(([id]) => id);

    let imposterWins = false;
    if (tie || !eliminated) {
        imposterWins = true;
    } else if (imposterIds.includes(eliminated)) {
        imposterWins = false;
    } else {
        imposterWins = true;
    }

    return {
        votes,
        skippedVotes,
        totalVotes,
        eliminated,
        tie,
        imposterWins,
        imposterIds
    };
}

function calculateRoundPoints(playersInput, voteResultsInput) {
    const players = playersInput && typeof playersInput === 'object' ? playersInput : {};
    const voteResults = voteResultsInput || calculateVoteResults(players);
    const imposterIdSet = new Set(voteResults.imposterIds || []);

    const pointsMap = {};
    Object.keys(players).forEach((pid) => {
        pointsMap[pid] = 0;
    });

    const correctVote = (voteResults.imposterIds || []).length > 0
        && !!voteResults.eliminated
        && imposterIdSet.has(voteResults.eliminated)
        && !voteResults.tie;

    if (correctVote) {
        Object.keys(players).forEach((pid) => {
            if (!imposterIdSet.has(pid)) {
                pointsMap[pid] = 1;
            }
        });
    } else if (voteResults.imposterWins) {
        (voteResults.imposterIds || []).forEach((pid) => {
            pointsMap[pid] = 1;
        });
    }

    return pointsMap;
}

export {
    calculateVoteResults,
    calculateRoundPoints
};
