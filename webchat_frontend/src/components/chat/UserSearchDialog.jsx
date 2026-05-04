import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import userService from "../../services/userService";

const UserSearchDialog = ({ open, onClose, onSelectUser, currentUserId }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const canSearch = useMemo(() => query.trim().length >= 2, [query]);

  useEffect(() => {
    if (!open) return undefined;
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
  }, [open, query, currentUserId]);

  const handleSelect = (user) => {
    onSelectUser?.(user);
    onClose?.();
    setQuery("");
    setResults([]);
    setError(null);
  };

  const handleClose = () => {
    onClose?.();
    setQuery("");
    setResults([]);
    setError(null);
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
        Find users
        <IconButton onClick={handleClose} sx={{ ml: "auto" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username"
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

        {!loading && !error && canSearch && results.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No users found.
          </Typography>
        )}

        {!loading && !canSearch && (
          <Typography variant="body2" color="text.secondary">
            Type at least 2 characters.
          </Typography>
        )}

        {!loading && results.length > 0 && (
          <List>
            {results.map((user) => (
              <ListItemButton key={user.id} onClick={() => handleSelect(user)}>
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
      </DialogContent>
    </Dialog>
  );
};

export default UserSearchDialog;
