import React, { useState } from 'react';
import { resolveApiBaseUrl } from '../../utils/apiBaseUrl';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Divider,
    IconButton,
    Link,
    Menu,
    MenuItem,
    Paper,
    TextField,
    Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ForwardIcon from '@mui/icons-material/Forward';
import ChatImageAttachment, { ChatImageGridCell } from './ChatImageAttachment';
import MessageReactionQuickBar from './MessageReactionQuickBar';
import MessageReactionsRow from './MessageReactionsRow';
import HighlightedMessageText from './HighlightedMessageText';
import { parseQuotedSnippet } from '../../utils/quotedMessagePreview';
import { chatColors, chatMenuSlotProps } from '../../theme/chatDesignTokens';
import { QuotedKindIcon } from './QuotedKindIcon';
import chatService from '../../services/chatService';
import useChatStore from '../../store/useChatStore';
import { canModerateOthersMessages } from '../../utils/channelPermissions';
import { isEmojiOnlyMessage } from '../../utils/chatDisplay';
import { countUserReactions, MAX_REACTIONS_PER_USER } from '../../utils/messageReactions';
import RichMessageContent from '../personalSpace/RichMessageContent';
import { getMessageCopyText, isRichMessageType } from '../../utils/personalSpace';
import {
  forwardedSourceLabel,
  isForwardedFromRoom,
  isForwardedSourceClickable,
} from '../../utils/forwardedMessage';
import UserAvatar from '../user/UserAvatar';

/** Larger previews; landscape uses bubble width, portrait shrinks to stay on-screen. */
const MEDIA_BUBBLE_MAX_WIDTH = 560;
const MEDIA_IMAGE_MAX_HEIGHT = 520;
const MEDIA_VIDEO_MAX_HEIGHT = 420;
/** Reserve space for chat chrome (headers, input, padding) so media fits without extra page scroll. */
const MEDIA_VIEWPORT_RESERVE_PX = 280;
const mediaMaxHeight = (capPx) => `min(${capPx}px, calc(100dvh - ${MEDIA_VIEWPORT_RESERVE_PX}px))`;

const formatMessageTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const avatarSx = {
    width: 40,
    height: 40,
    borderRadius: '12px',
    alignSelf: 'flex-end',
    flexShrink: 0,
};

