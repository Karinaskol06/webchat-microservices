import React from 'react';
import { Box, Button, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌',
  '😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳',
  '😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬',
  '🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🫢','🤭','🫣','🤫','🤥',
  '😶','😶‍🌫️','😐','😑','😬','🫠','🙄','😯','😦','😧','😮','😮‍💨','😲','🥱','😴','🤤','😪','😵','😵‍💫',
  '🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩',
  '👻','💀','☠️','👽','👾','🤖',
  '😺','😸','😹','😻','😼','😽','🙀','😿','😾',
  '👍','👎','👏','🙏','🫶','👋','🤝','👌',
  '🔥','🎉','❤️','💙','💚','💛','🖤','🤍','💜','💯','✅','❌','⚡','⭐','🌟','💬','📎','📌',
];

const TWEMOJI_BASE =
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';

const emojiToTwemojiUrl = (emoji) => {
  const codepoints = Array.from(emoji)
    .map((c) => c.codePointAt(0).toString(16))
    .join('-');
  return `${TWEMOJI_BASE}${codepoints}.svg`;
};

const EmojiSidebar = ({ onClose, onEmojiClick }) => {
  return (
    <Box
      sx={{
        width: 280,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2">Emojis</Typography>
        <Tooltip title="Hide emoji sidebar">
          <IconButton size="small" onClick={onClose}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1 }}>
          {EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              variant="text"
              onClick={() => onEmojiClick?.(emoji)}
              sx={{ minWidth: 0, p: 0.75, lineHeight: 1 }}
            >
              <Box
                component="img"
                src={emojiToTwemojiUrl(emoji)}
                alt={emoji}
                loading="lazy"
                sx={{ width: 26, height: 26, display: 'block' }}
              />
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default EmojiSidebar;

