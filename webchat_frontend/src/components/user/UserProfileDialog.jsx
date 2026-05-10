import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import userService from "../../services/userService";
import { getApiErrorMessage } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";

const toInputDate = (value) => (value ? new Date(value) : null);
const toIsoDate = (value) => (value ? value.toISOString().slice(0, 10) : null);
const appendVersion = (url) => (url ? `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}` : null);

const userToProfileShape = (u) => ({
  firstName: u?.firstName || "",
  lastName: u?.lastName || "",
  description: u?.description || "",
  birthday: toInputDate(u?.birthday),
  phoneNumber: u?.phoneNumber || "",
  username: u?.username || "",
  email: u?.email || "",
  profilePicture: u?.profilePicture || null,
  backgroundPicture: u?.backgroundPicture || null,
});

const UserProfileDialog = ({ open, onClose, user, editable = false }) => {
  const setUser = useAuthStore((state) => state.setUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [profile, setProfile] = useState(null);
  const [initialProfile, setInitialProfile] = useState(null);
  const avatarInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  useEffect(() => {
    if (!open || !user?.id) {
      return;
    }
    let cancelled = false;
    setFetchError("");
    setError("");
    setIsEditing(false);

    const seedShape = userToProfileShape(user);
    setProfile(seedShape);
    setInitialProfile({
      firstName: seedShape.firstName || "",
      lastName: seedShape.lastName || "",
      description: seedShape.description || "",
      birthday: toIsoDate(seedShape.birthday),
      phoneNumber: seedShape.phoneNumber || "",
    });

    setFetchLoading(true);
    userService
      .getUserById(user.id)
      .then((full) => {
        if (cancelled) return;
        const merged = {
          ...(user || {}),
          ...(full || {}),
        };
        const shape = userToProfileShape(merged);
        setProfile(shape);
        setInitialProfile({
          firstName: shape.firstName || "",
          lastName: shape.lastName || "",
          description: shape.description || "",
          birthday: toIsoDate(shape.birthday),
          phoneNumber: shape.phoneNumber || "",
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(getApiErrorMessage(err, "Failed to load profile"));
      })
      .finally(() => {
        if (!cancelled) {
          setFetchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.username;
  }, [profile]);

  const handleFieldChange = (name, value) => {
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const refreshCurrentProfile = async (showMessage) => {
    const updated = await userService.getCurrentProfile();
    setUser(updated);
    setProfile((prev) => ({
      ...(prev || {}),
      ...updated,
      birthday: toInputDate(updated.birthday),
    }));
    setInitialProfile({
      firstName: updated.firstName || "",
      lastName: updated.lastName || "",
      description: updated.description || "",
      birthday: toIsoDate(toInputDate(updated.birthday)),
      phoneNumber: updated.phoneNumber || "",
    });
    if (showMessage) {
      setSnackbar(showMessage);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setError("");
    setIsSaving(true);
    try {
      const payload = {
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        description: profile.description || "",
        birthday: toIsoDate(profile.birthday),
        phoneNumber: profile.phoneNumber || "",
      };
      const dirtyPayload = Object.fromEntries(
        Object.entries(payload).filter(([key, value]) => value !== initialProfile?.[key]),
      );
      if (Object.keys(dirtyPayload).length === 0) {
        setIsEditing(false);
        setSnackbar("No changes to save");
        return;
      }
      const updated = await userService.updateProfile(dirtyPayload);
      setUser(updated);
      setProfile((prev) => ({
        ...(prev || {}),
        ...updated,
        birthday: toInputDate(updated.birthday),
      }));
      setInitialProfile({
        firstName: updated.firstName || "",
        lastName: updated.lastName || "",
        description: updated.description || "",
        birthday: toIsoDate(toInputDate(updated.birthday)),
        phoneNumber: updated.phoneNumber || "",
      });
      setIsEditing(false);
      setSnackbar("Profile updated");
    } catch (saveError) {
      setError(getApiErrorMessage(saveError, "Failed to update profile"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (file, kind) => {
    if (!file) return;
    setError("");
    setIsSaving(true);
    try {
      if (kind === "avatar") {
        await userService.uploadAvatar(file);
      } else {
        await userService.uploadBackground(file);
      }
      await refreshCurrentProfile("Image updated");
      setProfile((prev) => ({
        ...(prev || {}),
        profilePicture:
          kind === "avatar" ? appendVersion(prev?.profilePicture || `/api/users/${user?.id}/avatar`) : prev?.profilePicture,
        backgroundPicture:
          kind === "background"
            ? appendVersion(prev?.backgroundPicture || `/api/users/${user?.id}/background`)
            : prev?.backgroundPicture,
      }));
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError, "Failed to upload image"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = async (kind) => {
    setError("");
    setIsSaving(true);
    try {
      if (kind === "avatar") {
        await userService.removeAvatar();
      } else {
        await userService.removeBackground();
      }
      await refreshCurrentProfile("Image removed");
    } catch (removeError) {
      setError(getApiErrorMessage(removeError, "Failed to remove image"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!user || !profile) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editable ? "My profile" : "User profile"}</DialogTitle>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {fetchError ? (
              <Alert severity="warning" onClose={() => setFetchError("")}>
                {fetchError}
              </Alert>
            ) : null}

            {/* LinkedIn-style: avatar overlaps bottom of cover */}
            <Box sx={{ position: "relative", pt: 0 }}>
              <Box
                sx={{
                  height: 168,
                  borderRadius: 2,
                  overflow: "hidden",
                  position: "relative",
                  bgcolor: "grey.400",
                  backgroundImage: profile.backgroundPicture ? `url(${profile.backgroundPicture})` : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {editable && isEditing && (
                  <Stack direction="row" spacing={1} sx={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
                    <Button size="small" variant="contained" onClick={() => backgroundInputRef.current?.click()}>
                      Cover photo
                    </Button>
                    <Button size="small" variant="outlined" color="inherit" onClick={() => handleRemoveImage("background")}>
                      Remove
                    </Button>
                  </Stack>
                )}
              </Box>
              <Avatar
                src={profile.profilePicture || undefined}
                sx={{
                  position: "absolute",
                  left: 24,
                  bottom: 0,
                  transform: "translateY(50%)",
                  width: 96,
                  height: 96,
                  border: "4px solid",
                  borderColor: "background.paper",
                  boxShadow: 2,
                }}
              >
                {(profile.firstName?.[0] || profile.username?.[0] || "U").toUpperCase()}
              </Avatar>
            </Box>
            {/* Clear space under overlapping avatar */}
            <Box sx={{ height: 52 }} />

            {editable && isEditing ? (
              <Stack direction="row" spacing={1} sx={{ px: 0.5 }}>
                <Button size="small" variant="contained" onClick={() => avatarInputRef.current?.click()}>
                  Change avatar
                </Button>
                <Button size="small" variant="outlined" onClick={() => handleRemoveImage("avatar")}>
                  Remove avatar
                </Button>
              </Stack>
            ) : null}

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="h6">{displayName}</Typography>
              {fetchLoading ? <CircularProgress color="inherit" size={22} sx={{ ml: 0.5 }} /> : null}
            </Stack>
            <TextField label="Username" value={`@${profile.username || ""}`} InputProps={{ readOnly: true }} />
            {editable ? (
              <TextField label="Email" value={profile.email || ""} InputProps={{ readOnly: true }} />
            ) : null}
            <TextField
              label="First name"
              value={profile.firstName || ""}
              onChange={(event) => handleFieldChange("firstName", event.target.value)}
              InputProps={{ readOnly: !editable || !isEditing }}
            />
            <TextField
              label="Last name"
              value={profile.lastName || ""}
              onChange={(event) => handleFieldChange("lastName", event.target.value)}
              InputProps={{ readOnly: !editable || !isEditing }}
            />
            <TextField
              label="Description"
              multiline
              minRows={3}
              value={profile.description || ""}
              onChange={(event) => handleFieldChange("description", event.target.value)}
              InputProps={{ readOnly: !editable || !isEditing }}
            />
            <DatePicker
              label="Birthday"
              value={profile.birthday}
              onChange={(value) => handleFieldChange("birthday", value)}
              disabled={!editable || !isEditing}
              slotProps={{ textField: { fullWidth: true } }}
            />
            <TextField
              label="Phone number"
              value={profile.phoneNumber || ""}
              onChange={(event) => handleFieldChange("phoneNumber", event.target.value)}
              InputProps={{ readOnly: !editable || !isEditing }}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </LocalizationProvider>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => handleUpload(event.target.files?.[0], "avatar")}
        />
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => handleUpload(event.target.files?.[0], "background")}
        />
      </DialogContent>
      <DialogActions>
        {editable && !isEditing ? <Button onClick={() => setIsEditing(true)}>Edit</Button> : null}
        {editable && isEditing ? (
          <>
            <Button onClick={() => setIsEditing(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} variant="contained">
              Save changes
            </Button>
          </>
        ) : null}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={2500}
        onClose={() => setSnackbar("")}
        message={snackbar}
      />
    </Dialog>
  );
};

export default UserProfileDialog;

