package com.project.webchat.shared.security;

/**
 * Headers set by the API gateway after JWT validation and trusted by internal services.
 */
public final class GatewayAuthHeaders {

    public static final String USER_ID = "X-User-Id";
    public static final String USERNAME = "X-Username";
    public static final String GATEWAY_AUTH = "X-Gateway-Auth";

    private GatewayAuthHeaders() {
    }
}
