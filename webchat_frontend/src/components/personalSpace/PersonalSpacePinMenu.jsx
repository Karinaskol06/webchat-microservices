import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ChecklistIcon from '@mui/icons-material/Checklist';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import PollOutlinedIcon from '@mui/icons-material/PollOutlined';

const BASE_ITEMS = [
  { id: 'TODO', label: 'To-do list', icon: ChecklistIcon },
  { id: 'STICKY_NOTE', label: 'Sticky note', icon: StickyNote2OutlinedIcon },
  { id: 'CALLOUT', label: 'Reminder callout', icon: LightbulbOutlinedIcon },
];

const POLL_ITEM = { id: 'POLL', label: 'Poll / test', icon: PollOutlinedIcon };

const PersonalSpacePinMenu = ({ anchorEl, open, onClose, onSelect, showPollOption = false }) => {
  const items = showPollOption ? [...BASE_ITEMS, POLL_ITEM] : BASE_ITEMS;

  return (
  <Menu
    anchorEl={anchorEl}
    open={open}
    onClose={onClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
    transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    slotProps={{
      paper: {
        sx: {
          minWidth: 220,
          borderRadius: 2,
          mt: -1,
        },
      },
    }}
  >
    {items.map(({ id, label, icon: Icon }) => (
      <MenuItem
        key={id}
        onClick={() => {
          onSelect?.(id);
          onClose?.();
        }}
      >
        <ListItemIcon>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText primary={label} />
      </MenuItem>
    ))}
  </Menu>
  );
};

export default PersonalSpacePinMenu;
