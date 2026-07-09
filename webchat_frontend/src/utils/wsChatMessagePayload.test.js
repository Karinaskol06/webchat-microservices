import { describe, expect, it } from 'vitest';
import { extractWsChatMessagePayload } from './wsChatMessagePayload';

describe('extractWsChatMessagePayload', () => {
  it('unwraps MESSAGE_SENT envelopes', () => {
    const message = { id: 'm1', chatId: 'c1', content: 'hi' };
    expect(extractWsChatMessagePayload({ type: 'MESSAGE_SENT', message })).toEqual(message);
  });

  it('unwraps INCOMING_CHAT_MESSAGE envelopes', () => {
    const message = { id: 'm2', chatId: 'c2', content: 'hey' };
    expect(
      extractWsChatMessagePayload({ type: 'INCOMING_CHAT_MESSAGE', chat: { id: 'c2' }, message }),
    ).toEqual(message);
  });

  it('accepts raw message DTOs', () => {
    const message = { id: 'm3', chatId: 'c3', content: 'yo' };
    expect(extractWsChatMessagePayload(message)).toEqual(message);
  });
});
