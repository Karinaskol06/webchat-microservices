import React from 'react';
import {
  Avatar,
  Badge,
  Box,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import SearchIcon from '@mui/icons-material/Search';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import useChatFolderStore from '../../store/useChatFolderStore';
import ChatFolderRailSection from './ChatFolderRailSection';
import { isChatDragEvent, readChatDragId } from '../../utils/chatDrag';
import { chatColors, chatLayout } from '../../theme/chatDesignTokens';

const CHAT_FILTERS = [
  { id: 'ALL', label: 'All chats', icon: ChatBubbleOutlineIcon },
  { id: 'PRIVATE', label: 'Direct', icon: PersonOutlineIcon },
  { id: 'GROUP', label: 'Groups', icon: PeopleOutlineIcon },
  { id: 'CHANNEL', label: 'Channels', icon: CampaignOutlinedIcon },
];

const FIND_USERS_ITEM = {
  id: 'FIND_USERS',
  label: 'Find users & rooms',
  icon: SearchIcon,
};

const ChatNavRail = ({
  activeFilter,
  activeFolderId,
  onFilterChange,
  onFolderSelect,
  onAllChatsSelect,
  onOpenProfile,
  onOpenSettings,
  onFindUsers,
  findUsersOpen,
  settingsOpen,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const chats = useChatStore((s) => s.chats);
  const folders = useChatFolderStore((s) => s.folders);
  const dragOverFolderId = useChatFolderStore((s) => s.dragOverFolderId);
  const setDragOverFolderId = useChatFolderStore((s) => s.setDragOverFolderId);
  const assignChatToFolder = useChatFolderStore((s) => s.assignChatToFolder);

  const unreadByFilter = React.useMemo(() => {
    const counts = { ALL: 0, PRIVATE: 0, GROUP: 0, CHANNEL: 0 };
    (Array.isArray(chats) ? chats : []).forEach((chat) => {
      const n = chat.unreadCount || 0;
      if (n <= 0) return;
      counts.ALL += n;
      const t = String(chat.type || '').toUpperCase();
      if (t === 'GROUP') counts.GROUP += n;
      else if (t === 'CHANNEL') counts.CHANNEL += n;
      else counts.PRIVATE += n;
    });
    return counts;
  }, [chats]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const letter = (user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase();

  return (
    <Box
      component="nav"
      aria-label="Chat navigation"
      sx={{
        width: '100%',
        height: '100%',
        flexShrink: 0,
        bgcolor: chatColors.navBg,
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        gap: 0.5,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          width: '100%',
          px: 1,
        }}
      >
        {CHAT_FILTERS.map(({ id, label, icon: Icon }, index) => {
          const active = !activeFolderId && activeFilter === id;
          const badge = id === 'ALL' ? unreadByFilter.ALL : unreadByFilter[id];
          const findItem = index === 0 ? FIND_USERS_ITEM : null;
          const FindIcon = findItem?.icon;
          const isAllChats = id === 'ALL';
          const isAllDropTarget = isAllChats && dragOverFolderId === '__all__';

          return (
            <React.Fragment key={id}>
              <Tooltip
                title={isAllChats ? 'All chats — drop here to remove from folder' : label}
                placement="right"
              >
                <IconButton
                  aria-label={label}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    onAllChatsSelect?.();
                    onFilterChange?.(id);
                  }}
                  onDragOver={
                    isAllChats
                      ? (e) => {
                          if (!isChatDragEvent(e)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverFolderId('__all__');
                        }
                      : undefined
                  }
                  onDragLeave={
                    isAllChats
                      ? () => {
                          if (isAllDropTarget) setDragOverFolderId(null);
                        }
                      : undefined
                  }
                  onDrop={
                    isAllChats
                      ? (e) => {
                          e.preventDefault();
                          const chatId = readChatDragId(e);
                          setDragOverFolderId(null);
                          if (chatId) assignChatToFolder(chatId, null);
                        }
                      : undefined
                  }
                  sx={{
                    width: 48,
                    height: 48,
                    mx: 'auto',
                    color: active ? chatColors.navIconActive : chatColors.navIcon,
                    bgcolor: isAllDropTarget
                      ? 'rgba(123, 97, 255, 0.45)'
                      : active
                        ? chatColors.navActiveBg
                        : 'transparent',
                    outline: isAllDropTarget ? '2px dashed rgba(255,255,255,0.65)' : 'none',
                    outlineOffset: 2,
                    borderRadius: 2,
                    transition: 'background-color 0.15s ease, outline 0.15s ease',
                    '&:hover': {
                      bgcolor: isAllDropTarget
                        ? 'rgba(123, 97, 255, 0.35)'
                        : active
                          ? chatColors.navActiveBg
                          : 'rgba(24, 20, 28, 0.06)',
                    },
                  }}
                >
                  <Badge
                    badgeContent={badge > 0 ? (badge > 9 ? '9+' : badge) : 0}
                    overlap="circular"
                    invisible={!badge}
                    sx={{
                      '& .MuiBadge-badge': {
                        bgcolor: chatColors.unreadBadge,
                        color: chatColors.textOnPrimary,
                        fontWeight: 700,
                      },
                    }}
                  >
                    <Icon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
              {findItem && FindIcon ? (
                <Tooltip title={findItem.label} placement="right">
                  <IconButton
                    aria-label={findItem.label}
                    aria-pressed={findUsersOpen ? 'true' : undefined}
                    onClick={() => onFindUsers?.()}
                    sx={{
                      width: 48,
                      height: 48,
                      mx: 'auto',
                      color: findUsersOpen ? chatColors.navIconActive : chatColors.navIcon,
                      bgcolor: findUsersOpen ? chatColors.navActiveBg : 'transparent',
                      '&:hover': {
                        bgcolor: findUsersOpen ? chatColors.navActiveBg : 'rgba(24, 20, 28, 0.06)',
                      },
                    }}
                  >
                    <FindIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </React.Fragment>
          );
        })}
      </Box>

      <ChatFolderRailSection
        activeFolderId={activeFolderId}
        onSelectFolder={onFolderSelect}
      />

      <Box
        sx={{
          mt: 'auto',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          pt: 1,
          width: '100%',
        }}
      >
        <Tooltip title="My profile">
          <IconButton
            aria-label="My profile"
            onClick={onOpenProfile}
            sx={{ p: 0.5 }}
          >
            <Avatar
              src={user?.profilePicture || undefined}
              variant="rounded"
              sx={{ width: 40, height: 40, border: `2px solid ${chatColors.glassPanelBorder}` }}
            >
              {!user?.profilePicture ? letter : null}
            </Avatar>
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton
            aria-label="Settings"
            aria-pressed={settingsOpen ? 'true' : undefined}
            onClick={() => onOpenSettings?.()}
            sx={{
              color: settingsOpen ? chatColors.navIconActive : chatColors.navIcon,
              bgcolor: settingsOpen ? chatColors.navActiveBg : 'transparent',
              '&:hover': {
                bgcolor: settingsOpen ? chatColors.navActiveBg : 'rgba(24, 20, 28, 0.06)',
              },
            }}
          >
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Log out">
          <IconButton
            aria-label="Log out"
            onClick={handleLogout}
            sx={{
              color: chatColors.navIcon,
              '&:hover': { bgcolor: 'rgba(24, 20, 28, 0.06)' },
            }}
          >
            <LogoutOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography
          variant="caption"
          sx={{
            color: chatColors.glassPanelTextMuted,
            fontSize: '0.65rem',
            mt: 0.5,
            maxWidth: 56,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user?.username}
        </Typography>
      </Box>
    </Box>
  );
};

export default ChatNavRail;
