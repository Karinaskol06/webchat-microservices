import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import chatService from '../../services/chatService';
import { getApiErrorMessage } from '../../services/api';
import useChatStore from '../../store/useChatStore';
import { canBanRoomMembers } from '../../utils/channelPermissions';
import ChatSharedMediaPanels from './ChatSharedMediaPanels';
import BannedUsersPanel from './BannedUsersPanel';
import { useRoomSharedMedia } from '../../hooks/useRoomSharedMedia';
import { useRoomMembersPresence } from '../../hooks/useRoomMembersPresence';
import {
  chatColors,
  chatGlassListSx,
  chatHideScrollbarSx,
  chatLayout,
  muiTransparent,
} from '../../theme/chatDesignTokens';
import { derivePresenceState, getPresenceLabel } from '../../utils/presence';
import UserAvatar from '../user/UserAvatar';
import useTranslation from '../../hooks/useTranslation';
import { t as translateStatic } from '../../i18n';

const displayName = (u) => {
  if (!u) return translateStatic('common.unknown');
  const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return full || u.username || `User ${u.id}`;
};

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

const presenceDotColor = (state) => {
  if (state === 'online') return '#22C55E';
  if (state === 'afk') return '#F59E0B';
  return 'rgba(16, 8, 26, 0.28)';
};

const panelHeaderSx = {
  px: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  flexShrink: 0,
  width: '100%',
  boxSizing: 'border-box',
};

const sidePanelGlassSx = {
  ...chatGlassListSx,
};

const SECTION_HEADER_HEIGHT = 44;

