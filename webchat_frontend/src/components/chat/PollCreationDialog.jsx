import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  Checkbox,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BinaryChoiceField from './BinaryChoiceField';
import PollStepperField from './PollStepperField';
import { createPollPayload, serializePayload } from '../../utils/personalSpace';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;

const PollCreationDialog = ({ open, onClose, onSubmit, submitting = false }) => {
  const [question, setQuestion] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [mode, setMode] = useState('poll');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [showCorrectAfterAnswer, setShowCorrectAfterAnswer] = useState(true);
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState([
    { id: crypto.randomUUID(), text: '', correct: false },
    { id: crypto.randomUUID(), text: '', correct: false },
  ]);
  const [error, setError] = useState('');

  const isTest = mode === 'test';

  const resetForm = useCallback(() => {
    setQuestion('');
    setAnonymous(false);
    setMultipleChoice(false);
    setMode('poll');
    setMaxAttempts(1);
    setShowCorrectAfterAnswer(true);
    setExplanation('');
    setOptions([
      { id: crypto.randomUUID(), text: '', correct: false },
      { id: crypto.randomUUID(), text: '', correct: false },
    ]);
    setError('');
  }, []);

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose?.();
  };

  const updateOption = (id, patch) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, { id: crypto.randomUUID(), text: '', correct: false }]);
  };

  const removeOption = (id) => {
    setOptions((prev) => {
      const next = prev.filter((o) => o.id !== id);
      if (next.length < MIN_OPTIONS) {
        return [...next, { id: crypto.randomUUID(), text: '', correct: false }].slice(0, MIN_OPTIONS);
      }
      return next;
    });
  };

  const validationError = useMemo(() => {
    if (!question.trim()) return 'Add a question.';
    const filled = options.filter((o) => String(o.text || '').trim());
    if (filled.length < MIN_OPTIONS) return 'Add at least two options with text.';
    if (isTest && !filled.some((o) => o.correct)) {
      return 'Mark at least one option as correct for a test.';
    }
    return '';
  }, [question, options, isTest]);

  const handleSubmit = async () => {
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    const payload = createPollPayload({
      question: question.trim(),
      mode,
      anonymous,
      multipleChoice,
      maxAttempts: isTest ? maxAttempts : 1,
      showCorrectAfterAnswer: isTest ? showCorrectAfterAnswer : false,
      explanation: isTest ? explanation.trim() : '',
      options: options
        .filter((o) => String(o.text || '').trim())
        .map((o) => ({
          id: o.id,
          text: o.text.trim(),
          ...(isTest ? { correct: Boolean(o.correct) } : {}),
        })),
    });
    try {
      await onSubmit?.(serializePayload(payload));
      resetForm();
      onClose?.();
    } catch (e) {
      setError(typeof e === 'string' ? e : 'Could not create poll. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Create poll</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, pt: 1 }}>
        <TextField
          label="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          autoFocus
        />

        <BinaryChoiceField
          label="Who can see voters?"
          value={anonymous ? 'anonymous' : 'public'}
          onChange={(next) => setAnonymous(next === 'anonymous')}
          disabled={submitting}
          options={[
            { id: 'public', label: 'Public' },
            { id: 'anonymous', label: 'Anonymous' },
          ]}
        />

        <BinaryChoiceField
          label="How many options can people pick?"
          value={multipleChoice ? 'multiple' : 'single'}
          onChange={(next) => setMultipleChoice(next === 'multiple')}
          disabled={submitting}
          options={[
            { id: 'single', label: 'Single choice' },
            { id: 'multiple', label: 'Multiple choice' },
          ]}
        />

        <BinaryChoiceField
          label="Format"
          value={mode}
          onChange={setMode}
          disabled={submitting}
          options={[
            { id: 'poll', label: 'Poll' },
            { id: 'test', label: 'Test' },
          ]}
        />

        {isTest ? (
          <>
            <PollStepperField
              label="Allowed tries"
              value={maxAttempts}
              min={1}
              max={10}
              onChange={setMaxAttempts}
              disabled={submitting}
            />
            <BinaryChoiceField
              label="After answering"
              value={showCorrectAfterAnswer ? 'reveal' : 'hide'}
              onChange={(next) => setShowCorrectAfterAnswer(next === 'reveal')}
              disabled={submitting}
              options={[
                { id: 'reveal', label: 'Show answers' },
                { id: 'hide', label: 'Hide answers' },
              ]}
            />
            <TextField
              label="Explanation (optional)"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              placeholder="Shown when reveal is enabled"
            />
          </>
        ) : null}

        <Box>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            Options
          </Typography>
          {isTest ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Check the correct answer(s).
            </Typography>
          ) : null}
          {options.map((option, index) => (
            <Box key={option.id} display="flex" alignItems="flex-start" gap={1} mb={1}>
              {isTest ? (
                <Checkbox
                  checked={Boolean(option.correct)}
                  onChange={(e) => updateOption(option.id, { correct: e.target.checked })}
                  sx={{ mt: 0.5 }}
                  inputProps={{ 'aria-label': `Mark option ${index + 1} as correct` }}
                />
              ) : null}
              <TextField
                fullWidth
                size="small"
                value={option.text}
                onChange={(e) => updateOption(option.id, { text: e.target.value })}
                placeholder={`Option ${index + 1}`}
              />
              <IconButton
                size="small"
                aria-label="Remove option"
                onClick={() => removeOption(option.id)}
                disabled={options.length <= MIN_OPTIONS}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={addOption}
            disabled={options.length >= MAX_OPTIONS}
          >
            Add option
          </Button>
        </Box>

        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || Boolean(validationError)}>
          Post
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PollCreationDialog;
