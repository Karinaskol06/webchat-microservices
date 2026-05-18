import React, { useState } from 'react';
import {
  Box,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { chatColors, chatHideScrollbarSx } from '../../theme/chatDesignTokens';

/**
 * Curated emoji list by category — rendered natively so ZWJ / skin tones / flags
 * display correctly (Twemoji CDN filenames are easy to get wrong per sequence).
 */
const EMOJI_CATEGORIES = [
  {
    label: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍',
      '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
      '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😶‍🌫️', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵',
      '😵‍💫', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '☹️', '😮', '😯',
      '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
      '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
      '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
    ],
  },
  {
    label: 'Gestures',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐',
      '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
      '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
    ],
  },
  {
    label: 'People',
    emojis: [
      '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅',
      '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '🥷', '👷', '🤴', '👸', '👳',
      '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜',
      '🧝', '🧞', '🧟', '💆', '💇', '🚶', '🧍', '🧎', '🏃', '💃', '🕺', '🕴️', '👯', '🧖', '🧗',
      '🤺', '🏇', '⛷️', '🏂', '🏌️', '🏄', '🚣', '🏊', '⛹️', '🏋️', '🚴', '🚵', '🤸', '🤼', '🤽',
      '🤾', '🤹', '🧘', '🛀', '🛌',
    ],
  },
  {
    label: 'Hearts & signs',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '💟', '💋', 
      '✅', '☑️', '✔️', '✖️', '❌', '⭕', '❗', '❓', '❕', '❔', '‼️', '⁉️', '💯', '🔅', '🔆',
    ],
  },
  {
    label: 'Animals',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸',
      '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟',
      '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
      '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛',
      '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐',
      '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩',
      '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
    ],
  },
  {
    label: 'Food',
    emojis: [
      '🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍',
      '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅',
      '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩',
      '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗',
      '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘',
      '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬',
      '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋',
      '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊',
    ],
  },
  {
    label: 'Activities',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑',
      '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
      '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘',
      '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🎖️', '🏆', '🥇', '🥈', '🥉', '🏅', '🎫', '🎟️',
      '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗',
      '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
    ],
  },
  {
    label: 'Objects',
    emojis: [
      '📱', '📲', '☎️', '📞', '📟', '📠', '🔋', '🪫', '🔌', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️',
      '💽', '💾', '💿', '📀', '🧮', '🎥', '🎞️', '📽️', '📷', '📸', '📹', '📼', '🔍', '🔎', '🕯️',
      '💡', '🔦', '🏮', '🪔', '📔', '📕', '📖', '📗', '📘', '📙', '📚', '📓', '📒', '📃', '📜',
      '📄', '📰', '🗞️', '📑', '🔖', '🏷️', '💰', '🪙', '💴', '💵', '💶', '💷', '💸', '💳', '🧾',
      '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '✏️', '✒️', '🖋️',
      '🖊️', '🖌️', '🖍️', '📝', '💼', '📁', '📂', '🗂️', '📅', '📆', '🗒️', '🗓️', '📇', '📈', '📉',
      '📊', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗃️', '🗄️', '🗑️', '🔒', '🔓', '🔏', '🔐',
      '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🗡️', '⚔️', '🔫', '🪃', '🏹', '🛡️', '🪚', '🔧',
      '🪛', '🔩', '⚙️', '🗜️', '⚖️', '🦯', '🔗', '⛓️', '🪝', '🧰', '🧲', '🪜', '⚗️', '🧪', '🧫',
      '🦠', '💉', '🩸', '💊', '🩹', '🩼', '🩺', '🩻', '🚪', '🛏️', '🛋️', '🪑', '🚽', '🚿', '🛁',
      '🧴', '🧷', '🧹', '🧺', '🧻', '🪣', '🧼', '🪥', '🧽', '🧯', '🛒', '🚬', '⚰️', '🪦', '⚱️',
    ],
  },
  {
    label: 'Nature',
    emojis: [
      '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🪻', '🌱', '🪴', '🌲', '🌳', '🌴',
      '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🪹', '🪺', '🍄', '🪾', '🌑', '🌒', '🌓',
      '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '🌡️', '☀️', '🌝', '🌞', '⭐', '🌟',
      '🌠', '☁️', '⛅', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌬️', '🌀', '🌈',
      '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌊',
    ],
  },
  {
    label: 'Transport',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯',
      '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
      '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '🛫', '🛬', '🛩️',
      '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝', '⛽',
      '🚧', '🚦', '🚥', '🛑', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠',
      '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️',
      '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️',
    ],
  },
];

const EMOJI_FONT =
  'system-ui, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const EmojiSidebar = ({ onClose, onEmojiClick, highlighted = false, reactionMode = false }) => {
  const [activeLabel, setActiveLabel] = useState(EMOJI_CATEGORIES[0]?.label ?? '');

  return (
    <Box
      sx={{
        width: 300,
        borderLeft: 1,
        borderColor: highlighted ? chatColors.primaryLight : chatColors.borderSubtle,
        bgcolor: chatColors.conversationBg,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        boxShadow: highlighted ? `-4px 0 0 0 ${chatColors.primary}` : 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle2" sx={{ color: chatColors.textPrimary }}>
          {reactionMode ? 'Pick a reaction' : 'Emojis'}
        </Typography>
        <Tooltip title="Hide emoji sidebar">
          <IconButton size="small" onClick={onClose} sx={{ color: chatColors.textPrimary }}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider sx={{ borderColor: chatColors.borderSubtle }} />
      <Box
        sx={{
          pt: 2,
          pb: 1.25,
          px: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 0.75,
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
          bgcolor: chatColors.conversationBg,
          borderBottom: 1,
          borderColor: chatColors.borderSubtle,
          WebkitOverflowScrolling: 'touch',
          ...chatHideScrollbarSx,
        }}
      >
        {EMOJI_CATEGORIES.map((cat) => (
          <Chip
            key={cat.label}
            label={cat.label}
            size="small"
            onClick={() => setActiveLabel(cat.label)}
            color={activeLabel === cat.label ? 'primary' : 'default'}
            variant={activeLabel === cat.label ? 'filled' : 'outlined'}
            sx={{ fontSize: '0.7rem', flexShrink: 0 }}
          />
        ))}
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.25 }}>
        {EMOJI_CATEGORIES.filter((c) => c.label === activeLabel).map((cat) => (
          <Box key={cat.label}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 0.25,
              }}
            >
              {cat.emojis.map((emoji) => (
                <Tooltip key={`${cat.label}:${emoji}`} title={emoji} placement="top">
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onEmojiClick?.(emoji)}
                    sx={{
                      border: 0,
                      borderRadius: 1,
                      bgcolor: 'transparent',
                      cursor: 'pointer',
                      p: 0.5,
                      m: 0,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: EMOJI_FONT,
                      fontSize: '1.5rem',
                      lineHeight: 1,
                      transition: 'background-color 120ms ease',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:focus-visible': {
                        outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 0,
                      },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontFamily: EMOJI_FONT,
                        fontSize: '1.5rem',
                        lineHeight: 1,
                        display: 'block',
                        // Avoid clipping composite emoji (ZWJ / flags)
                        overflow: 'visible',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {emoji}
                    </Box>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default EmojiSidebar;
