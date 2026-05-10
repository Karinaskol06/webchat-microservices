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
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AuthenticatedImage from './AuthenticatedImage';
import chatService from '../../services/chatService';
import useChatStore from '../../store/useChatStore';

const MessageItem = ({ message, currentUserId }) => {
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

    const sender = message.sender || { id: message.senderId };
    const isOwn = Number(sender?.id) === Number(currentUserId);
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const hasAttachments = attachments.length > 0;
    const hasText = message.content && message.content.trim().length > 0;

    // grouping attachments
    const images = attachments.filter(a => a.isImage || a.fileType === 'IMAGE');
    const videos = attachments.filter(a => a.fileType === 'VIDEO' || a.mimeType?.startsWith('video/'));
    const documents = attachments.filter(a =>
        a.fileType === 'DOCUMENT' ||
        a.fileType === 'OTHER' ||
        (!a.isImage && !a.mimeType?.startsWith('video/'))
    );

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

    const handleImageLoad = (attachmentId) => {
        setImagesLoaded(prev => ({ ...prev, [attachmentId]: true }));
    };

    const closeMenu = () => setMenuAnchorEl(null);
    const openMenu = (event) => setMenuAnchorEl(event.currentTarget);

    const handleStartEdit = () => {
        setEditedContent(message.content || '');
        setEditError('');
        setIsEditMode(true);
        closeMenu();
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

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
                mb: 2,
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

            <Box sx={{ maxWidth: '70%', minWidth: hasAttachments ? '200px' : 'auto' }}>
                {!isOwn && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mb: 0.5, display: 'block' }}>
                        {sender?.firstName || sender?.username || 'User'}
                    </Typography>
                )}

                <Paper
                    sx={{
                        p: hasText || hasAttachments || (isOwn && isEditMode) ? 1.5 : 1,
                        bgcolor: isOwn ? '#e3f2fd' : 'white',
                        borderRadius: 2,
                    }}
                >
                    {/* Text-only messages: caption is the bubble body */}
                    {!hasAttachments && !isOwn && hasText && (
                        <Typography
                            variant="body1"
                            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                            {message.content}
                        </Typography>
                    )}

                    {!hasAttachments && isOwn && hasText && (
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

                    {/* Images */}
                    {images.length > 0 && (
                        <Box
                            mt={0}
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${Math.min(images.length, 3)}, 1fr)`,
                                gap: 0.5,
                                maxWidth: '100%'
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
                                            '&:hover': { opacity: 0.9 }
                                        }}
                                    >
                                        <AuthenticatedImage
                                            attachmentId={attachment.id}
                                            alt={attachment.filename}
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
                                                    transform: 'translate(-50%, -50%)'
                                                }}
                                            >
                                                <ImageIcon sx={{ color: '#999' }} />
                                            </Box>
                                        )}
                                    </Box>
                                </Link>
                            ))}
                        </Box>
                    )}

                    {/* Video */}
                    {videos.length > 0 && (
                        <Box mt={images.length > 0 ? 1 : 0}>
                            {(expanded ? videos : videos.slice(0, 1)).map((attachment) => (
                                <Box key={attachment.id} sx={{ maxWidth: 300 }}>
                                    <video
                                        controls
                                        preload="metadata"
                                        style={{ width: '100%', borderRadius: 8 }}
                                    >
                                        <source src={(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089') + `/api/chat/attachments/${attachment.id}`} type={attachment.mimeType} />
                                    </video>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        {attachment.filename}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}

                    {/* Documents and other files */}
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
                                        '&:hover': { bgcolor: 'action.hover', borderRadius: 1 }
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

                    {/* Show more button */}
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

                    {/* Captions beneath attachment media */}
                    {hasAttachments && !isOwn && hasText && (
                        <Typography
                            variant="body1"
                            sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                        >
                            {message.content}
                        </Typography>
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
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem onClick={handleStartEdit}>Edit</MenuItem>
                <MenuItem onClick={handleOpenDeleteDialog}>Delete</MenuItem>
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