package com.project.webchat.notification.controller;

import com.project.webchat.notification.config.VapidProperties;
import com.project.webchat.notification.dto.VapidPublicKeyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class VapidController {

    private final VapidProperties vapidProperties;

    @GetMapping("/vapid-public-key")
    public ResponseEntity<VapidPublicKeyResponse> getVapidPublicKey() {
        return ResponseEntity.ok(VapidPublicKeyResponse.builder()
                .publicKey(vapidProperties.getPublicKey())
                .build());
    }
}
