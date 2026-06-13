package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SharedPollService {

    private final ChatMessageRepository chatMessageRepository;
    private final PollPayloadHelper pollPayloadHelper;
    private final WebSocketService webSocketService;

    public String pollIdPattern(String pollId) {
        return "\"pollId\"\\s*:\\s*\"" + Pattern.quote(pollId) + "\"";
    }

    public List<ChatMessage> findLinkedPollMessages(String pollId) {
        if (pollId == null || pollId.isBlank()) {
            return List.of();
        }
        return chatMessageRepository.findPollMessagesByPollIdPattern(pollIdPattern(pollId));
    }

    /** Pick the linked copy with the richest vote data (for forward / hydration). */
    public String resolveCanonicalPollContent(String pollId) {
        List<ChatMessage> linked = findLinkedPollMessages(pollId);
        if (linked.isEmpty()) {
            throw new IllegalArgumentException("Poll not found.");
        }
        return linked.stream()
                .max(Comparator
                        .comparingInt((ChatMessage m) -> pollPayloadHelper.countVotes(m.getContent()))
                        .thenComparing(ChatMessage::getTimestamp, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(ChatMessage::getContent)
                .orElse(linked.getFirst().getContent());
    }

    /**
     * Ensures the source message has a poll id, then returns shared poll JSON (config + votes)
     * for a new forwarded copy.
     */
    @Transactional
    public String prepareForwardPollContent(ChatMessage source) {
        String ensured = pollPayloadHelper.ensurePollId(source.getContent(), source.getId());
        if (!ensured.equals(source.getContent())) {
            source.setContent(ensured);
            chatMessageRepository.save(source);
        }
        String pollId = pollPayloadHelper.extractPollId(ensured);
        if (pollId == null) {
            return ensured;
        }
        return resolveCanonicalPollContent(pollId);
    }

    /** Writes the same vote snapshot to every message linked by pollId and notifies each chat. */
    @Transactional
    public void propagatePollUpdate(String pollId, String updatedContent, Long actorUserId) {
        if (pollId == null || pollId.isBlank()) {
            return;
        }
        List<ChatMessage> linked = findLinkedPollMessages(pollId);
        for (ChatMessage linkedMessage : linked) {
            linkedMessage.setContent(updatedContent);
            ChatMessage saved = chatMessageRepository.save(linkedMessage);
            webSocketService.notifyMessageEdited(
                    saved.getId(),
                    saved.getChatId(),
                    saved.getContent(),
                    actorUserId,
                    null,
                    MessageType.POLL);
        }
    }
}