const MediaSection = ({ label, icon: Icon, count, expanded, onToggle, fillSpace, children }) => {
  const hasContent = count > 0;

  return (
    <Box
      sx={{
        flex: fillSpace ? '1 1 0' : '0 0 auto',
        minHeight: fillSpace ? 72 : undefined,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        component="button"
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        sx={{
          minHeight: SECTION_HEADER_HEIGHT,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          border: 0,
          bgcolor: muiTransparent,
          cursor: 'pointer',
          textAlign: 'left',
          color: chatColors.glassPanelText,
          '&:hover': { bgcolor: 'rgba(16, 8, 26, 0.04)' },
        }}
      >
        <Icon sx={{ fontSize: 20, color: chatColors.glassPanelTextMuted, flexShrink: 0 }} />
        <Typography variant="body2" fontWeight={600} sx={{ color: chatColors.glassPanelText }}>
          {label}
        </Typography>
        <Typography variant="caption" sx={{ color: chatColors.glassPanelTextMuted, ml: 'auto', pr: 0.5 }}>
          {count}
        </Typography>
        <ExpandMoreIcon
          sx={{
            color: chatColors.glassPanelTextMuted,
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </Box>
      {expanded ? (
        <Box
          sx={{
            flex: fillSpace ? 1 : undefined,
            minHeight: fillSpace ? 0 : undefined,
            px: 1,
            pb: hasContent ? 1 : 0.5,
            boxSizing: 'border-box',
            overflow: fillSpace ? 'auto' : 'visible',
            ...(fillSpace ? chatHideScrollbarSx : {}),
          }}
        >
          {children}
        </Box>
      ) : null}
    </Box>
  );
};

const SidePanel = ({
  title,
  subtitle,
  folded,
  onToggleFold,
  onClose,
  ariaLabel,
  children,
  flex = 1,
  maxHeight,
  pushToBottom = false,
}) => (
  <Box
    component="section"
    aria-label={ariaLabel}
    sx={{
      flex: folded ? '0 0 auto' : flex,
      maxHeight: folded ? 'none' : maxHeight,
      height: folded ? 'auto' : undefined,
      alignSelf: 'stretch',
      width: '100%',
      minWidth: '100%',
      mt: pushToBottom ? 'auto' : 0,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      ...sidePanelGlassSx,
    }}
  >
      <Box
        sx={{
          ...panelHeaderSx,
          minHeight: folded || !subtitle ? 48 : 56,
          py: folded ? 1.25 : 1.5,
          borderBottom: folded ? 'none' : `1px solid ${chatColors.glassPanelBorder}`,
        }}
      >
      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography variant="subtitle1" sx={{ color: chatColors.glassPanelText, fontWeight: 700, lineHeight: 1.3 }}>
          {title}
        </Typography>
        {subtitle && !folded ? (
          <Typography
            variant="caption"
            sx={{
              color: chatColors.glassPanelTextMuted,
              display: 'block',
              lineHeight: 1.25,
            }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 0.25,
          flexShrink: 0,
          width: 72,
        }}
      >
        <IconButton
          size="small"
          aria-label={folded ? `Expand ${title}` : `Collapse ${title}`}
          aria-expanded={!folded}
          onClick={onToggleFold}
          sx={{
            color: chatColors.glassPanelTextMuted,
            transform: folded ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
        {onClose ? (
          <IconButton
            size="small"
            aria-label={`Close ${title}`}
            onClick={onClose}
            sx={{ color: chatColors.glassPanelTextMuted }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        ) : (
          <Box sx={{ width: 34, height: 34, flexShrink: 0 }} aria-hidden />
        )}
      </Box>
    </Box>
    {!folded ? (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
    ) : null}
  </Box>
);

const ChatInfoSidebar = ({
  room,
  currentUserId,
  onMemberClick,
  onOpenRoomProfile,
  showMembersPanel = true,
  groupInfoOpen = true,
  membersOpen = true,
  onCloseGroupInfo,
  onCloseMembers,
}) => {
  const { t } = useTranslation();
  const fileSections = useMemo(
    () => [
      { key: 'photos', label: t('sidebar.media.photos'), icon: ImageOutlinedIcon },
      { key: 'videos', label: t('sidebar.media.videos'), icon: VideocamOutlinedIcon },
      { key: 'files', label: t('sidebar.media.documents'), icon: InsertDriveFileOutlinedIcon },
      { key: 'links', label: t('sidebar.media.links'), icon: LinkOutlinedIcon },
    ],
    [t],
  );
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [roomAccessVerified, setRoomAccessVerified] = useState(false);
  const [mediaFolded, setMediaFolded] = useState(false);
  const [membersFolded, setMembersFolded] = useState(false);
  const [expandedSections, setExpandedSections] = useState(['photos']);
  const [memberMenuAnchor, setMemberMenuAnchor] = useState(null);
  const [memberMenuTarget, setMemberMenuTarget] = useState(null);
  const [banConfirmOpen, setBanConfirmOpen] = useState(false);
  const [banActionBusy, setBanActionBusy] = useState(false);
  const [banActionError, setBanActionError] = useState('');
  const [bannedUsers, setBannedUsers] = useState([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedError, setBannedError] = useState(false);
  const [bannedExpanded, setBannedExpanded] = useState(false);
  const [unbanLoadingId, setUnbanLoadingId] = useState(null);
  const loadedRoomIdRef = useRef(null);
  const roomSeedRef = useRef(null);

  const roomId = room?.id;
  const chatType = String(room?.type || '').toUpperCase();
  const isPrivateChat = chatType === 'PRIVATE';
  const isPersonalSpace = chatType === 'PERSONAL_SPACE';
  const infoPanelTitle = isPersonalSpace
    ? t('chat.sidebar.spaceInfo')
    : isPrivateChat
      ? t('chat.sidebar.chatInfo')
      : chatType === 'CHANNEL'
        ? t('chat.sidebar.channelInfo')
        : t('chat.sidebar.groupInfo');
  const linksSectionExpanded = expandedSections.includes('links');
  const sharedMedia = useRoomSharedMedia(roomId, {
    enabled: roomAccessVerified && groupInfoOpen,
    loadLinks: linksSectionExpanded,
  });
  const membersPanelVisible = showMembersPanel && membersOpen;
  const bothPanelsOpen = groupInfoOpen && membersPanelVisible;
  const groupInfoExpanded = groupInfoOpen && !mediaFolded;
  const membersExpanded = membersPanelVisible && !membersFolded;
  const anyPanelExpanded = groupInfoExpanded || membersExpanded;

  const groupInfoFlex = bothPanelsOpen
    ? groupInfoExpanded && membersExpanded
      ? '1 1 0'
      : groupInfoExpanded
        ? 1
        : '0 0 auto'
    : 1;

  const groupInfoMaxHeight =
    bothPanelsOpen && groupInfoExpanded && membersExpanded ? '48%' : undefined;

  const sectionCounts = useMemo(
    () => ({
      photos: sharedMedia.media.photos.length,
      videos: sharedMedia.media.videos.length,
      files: sharedMedia.media.files.length,
      links: sharedMedia.links.length,
    }),
    [sharedMedia.media, sharedMedia.links],
  );

  const membersFlex = bothPanelsOpen
    ? membersExpanded && groupInfoExpanded
      ? 1
      : membersExpanded
        ? 1
        : '0 0 auto'
    : 1;

  const membersPushToBottom = bothPanelsOpen && groupInfoExpanded && !membersExpanded;

  const toggleSection = (key) => {
    setExpandedSections((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  useEffect(() => {
    setMediaFolded(false);
    setMembersFolded(false);
    setExpandedSections(['photos']);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) {
      setDetail(null);
      setRoomAccessVerified(false);
      loadedRoomIdRef.current = null;
      return undefined;
    }

    roomSeedRef.current = room;
    const isNewRoom = loadedRoomIdRef.current !== roomId;
    if (isNewRoom) {
      setLoading(true);
      setRoomAccessVerified(false);
    }

    let cancelled = false;
    chatService
      .getRoom(roomId)
      .then((dto) => {
        if (!cancelled) {
          setDetail(dto);
          setRoomAccessVerified(true);
          loadedRoomIdRef.current = roomId;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(roomSeedRef.current ?? room);
          setRoomAccessVerified(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const data = detail || room;
  const canModerateMembers = Boolean(
    data?.isCurrentUserCanModerateMembers ?? canBanRoomMembers(data, currentUserId),
  );
  const showBannedSection = !isPrivateChat && !isPersonalSpace && canModerateMembers;

  const applyRoomUpdate = useCallback((dto) => {
    if (!dto) return;
    setDetail(dto);
    if (dto.id) {
      useChatStore.getState().upsertChat(dto);
    }
  }, []);

  const refreshBannedList = useCallback(async () => {
    if (!roomId || !showBannedSection) return;
    setBannedLoading(true);
    setBannedError(false);
    try {
      const list = await chatService.listBannedRoomMembers(roomId);
      setBannedUsers(Array.isArray(list) ? list : []);
    } catch {
      setBannedError(true);
    } finally {
      setBannedLoading(false);
    }
  }, [roomId, showBannedSection]);

  useEffect(() => {
    if (!roomId || !showBannedSection || !groupInfoOpen) {
      setBannedUsers([]);
      return undefined;
    }
    void refreshBannedList();
    return undefined;
  }, [roomId, showBannedSection, groupInfoOpen, refreshBannedList, data?.bannedMembers?.length]);

  const closeMemberMenu = () => {
    setMemberMenuAnchor(null);
    setMemberMenuTarget(null);
  };

  const openMemberMenu = (event, member) => {
    event.preventDefault();
    event.stopPropagation();
    setMemberMenuAnchor(event.currentTarget);
    setMemberMenuTarget(member);
  };

  const requestBanMember = () => {
    setBanActionError('');
    setBanConfirmOpen(true);
  };

  const confirmBanMember = async () => {
    if (!roomId || !memberMenuTarget?.id) return;
    setBanActionBusy(true);
    setBanActionError('');
    try {
      const dto = await chatService.banRoomMember(roomId, memberMenuTarget.id);
      applyRoomUpdate(dto);
      await refreshBannedList();
      setBanConfirmOpen(false);
      closeMemberMenu();
    } catch (e) {
      const msg =
        e?.status === 404
          ? 'Ban is not available on the server yet. Restart chat-service so it loads the latest code, then try again.'
          : getApiErrorMessage({ response: { data: e } }, 'Could not ban this member');
      setBanActionError(msg);
    } finally {
      setBanActionBusy(false);
    }
  };

  const handleUnban = async (user) => {
    if (!roomId || !user?.id) return;
    setUnbanLoadingId(user.id);
    try {
      const dto = await chatService.unbanRoomMember(roomId, user.id);
      applyRoomUpdate(dto);
      await refreshBannedList();
    } catch {
      setBannedError(true);
    } finally {
      setUnbanLoadingId(null);
    }
  };

  const canBanMember = (member) => {
    if (!canModerateMembers || !member?.id) return false;
    if (Number(member.id) === Number(currentUserId)) return false;
    if (data?.createdBy != null && Number(data.createdBy) === Number(member.id)) return false;
    return true;
  };

  const members = useMemo(() => {
    const list = Array.isArray(data?.members) ? [...data.members] : [];
    return list.sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [data?.members]);

  const presenceByUserId = useRoomMembersPresence(roomId, members, {
    enabled: roomAccessVerified && showMembersPanel && members.length > 0,
  });

  const closeMediaPanel = () => {
    onCloseGroupInfo?.();
  };

  const closeMembersPanel = () => {
    onCloseMembers?.();
  };

  if (!roomId || (!groupInfoOpen && !membersPanelVisible)) return null;

  return (
    <Box
      sx={{
        width: { lg: chatLayout.infoSidebarWidth, xl: 320 },
        flexShrink: 0,
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        gap: 1.5,
        height: anyPanelExpanded ? '100%' : 'auto',
        minHeight: 0,
        maxHeight: '100%',
        alignSelf: 'stretch',
      }}
    >
      {groupInfoOpen ? (
        <SidePanel
          title={infoPanelTitle}
          folded={mediaFolded}
          onToggleFold={() => setMediaFolded((v) => !v)}
          onClose={closeMediaPanel}
          ariaLabel={infoPanelTitle}
          flex={groupInfoFlex}
          maxHeight={groupInfoMaxHeight}
        >
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
                px: 1,
                py: 0.5,
                ...chatHideScrollbarSx,
              }}
            >
              {fileSections.map(({ key, label, icon: Icon }) => {
                const count = sectionCounts[key] ?? 0;
                const isExpanded = expandedSections.includes(key);
                const fillSpace =
                  isExpanded && count > 0 && key !== 'photos' && key !== 'videos';
                return (
                  <MediaSection
                    key={key}
                    label={label}
                    icon={Icon}
                    count={count}
                    expanded={isExpanded}
                    fillSpace={fillSpace}
                    onToggle={() => toggleSection(key)}
                  >
                    <ChatSharedMediaPanels
                      sectionKey={key}
                      loading={sharedMedia.loading}
                      error={sharedMedia.error}
                      media={sharedMedia.media}
                      links={sharedMedia.links}
                      glassPanel
                    />
                  </MediaSection>
                );
              })}
              {showBannedSection ? (
                <MediaSection
                  label={t('sidebar.banned')}
                  icon={BlockOutlinedIcon}
                  count={bannedUsers.length}
                  expanded={bannedExpanded}
                  fillSpace={false}
                  onToggle={() => setBannedExpanded((v) => !v)}
                >
                  <BannedUsersPanel
                    items={bannedUsers}
                    loading={bannedLoading}
                    error={bannedError}
                    onUnban={handleUnban}
                    actionLoadingId={unbanLoadingId}
                  />
                </MediaSection>
              ) : null}
            </Box>
            <Box
              sx={{
                flexShrink: 0,
                px: 2,
                py: 1,
                borderTop: `1px solid ${chatColors.glassPanelBorder}`,
              }}
            >
              <Typography
                component="button"
                type="button"
                variant="caption"
                onClick={() => onOpenRoomProfile?.()}
                sx={{
                  border: 0,
                  bgcolor: muiTransparent,
                  color: chatColors.navIconActive,
                  fontWeight: 700,
                  cursor: 'pointer',
                  p: 0,
                  font: 'inherit',
                  fontSize: '0.8125rem',
                  '&:hover': { color: chatColors.glassPanelText, textDecoration: 'underline' },
                }}
              >
                {isPersonalSpace
                  ? t('sidebar.viewDetails.personalSpace')
                  : isPrivateChat
                    ? t('sidebar.viewDetails.profile')
                    : t('sidebar.viewDetails.room')}
              </Typography>
            </Box>
          </Box>
        </SidePanel>
      ) : null}

      {membersPanelVisible ? (
        <SidePanel
          title={t('sidebar.members.title')}
          subtitle={t('sidebar.members.subtitle', {
            count: data?.memberCount ?? members.length,
          })}
          folded={membersFolded}
          onToggleFold={() => setMembersFolded((v) => !v)}
          onClose={closeMembersPanel}
          ariaLabel={t('sidebar.members.ariaLabel')}
          flex={membersFlex}
          maxHeight={bothPanelsOpen && membersExpanded && groupInfoExpanded ? undefined : '100%'}
          pushToBottom={membersPushToBottom}
        >
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              px: 1.5,
              pb: 1.5,
              minHeight: 0,
              ...chatHideScrollbarSx,
            }}
          >
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={28} />
              </Box>
            ) : members.length === 0 ? (
              <Typography variant="body2" sx={{ px: 0.5, color: chatColors.glassPanelTextMuted }}>
                {t('sidebar.members.empty')}
              </Typography>
            ) : (
              members.map((member) => {
                const role = memberRole(data, member.id);
                const presence = presenceByUserId[Number(member.id)];
                const presenceState = derivePresenceState(presence);
                const statusLabel = getPresenceLabel(presence, false);
                const isSelf = Number(member.id) === Number(currentUserId);
                const showBanMenu = canBanMember(member);

                return (
                  <Box
                    key={member.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.25,
                      width: '100%',
                      mb: 0.25,
                    }}
                  >
                    <Box
                      component="button"
                      type="button"
                      disabled={isSelf}
                      aria-label={
                        isSelf
                          ? `${displayName(member)} (you)`
                          : `Start chat with ${displayName(member)}`
                      }
                      onClick={() => {
                        if (isSelf) return;
                        onMemberClick?.(member);
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        flex: 1,
                        minWidth: 0,
                        py: 1,
                        px: 0.75,
                        border: 0,
                        borderRadius: 2,
                        bgcolor: muiTransparent,
                        cursor: isSelf ? 'default' : 'pointer',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                        opacity: isSelf ? 0.72 : 1,
                        '&:hover': isSelf ? undefined : { bgcolor: 'rgba(16, 8, 26, 0.06)' },
                        '&:focus-visible': {
                          outline: `2px solid ${chatColors.primary}`,
                          outlineOffset: 1,
                        },
                      }}
                    >
                      <Box sx={{ position: 'relative', flexShrink: 0 }}>
                        <UserAvatar user={member} variant="rounded" sx={{ width: 40, height: 40 }} />
                        <Box
                          aria-hidden
                          sx={{
                            position: 'absolute',
                            right: -1,
                            bottom: -1,
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            bgcolor: presenceDotColor(presenceState),
                            border: '2px solid rgba(255, 255, 255, 0.92)',
                          }}
                        />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{ color: chatColors.glassPanelText }}
                        >
                          {displayName(member)}
                          {isSelf ? ' (you)' : ''}
                        </Typography>
                        <Typography variant="caption" noWrap sx={{ color: chatColors.glassPanelTextMuted }}>
                          {statusLabel}
                        </Typography>
                      </Box>
                      {role ? (
                        <Chip
                          size="small"
                          label={role}
                          sx={{
                            height: 22,
                            fontSize: '0.65rem',
                            textTransform: 'lowercase',
                            bgcolor: 'rgba(123, 97, 255, 0.16)',
                            color: chatColors.primary,
                            fontWeight: 700,
                          }}
                        />
                      ) : null}
                    </Box>
                    {showBanMenu ? (
                      <IconButton
                        size="small"
                        aria-label={`Moderate ${displayName(member)}`}
                        onClick={(event) => openMemberMenu(event, member)}
                        sx={{ color: chatColors.glassPanelTextMuted, flexShrink: 0 }}
                      >
                        <MoreHorizIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </Box>
                );
              })
            )}
          </Box>
        </SidePanel>
      ) : null}

      <Menu
        anchorEl={memberMenuAnchor}
        open={Boolean(memberMenuAnchor)}
        onClose={closeMemberMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            requestBanMember();
          }}
          sx={{ color: 'error.main' }}
        >
          Ban from {chatType === 'CHANNEL' ? 'channel' : 'group'}
        </MenuItem>
      </Menu>

      <Dialog
        open={banConfirmOpen}
        onClose={() => {
          if (banActionBusy) return;
          setBanConfirmOpen(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          Ban {displayName(memberMenuTarget)}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            They will be removed from this {chatType === 'CHANNEL' ? 'channel' : 'group'} and will not
            be able to join again unless you unban them.
          </DialogContentText>
          {banActionError ? (
            <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
              {banActionError}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            disabled={banActionBusy}
            onClick={() => setBanConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={banActionBusy}
            onClick={() => void confirmBanMember()}
          >
            {banActionBusy ? 'Banning…' : 'Ban'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ChatInfoSidebar;
