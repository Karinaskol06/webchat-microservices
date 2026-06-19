import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined';
import AccountCredentialsPanel from '../settings/AccountCredentialsPanel';
import DeleteAccountPanel from '../settings/DeleteAccountPanel';
import ThemePickerDialog from '../settings/ThemePickerDialog';
import LanguageSettingsPanel from '../settings/LanguageSettingsPanel';
import chatService from '../../services/chatService';
import contactsService from '../../services/contactsService';
import userBanService from '../../services/userBanService';
import { joinInviteErrorMessage, parseInviteToken } from '../../utils/inviteLink';
import { parseRoomBanError } from '../../utils/roomBanError';
import RoomBanDialog from './RoomBanDialog';
import BannedUsersPanel from './BannedUsersPanel';
import { getApiErrorMessage } from '../../services/api';
import UserAvatar from '../user/UserAvatar';
import useTranslation from '../../hooks/useTranslation';
import { t as translateStatic } from '../../i18n';
import { chatHideScrollbarSx } from '../../theme/chatDesignTokens';

const VIEW_MENU = 'menu';
const VIEW_INVITE = 'invite';
const VIEW_CONTACTS = 'contacts';
const VIEW_ACCOUNT = 'account';
const VIEW_THEMES = 'themes';
const VIEW_BANNED = 'banned';
const VIEW_LANGUAGE = 'language';
const VIEW_DELETE = 'delete';

const displayName = (user) => {
  if (!user) return translateStatic('common.unknownUser');
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return full || user.username || `User ${user.id}`;
};

const sortContacts = (users) =>
  [...users].sort((a, b) =>
    displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }),
  );

