/** Quick-pick reactions shown above the message context menu (Unicode sequences). */
export const QUICK_REACTION_EMOJIS = [
  '❤️',
  '👍',
  '🥰',
  '😊',
  '😭',
  '🙄',
  '😒',
  '☹️',
];

export const MAX_REACTIONS_PER_USER = 5;

const EMOJI_FONT =
  'system-ui, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export const messageReactionEmojiSx = {
  fontFamily: EMOJI_FONT,
  fontSize: '1.25rem',
  lineHeight: 1,
};

export const normalizeReactions = (reactions, currentUserId) => {
  if (!Array.isArray(reactions) || reactions.length === 0) return [];
  const uid = currentUserId != null ? Number(currentUserId) : null;
  return reactions
    .filter((r) => r && r.emoji)
    .map((r) => {
      const userIds = Array.isArray(r.userIds) ? r.userIds.map(Number) : [];
      const reactedByMe =
        r.reactedByMe === true ||
        (uid != null && userIds.some((id) => Number(id) === uid));
      return {
        emoji: r.emoji,
        count: r.count ?? userIds.length,
        userIds,
        reactedByMe,
      };
    });
};

export const countUserReactions = (reactions, currentUserId) => {
  const uid = currentUserId != null ? Number(currentUserId) : null;
  if (uid == null) return 0;
  return normalizeReactions(reactions, currentUserId).filter((r) => r.reactedByMe).length;
};
