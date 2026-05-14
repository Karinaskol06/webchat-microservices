package com.project.webchat.auth.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestControllerAdvice
@Slf4j
public class AuthApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException e) {
        log.warn("Bad request: {}", e.getMessage());
        String msg = e.getMessage() != null ? e.getMessage() : "Invalid request";
        return ResponseEntity.badRequest()
                .body(Map.of("message", msg, "error", msg));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException e) {
        HttpStatusCode status = e.getStatusCode();
        String msg = e.getReason() != null ? e.getReason() : "Request failed";
        log.warn("HTTP {} : {}", status.value(), msg);
        return ResponseEntity.status(status)
                .body(Map.of("message", msg, "error", msg));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> handleBadCredentials(BadCredentialsException e) {
        log.warn("Unauthorized login: {}", e.getMessage());
        String msg = e.getMessage() != null ? e.getMessage() : "Incorrect password";
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("message", msg, "error", msg));
    }
}
