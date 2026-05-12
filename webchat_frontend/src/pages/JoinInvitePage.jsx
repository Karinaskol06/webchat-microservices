import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import chatService from "../services/chatService";
import useChatStore from "../store/useChatStore";

const JoinInvitePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const raw = token?.trim();

    if (!raw) {
      setStatus("error");
      setMessage("Invalid invite link.");
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
        setStatus("error");
        const body = typeof e === "object" && e !== null ? e : {};
        setMessage(
          body.message ||
            (typeof e === "string" ? e : null) ||
            "Could not join with this invite."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

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
          {message}
        </Typography>
        <Button variant="contained" onClick={() => navigate("/chat", { replace: true })}>
          Back to chats
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
      <Typography color="text.secondary">Joining room…</Typography>
    </Box>
  );
};

export default JoinInvitePage;
