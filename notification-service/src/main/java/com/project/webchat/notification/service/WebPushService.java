package com.project.webchat.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.notification.entity.PushSubscription;
import com.project.webchat.notification.repository.PushSubscriptionRepository;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import com.project.webchat.shared.events.v1.MessageReactionEventV1;
import com.project.webchat.shared.events.v1.RoomMemberInvitedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {

    private static final int PUSH_TIMEOUT_SECONDS = 5;
    private static final int PUSH_MAX_ATTEMPTS = 2;

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final PushSubscriptionMaintenanceService pushSubscriptionMaintenanceService;
    private final PushService pushService;
    private final ExecutorService webPushExecutor;
    private final ObjectMapper objectMapper;

    @Value("${app.webpush.delete-on-client-error:true}")
    private boolean deleteOnClientError;

    public int sendMessageCreated(Long recipientUserId, MessageCreatedEventV1 event) {
        return sendPayload(recipientUserId, event.getEventId(), buildMessageCreatedPayload(event));
    }

    public int sendMessageReaction(Long recipientUserId, MessageReactionEventV1 event) {
        return sendPayload(recipientUserId, event.getEventId(), buildMessageReactionPayload(event));
    }

    public int sendRoomMemberInvited(Long recipientUserId, RoomMemberInvitedEventV1 event) {
        return sendPayload(recipientUserId, event.getEventId(), buildRoomMemberInvitedPayload(event));
    }

    private int sendPayload(Long recipientUserId, UUID eventId, String payload) {
        List<PushSubscription> subscriptions = pushSubscriptionRepository
                .findByUserIdOrderByUpdatedAtDesc(recipientUserId);
        if (subscriptions.isEmpty()) {
            log.info("No push subscriptions for recipient userId={}", recipientUserId);
            return 0;
        }

        List<CompletableFuture<DeliveryOutcome>> futures = subscriptions.stream()
                .map(subscription -> CompletableFuture.supplyAsync(
                        () -> deliverToSingleSubscription(subscription, payload, eventId, recipientUserId),
                        webPushExecutor))
                .toList();

        int delivered = 0;
        boolean retryableFailureSeen = false;

        for (CompletableFuture<DeliveryOutcome> future : futures) {
            try {
                DeliveryOutcome outcome = future.get(PUSH_TIMEOUT_SECONDS + 2L, TimeUnit.SECONDS);
                if (outcome == DeliveryOutcome.DELIVERED) {
                    delivered++;
                } else if (outcome == DeliveryOutcome.RETRYABLE_FAILURE) {
                    retryableFailureSeen = true;
                }
            } catch (TimeoutException ex) {
                future.cancel(true);
                retryableFailureSeen = true;
            } catch (Exception ex) {
                retryableFailureSeen = true;
            }
        }

        if (delivered == 0 && retryableFailureSeen) {
            throw new RuntimeException("All push subscriptions for recipient " + recipientUserId
                    + " failed with retryable errors");
        }
        return delivered;
    }

    private DeliveryOutcome deliverToSingleSubscription(PushSubscription subscription,
                                                         String payload,
                                                         UUID eventId,
                                                         Long recipientUserId) {
        try {
            Notification notification = new Notification(
                    subscription.getEndpoint(),
                    subscription.getP256dhKey(),
                    subscription.getAuthKey(),
                    payload
            );

            HttpResponse response = sendWithRetry(notification);
            int status = response.getStatusLine().getStatusCode();

            log.info("WebPush response eventId={} recipientUserId={} subscriptionId={} status={}",
                    eventId, recipientUserId, subscription.getId(), status);

            if (status >= 200 && status < 300) {
                return DeliveryOutcome.DELIVERED;
            }
            if (status == 404 || status == 410) {
                pushSubscriptionMaintenanceService.deleteSubscriptionInNewTransaction(
                        subscription.getId(), "expired_status_" + status);
                return DeliveryOutcome.PERMANENTLY_FAILED;
            }
            if (status >= 400 && status < 500) {
                if (deleteOnClientError && (status == 400 || status == 401 || status == 403)) {
                    pushSubscriptionMaintenanceService.deleteSubscriptionInNewTransaction(
                            subscription.getId(), "rejected_status_" + status);
                }
                log.warn("WebPush non-retryable subscription response eventId={} recipientUserId={} subscriptionId={} status={}",
                        eventId, recipientUserId, subscription.getId(), status);
                return DeliveryOutcome.PERMANENTLY_FAILED;
            }
            log.warn("WebPush retryable status eventId={} recipientUserId={} subscriptionId={} status={}",
                    eventId, recipientUserId, subscription.getId(), status);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (PermanentNotificationException ex) {
            log.error("WebPush permanent failure eventId={} recipientUserId={} subscriptionId={} message={}",
                    eventId, recipientUserId, subscription.getId(), ex.getMessage(), ex);
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.error("WebPush interrupted eventId={} recipientUserId={} subscriptionId={} message={}",
                    eventId, recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (TimeoutException ex) {
            log.error("WebPush timeout eventId={} recipientUserId={} subscriptionId={} message={}",
                    eventId, recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (ExecutionException ex) {
            log.error("WebPush execution failure eventId={} recipientUserId={} subscriptionId={} message={}",
                    eventId, recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (Exception ex) {
            log.error("WebPush failure eventId={} recipientUserId={} subscriptionId={} message={}",
                    eventId, recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        }
    }

    private HttpResponse sendWithRetry(Notification notification)
            throws InterruptedException, ExecutionException, TimeoutException {
        RuntimeException lastFailure = null;
        for (int attempt = 1; attempt <= PUSH_MAX_ATTEMPTS; attempt++) {
            try {
                HttpResponse response = sendWithTimeout(notification, Encoding.AES128GCM);
                int status = response.getStatusLine().getStatusCode();
                if (status == 403) {
                    log.warn("WebPush AES128GCM returned 403, retrying with AESGCM attempt={}", attempt);
                    response = sendWithTimeout(notification, Encoding.AESGCM);
                }
                return response;
            } catch (TimeoutException | ExecutionException ex) {
                lastFailure = new RuntimeException(ex);
                if (attempt < PUSH_MAX_ATTEMPTS) {
                    log.warn("WebPush attempt {} failed, retrying immediately", attempt);
                }
            }
        }
        if (lastFailure != null) {
            if (lastFailure.getCause() instanceof TimeoutException timeout) {
                throw timeout;
            }
            if (lastFailure.getCause() instanceof ExecutionException execution) {
                throw execution;
            }
            if (lastFailure.getCause() instanceof InterruptedException interrupted) {
                throw interrupted;
            }
        }
        throw new TimeoutException("WebPush delivery timed out");
    }

    private HttpResponse sendWithTimeout(Notification notification, Encoding encoding)
            throws InterruptedException, ExecutionException, TimeoutException {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return pushService.send(notification, encoding);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }, webPushExecutor).get(PUSH_TIMEOUT_SECONDS, TimeUnit.SECONDS);
    }

    private String buildMessageCreatedPayload(MessageCreatedEventV1 event) {
        String senderDisplayName = (event.getSenderDisplayName() == null || event.getSenderDisplayName().isBlank())
                ? "New message"
                : event.getSenderDisplayName();
        String previewText = (event.getPreviewText() == null || event.getPreviewText().isBlank())
                ? "You have a new message"
                : event.getPreviewText();

        Map<String, Object> data = new HashMap<>();
        data.put("notificationType", "message-created");
        data.put("eventId", event.getEventId());
        data.put("chatId", event.getChatId());
        data.put("messageId", event.getMessageId());
        data.put("senderDisplayName", senderDisplayName);
        String senderAvatarUrl =
                event.getSenderAvatarUrl() != null ? event.getSenderAvatarUrl().trim() : null;
        if (senderAvatarUrl != null && !senderAvatarUrl.isEmpty()) {
            data.put("senderAvatarUrl", senderAvatarUrl);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("title", senderDisplayName);
        payload.put("body", previewText);
        if (senderAvatarUrl != null && !senderAvatarUrl.isEmpty()) {
            payload.put("icon", senderAvatarUrl);
        }
        payload.put("actions", List.of(
                Map.of("action", "mark-read", "title", "Mark as read"),
                Map.of("action", "answer", "title", "Answer")
        ));
        payload.put("data", data);

        return serializePayload(payload);
    }

    private String buildMessageReactionPayload(MessageReactionEventV1 event) {
        String reactorDisplayName = (event.getReactorDisplayName() == null || event.getReactorDisplayName().isBlank())
                ? "Someone"
                : event.getReactorDisplayName();
        String emoji = event.getEmoji() != null ? event.getEmoji().trim() : "";
        String body = emoji.isEmpty()
                ? reactorDisplayName + " reacted to your message"
                : reactorDisplayName + " reacted " + emoji + " to your message";

        Map<String, Object> data = new HashMap<>();
        data.put("notificationType", "message-reaction");
        data.put("eventId", event.getEventId());
        data.put("chatId", event.getChatId());
        data.put("messageId", event.getMessageId());
        data.put("reactorDisplayName", reactorDisplayName);
        data.put("emoji", emoji);
        String reactorAvatarUrl = event.getReactorAvatarUrl() != null ? event.getReactorAvatarUrl().trim() : null;
        if (reactorAvatarUrl != null && !reactorAvatarUrl.isEmpty()) {
            data.put("reactorAvatarUrl", reactorAvatarUrl);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("title", "New reaction");
        payload.put("body", body);
        if (reactorAvatarUrl != null && !reactorAvatarUrl.isEmpty()) {
            payload.put("icon", reactorAvatarUrl);
        }
        payload.put("data", data);

        return serializePayload(payload);
    }

    private String buildRoomMemberInvitedPayload(RoomMemberInvitedEventV1 event) {
        String inviterDisplayName = (event.getInviterDisplayName() == null || event.getInviterDisplayName().isBlank())
                ? "Someone"
                : event.getInviterDisplayName();
        String roomLabel = (event.getRoomName() == null || event.getRoomName().isBlank())
                ? "a chat"
                : "\"" + event.getRoomName().trim() + "\"";

        Map<String, Object> data = new HashMap<>();
        data.put("notificationType", "room-member-invited");
        data.put("eventId", event.getEventId());
        data.put("inviteId", event.getInviteId());
        data.put("roomId", event.getRoomId());
        data.put("roomName", event.getRoomName());
        data.put("roomType", event.getRoomType());
        data.put("inviterDisplayName", inviterDisplayName);
        String inviterAvatarUrl = event.getInviterAvatarUrl() != null ? event.getInviterAvatarUrl().trim() : null;
        if (inviterAvatarUrl != null && !inviterAvatarUrl.isEmpty()) {
            data.put("inviterAvatarUrl", inviterAvatarUrl);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("title", "Chat invite");
        payload.put("body", inviterDisplayName + " invited you to join " + roomLabel);
        if (inviterAvatarUrl != null && !inviterAvatarUrl.isEmpty()) {
            payload.put("icon", inviterAvatarUrl);
        }
        payload.put("data", data);

        return serializePayload(payload);
    }

    private String serializePayload(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new PermanentNotificationException("Failed to serialize web push payload", e);
        }
    }

    private enum DeliveryOutcome {
        DELIVERED,
        PERMANENTLY_FAILED,
        RETRYABLE_FAILURE
    }
}
