import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Button,
  TextField,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UserAvatar from '../user/UserAvatar';
import GroupsIcon from '@mui/icons-material/Groups';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { alpha, useTheme } from '@mui/material/styles';
import chatService from '../../services/chatService';
import { canEditRoomProfile } from '../../utils/channelPermissions';
import { getApiErrorMessage } from '../../services/api';
import useChatStore from '../../store/useChatStore';
import useAuthStore from '../../store/useAuthStore';
import { fileToRoomPhotoDataUrl, ROOM_PHOTO_ACCEPT } from '../../utils/roomPhoto';
import { chatHideScrollbarSx } from '../../theme/chatDesignTokens';

const displayName = (u) => {
  if (!u) return 'Unknown';
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || `User ${u.id}`;
};

const handleForUser = (u) => (u?.username ? `@${u.username}` : null);

const formatCreated = (val) => {
  if (val == null) return null;
  try {
    let d;
    if (typeof val === 'string') {
      d = new Date(val);
    } else if (Array.isArray(val) && val.length >= 3) {
      const [y, mo = 1, day = 1, h = 0, mi = 0, s = 0] = val;
      d = new Date(y, mo - 1, day, h, mi, s);
    } else {
      return null;
    }
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return null;
  }
};

function adminIdsSet(room) {
  return new Set((room?.adminUserIds || []).map((id) => Number(id)));
}

function posterIdsSet(room) {
  return new Set((room?.channelPosterUserIds || []).map((id) => Number(id)));
}

function sortRoomMembers(room) {
  if (!room?.members?.length) return [];
  const list = [...room.members];
  const ownerId = room.createdBy != null ? Number(room.createdBy) : null;
  const kind = String(room.type || '').toUpperCase();
  const isGroup = kind === 'GROUP';
  const isChannel = kind === 'CHANNEL';
  const admins = adminIdsSet(room);
  const posters = posterIdsSet(room);

  const rank = (m) => {
    const id = Number(m?.id);
    if (ownerId != null && id === ownerId) return 0;
    if (isChannel && admins.has(id)) return 1;
    if (isChannel && posters.has(id)) return 2;
    if (isGroup && admins.has(id)) return 1;
    return 3;
  };

  list.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' });
  });
  return list;
}

