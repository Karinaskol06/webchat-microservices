package com.project.webchat.gateway.config;

import com.project.webchat.gateway.security.JwtService;
import com.project.webchat.shared.security.GatewayAuthHeaders;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the gateway trust boundary: public allowlist, Bearer contract,
 * claim propagation, and stripping of client-spoofed identity headers.
 */
class JwtValidationFilterTest {

    private static final String GATEWAY_TOKEN = "test-gateway-token";
    private static final String VALID_JWT = "valid.jwt.token";
    private static final String INVALID_JWT = "invalid.jwt.token";
    private static final String NO_USER_ID_JWT = "no.userid.token";
    private static final String THROWING_JWT = "throwing.jwt.token";
    private static final String BLANK_USERNAME_JWT = "blank.username.token";

    private StubJwtService jwtService;
    private RecordingFilterChain chain;
    private GatewayFilter filter;

    @BeforeEach
    void setUp() {
        jwtService = new StubJwtService();
        chain = new RecordingFilterChain();
        JwtValidationFilter factory = new JwtValidationFilter(jwtService, GATEWAY_TOKEN);
        filter = factory.apply(new JwtValidationFilter.Config());
    }

    @Test
    void options_bypassesAuthEvenWithoutAuthorization() {
        MockServerWebExchange exchange = exchange(HttpMethod.OPTIONS, "/api/chat/rooms");

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(chain.exchanges).containsExactly(exchange);
        assertThat(jwtService.validateCalls).isZero();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/auth/login",
            "/api/auth/register",
            "/api/users/42/avatar",
            "/api/users/7/background",
            "/api/notifications/vapid-public-key",
            "/openapi/auth/v3/api-docs",
            "/actuator/health",
            "/eureka/apps",
            "/v3/api-docs",
            "/swagger-ui/index.html"
    })
    void publicEndpoints_bypassJwtValidation(String path) {
        MockServerWebExchange exchange = exchange(HttpMethod.GET, path);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(chain.exchanges).containsExactly(exchange);
        assertThat(jwtService.validateCalls).isZero();
    }

    @Test
    void protectedPath_missingAuthorization_returns401() {
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/chat/rooms");

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertUnauthorized(exchange, "Missing or invalid Authorization header");
        assertThat(chain.exchanges).isEmpty();
        assertThat(jwtService.validateCalls).isZero();
    }

    @Test
    void protectedPath_nonBearerScheme_returns401() {
        MockServerWebExchange exchange = exchangeWithAuth(HttpMethod.GET, "/api/users/me", "Basic abc");

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertUnauthorized(exchange, "Missing or invalid Authorization header");
        assertThat(chain.exchanges).isEmpty();
    }

    @Test
    void protectedPath_emptyBearerToken_returns401() {
        MockServerWebExchange exchange = exchangeWithAuth(HttpMethod.GET, "/api/chat/rooms", "Bearer   ");

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertUnauthorized(exchange, "Invalid or expired token");
        assertThat(chain.exchanges).isEmpty();
        assertThat(jwtService.validateCalls).isZero();
    }

    @Test
    void protectedPath_invalidToken_returns401() {
        MockServerWebExchange exchange = exchangeWithAuth(
                HttpMethod.GET, "/api/chat/rooms", "Bearer " + INVALID_JWT);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertUnauthorized(exchange, "Invalid or expired token");
        assertThat(chain.exchanges).isEmpty();
        assertThat(jwtService.validateCalls).isEqualTo(1);
    }

    @Test
    void protectedPath_tokenMissingUserId_returns401() {
        MockServerWebExchange exchange = exchangeWithAuth(
                HttpMethod.GET, "/api/chat/rooms", "Bearer " + NO_USER_ID_JWT);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertUnauthorized(exchange, "Token missing userId claim");
        assertThat(chain.exchanges).isEmpty();
    }

    @Test
    void protectedPath_jwtServiceThrows_returns401() {
        MockServerWebExchange exchange = exchangeWithAuth(
                HttpMethod.GET, "/api/chat/rooms", "Bearer " + THROWING_JWT);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertUnauthorized(exchange, "Token validation error: parse failed");
        assertThat(chain.exchanges).isEmpty();
    }

    @Test
    void validToken_injectsTrustedIdentityHeadersAndContinues() {
        MockServerWebExchange exchange = exchangeWithAuth(
                HttpMethod.GET, "/api/chat/rooms", "Bearer " + VALID_JWT);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        ServerWebExchange forwarded = assertSingleForwarded();
        HttpHeaders headers = forwarded.getRequest().getHeaders();

        assertThat(headers.getFirst(HttpHeaders.AUTHORIZATION)).isEqualTo("Bearer " + VALID_JWT);
        assertThat(headers.getFirst(GatewayAuthHeaders.USER_ID)).isEqualTo("42");
        assertThat(headers.getFirst(GatewayAuthHeaders.USERNAME)).isEqualTo("karina");
        assertThat(headers.getFirst(GatewayAuthHeaders.GATEWAY_AUTH)).isEqualTo(GATEWAY_TOKEN);
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    void validToken_stripsClientSpoofedIdentityHeaders() {
        MockServerHttpRequest request = MockServerHttpRequest
                .method(HttpMethod.GET, "/api/users/me")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + VALID_JWT)
                .header(GatewayAuthHeaders.USER_ID, "1")
                .header(GatewayAuthHeaders.USERNAME, "attacker")
                .header(GatewayAuthHeaders.GATEWAY_AUTH, "forged-token")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        ServerWebExchange forwarded = assertSingleForwarded();
        HttpHeaders headers = forwarded.getRequest().getHeaders();

        assertThat(headers.getFirst(GatewayAuthHeaders.USER_ID)).isEqualTo("42");
        assertThat(headers.getFirst(GatewayAuthHeaders.USERNAME)).isEqualTo("karina");
        assertThat(headers.getFirst(GatewayAuthHeaders.GATEWAY_AUTH)).isEqualTo(GATEWAY_TOKEN);
        assertThat(headers.get(GatewayAuthHeaders.USER_ID)).containsExactly("42");
    }

    @Test
    void validToken_blankUsername_omitsUsernameHeader() {
        MockServerWebExchange exchange = exchangeWithAuth(
                HttpMethod.GET, "/api/presence/status", "Bearer " + BLANK_USERNAME_JWT);

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        ServerWebExchange forwarded = assertSingleForwarded();
        assertThat(forwarded.getRequest().getHeaders().getFirst(GatewayAuthHeaders.USER_ID))
                .isEqualTo("5");
        assertThat(forwarded.getRequest().getHeaders().containsKey(GatewayAuthHeaders.USERNAME))
                .isFalse();
    }

    @Test
    void nonPublicUserPath_stillRequiresJwt() {
        MockServerWebExchange exchange = exchange(HttpMethod.GET, "/api/users/42/profile");

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertUnauthorized(exchange, "Missing or invalid Authorization header");
        assertThat(chain.exchanges).isEmpty();
    }

    private ServerWebExchange assertSingleForwarded() {
        assertThat(chain.exchanges).hasSize(1);
        return chain.exchanges.getFirst();
    }

    private void assertUnauthorized(MockServerWebExchange exchange, String message) {
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(exchange.getResponse().getHeaders().getFirst("X-Error-Message")).isEqualTo(message);
    }

    private static MockServerWebExchange exchange(HttpMethod method, String path) {
        return MockServerWebExchange.from(MockServerHttpRequest.method(method, path).build());
    }

    private static MockServerWebExchange exchangeWithAuth(HttpMethod method, String path, String authorization) {
        return MockServerWebExchange.from(
                MockServerHttpRequest.method(method, path)
                        .header(HttpHeaders.AUTHORIZATION, authorization)
                        .build());
    }

    static final class RecordingFilterChain implements GatewayFilterChain {
        final List<ServerWebExchange> exchanges = new ArrayList<>();

        @Override
        public Mono<Void> filter(ServerWebExchange exchange) {
            exchanges.add(exchange);
            return Mono.empty();
        }
    }

    /**
     * Hand-rolled stub avoids mocking the concrete JwtService (Byte Buddy / Java version friction)
     * and keeps filter behavior assertions readable.
     */
    static final class StubJwtService extends JwtService {
        int validateCalls;

        @Override
        public boolean validateToken(String token) {
            validateCalls++;
            if (THROWING_JWT.equals(token)) {
                throw new RuntimeException("parse failed");
            }
            return VALID_JWT.equals(token)
                    || NO_USER_ID_JWT.equals(token)
                    || BLANK_USERNAME_JWT.equals(token);
        }

        @Override
        public String extractUsername(String token) {
            if (BLANK_USERNAME_JWT.equals(token)) {
                return "  ";
            }
            return "karina";
        }

        @Override
        public Long extractUserId(String token) {
            if (NO_USER_ID_JWT.equals(token)) {
                return null;
            }
            if (BLANK_USERNAME_JWT.equals(token)) {
                return 5L;
            }
            return 42L;
        }
    }
}