const MessageItem = ({
    message,
    currentUserId,
    room = null,
    onReply,
    onOpenForward,
    onOpenForwardedProfile,
    onOpenForwardedRoom,
    onJumpToMessage,
    isHighlighted,
    hideReplyActions = false,
    inChatSearchQuery = '',
    inChatSearchMatches = [],
    activeInChatSearchMatch = null,
    onOpenEmojiSidebarForReaction,
    isPersonalSpace = false,
    onOpenImage,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedContent, setEditedContent] = useState(message.content || '');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [contextMenuPosition, setContextMenuPosition] = useState(null);
    const [moderatorEditOpen, setModeratorEditOpen] = useState(false);
    const [isTogglingReaction, setIsTogglingReaction] = useState(false);
    const [reactionError, setReactionError] = useState('');

    const sender = message.sender || { id: message.senderId };
    const isOwn = Number(sender?.id) === Number(currentUserId);
    const canModerateOthers = canModerateOthersMessages(room, currentUserId);
    const messageTypeUpper = String(
        message.messageType || message.message_type || 'TEXT',
    ).toUpperCase();
    const isRichMessage = isRichMessageType(messageTypeUpper);
    const canEditMessageType =
        messageTypeUpper === 'TEXT' ||
        messageTypeUpper === 'MIXED' ||
        messageTypeUpper === 'ATTACHMENT' ||
        (isRichMessage && messageTypeUpper !== 'POLL');
    const canEditThis = (isOwn || canModerateOthers) && canEditMessageType;
    const canDeleteThis = isOwn || canModerateOthers;
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const hasAttachments = attachments.length > 0;
    const hasText = message.content && message.content.trim().length > 0;
    const messageIdStr = String(message.id ?? message._id ?? '');

    const renderMessageText = (sx = {}) => {
        if (!hasText) return null;
        const query = String(inChatSearchQuery || '').trim();
        const ranges = query
            ? inChatSearchMatches
                  .filter((m) => String(m.messageId) === messageIdStr)
                  .map(({ start, end }) => ({ start, end }))
            : [];
        const activeRange =
            activeInChatSearchMatch &&
            String(activeInChatSearchMatch.messageId) === messageIdStr
                ? {
                      start: activeInChatSearchMatch.start,
                      end: activeInChatSearchMatch.end,
                  }
                : null;
        const emojiOnly = isEmojiOnlyMessage(message.content);
        const typographySx = {
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            ...(emojiOnly ? { fontSize: '2.25rem', lineHeight: 1.15 } : {}),
            ...sx,
        };

        return (
            <Typography variant="body1" sx={typographySx}>
                {ranges.length ? (
                    <HighlightedMessageText
                        text={message.content}
                        ranges={ranges}
                        activeRange={activeRange}
                    />
                ) : (
                    message.content
                )}
            </Typography>
        );
    };
    const forwardedFrom = message.forwardedFrom;
    const forwardedFromRoom = message.forwardedFromRoom;
    const forwardedDisplayName = forwardedSourceLabel(message);
    const forwardedClickable = isForwardedSourceClickable(message);

    // grouping attachments
    const images = attachments.filter(a => a.isImage || a.fileType === 'IMAGE');
    const videos = attachments.filter(a => a.fileType === 'VIDEO' || a.mimeType?.startsWith('video/'));
    const documents = attachments.filter(a =>
        a.fileType === 'DOCUMENT' ||
        a.fileType === 'OTHER' ||
        (!a.isImage && !a.mimeType?.startsWith('video/'))
    );

    const hasVisualMedia = images.length > 0 || videos.length > 0;

    const handleOpenImage = (attachment) => {
        onOpenImage?.(attachment);
    };

    const openAttachment = async (attachment, { download = false } = {}) => {
        const blob = await chatService.getAttachmentBlob(attachment.id, { download });
        const blobUrl = URL.createObjectURL(blob);

        // Prefer open in new tab for preview; fallback to download
        const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = attachment?.filename || 'attachment';
            document.body.appendChild(a);
            a.click();
            a.remove();
        }

        // Revoke later to allow the new tab to read it
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    };

    const getFileIcon = (attachment) => {
        if (attachment.isImage) return <ImageIcon fontSize="small" />;
        if (attachment.fileType === 'VIDEO') return <VideoLibraryIcon fontSize="small" />;
        return <InsertDriveFileIcon fontSize="small" />;
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const closeMenu = () => setMenuAnchorEl(null);
    const openMenu = (event) => setMenuAnchorEl(event.currentTarget);
    const closeContextMenu = () => setContextMenuPosition(null);

    const replyTargetId =
        message.replyToMessageId ||
        message.reply_to_message_id ||
        message.repliedMessage?.messageId ||
        null;

    const isReplyBubble = Boolean(replyTargetId);

    const repliedForPreview =
        message.repliedMessage ||
        (replyTargetId
            ? {
                messageId: replyTargetId,
                deleted: false,
                content: '',
                messageType: 'TEXT',
            }
            : null);

    const quoted = parseQuotedSnippet(repliedForPreview);

    const repliedAuthorName =
        message.repliedMessage?.senderDisplayName ||
        (message.repliedMessage?.senderId != null &&
        Number(message.repliedMessage.senderId) === Number(currentUserId)
            ? 'You'
            : null) ||
        'Message';

    const canJumpToReply =
        Boolean(onJumpToMessage) &&
        Boolean(replyTargetId) &&
        !message.repliedMessage?.deleted;

    const handleReplyPreviewClick = () => {
        if (!canJumpToReply) return;
        const targetId = message.repliedMessage?.messageId || replyTargetId;
        onJumpToMessage(targetId);
    };

    const handleReplyPreviewKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleReplyPreviewClick();
        }
    };

    const handleReply = () => {
        if (hideReplyActions) return;
        onReply?.(message);
        closeMenu();
        closeContextMenu();
    };

    const handleForward = () => {
        onOpenForward?.(message);
        closeMenu();
        closeContextMenu();
    };

    const handleCopy = async () => {
        const text = getMessageCopyText(message);
        closeMenu();
        closeContextMenu();
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.setAttribute('readonly', '');
                textarea.style.position = 'fixed';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                textarea.remove();
            } catch {
                /* clipboard unavailable */
            }
        }
    };

    const handleForwardedNameClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isForwardedFromRoom(message)) {
            onOpenForwardedRoom?.(forwardedFromRoom);
            return;
        }
        if (forwardedFrom?.id != null) {
            onOpenForwardedProfile?.(forwardedFrom);
        }
    };

    const handleOpenContextMenu = (event) => {
        event.preventDefault();
        setReactionError('');
        setContextMenuPosition({
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
        });
    };

    const userReactionCount = countUserReactions(message.reactions, currentUserId);
    const reactionLimitReached = userReactionCount >= MAX_REACTIONS_PER_USER;

    const resolveChatId = () => {
        const fromRoom = room?.id ?? room?._id;
        const fromMessage = message.chatId ?? message.chat_id;
        return fromRoom ?? fromMessage ?? null;
    };

    const handleToggleReaction = async (emoji) => {
        const chatId = resolveChatId();
        if (!message.id || !chatId || isTogglingReaction) return;
        setReactionError('');
        setIsTogglingReaction(true);
        try {
            const reactions = await chatService.toggleMessageReaction(chatId, message.id, emoji);
            useChatStore.getState().updateMessageReactions(message.id, reactions);
            closeMenu();
            closeContextMenu();
        } catch (error) {
            const responseMessage =
                error?.error ||
                error?.message ||
                (typeof error === 'string' ? error : '');
            setReactionError(
                responseMessage || 'Unable to update reaction. Please try again.',
            );
        } finally {
            setIsTogglingReaction(false);
        }
    };

    const handleOpenFullReactionPicker = () => {
        onOpenEmojiSidebarForReaction?.(message.id);
        closeMenu();
        closeContextMenu();
    };

    const reactionMenuHeader = (
        <Box>
            <MessageReactionQuickBar
                disabled={isTogglingReaction}
                onPickEmoji={handleToggleReaction}
                onOpenFullPicker={handleOpenFullReactionPicker}
            />
            {reactionError ? (
                <Typography variant="caption" color="error" sx={{ px: 1.5, pb: 0.5, display: 'block' }}>
                    {reactionError}
                </Typography>
            ) : null}
            {reactionLimitReached && !reactionError ? (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ px: 1.5, pb: 0.5, display: 'block' }}
                >
                    Maximum {MAX_REACTIONS_PER_USER} reactions per message
                </Typography>
            ) : null}
            <Divider sx={{ borderColor: chatColors.borderSubtle }} />
        </Box>
    );

    const handleStartEdit = () => {
        if (!canEditThis) return;
        setEditedContent(message.content || '');
        setEditError('');
        if (isOwn) {
            setIsEditMode(true);
        } else {
            setModeratorEditOpen(true);
        }
        closeMenu();
        closeContextMenu();
    };

    const handleCancelEdit = () => {
        setEditedContent(message.content || '');
        setEditError('');
        setIsEditMode(false);
        setModeratorEditOpen(false);
    };

    const captionUnchanged =
        editedContent.trim() === (message.content || '').trim();

    const handleSaveEdit = async () => {
        if (captionUnchanged) {
            setIsEditMode(false);
            return;
        }
        const normalized = editedContent.trim();
        setEditError('');
        setIsSavingEdit(true);
        try {
            const updated = await chatService.editMessage(message.id, normalized);
            useChatStore.getState().updateMessageContent(
                message.id,
                updated?.content ?? normalized ?? '',
                updated?.editedAt,
                updated?.messageType
            );
            setIsEditMode(false);
            setModeratorEditOpen(false);
        } catch (error) {
            const responseMessage =
                error?.error ||
                error?.message ||
                (typeof error === 'string' ? error : '');
            setEditError(
                responseMessage || 'Unable to edit this message. Please try again.'
            );
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleOpenDeleteDialog = () => {
        setDeleteError('');
        setDeleteDialogOpen(true);
        closeMenu();
        closeContextMenu();
    };

    const handleDeleteMessage = async () => {
        setDeleteError('');
        setIsDeleting(true);
        try {
            await chatService.deleteMessage(message.id);
            useChatStore.getState().removeMessage(message.id);
            setDeleteDialogOpen(false);
        } catch (error) {
            const responseMessage =
                error?.error ||
                error?.message ||
                (typeof error === 'string' ? error : '');
            setDeleteError(
                responseMessage || 'Unable to delete this message. Please try again.'
            );
        } finally {
            setIsDeleting(false);
        }
    };

    const toggleExpand = () => setExpanded(!expanded);

    const showExpandButton = hasAttachments && attachments.length > 3;

    const messageTime = formatMessageTime(message.timestamp);

    const isSingleImageOnly =
        images.length === 1 &&
        !hasText &&
        videos.length === 0 &&
        documents.length === 0 &&
        !isEditMode &&
        !forwardedFrom &&
        !isReplyBubble;

    const isForwardedImageMessage =
        Boolean(
            forwardedFrom &&
                images.length === 1 &&
                videos.length === 0 &&
                documents.length === 0,
        );

    const renderSingleChatImage = (attachment, { showOverlay = false } = {}) => (
        <Box key={attachment.id} sx={{ width: '100%' }}>
            <ChatImageAttachment
                attachment={attachment}
                isOwn={isOwn}
                isRead={Boolean(message.isRead)}
                timestamp={showOverlay ? messageTime : null}
                attachCaptionBelow={hasText}
                onOpen={() => handleOpenImage(attachment)}
            />
        </Box>
    );

    const renderMediaAndFiles = () => (
        <>
            {images.length > 0 && (
                images.length === 1 ? (
                    renderSingleChatImage(images[0], { showOverlay: false })
                ) : (
                    <Box
                        mt={0}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, minmax(100px, 1fr))`,
                            gap: 1,
                            maxWidth: '100%',
                        }}
                    >
                        {(expanded ? images : images.slice(0, 3)).map((attachment) => (
                            <ChatImageGridCell
                                key={attachment.id}
                                attachment={attachment}
                                onOpen={() => handleOpenImage(attachment)}
                            />
                        ))}
                    </Box>
                )
            )}

            {videos.length > 0 && (
                <Box mt={images.length > 0 ? 1 : 0} sx={{ maxWidth: '100%', width: '100%' }}>
                    {(expanded ? videos : videos.slice(0, 1)).map((attachment) => (
                        <Box key={attachment.id} sx={{ width: '100%' }}>
                            <Box
                                sx={{
                                    bgcolor: '#000',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    lineHeight: 0,
                                }}
                            >
                                <video
                                    controls
                                    preload="metadata"
                                    playsInline
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        maxHeight: mediaMaxHeight(MEDIA_VIDEO_MAX_HEIGHT),
                                        height: 'auto',
                                        objectFit: 'contain',
                                    }}
                                >
                                    <source
                                        src={
                                            `${resolveApiBaseUrl()}/api/chat/attachments/${attachment.id}`
                                        }
                                        type={attachment.mimeType || undefined}
                                    />
                                </video>
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                {attachment.filename}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}

            {documents.length > 0 && (
                <Box mt={images.length > 0 || videos.length > 0 ? 1 : 0}>
                    {(expanded ? documents : documents.slice(0, 2)).map((attachment) => (
                        <Link
                            key={attachment.id}
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                openAttachment(attachment, { download: true }).catch(() => {});
                            }}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                p: 1,
                                textDecoration: 'none',
                                '&:hover': { bgcolor: 'action.hover', borderRadius: 1 },
                            }}
                        >
                            {getFileIcon(attachment)}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" noWrap>
                                    {attachment.filename}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {formatFileSize(attachment.size)}
                                </Typography>
                            </Box>
                        </Link>
                    ))}
                </Box>
            )}

            {showExpandButton && (
                <Box display="flex" justifyContent="center" mt={1}>
                    <IconButton size="small" onClick={toggleExpand}>
                        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        <Typography variant="caption" sx={{ ml: 0.5 }}>
                            {expanded ? 'Сховати' : `Показати ще ${attachments.length - 3} файлів`}
                        </Typography>
                    </IconButton>
                </Box>
            )}
        </>
    );

    const messageMenus = (
        <>
            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={closeMenu}
                slotProps={chatMenuSlotProps}
                disableAutoFocusItem
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: isOwn ? 'right' : 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: isOwn ? 'right' : 'left',
                }}
            >
                {reactionMenuHeader}
                {!hideReplyActions && <MenuItem onClick={handleReply}>Reply</MenuItem>}
                <MenuItem onClick={() => void handleCopy()}>Copy</MenuItem>
                <MenuItem onClick={handleForward}>Forward</MenuItem>
                {canEditThis && <MenuItem onClick={handleStartEdit}>Edit</MenuItem>}
                {canDeleteThis && <MenuItem onClick={handleOpenDeleteDialog}>Delete</MenuItem>}
            </Menu>

            <Menu
                open={Boolean(contextMenuPosition)}
                onClose={closeContextMenu}
                slotProps={chatMenuSlotProps}
                disableAutoFocusItem
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenuPosition
                        ? { top: contextMenuPosition.mouseY, left: contextMenuPosition.mouseX }
                        : undefined
                }
            >
                {reactionMenuHeader}
                {!hideReplyActions && <MenuItem onClick={handleReply}>Reply</MenuItem>}
                <MenuItem onClick={() => void handleCopy()}>Copy</MenuItem>
                <MenuItem onClick={handleForward}>Forward</MenuItem>
                {canEditThis && <MenuItem onClick={handleStartEdit}>Edit</MenuItem>}
                {canDeleteThis && <MenuItem onClick={handleOpenDeleteDialog}>Delete</MenuItem>}
            </Menu>

            <Dialog open={moderatorEditOpen} onClose={handleCancelEdit} fullWidth maxWidth="sm">
                <DialogTitle>Edit message</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        fullWidth
                        multiline
                        minRows={3}
                        label="Message text"
                        value={editedContent}
                        error={Boolean(editError)}
                        helperText={editError}
                        onChange={(e) => {
                            setEditedContent(e.target.value);
                            if (editError) setEditError('');
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelEdit} disabled={isSavingEdit}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            handleSaveEdit().catch(() => {});
                        }}
                        disabled={isSavingEdit || captionUnchanged}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Delete message?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This action cannot be undone.
                    </DialogContentText>
                    {deleteError && (
                        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                            {deleteError}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button
                        color="error"
                        onClick={() => {
                            handleDeleteMessage().catch(() => {});
                        }}
                        disabled={isDeleting}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );

    const rowHighlightSx = isHighlighted
        ? {
              outline: (theme) => `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
              borderRadius: 2,
          }
        : {};

    const senderLabel = sender?.firstName || sender?.username || 'User';

    const handleRichUpdate = async (content) => {
        try {
            const updated = await chatService.editMessage(message.id, content);
            useChatStore.getState().updateMessageContent(
                message.id,
                updated.content ?? content,
                updated.editedAt,
                updated.messageType,
            );
        } catch (error) {
            console.error('Failed to update rich message', error);
        }
    };

    if (isRichMessage) {
        if (isPersonalSpace && messageTypeUpper === 'STICKY_NOTE') {
            return null;
        }

        const isTodoList = messageTypeUpper === 'TODO';

        return (
            <>
                <Box
                    id={`webchat-msg-${message.id}`}
                    onContextMenu={handleOpenContextMenu}
                    sx={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        mb: 2,
                        width: '100%',
                        ...rowHighlightSx,
                    }}
                >
                    {!isOwn && (
                        <UserAvatar
                            user={sender}
                            variant="rounded"
                            sx={{ ...avatarSx, mr: 1 }}
                        />
                    )}

                    <Box
                        sx={{
                            maxWidth: isTodoList ? 'min(96%, 720px)' : '92%',
                            minWidth: 0,
                            width: isTodoList ? 'max-content' : undefined,
                            position: 'relative',
                        }}
                    >
                        {!isOwn && (
                            <Typography
                                sx={{
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                    color: chatColors.primary,
                                    mb: 0.5,
                                    pl: 0.5,
                                }}
                            >
                                {senderLabel}
                            </Typography>
                        )}

                        {(forwardedFrom || forwardedFromRoom) && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    mb: 0.75,
                                    cursor: forwardedClickable ? 'pointer' : 'default',
                                }}
                                onClick={forwardedClickable ? handleForwardedNameClick : undefined}
                            >
                                <ForwardIcon sx={{ fontSize: 14, opacity: 0.7 }} />
                                <Typography variant="caption" color="text.secondary">
                                    Forwarded from {forwardedDisplayName}
                                </Typography>
                            </Box>
                        )}

                        <RichMessageContent
                            message={message}
                            editable={canEditThis}
                            onUpdate={handleRichUpdate}
                            onDelete={canDeleteThis ? () => handleDeleteMessage().catch(() => {}) : undefined}
                            currentUserId={currentUserId}
                        />

                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                                gap: 0.5,
                                mt: 0.75,
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                {messageTime}
                            </Typography>
                            {isOwn && (
                                <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.25 }}>
                                    {message.isRead ? (
                                        <DoneAllIcon sx={{ fontSize: 14, color: chatColors.primaryLight }} />
                                    ) : (
                                        <DoneIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                    )}
                                </Box>
                            )}
                            <IconButton
                                size="small"
                                aria-label="Message actions"
                                onClick={openMenu}
                                sx={{ ml: 0.25 }}
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <MessageReactionsRow
                            reactions={message.reactions}
                            currentUserId={currentUserId}
                            onToggleReaction={handleToggleReaction}
                        />
                    </Box>
                </Box>
                {messageMenus}
            </>
        );
    }

    if (isSingleImageOnly) {
        const attachment = images[0];
        return (
            <>
                <Box
                    id={`webchat-msg-${message.id}`}
                    onContextMenu={handleOpenContextMenu}
                    sx={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        mb: 2,
                        ...rowHighlightSx,
                    }}
                >
                    {!isOwn && (
                        <UserAvatar
                            user={sender}
                            variant="rounded"
                            sx={{ ...avatarSx, mr: 1 }}
                        />
                    )}

                    <Box
                        sx={{
                            width: 'fit-content',
                            maxWidth: '100%',
                            minWidth: 0,
                        }}
                    >
                        {!isOwn && (
                            <Typography
                                sx={{
                                    fontWeight: 700,
                                    fontSize: '0.8125rem',
                                    color: chatColors.primary,
                                    mb: 0.5,
                                    pl: 0.5,
                                    lineHeight: 1.3,
                                }}
                            >
                                {senderLabel}
                            </Typography>
                        )}
                        <ChatImageAttachment
                            attachment={attachment}
                            isOwn={isOwn}
                            isRead={Boolean(message.isRead)}
                            timestamp={messageTime}
                            onOpen={() => handleOpenImage(attachment)}
                        />
                        <MessageReactionsRow
                            reactions={message.reactions}
                            currentUserId={currentUserId}
                            onToggleReaction={handleToggleReaction}
                        />
                        {isOwn && (
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                                <IconButton size="small" onClick={openMenu} aria-label="Message actions">
                                    <MoreVertIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        )}
                    </Box>

                    {isOwn && (
                        <UserAvatar
                            user={sender}
                            variant="rounded"
                            sx={{ ...avatarSx, ml: 1 }}
                        />
                    )}
                </Box>
                {messageMenus}
            </>
        );
    }

    return (
        <>
        <Box
            id={`webchat-msg-${message.id}`}
            sx={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                mb: 2,
                ...rowHighlightSx,
            }}
        >
            {!isOwn && (
                <UserAvatar
                    user={sender}
                    variant="rounded"
                    sx={{ ...avatarSx, mr: 1 }}
                />
            )}

            <Box
                sx={{
                    maxWidth: hasVisualMedia && images.length === 1 ? '100%' : hasVisualMedia
                        ? `min(${MEDIA_BUBBLE_MAX_WIDTH}px, 78%)`
                        : '70%',
                    minWidth: hasVisualMedia && images.length !== 1 ? 180 : hasAttachments ? 200 : 'auto',
                    width: hasVisualMedia && images.length === 1 ? 'fit-content' : undefined,
                }}
            >
                {!isOwn && (
                    <Typography
                        sx={{
                            fontWeight: 700,
                            fontSize: '0.8125rem',
                            color: chatColors.primaryLight,
                            mb: 0.5,
                            ml: 0.5,
                            lineHeight: 1.3,
                        }}
                    >
                        {senderLabel}
                    </Typography>
                )}

                <Paper
                    onContextMenu={handleOpenContextMenu}
                    sx={{
                        p:
                          isForwardedImageMessage && !hasText
                            ? 0
                            : images.length === 1 && !hasText
                              ? 0
                              : images.length === 1 && hasText
                                ? 0
                                : hasText || hasAttachments || (isOwn && isEditMode)
                                  ? 1.5
                                  : 1,
                        ...(isForwardedImageMessage &&
                            !hasText && {
                                pt: 1.25,
                                pb: 0.35,
                            }),
                        bgcolor: isOwn ? chatColors.bubbleOutgoing : chatColors.bubbleIncoming,
                        color: chatColors.bubbleText,
                        borderRadius: isReplyBubble ? '14px 14px 12px 12px' : images.length === 1 ? '10px' : '14px',
                        '& .MuiTypography-caption': { color: 'rgba(255,255,255,0.72)' },
                        '& .MuiTypography-body1': {
                            color: chatColors.bubbleText,
                            fontFamily:
                                'system-ui, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                        },
                        '& .MuiTypography-body2': { color: 'rgba(255,255,255,0.92)' },
                        overflow: 'hidden',
                        ...(isReplyBubble && {
                            borderLeft: '4px solid',
                            borderLeftColor: chatColors.primaryLight,
                            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                        }),
                    }}
                >
                    {(forwardedFrom || forwardedFromRoom) && forwardedDisplayName && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mb: isForwardedImageMessage ? 0.75 : 1,
                                minHeight: 20,
                                ...(isForwardedImageMessage && {
                                    px: 1.25,
                                }),
                            }}
                        >
                            <ForwardIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                Forwarded from{' '}
                                {forwardedClickable ? (
                                    <Link
                                        component="button"
                                        type="button"
                                        onClick={handleForwardedNameClick}
                                        underline="hover"
                                        sx={{
                                            verticalAlign: 'baseline',
                                            fontWeight: 600,
                                            p: 0,
                                            border: 0,
                                            background: 'none',
                                            cursor: 'pointer',
                                            font: 'inherit',
                                            color: chatColors.primaryLight,
                                        }}
                                    >
                                        {forwardedDisplayName}
                                    </Link>
                                ) : (
                                    <Box component="span" sx={{ fontWeight: 600 }}>
                                        {forwardedDisplayName}
                                    </Box>
                                )}
                            </Typography>
                        </Box>
                    )}

                    {isReplyBubble && (
                        <Box
                            onClick={canJumpToReply ? handleReplyPreviewClick : undefined}
                            onKeyDown={canJumpToReply ? handleReplyPreviewKeyDown : undefined}
                            role={canJumpToReply ? 'button' : undefined}
                            tabIndex={canJumpToReply ? 0 : undefined}
                            aria-label={
                                canJumpToReply
                                    ? 'Quoted message; press to jump to original'
                                    : 'Quoted original message preview'
                            }
                            sx={{
                                display: 'flex',
                                mb: 1,
                                minHeight: quoted.kind === 'deleted' ? 32 : 40,
                                maxWidth: '100%',
                                borderRadius: 1,
                                overflow: 'hidden',
                                cursor: canJumpToReply ? 'pointer' : 'default',
                                bgcolor: 'rgba(0, 0, 0, 0.22)',
                                boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.08)',
                                ...(canJumpToReply && {
                                    '&:hover': {
                                        bgcolor: 'rgba(0, 0, 0, 0.32)',
                                    },
                                }),
                                '&:focus-visible': {
                                    outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                                    outlineOffset: 0,
                                },
                            }}
                        >
                            <Box
                                sx={{
                                    width: 4,
                                    flexShrink: 0,
                                    bgcolor: chatColors.primaryLight,
                                    borderRadius: '2px 0 0 2px',
                                }}
                            />
                            <Box
                                sx={{
                                    py: 0.625,
                                    pl: 0.875,
                                    pr: 1,
                                    minWidth: 0,
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    gap: 0.125,
                                }}
                            >
                                {quoted.kind === 'deleted' ? (
                                    <Typography
                                        variant="caption"
                                        color="text.disabled"
                                        sx={{ fontStyle: 'italic', fontSize: '0.8rem', lineHeight: 1.4 }}
                                    >
                                        {quoted.subtitle}
                                    </Typography>
                                ) : (
                                    <>
                                        <Typography
                                            variant="caption"
                                            component="div"
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: '0.8rem',
                                                lineHeight: 1.25,
                                                color: chatColors.primaryLight,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}
                                        >
                                            {repliedAuthorName}
                                        </Typography>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.375,
                                                minWidth: 0,
                                                mt: 0.125,
                                            }}
                                        >
                                            {quoted.kind !== 'text' && <QuotedKindIcon kind={quoted.kind} />}
                                            <Typography
                                                variant="caption"
                                                component="div"
                                                color="text.secondary"
                                                sx={{
                                                    fontSize: '0.75rem',
                                                    lineHeight: 1.35,
                                                    overflow: 'hidden',
                                                    ...(quoted.kind === 'text'
                                                        ? {
                                                              display: '-webkit-box',
                                                              WebkitLineClamp: 2,
                                                              WebkitBoxOrient: 'vertical',
                                                              whiteSpace: 'normal',
                                                              wordBreak: 'break-word',
                                                          }
                                                        : {
                                                              whiteSpace: 'nowrap',
                                                              textOverflow: 'ellipsis',
                                                          }),
                                                }}
                                            >
                                                {quoted.subtitle}
                                            </Typography>
                                        </Box>
                                    </>
                                )}
                            </Box>
                        </Box>
                    )}

                    {isOwn ? (
                        <>
                            {!hasAttachments && hasText && (
                                isEditMode ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <TextField
                                            size="small"
                                            fullWidth
                                            multiline
                                            minRows={2}
                                            value={editedContent}
                                            error={Boolean(editError)}
                                            helperText={editError}
                                            onChange={(e) => {
                                                setEditedContent(e.target.value);
                                                if (editError) {
                                                    setEditError('');
                                                }
                                            }}
                                        />
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                            <Button size="small" onClick={handleCancelEdit} disabled={isSavingEdit}>
                                                Cancel
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={() => {
                                                    handleSaveEdit().catch(() => {});
                                                }}
                                                disabled={isSavingEdit || captionUnchanged}
                                            >
                                                Save
                                            </Button>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            {renderMessageText()}
                                        </Box>
                                        <IconButton
                                            size="small"
                                            onClick={openMenu}
                                            aria-label="Message actions"
                                            sx={{ mt: -0.5, mr: -0.5, flexShrink: 0 }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )
                            )}
                            {renderMediaAndFiles()}
                        </>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                            <IconButton
                                size="small"
                                onClick={openMenu}
                                aria-label="Message actions"
                                sx={{ mt: -0.25, ml: -0.5, flexShrink: 0, alignSelf: 'flex-start' }}
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                {!hasAttachments && hasText && renderMessageText()}
                                {hasAttachments && (
                                    <>
                                        {renderMediaAndFiles()}
                                        {hasText &&
                                            renderMessageText({
                                                px: 1.5,
                                                py: 1.25,
                                            })}
                                    </>
                                )}
                            </Box>
                        </Box>
                    )}

                    {hasAttachments && isOwn && isEditMode && (
                        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <TextField
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                placeholder="Add a caption (optional)"
                                value={editedContent}
                                error={Boolean(editError)}
                                helperText={editError}
                                onChange={(e) => {
                                    setEditedContent(e.target.value);
                                    if (editError) {
                                        setEditError('');
                                    }
                                }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                <Button size="small" onClick={handleCancelEdit} disabled={isSavingEdit}>
                                    Cancel
                                </Button>
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={() => {
                                        handleSaveEdit().catch(() => {});
                                    }}
                                    disabled={isSavingEdit || captionUnchanged}
                                >
                                    Save
                                </Button>
                            </Box>
                        </Box>
                    )}

                    {hasAttachments && isOwn && !isEditMode && hasText && (
                        <Box
                            sx={{
                                mt: 1,
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 1,
                            }}
                        >
                            <Box sx={{ flex: 1, minWidth: 0 }}>{renderMessageText()}</Box>
                            <IconButton
                                size="small"
                                onClick={openMenu}
                                aria-label="Message actions"
                                sx={{ mt: -0.5, mr: -0.5, flexShrink: 0 }}
                            >
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    )}

                    {hasAttachments && isOwn && !isEditMode && !hasText && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                            <IconButton size="small" onClick={openMenu} aria-label="Message actions">
                                <MoreVertIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    )}

                    <MessageReactionsRow
                        reactions={message.reactions}
                        currentUserId={currentUserId}
                        onToggleReaction={handleToggleReaction}
                    />

                    {/* Chat and status */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            mt:
                              isForwardedImageMessage && !hasText
                                ? 0.25
                                : hasText || hasAttachments
                                  ? 1
                                  : 0,
                            gap: 0.5,
                            ...(isForwardedImageMessage &&
                                !hasText && {
                                    px: 1,
                                }),
                        }}
                    >
                        <Typography variant="caption" color="text.secondary">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                        {message.editedAt && (
                            <Typography variant="caption" color="text.secondary">
                                (edited)
                            </Typography>
                        )}
                        {isOwn && (
                            message.isRead ? (
                                <DoneAllIcon fontSize="small" sx={{ color: '#4caf50', fontSize: 16 }} />
                            ) : (
                                <DoneIcon fontSize="small" sx={{ color: '#9e9e9e', fontSize: 16 }} />
                            )
                        )}
                    </Box>
                </Paper>
            </Box>

            {isOwn && (
                <UserAvatar
                    user={sender}
                    variant="rounded"
                    sx={{ ...avatarSx, ml: 1 }}
                />
            )}
        </Box>
        {messageMenus}
        </>
    );
};

export default MessageItem;