const RoomProfileDialog = ({ open, roomId, onClose }) => {
  const theme = useTheme();
  const { user } = useAuthStore();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviteSentMessage, setInviteSentMessage] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef(null);
  const [manageAnchor, setManageAnchor] = useState(null);
  const [manageMember, setManageMember] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditingProfile(false);
      setEditName('');
      setEditDescription('');
    }
  }, [open]);

  useEffect(() => {
    if (!open || !roomId) {
      return undefined;
    }
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      if (cancelled) return;
      setRoom(null);
      setEditingProfile(false);
      setLoading(true);
      setError('');
      setActionError('');
      try {
        const dto = await chatService.getRoom(roomId);
        if (cancelled) return;
        setRoom(dto);
        if (dto?.id) {
          useChatStore.getState().upsertChat(dto);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, 'Could not load room'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, roomId]);

  const applyRoomUpdate = (dto) => {
    if (!dto) return;
    setRoom(dto);
    if (dto.id) {
      useChatStore.getState().upsertChat(dto);
    }
  };

  const refreshRoom = async () => {
    if (!roomId) return;
    try {
      const dto = await chatService.getRoom(roomId);
      applyRoomUpdate(dto);
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not refresh room'));
    }
  };

  const closeManage = () => {
    setManageAnchor(null);
    setManageMember(null);
  };

  const runAdminAction = async (targetUserId, action) => {
    if (!room?.id) return;
    setActionBusy(true);
    setActionError('');
    try {
      await chatService.mutateRoomAdmins(room.id, targetUserId, action);
      await refreshRoom();
      closeManage();
    } catch (e) {
      setActionError(getApiErrorMessage(e, 'Action failed'));
    } finally {
      setActionBusy(false);
    }
  };

  const handleInviteMember = async () => {
    const username = String(inviteUsername || '').trim().replace(/^@/, '');
    if (!room?.id || !username) {
      setActionError('Enter a username.');
      return;
    }
    setActionBusy(true);
    setActionError('');
    try {
      await chatService.inviteRoomMemberByUsername(room.id, username);
      setInviteUsername('');
      setInviteSentMessage(`Invite sent to @${username}. They must accept before joining.`);
    } catch (e) {
      setInviteSentMessage('');
      setActionError(getApiErrorMessage(e, 'Could not send invite'));
    } finally {
      setActionBusy(false);
    }
  };

  const handlePhotoPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !room?.id) return;
    setPhotoUploading(true);
    setActionError('');
    try {
      const dataUrl = await fileToRoomPhotoDataUrl(file);
      const updatedRoom = await chatService.updateRoomProfile(room.id, { groupPhoto: dataUrl });
      applyRoomUpdate(updatedRoom);
    } catch (e) {
      const message = e instanceof Error && e.message ? e.message : getApiErrorMessage(e, 'Could not update photo');
      setActionError(message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const startEditingProfile = () => {
    if (!room) return;
    setEditName(room.groupName || '');
    setEditDescription(room.description || '');
    setEditingProfile(true);
    setActionError('');
  };

  const cancelEditingProfile = () => {
    setEditingProfile(false);
    setActionError('');
  };

  const handleSaveProfile = async () => {
    if (!room?.id) return;
    if (String(room?.type || '').toUpperCase() === 'PERSONAL_SPACE') return;
    const name = String(editName || '').trim();
    if (!name) {
      setActionError('Room name is required.');
      return;
    }
    if (name.length > 100) {
      setActionError('Room name must be at most 100 characters.');
      return;
    }
    const desc = String(editDescription ?? '');
    if (desc.length > 2000) {
      setActionError('Description must be at most 2000 characters.');
      return;
    }
    setProfileSaving(true);
    setActionError('');
    try {
      const updatedRoom = await chatService.updateRoomProfile(room.id, {
        groupName: name,
        description: desc.trim(),
      });
      applyRoomUpdate(updatedRoom);
      setEditingProfile(false);
    } catch (e) {
      setActionError(getApiErrorMessage(e, 'Could not save room details'));
    } finally {
      setProfileSaving(false);
    }
  };

  const kind = String(room?.type || '').toUpperCase();
  const isGroup = kind === 'GROUP';
  const isChannel = kind === 'CHANNEL';
  const isPersonalSpace = kind === 'PERSONAL_SPACE';
  const visibility = String(room?.visibility || '').toUpperCase();
  const isPublic = visibility === 'PUBLIC';

  const sortedMembers = room ? sortRoomMembers(room) : [];
  const adminSet = room ? adminIdsSet(room) : new Set();
  const posterSet = room ? posterIdsSet(room) : new Set();
  const myId = user?.id != null ? Number(user.id) : null;
  const canModerateRoom = Boolean(
    room &&
      (isPersonalSpace
        ? myId != null && Number(room.createdBy) === myId
        : canEditRoomProfile(room, myId)),
  );
  const canEditProfileDetails = canModerateRoom && !isPersonalSpace;

  const title = room?.groupName || (isPersonalSpace ? 'Personal Space' : isChannel ? 'Channel' : isGroup ? 'Group' : 'Room');
  const profileBusy = profileSaving || photoUploading || actionBusy;
  const letter = (title?.[0] || '?').toUpperCase();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="room-profile-title"
    >
      <DialogTitle
        id="room-profile-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pr: 1,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography component="span" variant="h6" sx={{ flex: 1, fontWeight: 700 }}>
          {isPersonalSpace ? 'Personal space' : 'Room details'}
        </Typography>
        {canEditProfileDetails && !editingProfile ? (
          <Button
            size="small"
            startIcon={<EditOutlinedIcon />}
            onClick={startEditingProfile}
            disabled={profileBusy || loading}
            sx={{ mr: 0.5, textTransform: 'none', fontWeight: 600 }}
          >
            Edit
          </Button>
        ) : null}
        {editingProfile ? (
          <>
            <Button
              size="small"
              onClick={cancelEditingProfile}
              disabled={profileBusy}
              sx={{ mr: 0.5, textTransform: 'none' }}
            >
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => void handleSaveProfile()}
              disabled={profileBusy}
              sx={{ mr: 0.5, textTransform: 'none', fontWeight: 600 }}
            >
              {profileSaving ? 'Saving…' : 'Save'}
            </Button>
          </>
        ) : null}
        <IconButton aria-label="Close" onClick={onClose} edge="end" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 0,
          pt: 0,
          pb: 2,
          overflowY: 'auto',
          ...chatHideScrollbarSx,
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ px: 3, pt: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {!loading && !error && room && (
          <>
            {actionError ? (
              <Box sx={{ px: 3, pt: 2 }}>
                <Alert severity="error" onClose={() => setActionError('')}>
                  {actionError}
                </Alert>
              </Box>
            ) : null}
            <Box
              sx={{
                px: 3,
                pt: 3,
                pb: 2.5,
                background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${alpha(
                  theme.palette.primary.dark,
                  0.06,
                )} 45%, transparent 100%)`,
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ position: 'relative', flexShrink: 0 }}>
                  <UserAvatar
                    src={room.groupPhoto || undefined}
                    letter={letter}
                    alt=""
                    sx={{
                      width: 88,
                      height: 88,
                      fontSize: '2rem',
                      fontWeight: 700,
                      boxShadow: 2,
                      border: '2px solid',
                      borderColor: 'background.paper',
                      opacity: photoUploading ? 0.6 : 1,
                    }}
                  />
                  {canModerateRoom ? (
                    <>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept={ROOM_PHOTO_ACCEPT}
                        hidden
                        onChange={(e) => void handlePhotoPick(e)}
                      />
                      <IconButton
                        size="small"
                        aria-label={isPersonalSpace ? 'Change personal space avatar' : 'Change room avatar'}
                        disabled={profileBusy}
                        onClick={() => photoInputRef.current?.click()}
                        sx={{
                          position: 'absolute',
                          right: -4,
                          bottom: -4,
                          bgcolor: 'background.paper',
                          boxShadow: 1,
                          '&:hover': { bgcolor: 'background.paper' },
                        }}
                      >
                        <PhotoCameraOutlinedIcon fontSize="small" />
                      </IconButton>
                    </>
                  ) : null}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1, pt: 0.5 }}>
                  {editingProfile && canEditProfileDetails ? (
                    <TextField
                      label={isPersonalSpace ? 'Space name' : 'Room name'}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      fullWidth
                      required
                      disabled={profileBusy}
                      inputProps={{ maxLength: 100, 'aria-label': 'Room name' }}
                      sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                    />
                  ) : (
                    <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.02 }}>
                      {title}
                    </Typography>
                  )}
                  <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.25 }}>
                    <Chip
                      size="small"
                      icon={
                        isPersonalSpace ? (
                          <EditOutlinedIcon sx={{ fontSize: 16 }} />
                        ) : isChannel ? (
                          <CampaignOutlinedIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <GroupsIcon sx={{ fontSize: 16 }} />
                        )
                      }
                      label={isPersonalSpace ? 'Personal space' : isChannel ? 'Channel' : isGroup ? 'Group chat' : kind}
                      color={isChannel ? 'primary' : 'default'}
                      variant={isChannel ? 'filled' : 'outlined'}
                    />
                    {isPersonalSpace ? (
                      <Chip size="small" icon={<LockIcon sx={{ fontSize: 16 }} />} label="Only visible to you" variant="outlined" />
                    ) : (
                      <Chip
                        size="small"
                        icon={isPublic ? <PublicIcon sx={{ fontSize: 16 }} /> : <LockIcon sx={{ fontSize: 16 }} />}
                        label={isPublic ? 'Public' : 'Private'}
                        variant="outlined"
                      />
                    )}
                    {typeof room.memberCount === 'number' ? (
                      <Chip size="small" variant="outlined" label={`${room.memberCount} members`} />
                    ) : null}
                  </Stack>
                </Box>
              </Stack>
            </Box>

            <Box sx={{ px: 3, mt: 2 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.08 }}>
                {isPersonalSpace ? 'Purpose' : 'About'}
              </Typography>
              {editingProfile && canEditProfileDetails ? (
                <TextField
                  label="Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  maxRows={8}
                  disabled={profileBusy}
                  placeholder="What is this room about?"
                  helperText={`${editDescription.length}/2000`}
                  inputProps={{ maxLength: 2000, 'aria-label': 'Room description' }}
                  sx={{ mt: 0.75, '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}
                />
              ) : (
                <Box
                  sx={{
                    mt: 0.75,
                    p: 1.75,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {room.description?.trim()
                      ? room.description.trim()
                      : isPersonalSpace
                        ? 'Your private space for notes, attachments, reminders, and pinned blocks.'
                        : 'No description has been added for this room yet.'}
                  </Typography>
                </Box>
              )}
            </Box>

            {formatCreated(room.createdAt) ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 3, mt: 1.5 }}>
                Created {formatCreated(room.createdAt)}
              </Typography>
            ) : null}

            {!isPersonalSpace ? (
              <>
                <Divider sx={{ my: 2.5 }} />

                <Box sx={{ px: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.08 }}>
                    {isChannel ? 'Owner & channel moderators' : 'Owner & admins'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25, mb: 1.25 }}>
                    {isChannel
                      ? 'Owner and moderators manage invites, roles, and other members’ messages. Posting in the channel requires permission.'
                      : 'Admins can manage invites, add members, promote other admins, and moderate messages. All members can chat.'}
                  </Typography>
                  <Stack spacing={1}>
                    {sortedMembers
                      .filter((m) => m && Number(m.id) === Number(room.createdBy))
                      .map((m) => (
                        <Stack
                          key={`owner-${m.id}`}
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'primary.light',
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                          }}
                        >
                          <UserAvatar user={m} sx={{ width: 40, height: 40 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="subtitle2" fontWeight={700} noWrap>
                              {displayName(m)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                              {handleForUser(m)}
                            </Typography>
                          </Box>
                          <Chip size="small" label="Owner" color="primary" variant="outlined" />
                        </Stack>
                      ))}
                    {(isGroup || isChannel)
                      ? sortedMembers
                          .filter((m) => m && adminSet.has(Number(m.id)) && Number(m.id) !== Number(room.createdBy))
                          .map((m) => (
                            <Stack
                              key={`mod-${m.id}`}
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                              sx={{
                                p: 1.25,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <UserAvatar user={m} sx={{ width: 40, height: 40 }} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="subtitle2" fontWeight={600} noWrap>
                                  {displayName(m)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap display="block">
                                  {handleForUser(m)}
                                </Typography>
                              </Box>
                              <Chip
                                size="small"
                                label={isChannel ? 'Moderator' : 'Admin'}
                                variant="outlined"
                              />
                            </Stack>
                          ))
                      : null}
                  </Stack>
                </Box>

                {canModerateRoom ? (
                  <Box sx={{ px: 3, mt: 2 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.08 }}>
                      Invite member by username
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      They receive a request and join only after accepting.
                    </Typography>
                    {inviteSentMessage ? (
                      <Alert severity="success" sx={{ mt: 1 }} onClose={() => setInviteSentMessage('')}>
                        {inviteSentMessage}
                      </Alert>
                    ) : null}
                    <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="flex-start">
                      <TextField
                        size="small"
                        fullWidth
                        placeholder="@jane_doe"
                        value={inviteUsername}
                        onChange={(e) => {
                          setInviteUsername(e.target.value);
                          setInviteSentMessage('');
                        }}
                        disabled={actionBusy}
                      />
                      <Button variant="contained" onClick={() => void handleInviteMember()} disabled={actionBusy}>
                        Invite
                      </Button>
                    </Stack>
                  </Box>
                ) : null}

                <Divider sx={{ my: 2.5 }} />

                <Box sx={{ px: 3 }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.08 }}>
                    Members
                  </Typography>
                  <List dense disablePadding sx={{ mt: 1 }}>
                    {sortedMembers.map((m) => {
                      if (!m?.id) return null;
                      const mid = Number(m.id);
                      const ownerId = room.createdBy != null ? Number(room.createdBy) : null;
                      const isOwner = ownerId != null && mid === ownerId;
                      const isGrpAdm = isGroup && adminSet.has(mid) && !isOwner;
                      const isChanMod = isChannel && adminSet.has(mid) && !isOwner;
                      const isPoster = isChannel && posterSet.has(mid) && !isOwner && !isChanMod;

                      let role = 'Member';
                      if (isOwner) role = 'Owner';
                      else if (isChanMod) role = 'Moderator';
                      else if (isGrpAdm) role = 'Admin';
                      else if (isPoster) role = 'Can post';

                      const chipColor =
                        isOwner ? 'primary' : isGrpAdm || isChanMod ? 'default' : isPoster ? 'secondary' : 'default';
                      const chipVariant = isOwner ? 'filled' : 'outlined';
                      const showManage = canModerateRoom && myId != null && mid !== myId && !isOwner;

                      return (
                        <ListItem
                          key={m.id}
                          secondaryAction={
                            showManage ? (
                              <IconButton
                                edge="end"
                                aria-label="Member actions"
                                onClick={(e) => {
                                  setManageMember(m);
                                  setManageAnchor(e.currentTarget);
                                }}
                              >
                                <MoreHorizIcon />
                              </IconButton>
                            ) : null
                          }
                          sx={{
                            borderRadius: 1.5,
                            mb: 0.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                          }}
                        >
                          <ListItemAvatar>
                            <UserAvatar user={m} />
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight={600} noWrap>
                                {displayName(m)}
                              </Typography>
                            }
                            secondary={
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                display="block"
                              >
                                {handleForUser(m)}
                              </Typography>
                            }
                          />
                          <Chip
                            size="small"
                            label={role}
                            color={chipColor}
                            variant={chipVariant}
                            sx={{ flexShrink: 0, mr: showManage ? 4 : 0 }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                  <Menu anchorEl={manageAnchor} open={Boolean(manageAnchor)} onClose={closeManage}>
                    {manageMember && isGroup ? (
                      !adminSet.has(Number(manageMember.id)) ? (
                        <MenuItem
                          disabled={actionBusy}
                          onClick={() => void runAdminAction(Number(manageMember.id), 'PROMOTE')}
                        >
                          Make admin
                        </MenuItem>
                      ) : (
                        <MenuItem
                          disabled={actionBusy}
                          onClick={() => void runAdminAction(Number(manageMember.id), 'DEMOTE')}
                        >
                          Remove admin
                        </MenuItem>
                      )
                    ) : null}
                    {manageMember && isChannel ? (
                      <>
                        {!adminSet.has(Number(manageMember.id)) ? (
                          <MenuItem
                            disabled={actionBusy}
                            onClick={() => void runAdminAction(Number(manageMember.id), 'PROMOTE')}
                          >
                            Promote to moderator
                          </MenuItem>
                        ) : (
                          <MenuItem
                            disabled={actionBusy}
                            onClick={() => void runAdminAction(Number(manageMember.id), 'DEMOTE')}
                          >
                            Remove moderator
                          </MenuItem>
                        )}
                        {!adminSet.has(Number(manageMember.id)) && !posterSet.has(Number(manageMember.id)) ? (
                          <MenuItem
                            disabled={actionBusy}
                            onClick={() => void runAdminAction(Number(manageMember.id), 'GRANT_POST')}
                          >
                            Allow posting
                          </MenuItem>
                        ) : null}
                        {posterSet.has(Number(manageMember.id)) ? (
                          <MenuItem
                            disabled={actionBusy}
                            onClick={() => void runAdminAction(Number(manageMember.id), 'REVOKE_POST')}
                          >
                            Revoke posting
                          </MenuItem>
                        ) : null}
                      </>
                    ) : null}
                  </Menu>
                </Box>
              </>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RoomProfileDialog;
