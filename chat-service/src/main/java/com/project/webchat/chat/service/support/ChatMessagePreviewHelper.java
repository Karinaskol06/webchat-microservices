package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.MessageType;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ChatMessagePreviewHelper {

    public String getPreviewText(String content, List<Attachment> attachments) {
        return getPreviewText(content, attachments, null);
    }

    public String getPreviewText(String content, List<Attachment> attachments, MessageType messageType) {
        if (messageType != null) {
            String rich = richPreview(messageType, content);
            if (rich != null) {
                return rich;
            }
        }
        if (content != null && !content.isBlank()) {
            return content.length() > 50 ? content.substring(0, 47) + "..." : content;
        }
        if (attachments != null && !attachments.isEmpty()) {
            if (attachments.size() == 1) {
                Attachment att = attachments.getFirst();
                if (att.isImage()) {
                    return "Image";
                }
                return att.getFilename();
            }
            return attachments.size() + " files";
        }
        return "New message";
    }

    private String richPreview(MessageType messageType, String content) {
        return switch (messageType) {
            case TODO -> "To-do list";
            case STICKY_NOTE -> "Sticky note";
            case CALLOUT -> "Callout";
            case POLL -> {
                String mode = extractPollMode(content);
                yield "test".equals(mode) ? "Test" : "Poll";
            }
            default -> null;
        };
    }

    private String extractPollMode(String content) {
        if (content == null || content.isBlank()) {
            return "poll";
        }
        try {
            int modeIdx = content.indexOf("\"mode\"");
            if (modeIdx < 0) {
                return "poll";
            }
            int colon = content.indexOf(':', modeIdx);
            if (colon < 0) {
                return "poll";
            }
            int startQuote = content.indexOf('"', colon + 1);
            int endQuote = content.indexOf('"', startQuote + 1);
            if (startQuote < 0 || endQuote < 0) {
                return "poll";
            }
            return content.substring(startQuote + 1, endQuote);
        } catch (Exception e) {
            return "poll";
        }
    }
}
