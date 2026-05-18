package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.FileType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ChatMessagePreviewHelperTest {

    private final ChatMessagePreviewHelper helper = new ChatMessagePreviewHelper();

    @Test
    void getPreviewText_truncatesLongContent() {
        String longText = "a".repeat(60);
        assertThat(helper.getPreviewText(longText, List.of())).endsWith("...");
        assertThat(helper.getPreviewText(longText, List.of())).hasSize(50);
    }

    @Test
    void getPreviewText_describesSingleImageAttachment() {
        Attachment image = Attachment.builder()
                .filename("photo.png")
                .fileType(FileType.IMAGE)
                .build();
        assertThat(helper.getPreviewText(null, List.of(image))).isEqualTo("Image");
    }

    @Test
    void getPreviewText_countsMultipleAttachments() {
        assertThat(helper.getPreviewText(null, List.of(
                Attachment.builder().filename("a.txt").build(),
                Attachment.builder().filename("b.txt").build()
        ))).isEqualTo("2 files");
    }
}
