import { create } from 'zustand';

const STORAGE_PREFIX = 'webchat-chat-folders';

const loadPersisted = (userId) => {
  if (!userId) return { folders: [], chatAssignments: {} };
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}:${userId}`);
    if (!raw) return { folders: [], chatAssignments: {} };
    const parsed = JSON.parse(raw);
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      chatAssignments:
        parsed.chatAssignments && typeof parsed.chatAssignments === 'object'
          ? parsed.chatAssignments
          : {},
    };
  } catch {
    return { folders: [], chatAssignments: {} };
  }
};

const persist = (userId, folders, chatAssignments) => {
  if (!userId) return;
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}:${userId}`,
      JSON.stringify({ folders, chatAssignments }),
    );
  } catch {
    /* ignore quota errors */
  }
};

const createFolderId = () =>
  `folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const useChatFolderStore = create((set, get) => ({
  userId: null,
  folders: [],
  chatAssignments: {},
  activeFolderId: null,
  foldersSectionCollapsed: false,
  dragOverFolderId: null,

  initForUser: (userId) => {
    const id = userId != null ? String(userId) : null;
    const current = get().userId;
    if (current === id) return;
    const { folders, chatAssignments } = loadPersisted(id);
    set({
      userId: id,
      folders,
      chatAssignments,
      activeFolderId: null,
      foldersSectionCollapsed: false,
      dragOverFolderId: null,
    });
  },

  clearForUser: () => {
    set({
      userId: null,
      folders: [],
      chatAssignments: {},
      activeFolderId: null,
      foldersSectionCollapsed: false,
      dragOverFolderId: null,
    });
  },

  setActiveFolderId: (folderId) => {
    set({ activeFolderId: folderId });
  },

  setFoldersSectionCollapsed: (collapsed) => {
    set({ foldersSectionCollapsed: collapsed });
  },

  toggleFolderCollapsed: (folderId) => {
    set((state) => {
      const folders = state.folders.map((f) =>
        f.id === folderId ? { ...f, collapsed: !f.collapsed } : f,
      );
      persist(state.userId, folders, state.chatAssignments);
      return { folders };
    });
  },

  setDragOverFolderId: (folderId) => {
    set({ dragOverFolderId: folderId });
  },

  createFolder: (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return null;
    const folder = {
      id: createFolderId(),
      name: trimmed.slice(0, 48),
      collapsed: false,
      createdAt: Date.now(),
    };
    set((state) => {
      const folders = [...state.folders, folder];
      persist(state.userId, folders, state.chatAssignments);
      return { folders, activeFolderId: folder.id };
    });
    return folder;
  },

  renameFolder: (folderId, name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return;
    set((state) => {
      const folders = state.folders.map((f) =>
        f.id === folderId ? { ...f, name: trimmed.slice(0, 48) } : f,
      );
      persist(state.userId, folders, state.chatAssignments);
      return { folders };
    });
  },

  deleteFolder: (folderId) => {
    set((state) => {
      const folders = state.folders.filter((f) => f.id !== folderId);
      const chatAssignments = { ...state.chatAssignments };
      Object.keys(chatAssignments).forEach((chatId) => {
        if (chatAssignments[chatId] === folderId) delete chatAssignments[chatId];
      });
      persist(state.userId, folders, chatAssignments);
      return {
        folders,
        chatAssignments,
        activeFolderId: state.activeFolderId === folderId ? null : state.activeFolderId,
      };
    });
  },

  assignChatToFolder: (chatId, folderId) => {
    const key = chatId != null ? String(chatId) : '';
    if (!key) return;
    set((state) => {
      const chatAssignments = { ...state.chatAssignments };
      if (folderId) {
        chatAssignments[key] = folderId;
      } else {
        delete chatAssignments[key];
      }
      persist(state.userId, state.folders, chatAssignments);
      return { chatAssignments };
    });
  },

  getFolderIdForChat: (chatId) => {
    const key = chatId != null ? String(chatId) : '';
    return get().chatAssignments[key] || null;
  },

  getChatsInFolder: (folderId) => {
    const assignments = get().chatAssignments;
    return Object.entries(assignments)
      .filter(([, fid]) => fid === folderId)
      .map(([chatId]) => chatId);
  },
}));

export default useChatFolderStore;
