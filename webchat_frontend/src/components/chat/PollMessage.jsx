import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Radio,
  Typography,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { alpha } from '@mui/material/styles';
import { chatColors, chatRadii, themePrimaryAlpha } from '../../theme/chatDesignTokens';
import chatService from '../../services/chatService';
import { getApiErrorMessage } from '../../services/api';
import useChatStore from '../../store/useChatStore';
import {
  canUserVoteAgain,
  computePollStats,
  getUserPollVote,
  shouldRevealTestAnswers,
  shouldShowPollResults,
} from '../../utils/pollUtils';

const FLASH_MS = 2800;

const PollMessage = ({ payload, messageId, currentUserId }) => {
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState('');
  const [votersDialog, setVotersDialog] = useState(null);
  const [resultFlash, setResultFlash] = useState(null);

  const mode = String(payload?.mode || 'poll').toLowerCase();
  const isTest = mode === 'test';
  const anonymous = Boolean(payload?.anonymous);
  const multipleChoice = Boolean(payload?.multipleChoice);
  const options = Array.isArray(payload?.options) ? payload.options : [];

  const userVote = useMemo(
    () => getUserPollVote(payload, currentUserId),
    [payload, currentUserId],
  );
  const showResults = shouldShowPollResults(payload, currentUserId);
  const revealAnswers = shouldRevealTestAnswers(payload, currentUserId);
  const canVote = canUserVoteAgain(payload, currentUserId);
  const canSelectOptions = canVote && !(isTest && userVote?.lastCorrect);
  const stats = useMemo(() => computePollStats(payload), [payload]);

  useEffect(() => {
    if (userVote?.optionIds) {
      setSelected(userVote.optionIds);
    }
  }, [userVote?.optionIds?.join('|')]);

  useEffect(() => {
    if (!isTest || !userVote || userVote.lastCorrect == null) return undefined;
    setResultFlash(userVote.lastCorrect ? 'success' : 'error');
    const timer = window.setTimeout(() => setResultFlash(null), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [isTest, userVote?.lastCorrect, userVote?.attempts]);

  const borderRadius = isTest ? '8px' : `${chatRadii.shell}px`;
  const optionRadius = isTest ? '6px' : `${chatRadii.bubble}px`;
  const flashBorder = (theme) =>
    resultFlash === 'success'
      ? `2px solid ${theme.palette.success.main}`
      : resultFlash === 'error'
        ? `2px solid ${theme.palette.error.main}`
        : `1px solid ${themePrimaryAlpha(theme, 0.28)}`;

  const toggleOption = (optionId) => {
    if (!canSelectOptions) return;
    if (multipleChoice) {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    } else {
      setSelected([optionId]);
    }
  };

  const handleSubmitVote = async () => {
    if (!messageId || selected.length === 0 || submitting) return;
    setSubmitting(true);
    setVoteError('');
    try {
      const updated = await chatService.castPollVote(messageId, selected);
      useChatStore.getState().updateMessageContent(
        messageId,
        updated.content ?? '',
        null,
        updated.messageType ?? updated.message_type ?? 'POLL',
      );
    } catch (error) {
      console.error('Poll vote failed', error);
      setVoteError(getApiErrorMessage(error, 'Could not submit your vote. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptionPress = (optionId) => {
    if (showResults && !anonymous && !canSelectOptions) {
      const voters = stats.votersByOption[optionId] || [];
      if (voters.length > 0) {
        setVotersDialog({ optionId, voters });
      }
      return;
    }
    toggleOption(optionId);
  };

  const renderSelector = (optionId, checked) => {
    const commonSx = {
      width: 20,
      height: 20,
      flexShrink: 0,
      mt: 0.25,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: (theme) => `2px solid ${themePrimaryAlpha(theme, 0.45)}`,
      bgcolor: checked ? (theme) => themePrimaryAlpha(theme, 0.35) : 'transparent',
      transition: 'background-color 0.15s ease',
    };

    if (showResults) {
      return (
        <Box
          sx={{
            ...commonSx,
            borderRadius: multipleChoice ? '4px' : '50%',
          }}
        />
      );
    }

    if (multipleChoice) {
      return (
        <Checkbox
          size="small"
          checked={checked}
          onChange={() => toggleOption(optionId)}
          sx={{ p: 0, mr: 0.5 }}
        />
      );
    }

    return (
      <Radio
        size="small"
        checked={checked}
        onChange={() => toggleOption(optionId)}
        sx={{ p: 0, mr: 0.5 }}
      />
    );
  };

  return (
    <>
      <Box
        sx={{
          width: '100%',
          maxWidth: 520,
          boxSizing: 'border-box',
          p: 2,
          borderRadius,
          bgcolor: (theme) => themePrimaryAlpha(theme, 0.12),
          border: (theme) => flashBorder(theme),
          boxShadow: resultFlash
            ? (theme) =>
                `0 0 0 3px ${alpha(
                  resultFlash === 'success' ? theme.palette.success.main : theme.palette.error.main,
                  0.25,
                )}`
            : 'none',
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: chatColors.textPrimary, mb: 0.5 }}>
          {payload?.question || 'Poll'}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
          {anonymous ? 'Anonymous' : 'Public'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
          {isTest ? 'Test' : 'Poll'}
        </Typography>
        {multipleChoice ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Multiple choice
          </Typography>
        ) : (
          <Box sx={{ mb: 1.5 }} />
        )}

        {options.map((option) => {
          const checked = selected.includes(option.id);
          const pct = stats.percentages[option.id] ?? 0;
          const count = stats.counts[option.id] ?? 0;
          const showBar = showResults;
          const isCorrect = Boolean(option.correct);
          const showCorrectness = revealAnswers;

          return (
            <Box
              key={option.id}
              onClick={() => handleOptionPress(option.id)}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: optionRadius,
                mb: 1,
                cursor:
                  showResults && !anonymous && !canSelectOptions && count > 0
                    ? 'pointer'
                    : canSelectOptions
                      ? 'pointer'
                      : 'default',
                border: (theme) =>
                  showCorrectness && isCorrect
                    ? `1px solid ${alpha(theme.palette.success.main, 0.55)}`
                    : showCorrectness && !isCorrect
                      ? `1px solid ${alpha(theme.palette.error.main, 0.35)}`
                      : `1px solid ${themePrimaryAlpha(theme, 0.2)}`,
              }}
            >
              {showBar ? (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${pct}%`,
                    bgcolor: (theme) => themePrimaryAlpha(theme, 0.22),
                    transition: 'width 0.45s ease-out',
                    pointerEvents: 'none',
                  }}
                />
              ) : null}

              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  px: 1.25,
                  py: 1,
                }}
              >
                {showResults && checked ? (
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      flexShrink: 0,
                      mt: 0.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: multipleChoice ? '4px' : '50%',
                      border: (theme) => `2px solid ${themePrimaryAlpha(theme, 0.55)}`,
                      bgcolor: (theme) => themePrimaryAlpha(theme, 0.4),
                    }}
                  >
                    <CheckIcon sx={{ fontSize: 14 }} />
                  </Box>
                ) : (
                  renderSelector(option.id, checked)
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: chatColors.textPrimary,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {option.text}
                  </Typography>
                  {showBar ? (
                    <Typography variant="caption" color="text.secondary">
                      {Math.round(pct)}% · {count}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            </Box>
          );
        })}

        {showResults && stats.voterCount > 0 ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {stats.voterCount} {stats.voterCount === 1 ? 'vote' : 'votes'}
          </Typography>
        ) : null}

        {revealAnswers && payload?.explanation ? (
          <Box
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: (theme) => `1px solid ${themePrimaryAlpha(theme, 0.2)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Explanation
            </Typography>
            <Typography variant="body2" sx={{ color: chatColors.textPrimary, whiteSpace: 'pre-wrap' }}>
              {payload.explanation}
            </Typography>
          </Box>
        ) : null}

        {canVote ? (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              disabled={selected.length === 0 || submitting}
              onClick={handleSubmitVote}
            >
              {isTest && userVote ? 'Try again' : mode === 'poll' ? 'Vote' : 'Submit'}
            </Button>
            {isTest && userVote && !userVote.completed && !userVote.lastCorrect ? (
              <Typography variant="caption" color="text.secondary">
                Attempt {(userVote.attempts || 0) + 1} of {Math.max(1, payload?.maxAttempts || 1)}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {voteError ? (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
            {voteError}
          </Typography>
        ) : null}
      </Box>

      <Dialog open={Boolean(votersDialog)} onClose={() => setVotersDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Voters</DialogTitle>
        <DialogContent dividers>
          <List dense disablePadding>
            {(votersDialog?.voters || []).map((voter) => (
              <ListItem key={voter.userId} disableGutters>
                <ListItemText primary={voter.name} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PollMessage;
