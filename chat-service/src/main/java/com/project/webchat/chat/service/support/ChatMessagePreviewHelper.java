package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.Attachment;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ChatMessagePreviewHelper {

    public String getPreviewText(String content, List<Attachment> attachments) {
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
}
