import { describe, expect, it, beforeEach } from "vitest";
import useChatStore, { reorderChatsByRecent } from "./useChatStore";

describe("useChatStore", () => {
  beforeEach(() => {
    useChatStore.getState().clearStore();
  });

  it("upsertChat adds then updates chat by id", () => {
    const chat = { id: "chat-1", lastMessage: "hello" };
    useChatStore.getState().upsertChat(chat);
    expect(useChatStore.getState().chats).toHaveLength(1);

    useChatStore.getState().upsertChat({ id: "chat-1", lastMessage: "updated" });
    expect(useChatStore.getState().chats).toHaveLength(1);
    expect(useChatStore.getState().chats[0].lastMessage).toBe("updated");
  });

  it("reorderChatsByRecent puts more recent activity first", () => {
    const older = { id: "a", lastActivity: "2020-01-01T00:00:00" };
    const newer = { id: "b", lastMessageTime: "2025-06-01T12:00:00" };
    const sorted = reorderChatsByRecent([older, newer]);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("upsertChat moves updated chat toward top when lastMessageTime is newer", () => {
    useChatStore.getState().setChats([
      { id: "1", lastMessageTime: "2025-01-01T10:00:00" },
      { id: "2", lastMessageTime: "2025-01-02T10:00:00" },
    ]);
    useChatStore.getState().upsertChat({
      id: "1",
      lastMessageTime: "2025-01-03T10:00:00",
      lastMessage: "ping",
    });
    const ids = useChatStore.getState().chats.map((c) => c.id);
    expect(ids[0]).toBe("1");
    expect(ids[1]).toBe("2");
  });

  it("updateChatLastMessage reorders chats by preview timestamp", () => {
    useChatStore.getState().setChats([
      { id: "1", lastMessageTime: "2025-01-03T10:00:00" },
      { id: "2", lastMessageTime: "2025-01-04T10:00:00" },
    ]);
    useChatStore.getState().updateChatLastMessage("1", {
      content: "new",
      timestamp: "2025-01-05T10:00:00",
      senderId: 99,
    });
    const ids = useChatStore.getState().chats.map((c) => c.id);
    expect(ids[0]).toBe("1");
    expect(ids[1]).toBe("2");
  });

  it("removeMessage updates chat list preview when deleting the latest message", () => {
    useChatStore.getState().setCurrentChat({
      id: "chat-1",
      lastMessage: "bye",
      lastMessageTime: "2025-06-02T12:00:00",
    });
    useChatStore.getState().setChats([
      {
        id: "chat-1",
        lastMessage: "bye",
        lastMessageTime: "2025-06-02T12:00:00",
      },
      {
        id: "chat-2",
        lastMessage: "older",
        lastMessageTime: "2025-06-01T12:00:00",
      },
    ]);
    useChatStore.getState().setMessages([
      {
        id: "m1",
        content: "hello",
        timestamp: "2025-06-01T12:00:00",
        senderId: 1,
      },
      {
        id: "m2",
        content: "bye",
        timestamp: "2025-06-02T12:00:00",
        senderId: 1,
      },
    ]);

    useChatStore.getState().removeMessage("m2");

    const chat = useChatStore.getState().chats.find((c) => c.id === "chat-1");
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(chat.lastMessage).toBe("hello");
    expect(chat.lastMessageTime).toBe("2025-06-01T12:00:00");
    expect(useChatStore.getState().chats[0].id).toBe("chat-1");
  });

  it("removeMessage leaves chat preview unchanged when deleting an older message", () => {
    useChatStore.getState().setCurrentChat({
      id: "chat-1",
      lastMessage: "bye",
      lastMessageTime: "2025-06-02T12:00:00",
    });
    useChatStore.getState().setChats([
      {
        id: "chat-1",
        lastMessage: "bye",
        lastMessageTime: "2025-06-02T12:00:00",
      },
    ]);
    useChatStore.getState().setMessages([
      {
        id: "m1",
        content: "hello",
        timestamp: "2025-06-01T12:00:00",
        senderId: 1,
      },
      {
        id: "m2",
        content: "bye",
        timestamp: "2025-06-02T12:00:00",
        senderId: 1,
      },
    ]);

    useChatStore.getState().removeMessage("m1");

    const chat = useChatStore.getState().chats.find((c) => c.id === "chat-1");
    expect(chat.lastMessage).toBe("bye");
    expect(chat.lastMessageTime).toBe("2025-06-02T12:00:00");
  });

  it("setCurrentChat clears messages when switching to a different chat", () => {
    useChatStore.getState().setMessages([{ id: "m1", content: "text" }]);
    useChatStore.getState().setCurrentChat({ id: "chat-1" });
    expect(useChatStore.getState().messages).toEqual([]);

    useChatStore.getState().setMessages([{ id: "m2", content: "text2" }]);
    useChatStore.getState().setCurrentChat({ id: "chat-1" });
    expect(useChatStore.getState().messages).toHaveLength(1);
  });
});
