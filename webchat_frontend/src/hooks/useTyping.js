import { useMemo } from 'react';
import useChatStore from '../store/useChatStore';

const useTyping = (currentChat, otherUser) => {
  const typingUsers = useChatStore((state) => state.typingUsers);

  // Determine if the other user is typing based on the store's typingUsers state 
  // (which is updated by WebSocket events)
  const isOtherUserTyping = useMemo(() => {
    if (!currentChat || !otherUser) return false;
    return Boolean(typingUsers?.[otherUser.id]);
  }, [currentChat, otherUser, typingUsers]);

  return {
    isOtherUserTyping,
  };
};

export default useTyping;

