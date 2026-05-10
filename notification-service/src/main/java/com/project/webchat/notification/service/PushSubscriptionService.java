package com.project.webchat.notification.service;

import com.project.webchat.notification.dto.PushSubscriptionRequest;
import com.project.webchat.notification.entity.PushSubscription;
import com.project.webchat.notification.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PushSubscriptionService {

    private final PushSubscriptionRepository pushSubscriptionRepository;

    /**
     * Stores or updates a browser's push subscription for the given user.
     * <p>
     * The push endpoint URL is the natural primary identity for a
     * subscription — it points at exactly ONE physical browser channel.
     * If a row for that endpoint already exists under a different
     * {@code user_id} (e.g. two profiles on the same machine that were
     * handed the same WNS/FCM channel by the OS), we TRANSFER ownership
     * to whoever just authenticated, instead of letting a second row
     * coexist and ghost-deliver pushes to the previous owner's browser.
     */
    @Transactional
    public PushSubscription upsert(Long userId, PushSubscriptionRequest request, String userAgent) {
        // Optional explicit cleanup of an endpoint the client just
        // unsubscribed from (e.g. VAPID rotation). Endpoint-scoped so we
        // remove the row regardless of whose user_id it currently lives
        // under — the browser is telling us "this channel is dead".
        if (request.getPreviousEndpoint() != null
                && !request.getPreviousEndpoint().isBlank()
                && !request.getPreviousEndpoint().equals(request.getEndpoint())) {
            try {
                pushSubscriptionRepository.deleteByEndpoint(request.getPreviousEndpoint());
                log.info("Removed previous push subscription userId={} previousEndpoint={}",
                        userId, request.getPreviousEndpoint());
            } catch (Exception ex) {
                log.warn("Failed to remove previous push subscription userId={} message={}",
                        userId, ex.getMessage());
            }
        }

        PushSubscription subscription = pushSubscriptionRepository
                .findByEndpoint(request.getEndpoint())
                .orElseGet(PushSubscription::new);

        if (subscription.getId() != null && !userId.equals(subscription.getUserId())) {
            log.info("Transferring push subscription ownership endpoint={} fromUserId={} toUserId={}",
                    request.getEndpoint(), subscription.getUserId(), userId);
        }

        subscription.setUserId(userId);
        subscription.setEndpoint(request.getEndpoint());
        subscription.setP256dhKey(request.getKeys().getP256dh());
        subscription.setAuthKey(request.getKeys().getAuth());
        subscription.setUserAgent(userAgent);

        return pushSubscriptionRepository.save(subscription);
    }

    @Transactional(readOnly = true)
    public List<PushSubscription> getByUserId(Long userId) {
        return pushSubscriptionRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    @Transactional
    public void deleteByEndpoint(Long userId, String endpoint) {
        pushSubscriptionRepository.deleteByUserIdAndEndpoint(userId, endpoint);
    }
}
