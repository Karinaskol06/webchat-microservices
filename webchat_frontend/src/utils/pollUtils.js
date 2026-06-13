/** @typedef {{ id: string, text: string, correct?: boolean }} PollOption */
/** @typedef {{ optionIds: string[], name?: string, attempts?: number, completed?: boolean, lastCorrect?: boolean }} PollVoteRecord */

export const computePollStats = (payload) => {
  const options = Array.isArray(payload?.options) ? payload.options : [];
  const votes = payload?.votes && typeof payload.votes === 'object' ? payload.votes : {};
  const voterCount = Object.keys(votes).length;
  const counts = Object.fromEntries(options.map((o) => [o.id, 0]));
  const votersByOption = Object.fromEntries(options.map((o) => [o.id, []]));

  Object.entries(votes).forEach(([userId, record]) => {
    const optionIds = Array.isArray(record?.optionIds) ? record.optionIds : [];
    optionIds.forEach((optionId) => {
      if (counts[optionId] != null) {
        counts[optionId] += 1;
        votersByOption[optionId].push({
          userId,
          name: record?.name || `User ${userId}`,
        });
      }
    });
  });

  const percentages = Object.fromEntries(
    options.map((o) => [
      o.id,
      voterCount > 0 ? (counts[o.id] / voterCount) * 100 : 0,
    ]),
  );

  return { counts, percentages, voterCount, votersByOption };
};

export const evaluateTestAnswer = (payload, optionIds) => {
  const multipleChoice = Boolean(payload?.multipleChoice);
  const correctIds = (payload?.options || [])
    .filter((o) => o.correct)
    .map((o) => o.id)
    .sort();
  const selected = [...(optionIds || [])].sort();

  if (multipleChoice) {
    return (
      correctIds.length === selected.length &&
      correctIds.every((id, index) => id === selected[index])
    );
  }
  return selected.length === 1 && correctIds.includes(selected[0]);
};

export const getUserPollVote = (payload, userId) => {
  if (userId == null) return null;
  const votes = payload?.votes;
  if (!votes || typeof votes !== 'object') return null;
  return votes[String(userId)] ?? null;
};

export const canUserVoteAgain = (payload, userId) => {
  const mode = String(payload?.mode || 'poll').toLowerCase();
  const vote = getUserPollVote(payload, userId);
  if (mode !== 'test') {
    return !vote;
  }
  if (!vote) return true;
  if (vote.lastCorrect || vote.completed) return false;
  const maxAttempts = Math.max(1, Number(payload?.maxAttempts) || 1);
  const attemptsUsed = vote.attempts || (Array.isArray(vote.history) ? vote.history.length : 0);
  return attemptsUsed < maxAttempts;
};

export const shouldShowPollResults = (payload, userId) => {
  const mode = String(payload?.mode || 'poll').toLowerCase();
  const vote = getUserPollVote(payload, userId);
  if (!vote) return false;
  if (mode === 'poll') return true;
  if (vote.lastCorrect) return true;
  if (payload?.showCorrectAfterAnswer) return true;
  return Boolean(vote.completed);
};

export const shouldRevealTestAnswers = (payload, userId) => {
  const mode = String(payload?.mode || 'poll').toLowerCase();
  if (mode !== 'test') return false;
  if (!payload?.showCorrectAfterAnswer) return false;
  const vote = getUserPollVote(payload, userId);
  if (!vote) return false;
  return vote.completed || vote.lastCorrect;
};
