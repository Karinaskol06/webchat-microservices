package com.project.webchat.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.notification.config.VapidProperties;
import com.project.webchat.notification.entity.PushSubscription;
import com.project.webchat.notification.repository.PushSubscriptionRepository;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import nl.martijndwars.webpush.Encoding;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;

import java.security.GeneralSecurityException;
import java.security.PublicKey;
import java.security.Security;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {

    private final PushSubscriptionRepository pushSubscriptionRepository;
    private final PushSubscriptionMaintenanceService pushSubscriptionMaintenanceService;
    private final VapidProperties vapidProperties;
    private final ObjectMapper objectMapper;

    /**
     * Send a web-push notification to every active subscription owned by the
     * given recipient. Every subscription is attempted INDEPENDENTLY so a
     * failure on one (timeout, FCM/WNS hiccup, malformed row, ...) never
     * prevents the others — the active one in particular — from being tried.
     *
     * @return number of subscriptions that the push provider acknowledged with 2xx
     */
    public int sendMessageCreated(Long recipientUserId, MessageCreatedEventV1 event) {
        List<PushSubscription> subscriptions = pushSubscriptionRepository
                .findByUserIdOrderByUpdatedAtDesc(recipientUserId);
        if (subscriptions.isEmpty()) {
            log.info("No push subscriptions for recipient userId={}", recipientUserId);
            return 0;
        }

        String payload = buildPayload(event);
        PushService pushService = createPushService();

        int delivered = 0;
        boolean retryableFailureSeen = false;

        for (PushSubscription subscription : subscriptions) {
            DeliveryOutcome outcome = deliverToSingleSubscription(pushService, subscription, payload, event, recipientUserId);
            if (outcome == DeliveryOutcome.DELIVERED) {
                delivered++;
            } else if (outcome == DeliveryOutcome.RETRYABLE_FAILURE) {
                retryableFailureSeen = true;
            }
            // PERMANENTLY_FAILED / SKIPPED → just move on to the next subscription
        }

        // Only rethrow (and trigger Kafka retry / DLQ) if we delivered to no-one
        // AND at least one failure was the kind worth retrying. Otherwise we
        // either already reached the user, or every endpoint we have is dead
        // and retrying won't change anything.
        if (delivered == 0 && retryableFailureSeen) {
            throw new RuntimeException("All push subscriptions for recipient " + recipientUserId
                    + " failed with retryable errors");
        }
        return delivered;
    }

    private DeliveryOutcome deliverToSingleSubscription(PushService pushService,
                                                         PushSubscription subscription,
                                                         String payload,
                                                         MessageCreatedEventV1 event,
                                                         Long recipientUserId) {
        String endpointHost = subscription.getEndpoint() == null
                ? "null"
                : subscription.getEndpoint().replaceAll("https?://([^/]+).*", "$1");

        try {
            Notification notification = new Notification(
                    subscription.getEndpoint(),
                    subscription.getP256dhKey(),
                    subscription.getAuthKey(),
                    payload
            );

            HttpResponse response = sendWithTimeout(pushService, notification, Encoding.AES128GCM);
            int status = response.getStatusLine().getStatusCode();

            // Some FCM endpoints still require the legacy AESGCM encoding and
            // return 403 for AES128GCM payloads — fall back once before giving up.
            if (status == 403 && "fcm.googleapis.com".equals(endpointHost)) {
                log.warn("WebPush FCM retry with AESGCM eventId={} recipientUserId={} subscriptionId={}",
                        event.getEventId(), recipientUserId, subscription.getId());
                response = sendWithTimeout(pushService, notification, Encoding.AESGCM);
                status = response.getStatusLine().getStatusCode();
                log.info("WebPush FCM retry response eventId={} recipientUserId={} subscriptionId={} status={}",
                        event.getEventId(), recipientUserId, subscription.getId(), status);
            }

            log.info("WebPush response eventId={} recipientUserId={} subscriptionId={} status={}",
                    event.getEventId(), recipientUserId, subscription.getId(), status);

            if (status >= 200 && status < 300) {
                return DeliveryOutcome.DELIVERED;
            }
            if (status == 404 || status == 410) {
                pushSubscriptionMaintenanceService.deleteSubscriptionInNewTransaction(
                        subscription.getId(), "expired_status_" + status);
                return DeliveryOutcome.PERMANENTLY_FAILED;
            }
            if (status >= 400 && status < 500) {
                if (status == 400 || status == 401 || status == 403) {
                    pushSubscriptionMaintenanceService.deleteSubscriptionInNewTransaction(
                            subscription.getId(), "rejected_status_" + status);
                }
                log.warn("WebPush non-retryable subscription response eventId={} recipientUserId={} subscriptionId={} status={}",
                        event.getEventId(), recipientUserId, subscription.getId(), status);
                return DeliveryOutcome.PERMANENTLY_FAILED;
            }
            // 5xx and anything else → treat as transient, but DON'T abort the loop.
            log.warn("WebPush retryable status eventId={} recipientUserId={} subscriptionId={} status={}",
                    event.getEventId(), recipientUserId, subscription.getId(), status);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (PermanentNotificationException ex) {
            // Configuration-level problem (e.g. invalid VAPID): genuinely
            // permanent, no retry will help — propagate so the consumer
            // routes the event to the DLQ instead of looping.
            log.error("WebPush permanent failure eventId={} recipientUserId={} subscriptionId={} message={}",
                    event.getEventId(), recipientUserId, subscription.getId(), ex.getMessage(), ex);
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            log.error("WebPush interrupted eventId={} recipientUserId={} subscriptionId={} message={}",
                    event.getEventId(), recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (TimeoutException ex) {
            log.error("WebPush timeout eventId={} recipientUserId={} subscriptionId={} message={}",
                    event.getEventId(), recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (ExecutionException ex) {
            log.error("WebPush execution failure eventId={} recipientUserId={} subscriptionId={} message={}",
                    event.getEventId(), recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        } catch (Exception ex) {
            // Anything else — e.g. bad p256dh/auth key on a single legacy row —
            // must NOT poison delivery to the recipient's other subscriptions.
            log.error("WebPush failure eventId={} recipientUserId={} subscriptionId={} message={}",
                    event.getEventId(), recipientUserId, subscription.getId(), ex.getMessage(), ex);
            return DeliveryOutcome.RETRYABLE_FAILURE;
        }
    }

    private HttpResponse sendWithTimeout(PushService pushService, Notification notification, Encoding encoding)
            throws InterruptedException, ExecutionException, TimeoutException {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return pushService.send(notification, encoding);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).get(15, TimeUnit.SECONDS);
    }

    private PushService createPushService() {
        try {
            if (Security.getProvider("BC") == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            PublicKey publicKey = Utils.loadPublicKey(vapidProperties.getPublicKey());
            return new PushService()
                    .setSubject(vapidProperties.getSubject())
                    .setPublicKey(publicKey)
                    .setPrivateKey(Utils.loadPrivateKey(vapidProperties.getPrivateKey()));
        } catch (GeneralSecurityException e) {
            throw new PermanentNotificationException("Invalid VAPID key configuration", e);
        }
    }

    private String buildPayload(MessageCreatedEventV1 event) {
        String senderDisplayName = (event.getSenderDisplayName() == null || event.getSenderDisplayName().isBlank())
                ? "New message"
                : event.getSenderDisplayName();
        String previewText = (event.getPreviewText() == null || event.getPreviewText().isBlank())
                ? "You have a new message"
                : event.getPreviewText();

        Map<String, Object> data = new HashMap<>();
        data.put("eventId", event.getEventId());
        data.put("chatId", event.getChatId());
        data.put("messageId", event.getMessageId());
        data.put("senderDisplayName", senderDisplayName);
        String senderAvatarUrl =
                event.getSenderAvatarUrl() != null ? event.getSenderAvatarUrl().trim() : null;
        if (senderAvatarUrl != null && !senderAvatarUrl.isEmpty()) {
            data.put("senderAvatarUrl", senderAvatarUrl);
        }
        data.put("autoCloseMs", 10_000);

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
