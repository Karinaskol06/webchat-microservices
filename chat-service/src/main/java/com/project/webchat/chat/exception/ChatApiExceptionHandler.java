package com.project.webchat.chat.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import java.util.Map;

@RestControllerAdvice
@Slf4j
public class ChatApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("Bad request: {}", e.getMessage());
        String msg = e.getMessage() != null ? e.getMessage() : "Invalid request";
        return ResponseEntity.badRequest()
                .body(Map.of(
                        "message", msg,
                        "error", msg
                ));
    }

    @ExceptionHandler(ForbiddenChatOperationException.class)
    public ResponseEntity<Map<String, String>> handleForbiddenChat(ForbiddenChatOperationException e) {
        log.warn("Forbidden chat operation: {}", e.getMessage());
        String msg = e.getMessage() != null ? e.getMessage() : "Forbidden";
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", msg, "error", msg));
    }

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<Map<String, String>> handleSecurity(SecurityException e) {
        log.warn("Security exception: {}", e.getMessage());
        String msg = e.getMessage() != null ? e.getMessage() : "Access denied";
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", msg, "error", msg));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        log.warn("Upload exceeds configured limit: {}", e.getMessage());
        String msg = "This file is too large for the server. Maximum size is 10 MB per file.";
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(Map.of("message", msg, "error", msg));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<Map<String, String>> handleMultipart(MultipartException e) {
        log.warn("Multipart error: {}", e.getMessage());
        String msg = "Could not read the uploaded file. Try a smaller file or a supported format.";
        return ResponseEntity.badRequest()
                .body(Map.of("message", msg, "error", msg));
    }
}
