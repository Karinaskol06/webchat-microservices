package com.project.webchat.notification.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class VapidPublicKeyResponse {
    String publicKey;
}
