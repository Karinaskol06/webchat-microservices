import React, { useState } from 'react';
import { Avatar, Box, Link, Paper, Typography, IconButton } from '@mui/material';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AuthenticatedImage from './AuthenticatedImage';
import chatService from '../../services/chatService';

const MessageItem = ({ message, currentUserId }) => {
    const [expanded, setExpanded] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState({});

    const sender = message.sender || { id: message.senderId };
    const isOwn = sender?.id === currentUserId;
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
                        p: hasText ? 1.5 : 1,
                        bgcolor: isOwn ? '#e3f2fd' : 'white',
                        borderRadius: 2,
                    }}
                >
                    {/* Message text */}
                    {hasText && (
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {message.content}
                        </Typography>
                    )}

                    {/* Images */}
                    {images.length > 0 && (
                        <Box
                            mt={hasText ? 1 : 0}
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
                        <Box mt={hasText || images.length > 0 ? 1 : 0}>
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
                        <Box mt={hasText || images.length > 0 || videos.length > 0 ? 1 : 0}>
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
        </Box>
    );
};

export default MessageItem;