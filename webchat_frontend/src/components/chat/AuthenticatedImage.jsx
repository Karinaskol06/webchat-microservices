import { useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import api from '../../services/api';

const AuthenticatedImage = ({ attachmentId, alt, ...props }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const loadImage = async () => {
            try {
                setLoading(true);
                // Завантажуємо зображення через API з токеном

                const response = await api.get(`/api/chat/attachments/${attachmentId}`, {
                    responseType: 'blob'
                });

                const url = URL.createObjectURL(response.data);
                setImageUrl(url);
                setError(false);
            } catch (err) {
                console.error('Failed to load image:', err);

                setError(true);
            } finally {
                setLoading(false);
            }
        };

        loadImage();

        return () => {
            if (imageUrl) {
                URL.revokeObjectURL(imageUrl);
            }
        };
    }, [attachmentId]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" p={2}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    if (error || !imageUrl) {
        return (
            <Box display="flex" justifyContent="center" p={2}>
            </Box>
        );
    }

    return <Box component="img" src={imageUrl} alt={alt} {...props} />;
};

export default AuthenticatedImage;