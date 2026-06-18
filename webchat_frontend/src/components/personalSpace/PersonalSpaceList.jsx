import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import AddIcon from '@mui/icons-material/Add';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import chatService from '../../services/chatService';
import { getApiErrorMessage } from '../../services/api';
import useChatStore, { reorderChatsByRecent } from '../../store/useChatStore';
import {
  chatColors,
  chatGlassFieldPanelSx,
  chatRadii,
  chatUnreadCountBadgeSx,
  muiTransparent,
} from '../../theme/chatDesignTokens';
import UserAvatar from '../user/UserAvatar';
import { resolveRoomAvatarSrc } from '../../utils/userAvatar';
import { getMessagePreviewText } from '../../utils/personalSpace';
import CreatePersonalSpaceDialog from './CreatePersonalSpaceDialog';
import useTranslation from '../../hooks/useTranslation';

const PersonalSpaceList = ({
  spaces,
  loading,
  error,
  onRefresh,
  onSelectSpace,
  onOpenSpaceProfile,
  activeSpaceId,
}) => {
  const { t } = useTranslation();
  const removeChat = useChatStore((s) => s.removeChat);
  const upsertChat = useChatStore((s) => s.upsertChat);
  const storeChats = useChatStore((s) => s.chats);
  const [listSearch, setListSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuTarget, setMenuTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openMenu = (event, space) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuTarget(space);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuTarget(null);
  };

  const handleCreated = (dto) => {
    upsertChat(dto);
    onSelectSpace?.(dto);
    onRefresh?.();
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await chatService.deleteRoom(deleteTarget.id);
      removeChat(deleteTarget.id);
      closeMenu();
      setDeleteTarget(null);
      onRefresh?.();
    } catch (e) {
      setDeleteError(getApiErrorMessage(e, t('personalSpace.list.delete.error')));
    } finally {
      setDeleteBusy(false);
    }
  };

  const liveSpaces = useMemo(() => {
    const base = Array.isArray(spaces) ? spaces : [];
    const storeById = new Map(
      (Array.isArray(storeChats) ? storeChats : [])
        .filter((chat) => String(chat?.type || '').toUpperCase() === 'PERSONAL_SPACE')
        .map((chat) => [String(chat.id), chat]),
    );

    const merged = base.map((space) => {
      const live = storeById.get(String(space.id));
      if (live) storeById.delete(String(space.id));
      return live ? { ...space, ...live } : space;
    });

    storeById.forEach((chat) => merged.push(chat));
    return reorderChatsByRecent(merged);
  }, [spaces, storeChats]);

  const searchLower = listSearch.trim().toLowerCase();
  const filtered = liveSpaces.filter((space) => {
    if (!searchLower) return true;
    const name = space?.groupName || '';
    const desc = space?.description || '';
    const preview = getMessagePreviewText({
      content: space?.lastMessage || space?.lastMessageContent || '',
      messageType: space?.lastMessageType,
    });
    return `${name} ${desc} ${preview}`.toLowerCase().includes(searchLower);
  });

  const canDeleteSpace = () => liveSpaces.length > 1;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: muiTransparent,
        color: chatColors.glassPanelText,
      }}
    >
      <Box sx={{ flexShrink: 0, p: 1.5, borderBottom: `1px solid ${chatColors.glassPanelBorder}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
          <SpaceDashboardOutlinedIcon sx={{ fontSize: 20, color: chatColors.primary }} aria-hidden />
          <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, color: chatColors.glassPanelText }}>
            {t('personalSpace.list.title')}
          </Typography>
          <IconButton
            size="small"
            aria-label={t('personalSpace.list.create.ariaLabel')}
            onClick={() => setCreateOpen(true)}
            sx={{ color: chatColors.glassPanelTextMuted }}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
        <TextField
          size="small"
          fullWidth
          placeholder={t('personalSpace.list.search.placeholder')}
          value={listSearch}
          onChange={(e) => setListSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: chatColors.glassPanelTextMuted }} />
              </InputAdornment>
            ),
          }}
          sx={chatGlassFieldPanelSx}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => onRefresh?.()}>
                  {t('common.retry')}
                </Button>
              }
            >
              {error}
            </Alert>
          </Box>
        ) : filtered.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography variant="body1" paragraph sx={{ color: chatColors.glassPanelTextMuted }}>
              {liveSpaces.length === 0
                ? t('personalSpace.list.empty.none')
                : t('personalSpace.list.empty.noMatch')}
            </Typography>
            {liveSpaces.length === 0 ? (
              <Button variant="contained" onClick={() => setCreateOpen(true)} sx={{ mt: 1 }}>
                {t('personalSpace.list.createFirst')}
              </Button>
            ) : null}
          </Box>
        ) : (
          <List sx={{ width: '100%', minWidth: 0, bgcolor: muiTransparent, py: 0 }}>
            {filtered.map((space) => {
              const isSelected = String(activeSpaceId) === String(space.id);
              const name = space.groupName || t('roomProfile.fallback.personalSpace');
              const letter = (name[0] || 'P').toUpperCase();
              const preview = getMessagePreviewText({
                content: space.lastMessage || space.lastMessageContent || '',
                messageType: space.lastMessageType,
              }) || t('personalSpace.list.preview.fallback');
              const unreadCount = space.unreadCount || 0;

              return (
                <ListItem
                  key={space.id}
                  onClick={() => onSelectSpace?.(space)}
                  sx={{
                    mx: 1,
                    mb: 0.5,
                    minWidth: 0,
                    borderRadius: `${chatRadii.avatar}px`,
                    bgcolor: isSelected ? chatColors.surfaceMuted : muiTransparent,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                      bgcolor: isSelected ? chatColors.surfaceMuted : 'rgba(123, 97, 255, 0.06)',
                    },
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ListItemAvatar
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSpaceProfile?.(space);
                    }}
                    sx={{ cursor: 'pointer', minWidth: 56 }}
                  >
                    <UserAvatar
                      src={resolveRoomAvatarSrc(space)}
                      letter={letter}
                      disableMediaCache
                    />
                  </ListItemAvatar>
                  <ListItemText
                    sx={{ minWidth: 0, flex: 1, mr: 0.5 }}
                    primary={
                      <Typography variant="subtitle2" noWrap sx={{ color: chatColors.glassPanelText }}>
                        {name}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ color: chatColors.glassPanelTextMuted }}
                      >
                        {preview}
                      </Typography>
                    }
                  />
                  {unreadCount > 0 ? (
                    <Box
                      component="span"
                      sx={{
                        ...chatUnreadCountBadgeSx,
                        mr: 0.75,
                      }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Box>
                  ) : null}
                  <IconButton
                    size="small"
                    aria-label={t('personalSpace.list.options.ariaLabel', { name })}
                    onClick={(e) => openMenu(e, space)}
                    sx={{ color: chatColors.glassPanelTextMuted }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
        <MenuItem
          onClick={() => {
            closeMenu();
            onOpenSpaceProfile?.(menuTarget);
          }}
        >
          {t('personalSpace.list.menu.details')}
        </MenuItem>
        <MenuItem
          disabled={!canDeleteSpace(menuTarget)}
          onClick={() => {
            setDeleteTarget(menuTarget);
            closeMenu();
          }}
          sx={{ color: canDeleteSpace(menuTarget) ? 'error.main' : undefined }}
        >
          {t('personalSpace.list.menu.delete')}
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleteBusy && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {t('personalSpace.list.delete.title', {
            name: deleteTarget?.groupName || t('personalSpace.list.delete.fallbackName'),
          })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('personalSpace.list.delete.body')}
          </DialogContentText>
          {deleteError ? (
            <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
              {deleteError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
            {t('common.cancel')}
          </Button>
          <Button color="error" variant="contained" disabled={deleteBusy} onClick={() => void handleDelete()}>
            {deleteBusy ? t('common.deleting') : t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      <CreatePersonalSpaceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </Box>
  );
};

export default PersonalSpaceList;
