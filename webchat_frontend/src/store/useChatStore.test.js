import { describe, expect, it, beforeEach } from "vitest";
import useChatStore from "./useChatStore";

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

  it("setCurrentChat clears messages only for a different chat", () => {
    useChatStore.getState().setMessages([{ id: "m1", content: "text" }]);
    useChatStore.getState().setCurrentChat({ id: "chat-1" });
    expect(useChatStore.getState().messages).toEqual([]);

    useChatStore.getState().setMessages([{ id: "m2", content: "text2" }]);
    useChatStore.getState().setCurrentChat({ id: "chat-1" });
    expect(useChatStore.getState().messages).toHaveLength(1);
  });
});
