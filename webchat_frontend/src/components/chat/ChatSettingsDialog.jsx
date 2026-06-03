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
import AccountCredentialsPanel from '../settings/AccountCredentialsPanel';
import chatService from '../../services/chatService';
import contactsService from '../../services/contactsService';
import { joinInviteErrorMessage, parseInviteToken } from '../../utils/inviteLink';
import { getApiErrorMessage } from '../../services/api';
import UserAvatar from '../user/UserAvatar';

const VIEW_MENU = 'menu';
const VIEW_INVITE = 'invite';
const VIEW_CONTACTS = 'contacts';
const VIEW_ACCOUNT = 'account';

const displayName = (user) => {
  if (!user) return 'Unknown user';
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
  currentUserId,
  currentUser,
  /** `join` opens the invite form directly (e.g. from chat list menu). */
  variant = 'settings',
}) => {
  const joinOnly = variant === 'join';
  const [view, setView] = useState(joinOnly ? VIEW_INVITE : VIEW_MENU);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [contactsBusy, setContactsBusy] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestBusyId, setRequestBusyId] = useState(null);

  const menuItems = useMemo(
    () => [
      {
        key: VIEW_CONTACTS,
        icon: ContactsOutlinedIcon,
        primary: 'Contacts',
        secondary: 'Open chats with saved contacts and review pending requests',
      },
      {
        key: VIEW_INVITE,
        icon: LinkIcon,
        primary: 'Join via link',
        secondary: 'Paste a group or channel invite',
      },
      {
        key: VIEW_ACCOUNT,
        icon: ManageAccountsOutlinedIcon,
        primary: 'Change username or password',
        secondary: 'Update sign-in username, email, or password',
      },
    ],
    [],
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
        setContactsError(getApiErrorMessage(error, 'Failed to load contacts.'));
      } finally {
        if (!cancelled) setContactsBusy(false);
      }
    };
    void loadContactsData();
    return () => {
      cancelled = true;
    };
  }, [open, view, currentUserId]);

  const handleClose = () => {
    onClose?.();
  };

  const handleJoinInvite = async () => {
    const token = parseInviteToken(inviteInput);
    if (!token) {
      setInviteError('Paste an invite link or token.');
      return;
    }
    setInviteBusy(true);
    setInviteError('');
    try {
      const dto = await chatService.joinByInvite(token);
      if (!dto?.id) {
        setInviteError('Join succeeded but room data was missing.');
        return;
      }
      onJoinedRoom?.(dto);
      handleClose();
    } catch (err) {
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
      setContactsError(getApiErrorMessage(error, 'Could not accept the contact request.'));
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
      setContactsError(getApiErrorMessage(error, 'Could not decline the contact request.'));
    } finally {
      setRequestBusyId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth={view === VIEW_CONTACTS || view === VIEW_ACCOUNT ? 'sm' : 'xs'}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        {view !== VIEW_MENU ? (
          <IconButton
            aria-label={joinOnly ? 'Close' : 'Back to settings'}
            onClick={() => (joinOnly && view === VIEW_INVITE ? handleClose() : setView(VIEW_MENU))}
            edge="start"
            size="small"
          >
            <ArrowBackIcon />
          </IconButton>
        ) : null}
        <Typography component="span" variant="h6" sx={{ flex: 1 }}>
          {view === VIEW_INVITE
            ? 'Join via link'
            : view === VIEW_CONTACTS
              ? 'Contacts'
              : view === VIEW_ACCOUNT
                ? 'Change username or password'
                : 'Settings'}
        </Typography>
        <IconButton aria-label="Close settings" onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: view === VIEW_MENU ? 0 : 2 }}>
        {view === VIEW_MENU ? (
          <List disablePadding>
            {menuItems.map(({ key, icon: Icon, primary, secondary }) => (
              <ListItemButton key={key} onClick={() => setView(key)}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon color="primary" />
                </ListItemIcon>
                <ListItemText primary={primary} secondary={secondary} />
              </ListItemButton>
            ))}
          </List>
        ) : view === VIEW_ACCOUNT ? (
          <AccountCredentialsPanel currentUser={currentUser} onClose={handleClose} />
        ) : view === VIEW_INVITE ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Paste an invite link or token from a group or channel admin.
            </Typography>
            <TextField
              size="small"
              fullWidth
              label="Invite link or token"
              placeholder="Paste link or token"
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
                {joinOnly ? 'Cancel' : 'Back'}
              </Button>
              <Button
                variant="contained"
                disabled={inviteBusy || !String(inviteInput).trim()}
                onClick={() => void handleJoinInvite()}
              >
                {inviteBusy ? 'Joining…' : 'Join'}
              </Button>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Open chats with people already in your contacts or manage incoming contact requests.
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
                      Contacts
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {contacts.length}
                    </Typography>
                  </Stack>
                  {contacts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No contacts yet.
                    </Typography>
                  ) : (
                    <List disablePadding sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      {contacts.map((contact, index) => (
                        <React.Fragment key={contact.id}>
                          <ListItem disablePadding>
                            <ListItemButton onClick={() => handleOpenContact(contact)}>
                              <ListItemIcon sx={{ minWidth: 52 }}>
                                <UserAvatar user={contact} />
                              </ListItemIcon>
                              <ListItemText
                                primary={displayName(contact)}
                                secondary={contact.username ? `@${contact.username}` : null}
                              />
                            </ListItemButton>
                          </ListItem>
                          {index < contacts.length - 1 ? <Divider component="li" /> : null}
                        </React.Fragment>
                      ))}
                    </List>
                  )}
                </Box>

                <Box>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <PersonAddAlt1OutlinedIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>
                      Pending requests
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {pendingRequests.length}
                    </Typography>
                  </Stack>
                  {pendingRequests.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No pending contact requests.
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
                                  {requestUser?.username ? `@${requestUser.username}` : 'Incoming contact request'}
                                </Typography>
                              </Box>
                            </Stack>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.25 }}>
                              <Button
                                size="small"
                                onClick={() => void handleDeclineRequest(request)}
                                disabled={busy}
                              >
                                Decline
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => void handleAcceptRequest(request)}
                                disabled={busy}
                              >
                                {busy ? 'Saving…' : 'Accept'}
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
    </Dialog>
  );
};

export default ChatSettingsDialog;
