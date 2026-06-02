package com.project.webchat.chat.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ChatApiExceptionHandlerTest {

    private final ChatApiExceptionHandler handler = new ChatApiExceptionHandler();

    @Test
    void handleForbiddenChat_returnsForbiddenWithMessage() {
        ResponseEntity<Map<String, String>> response =
                handler.handleForbiddenChat(new ForbiddenChatOperationException("Only admins can manage this room"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("message", "Only admins can manage this room");
        assertThat(response.getBody()).containsEntry("error", "Only admins can manage this room");
    }

    @Test
    void handleMultipart_whenCauseIsMaxUpload_returnsPayloadTooLarge() {
        MultipartException multipartException = new MultipartException(
                "upload failed",
                new MaxUploadSizeExceededException(10 * 1024 * 1024L)
        );

        ResponseEntity<Map<String, String>> response = handler.handleMultipart(multipartException);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.PAYLOAD_TOO_LARGE);
        assertThat(response.getBody()).containsEntry(
                "message",
                "This file is too large for the server. Maximum size is 10 MB per file."
        );
    }
}
