package com.project.webchat.user;

import com.project.webchat.user.controller.ContactHttpAdapter;
import com.project.webchat.user.controller.UserAuthHttpAdapter;
import com.project.webchat.user.controller.UserBanHttpAdapter;
import com.project.webchat.user.controller.UserPresenceHttpAdapter;
import com.project.webchat.user.entity.FriendRequest;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards the split of UserServiceController into purpose-built HTTP adapters.
 * Paths stay under /api/users for Feign and frontend compatibility.
 */
class UserServiceControllerSplitTest {

    @Test
    void userServiceController_isRemoved() {
        try {
            Class.forName("com.project.webchat.user.controller.UserServiceController");
            throw new AssertionError("UserServiceController should be removed after the adapter split");
        } catch (ClassNotFoundException expected) {
            // expected
        }
    }

    @Test
    void adapters_areRestControllersOnApiUsers() {
        assertRestAdapter(UserAuthHttpAdapter.class);
        assertRestAdapter(ContactHttpAdapter.class);
        assertRestAdapter(UserBanHttpAdapter.class);
        assertRestAdapter(UserPresenceHttpAdapter.class);
    }

    @Test
    void authAdapter_ownsCredentialAndLookupRoutes() {
        Set<String> paths = mappedPaths(UserAuthHttpAdapter.class);
        assertThat(paths).contains(
                "/register",
                "/{id}",
                "/by-username/{username}",
                "/by-username/{username}/with-password",
                "/exists/username/{username}",
                "/exists/email/{email}",
                "/by-email",
                "/internal/reset-password",
                "/resolve-login/{loginIdentifier}",
                "/search",
                "/validate-credentials",
                "/validate-and-get-info");
        assertThat(paths).noneMatch(p -> p.startsWith("/contacts") || p.startsWith("/bans"));
        assertThat(paths).noneMatch(p -> p.contains("last-seen"));
    }

    @Test
    void contactAdapter_ownsContactRoutes_andDoesNotReturnFriendRequestEntity() {
        Set<String> paths = mappedPaths(ContactHttpAdapter.class);
        assertThat(paths).contains(
                "/contacts",
                "/contacts/requests",
                "/internal/contacts/requests",
                "/contacts/{contactUserId}",
                "/contacts/requests/incoming",
                "/contacts/requests/{id}/accept",
                "/contacts/requests/{id}/add-sender",
                "/contacts/requests/{id}/decline",
                "/contacts/status/{otherUserId}");

        for (Method method : ContactHttpAdapter.class.getDeclaredMethods()) {
            if (!isMapped(method)) {
                continue;
            }
            assertThat(returnsFriendRequest(method))
                    .as("%s must not expose FriendRequest entity", method.getName())
                    .isFalse();
        }
    }

    @Test
    void banAdapter_ownsBanRoutes() {
        Set<String> paths = mappedPaths(UserBanHttpAdapter.class);
        assertThat(paths).contains(
                "/bans",
                "/bans/{targetUserId}",
                "/bans/status/{targetUserId}",
                "/internal/{userId}/banned-user-ids",
                "/internal/{userId}/banning-user-ids",
                "/internal/{userId}/has-banned/{targetUserId}");
    }

    @Test
    void presenceAdapter_ownsLastSeenRoutes() {
        Set<String> paths = mappedPaths(UserPresenceHttpAdapter.class);
        assertThat(paths).containsExactlyInAnyOrder(
                "/internal/{userId}/last-seen");
        long lastSeenMappings = Arrays.stream(UserPresenceHttpAdapter.class.getDeclaredMethods())
                .filter(UserServiceControllerSplitTest::isMapped)
                .filter(m -> mappedPath(m).equals("/internal/{userId}/last-seen"))
                .count();
        assertThat(lastSeenMappings).isEqualTo(2);
    }

    private static void assertRestAdapter(Class<?> type) {
        assertThat(type.getAnnotation(RestController.class)).isNotNull();
        RequestMapping mapping = type.getAnnotation(RequestMapping.class);
        assertThat(mapping).isNotNull();
        assertThat(mapping.value()).containsExactly("/api/users");
    }

    private static Set<String> mappedPaths(Class<?> type) {
        Set<String> paths = new HashSet<>();
        for (Method method : type.getDeclaredMethods()) {
            if (isMapped(method)) {
                paths.add(mappedPath(method));
            }
        }
        return paths;
    }

    private static boolean isMapped(Method method) {
        return method.getAnnotation(GetMapping.class) != null
                || method.getAnnotation(PostMapping.class) != null
                || method.getAnnotation(PutMapping.class) != null
                || method.getAnnotation(DeleteMapping.class) != null;
    }

    private static String mappedPath(Method method) {
        GetMapping get = method.getAnnotation(GetMapping.class);
        if (get != null) {
            return firstOrEmpty(get.value(), get.path());
        }
        PostMapping post = method.getAnnotation(PostMapping.class);
        if (post != null) {
            return firstOrEmpty(post.value(), post.path());
        }
        PutMapping put = method.getAnnotation(PutMapping.class);
        if (put != null) {
            return firstOrEmpty(put.value(), put.path());
        }
        DeleteMapping delete = method.getAnnotation(DeleteMapping.class);
        if (delete != null) {
            return firstOrEmpty(delete.value(), delete.path());
        }
        return "";
    }

    private static String firstOrEmpty(String[] value, String[] path) {
        if (value != null && value.length > 0) {
            return value[0];
        }
        if (path != null && path.length > 0) {
            return path[0];
        }
        return "";
    }

    private static boolean returnsFriendRequest(Method method) {
        if (FriendRequest.class.equals(method.getReturnType())) {
            return true;
        }
        Type generic = method.getGenericReturnType();
        if (generic instanceof ParameterizedType parameterized) {
            for (Type arg : parameterized.getActualTypeArguments()) {
                if (FriendRequest.class.equals(arg)) {
                    return true;
                }
            }
        }
        return false;
    }
}
