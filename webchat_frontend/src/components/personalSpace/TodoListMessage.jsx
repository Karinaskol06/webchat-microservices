import React, { useCallback, useState } from 'react';
import {
  Box,
  Checkbox,
  IconButton,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { chatColors, chatRadii, themePrimaryAlpha } from '../../theme/chatDesignTokens';
import { serializePayload } from '../../utils/personalSpace';
import { useTodoTaskDrafts } from '../../hooks/useTodoTaskDrafts';

const TodoListMessage = ({
  payload,
  editable,
  canToggleTasks = false,
  onUpdate,
  onDelete,
  messageId,
}) => {
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const [newTaskText, setNewTaskText] = useState('');
  const { draftById, setDraft, onFocus, onBlur, mergeDrafts } = useTodoTaskDrafts(
    messageId ?? 'todo',
    tasks,
  );

  const persist = useCallback(
    (nextTasks) => {
      onUpdate?.(serializePayload({ tasks: nextTasks }));
    },
    [onUpdate],
  );

  const flushTask = (id, text) => {
    const merged = mergeDrafts();
    const nextTasks = merged.map((t) => (t.id === id ? { ...t, text } : t));
    const current = tasks.find((t) => t.id === id);
    if ((current?.text ?? '') === text) {
      return;
    }
    persist(nextTasks);
  };

  const updateTask = (id, patch) => {
    persist(mergeDrafts().map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTask = (id) => {
    const next = mergeDrafts().filter((t) => t.id !== id);
    persist(next.length ? next : [{ id: crypto.randomUUID(), text: '', done: false }]);
  };

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    persist([...mergeDrafts(), { id: crypto.randomUUID(), text, done: false }]);
    setNewTaskText('');
  };

  const canCheckTasks = editable || (canToggleTasks && Boolean(onUpdate));

  const taskTextSx = {
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
    color: chatColors.textPrimary,
  };

  return (
    <Box
      sx={{
        width: 'max-content',
        maxWidth: '100%',
        minWidth: { xs: '100%', sm: 280 },
        boxSizing: 'border-box',
        p: 2,
        borderRadius: `${chatRadii.md}px`,
        bgcolor: (theme) => themePrimaryAlpha(theme, 0.12),
        border: (theme) => `1px solid ${themePrimaryAlpha(theme, 0.28)}`,
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: chatColors.textPrimary }}>
          To-do
        </Typography>
        {editable && onDelete ? (
          <IconButton size="small" aria-label="Delete to-do list" onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>

      {tasks.map((task) => (
        <Box
          key={task.id}
          display="flex"
          alignItems="flex-start"
          gap={0.5}
          mb={0.75}
          sx={{
            opacity: task.done ? 0.72 : 1,
            width: '100%',
            minWidth: 0,
          }}
        >
          <Checkbox
            size="small"
            checked={Boolean(task.done)}
            disabled={!canCheckTasks}
            onChange={(e) => updateTask(task.id, { done: e.target.checked })}
            sx={{ p: 0.25, mt: 0.25 }}
          />
          {editable ? (
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={6}
              size="small"
              variant="standard"
              value={draftById[task.id] ?? task.text ?? ''}
              onChange={(e) => setDraft(task.id, e.target.value)}
              onFocus={() => onFocus(task.id)}
              onBlur={() => {
                onBlur(task.id, (text) => {
                  if (!String(text || '').trim() && tasks.length > 1) {
                    removeTask(task.id);
                    return;
                  }
                  flushTask(task.id, text);
                });
              }}
              placeholder="Task"
              InputProps={{ disableUnderline: false }}
              sx={{
                flex: 1,
                minWidth: 0,
                alignSelf: 'stretch',
                '& .MuiInput-input': {
                  ...taskTextSx,
                  fieldSizing: 'content',
                  minWidth: '10ch',
                  maxWidth: '100%',
                  textDecoration: task.done ? 'line-through' : 'none',
                },
              }}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                minWidth: 0,
                pt: 0.75,
                textDecoration: task.done ? 'line-through' : 'none',
                ...taskTextSx,
              }}
            >
              {task.text || '—'}
            </Typography>
          )}
          {editable && tasks.length > 1 ? (
            <IconButton
              size="small"
              aria-label="Remove task"
              onClick={() => removeTask(task.id)}
              sx={{ mt: 0.25 }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          ) : null}
        </Box>
      ))}

      {editable ? (
        <Box display="flex" gap={1} mt={1.5}>
          <TextField
            fullWidth
            size="small"
            placeholder="Add a task…"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTask();
              }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={addTask}
            disabled={!newTaskText.trim()}
            startIcon={<AddIcon />}
            sx={{ flexShrink: 0, borderRadius: 2 }}
          >
            Add
          </Button>
        </Box>
      ) : null}
    </Box>
  );
};

export default TodoListMessage;
