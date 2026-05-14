import { describe, expect, it, beforeEach, vi } from "vitest";
import useAuthStore from "./useAuthStore";
import useChatStore from "./useChatStore";

vi.mock("../utils/websocket.js", () => ({
  disconnectWebSocket: vi.fn(),
}));

import { disconnectWebSocket } from "../utils/websocket.js";

describe("useAuthStore session isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.getState().clearStore();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isInitialized: true,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  it("logout disconnects WebSocket and clears chat store", () => {
    useChatStore.setState({
      chats: [{ id: "c1", otherUser: { id: 9 } }],
      currentChat: { id: "c1", otherUser: { id: 9 } },
      messages: [{ id: "m1", content: "secret" }],
    });
    localStorage.setItem("token", "t1");

    useAuthStore.getState().logout();

    expect(disconnectWebSocket).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("token")).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useChatStore.getState().currentChat).toBeNull();
    expect(useChatStore.getState().chats).toEqual([]);
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it("login clears prior chat state and then stores new session", () => {
    useChatStore.setState({
      chats: [{ id: "old" }],
      currentChat: { id: "old" },
      messages: [{ id: "x" }],
    });

    useAuthStore.getState().login({ id: 2, username: "u2" }, "token-two");

    expect(disconnectWebSocket).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().currentChat).toBeNull();
    expect(useChatStore.getState().messages).toEqual([]);
    expect(localStorage.getItem("token")).toBe("token-two");
    expect(useAuthStore.getState().user?.id).toBe(2);
  });
});
