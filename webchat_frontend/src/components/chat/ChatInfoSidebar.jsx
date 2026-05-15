import React, { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import MicOutlinedIcon from '@mui/icons-material/MicOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import chatService from '../../services/chatService';
import ChatSharedMediaPanels from './ChatSharedMediaPanels';
import { useRoomSharedMedia } from '../../hooks/useRoomSharedMedia';
import { chatColors, chatGlassListSx, chatHideScrollbarSx } from '../../theme/chatDesignTokens';

const displayName = (u) => {
  if (!u) return 'Unknown';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || `User ${u.id}`;
};

const FILE_SECTIONS = [
  { key: 'photos', label: 'Photos', icon: ImageOutlinedIcon },
  { key: 'videos', label: 'Videos', icon: VideocamOutlinedIcon },
  { key: 'files', label: 'Files', icon: InsertDriveFileOutlinedIcon },
  { key: 'audio', label: 'Audio', icon: MicOutlinedIcon },
  { key: 'links', label: 'Links', icon: LinkOutlinedIcon },
  { key: 'voice', label: 'Voice messages', icon: MicOutlinedIcon },
];

function memberRole(room, memberId) {
  const id = Number(memberId);
  const kind = String(room?.type || '').toUpperCase();
  if (room?.createdBy != null && Number(room.createdBy) === id) {
    return kind === 'CHANNEL' ? 'owner' : 'admin';
  }
  if ((room?.adminUserIds || []).map(Number).includes(id)) return 'admin';
  if ((room?.channelPosterUserIds || []).map(Number).includes(id)) return 'poster';
  return null;
}

const ChatInfoSidebar = ({ room, onOpenRoomProfile }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roomAccessVerified, setRoomAccessVerified] = useState(false);

  const roomId = room?.id;
  const sharedMedia = useRoomSharedMedia(roomId, { enabled: roomAccessVerified });

  useEffect(() => {
    if (!roomId) {
      setDetail(null);
      setRoomAccessVerified(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setRoomAccessVerified(false);
    chatService
      .getRoom(roomId)
      .then((dto) => {
        if (!cancelled) {
          setDetail(dto);
          setRoomAccessVerified(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(room);
          setRoomAccessVerified(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, room]);

  const data = detail || room;
  const members = useMemo(() => {
    const list = Array.isArray(data?.members) ? [...data.members] : [];
    return list.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [data?.members]);

  if (!roomId) return null;

  return (
    <Box
      sx={{
        width: { lg: 300, xl: 320 },
        flexShrink: 0,
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
        minHeight: 0,
        maxHeight: '100%',
      }}
    >
      <Box
        component="section"
        aria-label="Group info"
        sx={{
          flex: '0 0 auto',
          maxHeight: '48%',
          ...chatGlassListSx,
        }}
      >
        <Box sx={{ px: 2, py: 1.75, borderBottom: `1px solid ${chatColors.borderSubtle}` }}>
          <Typography variant="subtitle1" sx={{ color: chatColors.textPrimary, fontWeight: 700 }}>
            Group info
          </Typography>
        </Box>
        <Box sx={{ overflow: 'auto', flex: 1, px: 1, py: 0.5, ...chatHideScrollbarSx }}>
          {FILE_SECTIONS.map(({ key, label, icon: Icon }, idx) => (
            <Accordion
              key={key}
              disableGutters
              elevation={0}
              defaultExpanded={idx === 0}
              sx={{
                '&:before': { display: 'none' },
                bgcolor: 'transparent',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: chatColors.textSecondary }} />}
                sx={{ minHeight: 44, px: 1, color: chatColors.textPrimary }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Icon sx={{ fontSize: 20, color: chatColors.textSecondary }} />
                  <Typography variant="body2" fontWeight={600} sx={{ color: chatColors.textPrimary }}>
                    {label}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1.5, px: 1 }}>
                <ChatSharedMediaPanels
                  sectionKey={key}
                  loading={sharedMedia.loading}
                  error={sharedMedia.error}
                  media={sharedMedia.media}
                  links={sharedMedia.links}
                />
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
        <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${chatColors.borderSubtle}` }}>
          <Typography
            component="button"
            type="button"
            variant="caption"
            onClick={() => onOpenRoomProfile?.()}
            sx={{
              border: 0,
              bgcolor: 'transparent',
              color: chatColors.primary,
              fontWeight: 600,
              cursor: 'pointer',
              p: 0,
              font: 'inherit',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            View full room details
          </Typography>
        </Box>
      </Box>

      <Box
        component="section"
        aria-label="Members"
        sx={{
          flex: 1,
          minHeight: 120,
          mt: 'auto',
          display: 'flex',
          flexDirection: 'column',
          ...chatGlassListSx,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.75,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="subtitle1" sx={{ color: chatColors.textPrimary, fontWeight: 700 }}>
            Members
          </Typography>
          <Typography variant="caption" sx={{ color: chatColors.textSecondary }}>
            {data?.memberCount ?? members.length}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, pb: 1.5, ...chatHideScrollbarSx }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : members.length === 0 ? (
            <Typography variant="body2" sx={{ px: 0.5, color: chatColors.textSecondary }}>
              No members loaded.
            </Typography>
          ) : (
            members.map((m) => {
              const role = memberRole(data, m.id);
              return (
                <Box
                  key={m.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    py: 1,
                    px: 0.5,
                    borderRadius: 2,
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
                  }}
                >
                  <Avatar
                    variant="rounded"
                    src={m.profilePicture || undefined}
                    sx={{ width: 40, height: 40 }}
                  >
                    {(m.firstName?.[0] || m.username?.[0] || '?').toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      noWrap
                      sx={{ color: chatColors.textPrimary }}
                    >
                      {displayName(m)}
                    </Typography>
                    {m.username ? (
                      <Typography variant="caption" noWrap sx={{ color: chatColors.textSecondary }}>
                        @{m.username}
                      </Typography>
                    ) : null}
                  </Box>
                  {role ? (
                    <Chip
                      size="small"
                      label={role}
                      sx={{
                        height: 22,
                        fontSize: '0.65rem',
                        bgcolor: chatColors.primary,
                        color: '#fff',
                      }}
                    />
                  ) : null}
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ChatInfoSidebar;
