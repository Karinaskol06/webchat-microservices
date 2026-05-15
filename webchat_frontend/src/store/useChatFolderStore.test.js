import { describe, it, expect, beforeEach } from 'vitest';
import useChatFolderStore from './useChatFolderStore';

describe('useChatFolderStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatFolderStore.getState().clearForUser();
  });

  it('creates folders and assigns chats with persistence per user', () => {
    useChatFolderStore.getState().initForUser(42);
    const folder = useChatFolderStore.getState().createFolder('Work');
    expect(folder?.name).toBe('Work');

    useChatFolderStore.getState().assignChatToFolder('chat-1', folder.id);
    expect(useChatFolderStore.getState().getFolderIdForChat('chat-1')).toBe(folder.id);

    useChatFolderStore.getState().clearForUser();
    useChatFolderStore.getState().initForUser(42);

    expect(useChatFolderStore.getState().folders).toHaveLength(1);
    expect(useChatFolderStore.getState().getFolderIdForChat('chat-1')).toBe(folder.id);
  });

  it('unassigns chat when dropped on all chats', () => {
    useChatFolderStore.getState().initForUser(1);
    const folder = useChatFolderStore.getState().createFolder('Personal');
    useChatFolderStore.getState().assignChatToFolder(99, folder.id);
    useChatFolderStore.getState().assignChatToFolder(99, null);
    expect(useChatFolderStore.getState().getFolderIdForChat(99)).toBeNull();
  });

  it('deletes folder and clears assignments', () => {
    useChatFolderStore.getState().initForUser(7);
    const folder = useChatFolderStore.getState().createFolder('Temp');
    useChatFolderStore.getState().assignChatToFolder(5, folder.id);
    useChatFolderStore.getState().deleteFolder(folder.id);
    expect(useChatFolderStore.getState().folders).toHaveLength(0);
    expect(useChatFolderStore.getState().getFolderIdForChat(5)).toBeNull();
  });
});
