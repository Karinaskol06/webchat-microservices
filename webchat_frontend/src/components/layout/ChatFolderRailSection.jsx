import React from 'react';
import {
  Box,
  Collapse,
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
import { chatColors, muiTransparent } from '../../theme/chatDesignTokens';

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
    <Box
      sx={{
        width: '88%',
        mx: 'auto',
        my: 0.75,
        flex: 1,
        minHeight: 0,
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderTop: `1px solid ${chatColors.glassPanelBorder}`,
        borderBottom: `1px solid ${chatColors.glassPanelBorder}`,
        pt: 0.5,
        pb: 0.5,
      }}
    >
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
                <Box
                  key={folder.id}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: 64,
                    mx: 'auto',
                    flexShrink: 0,
                  }}
                >
                  <Tooltip
                    title={
                      unread > 0
                        ? `${folder.name} (${unread} unread)`
                        : folder.name
                    }
                    placement="right"
                  >
                    <Box
                      component="div"
                      role="button"
                      tabIndex={0}
                      aria-label={folder.name}
                      aria-current={active ? 'true' : undefined}
                      aria-expanded={!folder.collapsed}
                      onClick={() => onSelectFolder?.(folder.id)}
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        toggleFolderCollapsed(folder.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectFolder?.(folder.id);
                        }
                      }}
                      onDragOver={(e) => handleDragOver(e, folder.id)}
                      onDragLeave={() => handleDragLeave(folder.id)}
                      onDrop={(e) => handleDrop(e, folder.id)}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.25,
                        py: 0.25,
                        borderRadius: 2,
                        cursor: 'pointer',
                        outline: isDropTarget ? '2px dashed rgba(123, 97, 255, 0.85)' : 'none',
                        outlineOffset: 1,
                        bgcolor: isDropTarget
                          ? 'rgba(123, 97, 255, 0.18)'
                          : active
                            ? chatColors.navActiveBg
                            : muiTransparent,
                        transition: 'background-color 0.15s ease, outline 0.15s ease',
                        '&:hover': {
                          bgcolor: isDropTarget
                            ? 'rgba(123, 97, 255, 0.22)'
                            : active
                              ? chatColors.navActiveBg
                              : 'rgba(16, 8, 26, 0.06)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 40,
                          height: 32,
                          color: active || isDropTarget ? chatColors.primary : chatColors.navIcon,
                          transition: 'color 0.15s ease',
                        }}
                      >
                        <FolderIcon fontSize="small" />
                        {unread > 0 ? (
                          <Box
                            component="span"
                            aria-hidden
                            sx={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              bgcolor: chatColors.unreadBadge,
                              border: '1.5px solid',
                              borderColor: chatColors.glassList,
                            }}
                          />
                        ) : null}
                      </Box>
                      <Typography
                        component="span"
                        variant="caption"
                        title={folder.name}
                        sx={{
                          width: '100%',
                          px: 0.25,
                          fontSize: '0.625rem',
                          lineHeight: 1.2,
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: isDropTarget
                            ? chatColors.primary
                            : active
                              ? chatColors.glassPanelText
                              : chatColors.glassPanelTextMuted,
                          fontWeight: isDropTarget || active ? 700 : 500,
                          letterSpacing: isDropTarget ? '0.02em' : 0,
                          textDecoration: isDropTarget ? 'underline' : 'none',
                          textDecorationColor: chatColors.primary,
                          textUnderlineOffset: 2,
                          transition: 'color 0.15s ease, font-weight 0.15s ease',
                        }}
                      >
                        {folder.name}
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
};

export default ChatFolderRailSection;
