import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import chatService from "../services/chatService";
import useChatStore from "../store/useChatStore";
import RoomBanDialog from "../components/chat/RoomBanDialog";
import { parseRoomBanError } from "../utils/roomBanError";
import { joinInviteErrorMessage } from "../utils/inviteLink";
import useTranslation from "../hooks/useTranslation";

const JoinInvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [banDialog, setBanDialog] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const raw = token?.trim();

    if (!raw) {
      setStatus("error");
      setMessage("");
      return undefined;
    }

    (async () => {
      try {
        const dto = await chatService.joinByInvite(raw);
        if (cancelled) return;
        useChatStore.getState().upsertChat(dto);
        const id = dto?.id != null ? encodeURIComponent(String(dto.id)) : "";
        navigate(id ? `/chat?chatId=${id}` : "/chat", { replace: true });
      } catch (e) {
        if (cancelled) return;
        const ban = parseRoomBanError(e);
        if (ban) {
          setBanDialog(ban);
          setStatus("banned");
          return;
        }
        setStatus("error");
        setMessage(joinInviteErrorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  if (status === "banned") {
    return (
      <>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            p: 4,
            minHeight: 240,
          }}
        >
          <Typography color="text.secondary" textAlign="center">
            {t("invite.join.banned.message")}
          </Typography>
          <Button variant="contained" onClick={() => navigate("/chat", { replace: true })}>
            {t("nav.backToChats")}
          </Button>
        </Box>
        <RoomBanDialog
          open={Boolean(banDialog)}
          onClose={() => navigate("/chat", { replace: true })}
          message={banDialog?.message}
          roomName={banDialog?.roomName}
          roomType={banDialog?.roomType}
        />
      </>
    );
  }

  if (status === "error") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          p: 4,
          minHeight: 240,
        }}
      >
        <Typography color="error" textAlign="center">
          {message || t("invite.join.error.invalidLink")}
        </Typography>
        <Button variant="contained" onClick={() => navigate("/chat", { replace: true })}>
          {t("nav.backToChats")}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 4,
        minHeight: 240,
      }}
    >
      <CircularProgress />
      <Typography color="text.secondary">{t("invite.join.loading")}</Typography>
    </Box>
  );
};

export default JoinInvitePage;
