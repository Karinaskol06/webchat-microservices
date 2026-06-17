import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import userService from "../../services/userService";
import userBanService from "../../services/userBanService";
import { getApiErrorMessage } from "../../services/api";
import useAuthStore from "../../store/useAuthStore";
import PhoneCountryField from "../common/PhoneCountryField";
import BirthdayField from "../common/BirthdayField";
import { isValidInternationalPhone } from "../../utils/internationalPhone";
import { toIsoDate, toLocalDate } from "../../utils/localDate";
import UserAvatar from "./UserAvatar";
import useChatStore from "../../store/useChatStore";
import { appendCacheBust } from "../../utils/userAvatar";
import {
  PROFILE_IMAGE_ACCEPT,
  validateProfileImageFile,
} from "../../utils/profileImageConstraints";
import { getProfileImageUploadErrorMessage } from "../../utils/profileUploadErrors";
import { chatHideScrollbarSx, chatColors } from "../../theme/chatDesignTokens";

const detailDialogPaperSx = {
  bgcolor: chatColors.detailPageBg,
  background: chatColors.detailPageBg,
  backgroundImage: 'none',
  border: `1px solid ${chatColors.borderSubtle}`,
};


const normalizeCountryCode = (u) => {
  const c = u?.countryCode;
  if (c == null || String(c).trim() === "") return "UA";
  return String(c).trim().toUpperCase();
};

const userToProfileShape = (u) => ({
  firstName: u?.firstName || "",
  lastName: u?.lastName || "",
  description: u?.description || "",
  birthday: toLocalDate(u?.birthday),
  phoneNumber: u?.phoneNumber || "",
  countryCode: normalizeCountryCode(u),
  username: u?.username || "",
  email: u?.email || "",
  profilePicture: u?.profilePicture || null,
  backgroundPicture: u?.backgroundPicture || null,
});

