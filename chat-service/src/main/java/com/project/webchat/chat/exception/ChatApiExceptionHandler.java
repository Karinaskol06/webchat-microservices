package com.project.webchat.chat.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class ChatApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .filter(m -> m != null && !m.isBlank())
                .collect(Collectors.joining("; "));
        if (msg.isBlank()) {
            msg = "Invalid request";
        }
        log.warn("Validation failed: {}", msg);
        return ResponseEntity.badRequest().body(Map.of("message", msg, "error", msg));
    }

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
        if (e.getCause() instanceof MaxUploadSizeExceededException) {
            return handleMaxUploadSize((MaxUploadSizeExceededException) e.getCause());
        }
        String msg = resolveMultipartMessage(e);
        HttpStatus status = msg.toLowerCase().contains("too large")
                ? HttpStatus.PAYLOAD_TOO_LARGE
                : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of("message", msg, "error", msg));
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    public ResponseEntity<Map<String, String>> handleMissingPart(MissingServletRequestPartException e) {
        log.warn("Missing multipart part: {}", e.getRequestPartName());
        String msg = "No files were provided";
        return ResponseEntity.badRequest().body(Map.of("message", msg, "error", msg));
    }

    private static String resolveMultipartMessage(MultipartException e) {
        String detail = e.getMostSpecificCause() != null
                ? e.getMostSpecificCause().getMessage()
                : e.getMessage();
        if (detail != null) {
            String lower = detail.toLowerCase();
            if (lower.contains("size") && (lower.contains("exceed") || lower.contains("larger") || lower.contains("limit"))) {
                if (lower.contains("request") || lower.contains("total")) {
                    return "The upload request is too large. Stay under 10 MB per file and upload files one at a time if needed.";
                }
                return "This file is too large for the server. Maximum size is 10 MB per file.";
            }
        }
        return "Could not read the uploaded file. Try a smaller file or a supported format.";
    }
}
