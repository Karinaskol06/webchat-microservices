import { describe, expect, it } from 'vitest';
import useChatStore from '../store/useChatStore';

describe('group chat live delete (store)', () => {
  it('removeMessage drops the message when inbox event id matches', () => {
    const groupChatId = '6a3b03f5a7971b20e276e596';
    useChatStore.getState().clearStore();
    useChatStore.getState().setCurrentChat({ id: groupChatId, type: 'GROUP' });
    useChatStore.getState().setMessages([
      {
        id: 'msg-live-1',
        chatId: groupChatId,
        content: 'hello group',
        timestamp: '2026-06-24T10:00:00.000Z',
        senderId: 15,
      },
    ]);

    useChatStore.getState().removeMessage('msg-live-1');

    expect(useChatStore.getState().messages).toHaveLength(0);
  });
});