const UserProfileDialog = ({
  open,
  onClose,
  user,
  editable = false,
  currentUserId,
  onBanStateChange,
  /** Ban/unban controls are only for private-chat partner profiles (Settings has its own list). */
  allowBanActions = false,
}) => {
  const setUser = useAuthStore((state) => state.setUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [profile, setProfile] = useState(null);
  const [initialProfile, setInitialProfile] = useState(null);
  const [isBanned, setIsBanned] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [banConfirmOpen, setBanConfirmOpen] = useState(false);
  const avatarInputRef = useRef(null);
  const backgroundInputRef = useRef(null);

  const canModerateBan =
    allowBanActions &&
    !editable &&
    currentUserId != null &&
    user?.id != null &&
    Number(currentUserId) !== Number(user.id);

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
      countryCode: (seedShape.countryCode || "").toUpperCase(),
    });

    setFetchLoading(true);
    setIsBanned(false);
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
          countryCode: (shape.countryCode || "").toUpperCase(),
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

    if (canModerateBan) {
      userBanService
        .getBanStatus(user.id, currentUserId)
        .then((banned) => {
          if (!cancelled) setIsBanned(banned);
        })
        .catch(() => {
          if (!cancelled) setIsBanned(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [open, user?.id, currentUserId, editable, allowBanActions]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.username;
  }, [profile]);

  const handleFieldChange = (name, value) => {
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const applyUpdatedProfile = (updated, showMessage, changedImageKind = null) => {
    if (!updated) return;
    const versionedProfilePicture =
      changedImageKind === "avatar" && updated.profilePicture
        ? appendCacheBust(updated.profilePicture)
        : updated.profilePicture || null;
    const versionedBackgroundPicture =
      changedImageKind === "background"
        ? appendCacheBust(updated.backgroundPicture || `/api/users/${updated.id}/background`)
        : updated.backgroundPicture || null;
    const avatarRevision = changedImageKind === "avatar" ? Date.now() : undefined;
    const decorated = {
      ...updated,
      profilePicture: versionedProfilePicture,
      backgroundPicture: versionedBackgroundPicture,
      ...(avatarRevision != null ? { avatarRevision } : {}),
    };
    setUser(decorated);
    if (changedImageKind === "avatar" && updated.id != null) {
      useChatStore.getState().patchUserProfileInChats(updated.id, {
        profilePicture: versionedProfilePicture,
      });
    }
    setProfile((prev) => ({
      ...(prev || {}),
      ...decorated,
      birthday: toLocalDate(decorated.birthday),
    }));
    setInitialProfile({
      firstName: decorated.firstName || "",
      lastName: decorated.lastName || "",
      description: decorated.description || "",
      birthday: toIsoDate(toLocalDate(decorated.birthday)),
      phoneNumber: decorated.phoneNumber || "",
      countryCode: (decorated.countryCode || "").toUpperCase(),
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
      const phone = (profile.phoneNumber || "").trim();
      if (phone && !isValidInternationalPhone(phone)) {
        setError("Wrong phone number format");
        return;
      }
      const payload = {
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        description: profile.description || "",
        birthday: toIsoDate(profile.birthday),
        phoneNumber: phone,
        countryCode: (profile.countryCode || "").toUpperCase(),
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
        birthday: toLocalDate(updated.birthday),
      }));
      setInitialProfile({
        firstName: updated.firstName || "",
        lastName: updated.lastName || "",
        description: updated.description || "",
        birthday: toIsoDate(toLocalDate(updated.birthday)),
        phoneNumber: updated.phoneNumber || "",
        countryCode: (updated.countryCode || "").toUpperCase(),
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
    const validation = validateProfileImageFile(file);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError("");
    setIsSaving(true);
    try {
      let updated = null;
      if (kind === "avatar") {
        updated = await userService.uploadAvatar(file);
      } else {
        updated = await userService.uploadBackground(file);
      }
      applyUpdatedProfile(updated, "Image updated", kind);
      if (kind === "avatar" && avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
      if (kind === "background" && backgroundInputRef.current) {
        backgroundInputRef.current.value = "";
      }
    } catch (uploadError) {
      setError(
        getProfileImageUploadErrorMessage(
          uploadError,
          kind === "background" ? "Failed to upload cover photo." : "Failed to upload avatar.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveImage = async (kind) => {
    setError("");
    setIsSaving(true);
    try {
      let updated = null;
      if (kind === "avatar") {
        updated = await userService.removeAvatar();
      } else {
        updated = await userService.removeBackground();
      }
      applyUpdatedProfile(updated, "Image removed");
    } catch (removeError) {
      setError(getApiErrorMessage(removeError, "Failed to remove image"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBanUser = async () => {
    if (!canModerateBan || !user?.id) return;
    setBanLoading(true);
    setError("");
    try {
      await userBanService.banUser(user.id, currentUserId);
      setIsBanned(true);
      setBanConfirmOpen(false);
      setSnackbar("User banned. Your private chat is hidden until you unban them.");
      onBanStateChange?.({ userId: user.id, banned: true });
    } catch (banError) {
      setError(getApiErrorMessage(banError, "Could not ban this user."));
    } finally {
      setBanLoading(false);
    }
  };

  const handleUnbanUser = async () => {
    if (!canModerateBan || !user?.id) return;
    setBanLoading(true);
    setError("");
    try {
      await userBanService.unbanUser(user.id, currentUserId);
      setIsBanned(false);
      setSnackbar("User unbanned. Your private chat is available again.");
      onBanStateChange?.({ userId: user.id, banned: false });
    } catch (unbanError) {
      setError(getApiErrorMessage(unbanError, "Could not unban this user."));
    } finally {
      setBanLoading(false);
    }
  };

  if (!user || !profile) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: detailDialogPaperSx } }}
    >
      <DialogTitle>{editable ? "My profile" : "User profile"}</DialogTitle>
      <DialogContent
        sx={{
          overflowY: "auto",
          ...chatHideScrollbarSx,
        }}
      >
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
                  borderRadius: 0.5,
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
              <UserAvatar
                user={profile}
                sx={{
                  position: "absolute",
                  left: 24,
                  bottom: 0,
                  transform: "translateY(50%)",
                  width: 96,
                  height: 96,
                  fontSize: "2rem",
                  border: "4px solid",
                  borderColor: "background.paper",
                  boxShadow: 2,
                }}
              />
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
            <BirthdayField
              label="Birthday"
              value={profile.birthday}
              onChange={(value) => handleFieldChange("birthday", value)}
              disabled={!editable || !isEditing}
            />
            {editable && isEditing ? (
              <PhoneCountryField
                variant="detail"
                phoneNumber={profile.phoneNumber}
                countryCode={profile.countryCode}
                onChange={({ phoneNumber, countryCode }) =>
                  setProfile((prev) => ({ ...prev, phoneNumber, countryCode }))
                }
                disabled={isSaving}
              />
            ) : (
              <TextField label="Phone number" value={profile.phoneNumber || ""} InputProps={{ readOnly: true }} />
            )}
            {error ? <Alert severity="error">{error}</Alert> : null}
          </Stack>
        </LocalizationProvider>
        <input
          ref={avatarInputRef}
          type="file"
          accept={PROFILE_IMAGE_ACCEPT}
          hidden
          onChange={(event) => handleUpload(event.target.files?.[0], "avatar")}
        />
        <input
          ref={backgroundInputRef}
          type="file"
          accept={PROFILE_IMAGE_ACCEPT}
          hidden
          onChange={(event) => handleUpload(event.target.files?.[0], "background")}
        />
      </DialogContent>
      <DialogActions>
        {canModerateBan ? (
          isBanned ? (
            <Button
              color="success"
              startIcon={<CheckCircleOutlineIcon />}
              onClick={handleUnbanUser}
              disabled={banLoading}
            >
              Unban user
            </Button>
          ) : (
            <Button
              color="error"
              startIcon={<BlockIcon />}
              onClick={() => setBanConfirmOpen(true)}
              disabled={banLoading}
            >
              Ban user
            </Button>
          )
        ) : null}
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
      <Dialog open={banConfirmOpen} onClose={() => !banLoading && setBanConfirmOpen(false)}>
        <DialogTitle>Ban this user?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Your private chat with {displayName} will be hidden and frozen until you unban them.
            You will still see their messages in groups and channels you share.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanConfirmOpen(false)} disabled={banLoading}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleBanUser} disabled={banLoading}>
            Ban user
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default UserProfileDialog;

