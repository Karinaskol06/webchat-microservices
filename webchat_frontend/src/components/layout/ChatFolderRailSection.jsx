import React from 'react';
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import useChatFolderStore from '../../store/useChatFolderStore';
import useChatStore from '../../store/useChatStore';
import { isChatDragEvent, readChatDragId } from '../../utils/chatDrag';
import { chatColors } from '../../theme/chatDesignTokens';

const ChatFolderRailSection = ({ activeFolderId, onSelectFolder }) => {
  const folders = useChatFolderStore((s) => s.folders);
  const foldersSectionCollapsed = useChatFolderStore((s) => s.foldersSectionCollapsed);
  const setFoldersSectionCollapsed = useChatFolderStore((s) => s.setFoldersSectionCollapsed);
  const dragOverFolderId = useChatFolderStore((s) => s.dragOverFolderId);
  const setDragOverFolderId = useChatFolderStore((s) => s.setDragOverFolderId);
  const assignChatToFolder = useChatFolderStore((s) => s.assignChatToFolder);
  const toggleFolderCollapsed = useChatFolderStore((s) => s.toggleFolderCollapsed);
  const chatAssignments = useChatFolderStore((s) => s.chatAssignments);
  const chats = useChatStore((s) => s.chats);

  const unreadByFolder = React.useMemo(() => {
    const map = {};
    (Array.isArray(chats) ? chats : []).forEach((chat) => {
      const n = chat.unreadCount || 0;
      if (n <= 0 || chat.id == null) return;
      const fid = chatAssignments[String(chat.id)];
      if (fid) map[fid] = (map[fid] || 0) + n;
    });
    return map;
  }, [chats, chatAssignments]);

  if (folders.length === 0) {
    return null;
  }

  const handleDragOver = (event, folderId) => {
    if (!isChatDragEvent(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  };

  const handleDragLeave = (folderId) => {
    if (dragOverFolderId === folderId) setDragOverFolderId(null);
  };

  const handleDrop = (event, folderId) => {
    event.preventDefault();
    const chatId = readChatDragId(event);
    setDragOverFolderId(null);
    if (chatId) assignChatToFolder(chatId, folderId);
  };

  return (
    <>
      <Divider sx={{ width: '80%', borderColor: chatColors.glassPanelBorder, my: 0.5 }} />
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: 1,
          maxHeight: '100%',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            minHeight: 28,
            px: 0.5,
          }}
        >
          <Typography
            variant="caption"
            component="span"
            sx={{
              color: chatColors.glassPanelTextMuted,
              fontSize: '0.6rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              textAlign: 'center',
              lineHeight: 1.2,
              width: '100%',
            }}
          >
            Tabs
          </Typography>
          <IconButton
            size="small"
            aria-label={foldersSectionCollapsed ? 'Expand tabs' : 'Collapse tabs'}
            onClick={() => setFoldersSectionCollapsed(!foldersSectionCollapsed)}
            sx={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              color: chatColors.glassPanelTextMuted,
              p: 0.25,
            }}
          >
            {foldersSectionCollapsed ? (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Box>

        <Collapse in={!foldersSectionCollapsed}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              py: 0.5,
              px: 0.5,
              scrollbarWidth: 'thin',
              '&::-webkit-scrollbar': { width: 4 },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(255,255,255,0.2)',
                borderRadius: 4,
              },
            }}
          >
            {folders.map((folder) => {
              const active = String(activeFolderId) === String(folder.id);
              const isDropTarget = dragOverFolderId === folder.id;
              const unread = unreadByFolder[folder.id] || 0;
              const FolderIcon = folder.collapsed ? FolderOutlinedIcon : FolderOpenOutlinedIcon;

              return (
                <Tooltip
                  key={folder.id}
                  title={
                    unread > 0
                      ? `${folder.name} (${unread} unread)`
                      : folder.name
                  }
                  placement="right"
                >
                  <IconButton
                    aria-label={folder.name}
                    aria-current={active ? 'true' : undefined}
                    aria-expanded={!folder.collapsed}
                    onClick={() => onSelectFolder?.(folder.id)}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      toggleFolderCollapsed(folder.id);
                    }}
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={() => handleDragLeave(folder.id)}
                    onDrop={(e) => handleDrop(e, folder.id)}
                    sx={{
                      width: 48,
                      height: 40,
                      mx: 'auto',
                      flexShrink: 0,
                      color: active ? chatColors.navIconActive : chatColors.navIcon,
                      bgcolor: isDropTarget
                        ? 'rgba(123, 97, 255, 0.45)'
                        : active
                          ? chatColors.navActiveBg
                          : 'transparent',
                      outline: isDropTarget ? '2px dashed rgba(255,255,255,0.65)' : 'none',
                      outlineOffset: 2,
                      borderRadius: 2,
                      transition: 'background-color 0.15s ease, outline 0.15s ease',
                      '&:hover': {
                        bgcolor: active ? chatColors.navActiveBg : 'rgba(24, 20, 28, 0.06)',
                      },
                    }}
                  >
                    <FolderIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              );
            })}
          </Box>
        </Collapse>
      </Box>
    </>
  );
};

export default ChatFolderRailSection;
