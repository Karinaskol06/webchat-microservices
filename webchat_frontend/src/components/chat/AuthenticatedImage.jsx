import { useState, useEffect, useRef } from 'react';
import { Box, CircularProgress } from '@mui/material';
import api from '../../services/api';

const AuthenticatedImage = ({ attachmentId, alt, onLoad, ...props }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const blobUrlRef = useRef(null);

    useEffect(() => {
        let cancelled = false;

        const revokeBlob = () => {
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };

        const loadImage = async () => {
            setLoading(true);
            setError(false);
            revokeBlob();
            setImageUrl(null);

            try {
                const response = await api.get(`/api/chat/attachments/${attachmentId}`, {
                    responseType: 'blob',
                });

                if (cancelled) return;

                const url = URL.createObjectURL(response.data);
                blobUrlRef.current = url;
                setImageUrl(url);
                setError(false);
            } catch (err) {
                console.error('Failed to load image:', err);
                if (!cancelled) {
                    setError(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void loadImage();

        return () => {
            cancelled = true;
            revokeBlob();
            setImageUrl(null);
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
            <Box display="flex" justifyContent="center" p={2} />
        );
    }

    return (
        <Box
            component="img"
            src={imageUrl}
            alt={alt}
            onLoad={onLoad}
            onError={() => setError(true)}
            {...props}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
        />
    );
};

export default AuthenticatedImage;
