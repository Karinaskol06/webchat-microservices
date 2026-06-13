import React from 'react';
import {
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
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import useChatStore from '../../store/useChatStore';
import useChatFolderStore from '../../store/useChatFolderStore';
import ChatFolderRailSection from './ChatFolderRailSection';
import { isChatDragEvent, readChatDragId } from '../../utils/chatDrag';
import { chatColors, chatLayout, muiTransparent } from '../../theme/chatDesignTokens';
import UserAvatar from '../user/UserAvatar';

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

const navRailIconSx = (active, { dropTarget = false } = {}) => ({
  width: 48,
  height: 48,
  mx: 'auto',
  color: active ? chatColors.navIconActive : chatColors.navIcon,
  bgcolor: dropTarget
    ? 'rgba(123, 97, 255, 0.45)'
    : active
      ? chatColors.navActiveBg
      : muiTransparent,
  outline: dropTarget ? '2px dashed rgba(255,255,255,0.65)' : 'none',
  outlineOffset: 2,
  borderRadius: 2,
  transition: 'background-color 0.15s ease, outline 0.15s ease, box-shadow 0.15s ease',
  '&:hover': {
    bgcolor: dropTarget
      ? 'rgba(123, 97, 255, 0.35)'
      : active
        ? chatColors.navActiveBg
        : 'rgba(24, 20, 28, 0.06)',
  },
  '&:focus-visible': {
    outline: `2px solid ${chatColors.primary}`,
    outlineOffset: 2,
  },
});

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
  pendingRoomInviteCount = 0,
  settingsOpen,
  personalSpaceActive,
  onPersonalSpaceSelect,
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
        <Tooltip title={FIND_USERS_ITEM.label} placement="right">
          <IconButton
            aria-label={FIND_USERS_ITEM.label}
            aria-pressed={findUsersOpen ? 'true' : undefined}
            onClick={() => onFindUsers?.()}
            sx={navRailIconSx(findUsersOpen)}
          >
            <Badge
              badgeContent={
                pendingRoomInviteCount > 0
                  ? pendingRoomInviteCount > 9
                    ? '9+'
                    : pendingRoomInviteCount
                  : 0
              }
              overlap="circular"
              invisible={!pendingRoomInviteCount}
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: chatColors.unreadBadge,
                  color: chatColors.textOnPrimary,
                  fontWeight: 700,
                },
              }}
            >
              <FIND_USERS_ITEM.icon fontSize="small" />
            </Badge>
          </IconButton>
        </Tooltip>

        {CHAT_FILTERS.map(({ id, label, icon: Icon }) => {
          const active = !personalSpaceActive && !activeFolderId && activeFilter === id;
          const badge = id === 'ALL' ? unreadByFilter.ALL : unreadByFilter[id];
          const isAllChats = id === 'ALL';
          const isAllDropTarget = isAllChats && dragOverFolderId === '__all__';

          return (
            <Tooltip key={id} title={label} placement="right">
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
                  sx={navRailIconSx(active, { dropTarget: isAllDropTarget })}
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
          );
        })}

        <Tooltip title="Personal Space" placement="right">
          <IconButton
            aria-label="Personal Space"
            aria-current={personalSpaceActive ? 'true' : undefined}
            onClick={() => onPersonalSpaceSelect?.()}
            sx={navRailIconSx(personalSpaceActive)}
          >
            <SpaceDashboardOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <ChatFolderRailSection
          activeFolderId={activeFolderId}
          personalSpaceActive={personalSpaceActive}
          onSelectFolder={onFolderSelect}
        />
      </Box>

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
            <UserAvatar
              user={user}
              cacheKey={user?.avatarRevision}
              variant="rounded"
              sx={{ width: 40, height: 40, border: `2px solid ${chatColors.glassPanelBorder}` }}
            />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton
            aria-label="Settings"
            aria-pressed={settingsOpen ? 'true' : undefined}
            onClick={() => onOpenSettings?.()}
            sx={{
              color: settingsOpen ? chatColors.navIconActive : chatColors.navIcon,
              bgcolor: settingsOpen ? chatColors.navActiveBg : muiTransparent,
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
