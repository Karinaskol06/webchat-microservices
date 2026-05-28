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
import { alpha } from '@mui/material/styles';
import { chatColors, chatRadii } from '../../theme/chatDesignTokens';
import { serializePayload } from '../../utils/personalSpace';

const TodoListMessage = ({ payload, editable, onUpdate, onDelete }) => {
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const [newTaskText, setNewTaskText] = useState('');

  const persist = useCallback(
    (nextTasks) => {
      onUpdate?.(serializePayload({ tasks: nextTasks }));
    },
    [onUpdate],
  );

  const updateTask = (id, patch) => {
    persist(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const removeTask = (id) => {
    const next = tasks.filter((t) => t.id !== id);
    persist(next.length ? next : [{ id: crypto.randomUUID(), text: '', done: false }]);
  };

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    persist([...tasks, { id: crypto.randomUUID(), text, done: false }]);
    setNewTaskText('');
  };

  return (
    <Box
      sx={{
        minWidth: { xs: '100%', sm: 280 },
        maxWidth: 420,
        p: 2,
        borderRadius: `${chatRadii.md}px`,
        bgcolor: alpha(chatColors.primary, 0.12),
        border: `1px solid ${alpha(chatColors.primary, 0.28)}`,
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
          sx={{ opacity: task.done ? 0.72 : 1 }}
        >
          <Checkbox
            size="small"
            checked={Boolean(task.done)}
            disabled={!editable}
            onChange={(e) => updateTask(task.id, { done: e.target.checked })}
            sx={{ p: 0.25, mt: 0.25 }}
          />
          {editable ? (
            <TextField
              fullWidth
              size="small"
              variant="standard"
              value={task.text ?? ''}
              onChange={(e) => updateTask(task.id, { text: e.target.value })}
              onBlur={() => {
                if (!String(task.text || '').trim() && tasks.length > 1) {
                  removeTask(task.id);
                }
              }}
              placeholder="Task"
              InputProps={{ disableUnderline: false }}
              sx={{
                '& .MuiInput-input': {
                  textDecoration: task.done ? 'line-through' : 'none',
                  color: chatColors.textPrimary,
                },
              }}
            />
          ) : (
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                pt: 0.75,
                textDecoration: task.done ? 'line-through' : 'none',
                color: chatColors.textPrimary,
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
