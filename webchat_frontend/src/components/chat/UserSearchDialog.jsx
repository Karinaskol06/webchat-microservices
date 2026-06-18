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
import useTranslation from "../../hooks/useTranslation";

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
  const { t } = useTranslation();
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
          setError(loadError?.error || loadError?.message || t("search.dialog.error.searchUsers"));
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
              t("search.dialog.error.searchRooms"),
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
        (typeof e === "string" ? e : t("search.dialog.error.join"));
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
        (typeof e === "string" ? e : t("search.dialog.error.open"));
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
        {t("search.dialog.title")}
        <IconButton onClick={handleClose} sx={{ ml: "auto" }} aria-label={t("search.dialog.aria.close")}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Tabs value={tab} onChange={handleTabChange} sx={{ mb: 2 }} aria-label={t("search.dialog.aria.category")}>
          <Tab label={t("search.dialog.tab.users")} id="search-tab-users" />
          <Tab label={t("search.dialog.tab.rooms")} id="search-tab-rooms" />
        </Tabs>

        <TextField
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            tab === TAB_USERS ? t("search.dialog.users.placeholder") : t("search.dialog.rooms.placeholder")
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
            {t("search.dialog.users.empty")}
          </Typography>
        )}

        {!loading && tab === TAB_USERS && !canSearchUsers && (
          <Typography variant="body2" color="text.secondary">
            {t("search.dialog.users.minChars")}
          </Typography>
        )}

        {!loading && tab === TAB_ROOMS && !error && !canSearchRooms && (
          <Typography variant="body2" color="text.secondary">
            {t("search.dialog.rooms.hint")}
          </Typography>
        )}

        {!loading && tab === TAB_ROOMS && canSearchRooms && !error && results.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("search.dialog.rooms.empty")}
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
            {results.map((room) => {
              const roomTypeLabel =
                String(room.type || "").toUpperCase() === "CHANNEL"
                  ? t("roomType.channel")
                  : t("roomType.groupShort");

              return (
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
                        {room.groupName || t("search.dialog.room.unnamed")}
                      </Typography>
                      {room.type ? (
                        <Chip size="small" label={roomTypeLabel} />
                      ) : null}
                      {room.alreadyMember ? (
                        <Chip size="small" label={t("search.dialog.room.yours")} color="success" variant="outlined" />
                      ) : (
                        <Chip size="small" label={t("common.public")} variant="outlined" />
                      )}
                    </Box>
                  }
                  secondary={
                    typeof room.memberCount === "number"
                      ? t("common.members", { count: room.memberCount })
                      : null
                  }
                />
              </ListItemButton>
            );
            })}
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
              {selectedRoom.groupName || t("search.dialog.room.fallback")}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {selectedRoom.type
                ? `${
                    String(selectedRoom.type).toUpperCase() === "CHANNEL"
                      ? t("roomType.channel")
                      : t("roomType.groupShort")
                  } · `
                : ""}
              {typeof selectedRoom.memberCount === "number"
                ? t("common.members", { count: selectedRoom.memberCount })
                : null}
              {selectedRoom.visibility
                ? ` · ${
                    String(selectedRoom.visibility).toUpperCase() === "PUBLIC"
                      ? t("common.public")
                      : t("common.private")
                  }`
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
                  {joinLoading ? t("search.dialog.opening") : t("search.dialog.open")}
                </Button>
              ) : isPublicJoinable ? (
                <Button
                  variant="contained"
                  disabled={joinLoading}
                  onClick={handleJoinPublicRoom}
                  sx={{ alignSelf: "center" }}
                >
                  {joinLoading ? t("common.joining") : t("common.join")}
                </Button>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                  {t("search.dialog.private.hint")}
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