const ChatSettingsDialog = ({
  open,
  onClose,
  onJoinedRoom,
  onOpenContact,
  onUserBanStateChange,
  currentUserId,
  currentUser,
  /** `join` opens the invite form directly (e.g. from chat list menu). */
  variant = 'settings',
}) => {
  const joinOnly = variant === 'join';
  const { t } = useTranslation();
  const [view, setView] = useState(joinOnly ? VIEW_INVITE : VIEW_MENU);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [contactsBusy, setContactsBusy] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestBusyId, setRequestBusyId] = useState(null);
  const [removeContactLoadingId, setRemoveContactLoadingId] = useState(null);
  const [themesOpen, setThemesOpen] = useState(false);
  const [banDialog, setBanDialog] = useState(null);
  const [bannedUsers, setBannedUsers] = useState([]);
  const [bannedLoading, setBannedLoading] = useState(false);
  const [bannedListError, setBannedListError] = useState(false);
  const [bannedError, setBannedError] = useState('');
  const [unbanLoadingId, setUnbanLoadingId] = useState(null);

  const menuItems = useMemo(
    () => [
      {
        key: VIEW_CONTACTS,
        icon: ContactsOutlinedIcon,
        primary: t('settings.menu.contacts.title'),
        secondary: t('settings.menu.contacts.subtitle'),
      },
      {
        key: VIEW_INVITE,
        icon: LinkIcon,
        primary: t('settings.menu.join.title'),
        secondary: t('settings.menu.join.subtitle'),
      },
      {
        key: VIEW_ACCOUNT,
        icon: ManageAccountsOutlinedIcon,
        primary: t('settings.menu.account.title'),
        secondary: t('settings.menu.account.subtitle'),
      },
      {
        key: VIEW_THEMES,
        icon: PaletteOutlinedIcon,
        primary: t('settings.menu.themes.title'),
        secondary: t('settings.menu.themes.subtitle'),
      },
      {
        key: VIEW_LANGUAGE,
        icon: TranslateOutlinedIcon,
        primary: t('settings.menu.language.title'),
        secondary: t('settings.menu.language.subtitle'),
      },
      {
        key: VIEW_BANNED,
        icon: BlockOutlinedIcon,
        primary: t('settings.menu.banned.title'),
        secondary: t('settings.menu.banned.subtitle'),
      },
    ],
    [t],
  );

  const dangerMenuItem = useMemo(
    () => ({
      key: VIEW_DELETE,
      icon: DeleteOutlineIcon,
      primary: t('settings.menu.delete.title'),
      secondary: t('settings.menu.delete.subtitle'),
    }),
    [t],
  );

  useEffect(() => {
    if (!open) {
      setView(joinOnly ? VIEW_INVITE : VIEW_MENU);
      setInviteInput('');
      setInviteError('');
      setInviteBusy(false);
      setContacts([]);
      setPendingRequests([]);
      setContactsError('');
      setContactsBusy(false);
      setRequestBusyId(null);
      setRemoveContactLoadingId(null);
      setThemesOpen(false);
      setBannedUsers([]);
      setBannedListError(false);
      setBannedError('');
      setUnbanLoadingId(null);
      return;
    }
    setView(joinOnly ? VIEW_INVITE : VIEW_MENU);
  }, [open, joinOnly]);

  useEffect(() => {
    if (!open || view !== VIEW_CONTACTS) return;
    let cancelled = false;
    const loadContactsData = async () => {
      if (!currentUserId) {
        setContacts([]);
        setPendingRequests([]);
        return;
      }
      setContactsBusy(true);
      setContactsError('');
      try {
        const [contactList, incomingRequests] = await Promise.all([
          contactsService.listContacts(currentUserId),
          contactsService.listIncomingRequests(currentUserId),
        ]);
        if (cancelled) return;
        setContacts(sortContacts(contactList));
        setPendingRequests(Array.isArray(incomingRequests) ? incomingRequests : []);
      } catch (error) {
        if (cancelled) return;
        setContactsError(getApiErrorMessage(error, t('settings.error.loadContacts')));
      } finally {
        if (!cancelled) setContactsBusy(false);
      }
    };
    void loadContactsData();
    return () => {
      cancelled = true;
    };
  }, [open, view, currentUserId]);

  useEffect(() => {
    if (!open || view !== VIEW_BANNED) return;
    let cancelled = false;
    const loadBannedUsers = async () => {
      if (!currentUserId) {
        setBannedUsers([]);
        return;
      }
      setBannedLoading(true);
      setBannedListError(false);
      setBannedError('');
      try {
        const list = await userBanService.listBannedUsers(currentUserId);
        if (!cancelled) {
          setBannedUsers(Array.isArray(list) ? list : []);
        }
      } catch (error) {
        if (!cancelled) {
          setBannedListError(true);
          setBannedError(getApiErrorMessage(error, t('settings.error.loadBanned')));
        }
      } finally {
        if (!cancelled) setBannedLoading(false);
      }
    };
    void loadBannedUsers();
    return () => {
      cancelled = true;
    };
  }, [open, view, currentUserId]);

  const handleUnbanUser = async (bannedUser) => {
    if (!bannedUser?.id || !currentUserId) return;
    setUnbanLoadingId(bannedUser.id);
    setBannedError('');
    try {
      await userBanService.unbanUser(bannedUser.id, currentUserId);
      setBannedUsers((prev) => prev.filter((item) => Number(item.id) !== Number(bannedUser.id)));
      onUserBanStateChange?.({ userId: bannedUser.id, banned: false });
    } catch (error) {
      setBannedError(getApiErrorMessage(error, t('settings.error.unban')));
    } finally {
      setUnbanLoadingId(null);
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  const handleJoinInvite = async () => {
    const token = parseInviteToken(inviteInput);
    if (!token) {
      setInviteError(t('settings.join.error.paste'));
      return;
    }
    setInviteBusy(true);
    setInviteError('');
    try {
      const dto = await chatService.joinByInvite(token);
      if (!dto?.id) {
        setInviteError(t('settings.join.error.missingRoom'));
        return;
      }
      onJoinedRoom?.(dto);
      handleClose();
    } catch (err) {
      const ban = parseRoomBanError(err);
      if (ban) {
        setBanDialog(ban);
        return;
      }
      setInviteError(joinInviteErrorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleOpenContact = (contact) => {
    if (!contact?.id) return;
    onOpenContact?.({
      ...contact,
      avatar: contact.avatar ?? contact.profilePicture ?? null,
    });
    handleClose();
  };

  const handleAcceptRequest = async (request) => {
    if (!request?.id || !currentUserId) return;
    setRequestBusyId(request.id);
    setContactsError('');
    try {
      await contactsService.acceptRequest(request.id, currentUserId);
      setPendingRequests((prev) => prev.filter((item) => item.id !== request.id));
      if (request.fromUser?.id) {
        setContacts((prev) => {
          const withoutDuplicate = prev.filter((item) => Number(item.id) !== Number(request.fromUser.id));
          return sortContacts([...withoutDuplicate, request.fromUser]);
        });
      }
    } catch (error) {
      setContactsError(getApiErrorMessage(error, t('settings.error.acceptRequest')));
    } finally {
      setRequestBusyId(null);
    }
  };

  const handleDeclineRequest = async (request) => {
    if (!request?.id || !currentUserId) return;
    setRequestBusyId(request.id);
    setContactsError('');
    try {
      await contactsService.declineRequest(request.id, currentUserId);
      setPendingRequests((prev) => prev.filter((item) => item.id !== request.id));
    } catch (error) {
      setContactsError(getApiErrorMessage(error, t('settings.error.declineRequest')));
    } finally {
      setRequestBusyId(null);
    }
  };

  const handleRemoveContact = async (contact) => {
    if (!contact?.id || !currentUserId) return;
    setRemoveContactLoadingId(contact.id);
    setContactsError('');
    try {
      await contactsService.removeContact(contact.id, currentUserId);
      setContacts((prev) => prev.filter((item) => Number(item.id) !== Number(contact.id)));
    } catch (error) {
      setContactsError(getApiErrorMessage(error, t('settings.error.removeContact')));
    } finally {
      setRemoveContactLoadingId(null);
    }
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth={view === VIEW_CONTACTS || view === VIEW_ACCOUNT || view === VIEW_BANNED || view === VIEW_LANGUAGE || view === VIEW_DELETE ? 'sm' : 'xs'}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        {view !== VIEW_MENU ? (
          <IconButton
            aria-label={joinOnly ? t('common.close') : t('settings.back')}
            onClick={() => (joinOnly && view === VIEW_INVITE ? handleClose() : setView(VIEW_MENU))}
            edge="start"
            size="small"
          >
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <Typography component="span" variant="h6" sx={{ flex: 1 }}>
          {view === VIEW_INVITE
            ? t('settings.menu.join.title')
            : view === VIEW_CONTACTS
              ? t('settings.menu.contacts.title')
              : view === VIEW_ACCOUNT
                ? t('settings.menu.account.title')
                : view === VIEW_BANNED
                  ? t('settings.menu.banned.title')
                  : view === VIEW_LANGUAGE
                    ? t('settings.menu.language.title')
                    : view === VIEW_DELETE
                      ? t('settings.menu.delete.title')
                      : t('settings.title')}
        </Typography>
        <IconButton aria-label={t('settings.close')} onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          pt: view === VIEW_MENU ? 0 : 2,
          ...chatHideScrollbarSx,
          overflowX: 'hidden',
        }}
      >
        {view === VIEW_MENU ? (
          <List disablePadding>
            {menuItems.map(({ key, icon: Icon, primary, secondary }) => (
              <ListItemButton
                key={key}
                onClick={() => (key === VIEW_THEMES ? setThemesOpen(true) : setView(key))}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon color="primary" />
                </ListItemIcon>
                <ListItemText primary={primary} secondary={secondary} />
              </ListItemButton>
            ))}
            <Divider sx={{ my: 1 }} />
            <ListItemButton onClick={() => setView(VIEW_DELETE)}>
              <ListItemIcon sx={{ minWidth: 40 }}>
                <dangerMenuItem.icon color="error" />
              </ListItemIcon>
              <ListItemText
                primary={dangerMenuItem.primary}
                secondary={dangerMenuItem.secondary}
                primaryTypographyProps={{ color: 'error.main', fontWeight: 600 }}
              />
            </ListItemButton>
          </List>
        ) : view === VIEW_ACCOUNT ? (
          <AccountCredentialsPanel currentUser={currentUser} onClose={handleClose} />
        ) : view === VIEW_DELETE ? (
          <DeleteAccountPanel currentUser={currentUser} onClose={handleClose} />
        ) : view === VIEW_LANGUAGE ? (
          <LanguageSettingsPanel />
        ) : view === VIEW_BANNED ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('settings.banned.intro')}
            </Typography>
            {bannedError ? (
              <Alert severity="error" onClose={() => setBannedError('')}>
                {bannedError}
              </Alert>
            ) : null}
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <BlockOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'text.primary' }}>
                  {t('settings.banned.sectionTitle')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {bannedUsers.length}
                </Typography>
              </Stack>
              <BannedUsersPanel
                items={bannedUsers}
                loading={bannedLoading}
                error={bannedListError}
                onUnban={handleUnbanUser}
                actionLoadingId={unbanLoadingId}
                variant="modal"
              />
            </Box>
          </Stack>
        ) : view === VIEW_INVITE ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('settings.join.intro')}
            </Typography>
            <TextField
              size="small"
              fullWidth
              label={t('settings.join.label')}
              placeholder={t('settings.join.placeholder')}
              value={inviteInput}
              disabled={inviteBusy}
              onChange={(e) => {
                setInviteInput(e.target.value);
                if (inviteError) setInviteError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleJoinInvite();
                }
              }}
            />
            {inviteError ? (
              <Alert severity="error" onClose={() => setInviteError('')}>
                {inviteError}
              </Alert>
            ) : null}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                onClick={() => (joinOnly ? handleClose() : setView(VIEW_MENU))}
                disabled={inviteBusy}
              >
                {joinOnly ? t('common.cancel') : t('common.back')}
              </Button>
              <Button
                variant="contained"
                disabled={inviteBusy || !String(inviteInput).trim()}
                onClick={() => void handleJoinInvite()}
              >
                {inviteBusy ? t('common.joining') : t('common.join')}
              </Button>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t('settings.contacts.intro')}
            </Typography>
            {contactsError ? (
              <Alert severity="error" onClose={() => setContactsError('')}>
                {contactsError}
              </Alert>
            ) : null}
            {contactsBusy ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <ContactsOutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      {t('settings.contacts.section')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {contacts.length}
                    </Typography>
                  </Stack>
                  {contacts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('settings.contacts.empty')}
                    </Typography>
                  ) : (
                    <List disablePadding sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      {contacts.map((contact, index) => {
                        const busy = Number(removeContactLoadingId) === Number(contact.id);
                        return (
                          <React.Fragment key={contact.id}>
                            <ListItem
                              disablePadding
                              sx={{
                                gap: 1,
                                py: 0.5,
                                pr: 1,
                                alignItems: 'center',
                              }}
                            >
                              <ListItemButton onClick={() => handleOpenContact(contact)} sx={{ flex: 1 }}>
                                <ListItemIcon sx={{ minWidth: 52 }}>
                                  <UserAvatar user={contact} />
                                </ListItemIcon>
                                <ListItemText
                                  primary={displayName(contact)}
                                  secondary={contact.username ? `@${contact.username}` : null}
                                />
                              </ListItemButton>
                              <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                disabled={busy}
                                onClick={() => void handleRemoveContact(contact)}
                                sx={{ flexShrink: 0, minWidth: 72, fontWeight: 600 }}
                              >
                                {busy ? t('common.saving') : t('settings.contacts.remove')}
                              </Button>
                            </ListItem>
                            {index < contacts.length - 1 ? <Divider component="li" /> : null}
                          </React.Fragment>
                        );
                      })}
                    </List>
                  )}
                </Box>

                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <PersonAddAlt1OutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      {t('settings.contacts.pending')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pendingRequests.length}
                    </Typography>
                  </Stack>
                  {pendingRequests.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      {t('settings.contacts.pending.empty')}
                    </Typography>
                  ) : (
                    <Stack spacing={1.25}>
                      {pendingRequests.map((request) => {
                        const requestUser = request.fromUser;
                        const busy = requestBusyId === request.id;
                        return (
                          <Box
                            key={request.id}
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'background.paper',
                            }}
                          >
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <UserAvatar user={requestUser} />
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" fontWeight={700} noWrap>
                                  {displayName(requestUser)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap display="block">
                                  {requestUser?.username ? `@${requestUser.username}` : t('settings.contacts.request.incoming')}
                                </Typography>
                              </Box>
                            </Stack>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.25 }}>
                              <Button
                                size="small"
                                onClick={() => void handleDeclineRequest(request)}
                                disabled={busy}
                              >
                                {t('common.decline')}
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => void handleAcceptRequest(request)}
                                disabled={busy}
                              >
                                {busy ? t('common.saving') : t('common.accept')}
                              </Button>
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <ThemePickerDialog open={themesOpen} onClose={() => setThemesOpen(false)} />
    </Dialog>
    <RoomBanDialog
      open={Boolean(banDialog)}
      onClose={() => setBanDialog(null)}
      message={banDialog?.message}
      roomName={banDialog?.roomName}
      roomType={banDialog?.roomType}
    />
    </>
  );
};

export default ChatSettingsDialog;
