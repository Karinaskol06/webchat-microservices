import { describe, expect, it } from 'vitest';
import {
  createOptimisticMessageId,
  isOptimisticMessageId,
  removeOneMatchingOptimistic,
} from './messageOptimistic';

describe('messageOptimistic', () => {
  it('createOptimisticMessageId returns unique optimistic ids', () => {
    const a = createOptimisticMessageId();
    const b = createOptimisticMessageId();
    expect(isOptimisticMessageId(a)).toBe(true);
    expect(isOptimisticMessageId(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('removeOneMatchingOptimistic drops only the first fifo match', () => {
    const messages = [
      {
        id: 'optimistic-1',
        chatId: 'group-1',
        senderId: 1,
        content: 'first',
      },
      {
        id: 'optimistic-2',
        chatId: 'group-1',
        senderId: 1,
        content: 'second',
      },
    ];
    const afterFirst = removeOneMatchingOptimistic(messages, {
      id: 'server-1',
      chatId: 'group-1',
      senderId: 1,
      content: 'first',
    });
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].id).toBe('optimistic-2');

    const afterSecond = removeOneMatchingOptimistic(
      [...afterFirst, { id: 'server-1', chatId: 'group-1', senderId: 1, content: 'first' }],
      {
        id: 'server-2',
        chatId: 'group-1',
        senderId: 1,
        content: 'second',
      },
    );
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0].id).toBe('server-1');
  });
});

describe('group chat burst send (store)', () => {
  it('keeps multiple optimistic messages and confirms each server echo separately', async () => {
    const { default: useChatStore } = await import('../store/useChatStore');
    const { createOptimisticMessageId: createId } = await import('./messageOptimistic');

    useChatStore.getState().clearStore();
    const groupChatId = '6a208a62c8073e4f986ac988';
    useChatStore.getState().setCurrentChat({ id: groupChatId, type: 'GROUP' });

    const user = { id: 1, username: 'karinaskol' };
    const texts = ['hello team', 'second line', 'third'];

    for (const text of texts) {
      useChatStore.getState().addMessage({
        id: createId(),
        chatId: groupChatId,
        content: text,
        messageType: 'TEXT',
        timestamp: new Date().toISOString(),
        senderId: user.id,
        sender: user,
      });
    }

    expect(useChatStore.getState().messages).toHaveLength(3);
    expect(useChatStore.getState().messages.map((m) => m.content)).toEqual(texts);

    texts.forEach((text, index) => {
      useChatStore.getState().addMessage({
        id: `server-${index + 1}`,
        chatId: groupChatId,
        content: text,
        messageType: 'TEXT',
        timestamp: new Date(Date.now() + index).toISOString(),
        senderId: user.id,
        sender: user,
      });
    });

    const final = useChatStore.getState().messages;
    expect(final).toHaveLength(3);
    expect(final.every((m) => !isOptimisticMessageId(m.id))).toBe(true);
    expect(final.map((m) => m.content)).toEqual(texts);
    expect(final.map((m) => m.id)).toEqual(['server-1', 'server-2', 'server-3']);
  });
});
