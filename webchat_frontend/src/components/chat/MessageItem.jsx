import React, { useState } from 'react';
import {
    Avatar,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
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
import AuthenticatedImage from './AuthenticatedImage';
import { parseQuotedSnippet } from '../../utils/quotedMessagePreview';
import { QuotedKindIcon } from './QuotedKindIcon';
import chatService from '../../services/chatService';
import useChatStore from '../../store/useChatStore';

/** Larger previews; landscape uses bubble width, portrait shrinks to stay on-screen. */
const MEDIA_BUBBLE_MAX_WIDTH = 560;
const MEDIA_IMAGE_MAX_HEIGHT = 520;
const MEDIA_VIDEO_MAX_HEIGHT = 420;
/** Reserve space for chat chrome (headers, input, padding) so media fits without extra page scroll. */
const MEDIA_VIEWPORT_RESERVE_PX = 280;
const mediaMaxHeight = (capPx) => `min(${capPx}px, calc(100dvh - ${MEDIA_VIEWPORT_RESERVE_PX}px))`;

const MessageItem = ({
    message,
    currentUserId,
    onReply,
    onOpenForward,
    onOpenForwardedProfile,
    onJumpToMessage,
    isHighlighted,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState({});
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedContent, setEditedContent] = useState(message.content || '');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [contextMenuPosition, setContextMenuPosition] = useState(null);

    const sender = message.sender || { id: message.senderId };
    const isOwn = Number(sender?.id) === Number(currentUserId);
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const hasAttachments = attachments.length > 0;
    const hasText = message.content && message.content.trim().length > 0;
    const forwardedFrom = message.forwardedFrom;
    const forwardedDisplayName =
        forwardedFrom?.username ||
        forwardedFrom?.firstName ||
        (forwardedFrom?.id != null ? `User #${forwardedFrom.id}` : '');

    // grouping attachments
    const images = attachments.filter(a => a.isImage || a.fileType === 'IMAGE');
    const videos = attachments.filter(a => a.fileType === 'VIDEO' || a.mimeType?.startsWith('video/'));
    const documents = attachments.filter(a =>
        a.fileType === 'DOCUMENT' ||
        a.fileType === 'OTHER' ||
        (!a.isImage && !a.mimeType?.startsWith('video/'))
    );

    const hasVisualMedia = images.length > 0 || videos.length > 0;

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
        onReply?.(message);
        closeMenu();
        closeContextMenu();
    };

    const handleForward = () => {
        onOpenForward?.(message);
        closeMenu();
        closeContextMenu();
    };

    const handleForwardedNameClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (forwardedFrom?.id != null) {
            onOpenForwardedProfile?.(forwardedFrom);
        }
    };

    const handleOpenContextMenu = (event) => {
        event.preventDefault();
        setContextMenuPosition({
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
        });
    };

    const handleStartEdit = () => {
        setEditedContent(message.content || '');
        setEditError('');
        setIsEditMode(true);
        closeMenu();
        closeContextMenu();
    };

    const handleCancelEdit = () => {
        setEditedContent(message.content || '');
        setEditError('');
        setIsEditMode(false);
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

    const renderMediaAndFiles = () => (
        <>
            {images.length > 0 && (
                images.length === 1 ? (
                    <Box
                        sx={{
                            mt: 0,
                            maxWidth: '100%',
                            maxHeight: mediaMaxHeight(MEDIA_IMAGE_MAX_HEIGHT),
                            backgroundColor: '#f0f0f0',
                            borderRadius: 1,
                            overflow: 'hidden',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        {(expanded ? images : images.slice(0, 1)).map((attachment) => (
                            <Link
                                key={attachment.id}
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    openAttachment(attachment, { download: false }).catch(() => {});
                                }}
                                sx={{
                                    display: 'block',
                                    maxWidth: '100%',
                                    textDecoration: 'none',
                                    lineHeight: 0,
                                    '&:hover': { opacity: 0.92 },
                                }}
                            >
                                <Box
                                    sx={{
                                        position: 'relative',
                                        display: 'inline-block',
                                        maxWidth: '100%',
                                        maxHeight: mediaMaxHeight(MEDIA_IMAGE_MAX_HEIGHT),
                                        lineHeight: 0,
                                    }}
                                >
                                    <AuthenticatedImage
                                        attachmentId={attachment.id}
                                        alt={attachment.filename}
                                        onLoad={() => {
                                            setImagesLoaded((prev) => ({ ...prev, [attachment.id]: true }));
                                        }}
                                        sx={{
                                            display: 'block',
                                            width: 'auto',
                                            height: 'auto',
                                            maxWidth: '100%',
                                            maxHeight: mediaMaxHeight(MEDIA_IMAGE_MAX_HEIGHT),
                                            objectFit: 'contain',
                                            objectPosition: 'center',
                                            mx: 'auto',
                                        }}
                                    />
                                    {!imagesLoaded[attachment.id] && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                minHeight: 120,
                                                minWidth: 160,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <ImageIcon sx={{ color: '#999', fontSize: 40 }} />
                                        </Box>
                                    )}
                                </Box>
                            </Link>
                        ))}
                    </Box>
                ) : (
                    <Box
                        mt={0}
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, minmax(132px, 1fr))`,
                            gap: 0.75,
                            maxWidth: '100%',
                        }}
                    >
                        {(expanded ? images : images.slice(0, 3)).map((attachment) => (
                            <Link
                                key={attachment.id}
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    openAttachment(attachment, { download: false }).catch(() => {});
                                }}
                                sx={{ display: 'block', textDecoration: 'none' }}
                            >
                                <Box
                                    sx={{
                                        position: 'relative',
                                        aspectRatio: '1 / 1',
                                        backgroundColor: '#f0f0f0',
                                        borderRadius: 1,
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                        minHeight: { xs: 120, sm: 148 },
                                        '&:hover': { opacity: 0.9 },
                                    }}
                                >
                                    <AuthenticatedImage
                                        attachmentId={attachment.id}
                                        alt={attachment.filename}
                                        onLoad={() => {
                                            setImagesLoaded((prev) => ({ ...prev, [attachment.id]: true }));
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            inset: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                    {!imagesLoaded[attachment.id] && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                            }}
                                        >
                                            <ImageIcon sx={{ color: '#999' }} />
                                        </Box>
                                    )}
                                </Box>
                            </Link>
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
                                            (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089') +
                                            `/api/chat/attachments/${attachment.id}`
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

    return (
        <Box
            id={`webchat-msg-${message.id}`}
            sx={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                mb: 2,
                ...(isHighlighted && {
                    outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: 2,
                    borderRadius: 2,
                }),
            }}
        >
            {!isOwn && (
                <Avatar
                    sx={{ mr: 1, width: 36, height: 36 }}
                    src={sender?.profilePicture || undefined}
                >
                    {(sender?.firstName?.[0] || sender?.username?.[0] || 'U').toUpperCase()}
                </Avatar>
            )}

            <Box
                sx={{
                    maxWidth: hasVisualMedia
                        ? `min(${MEDIA_BUBBLE_MAX_WIDTH}px, 92vw)`
                        : '70%',
                    minWidth: hasVisualMedia ? 220 : hasAttachments ? 200 : 'auto',
                    width: hasVisualMedia ? '100%' : undefined,
                }}
            >
                {!isOwn && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mb: 0.5, display: 'block' }}>
                        {sender?.firstName || sender?.username || 'User'}
                    </Typography>
                )}

                <Paper
                    onContextMenu={handleOpenContextMenu}
                    sx={{
                        p: hasText || hasAttachments || (isOwn && isEditMode) ? 1.5 : 1,
                        bgcolor: isOwn ? '#e3f2fd' : 'white',
                        borderRadius: isReplyBubble ? '12px 12px 10px 10px' : 2,
                        overflow: 'hidden',
                        '& .MuiTypography-body1': {
                            fontFamily:
                                'system-ui, "Segoe UI Emoji", "Segoe UI Symbol", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
                        },
                        ...(isReplyBubble && {
                            borderLeft: '4px solid',
                            borderLeftColor: isOwn ? '#1565c0' : 'primary.main',
                        }),
                        ...(isReplyBubble &&
                            !isOwn && {
                                bgcolor: '#fff',
                                boxShadow: (theme) =>
                                    `0 1px 0.5px ${alpha(theme.palette.common.black, 0.13)}, 0 0 0 0.5px ${alpha(theme.palette.common.black, 0.05)}`,
                            }),
                        ...(isReplyBubble &&
                            isOwn && {
                                boxShadow: (theme) =>
                                    `0 1px 0.5px ${alpha(theme.palette.common.black, 0.08)}`,
                            }),
                    }}
                >
                    {forwardedFrom && forwardedDisplayName && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                mb: 1,
                                minHeight: 20,
                            }}
                        >
                            <ForwardIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.35 }}>
                                Forwarded from{' '}
                                {onOpenForwardedProfile && forwardedFrom?.id != null ? (
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
                                            color: isOwn ? '#0d47a1' : 'primary.main',
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
                                bgcolor: isOwn
                                    ? 'rgba(255,255,255,0.92)'
                                    : '#e9eef5',
                                boxShadow: (theme) =>
                                    `inset 0 0 0 1px ${alpha(theme.palette.common.black, isOwn ? 0.06 : 0.08)}`,
                                ...(canJumpToReply && {
                                    '&:hover': {
                                        bgcolor: isOwn
                                            ? 'rgba(255,255,255,1)'
                                            : '#e2e9f3',
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
                                    bgcolor: isOwn ? '#0d47a1' : 'primary.main',
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
                                                color: isOwn ? '#0d47a1' : 'primary.dark',
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
                                        <Typography
                                            variant="body1"
                                            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, minWidth: 0 }}
                                        >
                                            {message.content}
                                        </Typography>
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
                                {!hasAttachments && hasText && (
                                    <Typography
                                        variant="body1"
                                        sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                    >
                                        {message.content}
                                    </Typography>
                                )}
                                {hasAttachments && (
                                    <>
                                        {renderMediaAndFiles()}
                                        {hasText && (
                                            <Typography
                                                variant="body1"
                                                sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                            >
                                                {message.content}
                                            </Typography>
                                        )}
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
                            <Typography
                                variant="body1"
                                sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, minWidth: 0 }}
                            >
                                {message.content}
                            </Typography>
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

                    {/* Chat and status */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            mt: hasText || hasAttachments ? 1 : 0,
                            gap: 0.5,
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
                <Avatar
                    sx={{ ml: 1, width: 36, height: 36 }}
                    src={sender?.profilePicture || undefined}
                >
                    {(sender?.firstName?.[0] || sender?.username?.[0] || 'U').toUpperCase()}
                </Avatar>
            )}

            <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={closeMenu}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: isOwn ? 'right' : 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: isOwn ? 'right' : 'left',
                }}
            >
                <MenuItem onClick={handleReply}>Reply</MenuItem>
                <MenuItem onClick={handleForward}>Forward</MenuItem>
                {isOwn && <MenuItem onClick={handleStartEdit}>Edit</MenuItem>}
                {isOwn && <MenuItem onClick={handleOpenDeleteDialog}>Delete</MenuItem>}
            </Menu>

            <Menu
                open={Boolean(contextMenuPosition)}
                onClose={closeContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenuPosition
                        ? { top: contextMenuPosition.mouseY, left: contextMenuPosition.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={handleReply}>Reply</MenuItem>
                <MenuItem onClick={handleForward}>Forward</MenuItem>
                {isOwn && <MenuItem onClick={handleStartEdit}>Edit</MenuItem>}
                {isOwn && <MenuItem onClick={handleOpenDeleteDialog}>Delete</MenuItem>}
            </Menu>

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
        </Box>
    );
};

export default MessageItem;