import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import userService from "../../services/userService";
import chatService from "../../services/chatService";
import RoomBanDialog from "./RoomBanDialog";
import { parseRoomBanError } from "../../utils/roomBanError";

const TAB_USERS = 0;
const TAB_ROOMS = 1;

const mergeRoomResults = (mineRooms, publicRooms) => {
  const byId = new Map();
  (Array.isArray(mineRooms) ? mineRooms : []).forEach((r) => {
    if (r?.id) byId.set(String(r.id), { ...r, alreadyMember: true });
  });
  (Array.isArray(publicRooms) ? publicRooms : []).forEach((r) => {
    if (!r?.id) return;
    const key = String(r.id);
    if (!byId.has(key)) {
      byId.set(key, { ...r, alreadyMember: Boolean(r.alreadyMember) });
    }
  });
  return [...byId.values()];
};

const UserSearchDialog = ({
  open,
  onClose,
  onSelectUser,
  onJoinedRoom,
  onOpenExistingRoom,
  currentUserId,
}) => {
  const [tab, setTab] = useState(TAB_USERS);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [banDialog, setBanDialog] = useState(null);

  const canSearchUsers = useMemo(() => query.trim().length >= 2, [query]);
  const canSearchRooms = useMemo(() => query.trim().length >= 1, [query]);

  useEffect(() => {
    if (!open) return undefined;
    if (tab !== TAB_USERS) return undefined;

    const nextQuery = query.trim();
    if (nextQuery.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await userService.searchUsers(nextQuery, 0, 20, currentUserId);
        if (!cancelled) {
          setResults(users);
          setError(null);
        }
      } catch (loadError) {
        console.error("Failed to search users:", loadError);
        if (!cancelled) {
          setResults([]);
          setError(loadError?.error || loadError?.message || "Failed to search users");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [open, tab, query, currentUserId]);

  useEffect(() => {
    if (!open) return undefined;
    if (tab !== TAB_ROOMS) return undefined;

    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setError(null);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const [mineRes, pubRes] = await Promise.all([
          chatService.searchMyGroupChannels(q, 0, 20),
          chatService.discoverRooms(q, 0, 20),
        ]);
        if (cancelled) return;
        const merged = mergeRoomResults(mineRes.rooms, pubRes.rooms);
        setResults(merged);
        setError(null);
      } catch (loadError) {
        console.error("Failed to search rooms:", loadError);
        if (!cancelled) {
          setResults([]);
          setError(
            loadError?.message ||
              loadError?.error ||
              "Failed to search groups and channels",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [open, tab, query]);

  const handleSelectUser = (user) => {
    onSelectUser?.(user);
    onClose?.();
    resetLocalState();
  };

  const resetLocalState = () => {
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
    setSelectedRoom(null);
    setJoinError(null);
    setJoinLoading(false);
    setTab(TAB_USERS);
  };

  const handleClose = () => {
    onClose?.();
    resetLocalState();
  };

  const handleTabChange = (_, next) => {
    setTab(next);
    setQuery("");
    setResults([]);
    setError(null);
    setSelectedRoom(null);
    setJoinError(null);
  };

  const handleJoinPublicRoom = async () => {
    if (!selectedRoom?.id || selectedRoom.alreadyMember) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const dto = await chatService.joinPublicRoom(selectedRoom.id);
      onJoinedRoom?.(dto);
      handleClose();
    } catch (e) {
      const ban = parseRoomBanError(e);
      if (ban) {
        setBanDialog(ban);
        return;
      }
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        (typeof e === "string" ? e : "Could not join this room");
      setJoinError(msg);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleOpenExistingRoom = async () => {
    if (!selectedRoom?.id || !selectedRoom.alreadyMember) return;
    setJoinLoading(true);
    setJoinError(null);
    try {
      const dto = await chatService.getRoom(selectedRoom.id);
      onOpenExistingRoom?.(dto);
      handleClose();
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        (typeof e === "string" ? e : "Could not open this room");
      setJoinError(msg);
    } finally {
      setJoinLoading(false);
    }
  };

  const isPublicJoinable =
    selectedRoom &&
    !selectedRoom.alreadyMember &&
    String(selectedRoom.visibility || "").toUpperCase() === "PUBLIC";

  return (
    <>
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
        Find users & rooms
        <IconButton onClick={handleClose} sx={{ ml: "auto" }} aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }} aria-label="Search category">
          <Tab label="Users" id="search-tab-users" />
          <Tab label="Groups & channels" id="search-tab-rooms" />
        </Tabs>

        <TextField
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === TAB_USERS ? "Search by username" : "Search by group or channel name"
          }
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!loading && error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}

        {!loading && tab === TAB_USERS && !error && canSearchUsers && results.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No users found.
          </Typography>
        )}

        {!loading && tab === TAB_USERS && !canSearchUsers && (
          <Typography variant="body2" color="text.secondary">
            Type at least 2 characters.
          </Typography>
        )}

        {!loading && tab === TAB_ROOMS && !error && !canSearchRooms && (
          <Typography variant="body2" color="text.secondary">
            Enter at least one character to search your groups and channels and discover public rooms
            you can join.
          </Typography>
        )}

        {!loading && tab === TAB_ROOMS && canSearchRooms && !error && results.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No groups or channels match that name.
          </Typography>
        )}

        {!loading && results.length > 0 && tab === TAB_USERS && (
          <List>
            {results.map((user) => (
              <ListItemButton key={user.id} onClick={() => handleSelectUser(user)}>
                <Avatar sx={{ mr: 1.5 }} src={user.avatar || undefined}>
                  {(user.username?.[0] || "U").toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={user.displayName || user.username}
                  secondary={`@${user.username}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {!loading && results.length > 0 && tab === TAB_ROOMS && (
          <List>
            {results.map((room) => (
              <ListItemButton
                key={room.id}
                selected={selectedRoom?.id === room.id}
                onClick={() => {
                  setSelectedRoom(room);
                  setJoinError(null);
                }}
              >
                <Avatar sx={{ mr: 1.5 }} src={room.groupPhoto || undefined}>
                  {(room.groupName?.[0] || "?").toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                      <Typography component="span" variant="body2" fontWeight={600}>
                        {room.groupName || "Unnamed"}
                      </Typography>
                      {room.type ? (
                        <Chip size="small" label={String(room.type).toLowerCase()} />
                      ) : null}
                      {room.alreadyMember ? (
                        <Chip size="small" label="Yours" color="success" variant="outlined" />
                      ) : (
                        <Chip size="small" label="Public" variant="outlined" />
                      )}
                    </Box>
                  }
                  secondary={
                    typeof room.memberCount === "number"
                      ? `${room.memberCount} members`
                      : null
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {tab === TAB_ROOMS && selectedRoom && (
          <Box
            sx={{
              borderTop: 1,
              borderColor: "divider",
              pt: 2,
              pb: 1,
              mt: 1,
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {selectedRoom.groupName || "Room"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {selectedRoom.type ? `${String(selectedRoom.type)} · ` : ""}
              {typeof selectedRoom.memberCount === "number"
                ? `${selectedRoom.memberCount} members`
                : null}
              {selectedRoom.visibility
                ? ` · ${String(selectedRoom.visibility).toLowerCase()}`
                : ""}
            </Typography>
            {joinError ? (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {joinError}
              </Typography>
            ) : null}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mt: 2,
              }}
            >
              {selectedRoom.alreadyMember ? (
                <Button
                  variant="contained"
                  disabled={joinLoading}
                  onClick={handleOpenExistingRoom}
                  sx={{ alignSelf: "center" }}
                >
                  {joinLoading ? "Opening…" : "Open"}
                </Button>
              ) : isPublicJoinable ? (
                <Button
                  variant="contained"
                  disabled={joinLoading}
                  onClick={handleJoinPublicRoom}
                  sx={{ alignSelf: "center" }}
                >
                  {joinLoading ? "Joining…" : "Join"}
                </Button>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                  This room is private. Ask an admin for an invite link.
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
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

export default UserSearchDialog;
