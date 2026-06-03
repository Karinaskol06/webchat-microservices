package com.project.webchat.chat.service.message;

import com.project.webchat.chat.dto.MessageReactionDTO;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.MessageReaction;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.ChatNotificationEventPublisher;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatMessageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MessageReactionService {

    static final int MAX_REACTIONS_PER_USER_PER_MESSAGE = 5;

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final WebSocketService webSocketService;
    private final ChatMessageMapper chatMessageMapper;
    private final ChatNotificationEventPublisher chatNotificationEventPublisher;

    @Transactional
    public List<MessageReactionDTO> toggleMessageReaction(String chatId, String messageId, Long userId, String emojiRaw) {
        String emoji = normalizeReactionEmoji(emojiRaw);
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        String messageChatId = message.getChatId();
        if (messageChatId == null || messageChatId.isBlank() || !messageChatId.equals(chatId)) {
            throw new IllegalArgumentException("Message does not belong to this chat");
        }

        if (!chatRoomRepository.existsByIdAndMemberIdsContains(chatId, userId)) {
            throw new ForbiddenChatOperationException("You cannot react to messages in this chat");
        }

        List<MessageReaction> reactions = message.getReactions() != null
                ? new ArrayList<>(message.getReactions())
                : new ArrayList<>();

        MessageReaction existing = reactions.stream()
                .filter(r -> emoji.equals(r.getEmoji()))
                .findFirst()
                .orElse(null);

        boolean reactionAdded = false;
        if (existing != null) {
            List<Long> userIds = existing.getUserIds() != null
                    ? new ArrayList<>(existing.getUserIds())
                    : new ArrayList<>();
            if (reactionUserIdsContain(userIds, userId)) {
                userIds.removeIf(id -> id != null && id.longValue() == userId.longValue());
                if (userIds.isEmpty()) {
                    reactions.remove(existing);
                } else {
                    existing.setUserIds(userIds);
                }
            } else {
                assertUserReactionLimit(reactions, userId);
                userIds.add(userId);
                existing.setUserIds(userIds);
                reactionAdded = true;
            }
        } else {
            assertUserReactionLimit(reactions, userId);
            reactions.add(MessageReaction.builder()
                    .emoji(emoji)
                    .userIds(new ArrayList<>(List.of(userId)))
                    .build());
            reactionAdded = true;
        }

        message.setReactions(reactions);
        ChatMessage saved = chatMessageRepository.save(message);
        List<MessageReactionDTO> reactionDtos = chatMessageMapper.toReactionDtos(saved.getReactions(), userId);
        webSocketService.notifyMessageReactionUpdated(saved.getId(), saved.getChatId(), reactionDtos);
        if (reactionAdded) {
            chatNotificationEventPublisher.publishMessageReactionAdded(saved, userId, emoji);
        }
        return reactionDtos;
    }

    static boolean reactionUserIdsContain(List<Long> userIds, Long userId) {
        if (userIds == null || userId == null) {
            return false;
        }
        return userIds.stream()
                .filter(Objects::nonNull)
                .anyMatch(id -> id.longValue() == userId.longValue());
    }

    static void assertUserReactionLimit(List<MessageReaction> reactions, Long userId) {
        long userReactionCount = reactions.stream()
                .filter(r -> reactionUserIdsContain(r.getUserIds(), userId))
                .count();
        if (userReactionCount >= MAX_REACTIONS_PER_USER_PER_MESSAGE) {
            throw new IllegalArgumentException(
                    "You can add at most " + MAX_REACTIONS_PER_USER_PER_MESSAGE + " reactions to one message");
        }
    }

    static String normalizeReactionEmoji(String emojiRaw) {
        if (emojiRaw == null) {
            throw new IllegalArgumentException("Emoji is required");
        }
        String emoji = emojiRaw.trim();
        if (emoji.isEmpty()) {
            throw new IllegalArgumentException("Emoji is required");
        }
        if (emoji.length() > 32) {
            throw new IllegalArgumentException("Emoji is too long");
        }
        return emoji;
    }
}
