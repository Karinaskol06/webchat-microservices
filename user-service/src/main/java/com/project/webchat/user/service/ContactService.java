package com.project.webchat.user.service;

import com.project.webchat.shared.dto.ContactPromptDescriptorDTO;
import com.project.webchat.shared.dto.ContactRequestState;
import com.project.webchat.shared.dto.ContactStatusDTO;
import com.project.webchat.user.entity.FriendRequest;
import com.project.webchat.user.entity.UserContact;
import com.project.webchat.user.repository.FriendRequestRepository;
import com.project.webchat.user.repository.UserContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ContactService {
    private final FriendRequestRepository friendRequestRepository;
    private final UserContactRepository userContactRepository;

    @Value("${app.contacts.snooze-days:7}")
    private long snoozeDays;

    public FriendRequest createPendingRequestIfEligible(Long fromUserId, Long toUserId) {
        validatePair(fromUserId, toUserId);
        if (areContacts(fromUserId, toUserId)) {
            return null;
        }

        FriendRequest existingPending = friendRequestRepository
                .findByFromUserIdAndToUserIdAndState(fromUserId, toUserId, ContactRequestState.PENDING)
                .orElse(null);
        if (existingPending != null) {
            return existingPending;
        }

        boolean snoozed = friendRequestRepository
                .findFirstByFromUserIdAndToUserIdAndStateInAndNextEligibleAtAfterOrderByCreatedAtDesc(
                        fromUserId, toUserId, List.of(ContactRequestState.SNOOZED), LocalDateTime.now())
                .isPresent();
        if (snoozed) {
            return null;
        }

        FriendRequest request = FriendRequest.builder()
                .fromUserId(fromUserId)
                .toUserId(toUserId)
                .state(ContactRequestState.PENDING)
                .nextEligibleAt(LocalDateTime.now())
                .build();
        return friendRequestRepository.save(request);
    }

    @Transactional(readOnly = true)
    public List<FriendRequest> getIncomingPendingRequests(Long userId) {
        return friendRequestRepository.findByToUserIdAndStateOrderByCreatedAtDesc(userId, ContactRequestState.PENDING);
    }

    public ContactStatusDTO acceptRequest(Long requestId, Long currentUserId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Contact request not found"));
        if (!request.getToUserId().equals(currentUserId)) {
            throw new IllegalArgumentException("User cannot accept this contact request");
        }

        if (request.getState() == ContactRequestState.ACCEPTED || areContacts(request.getFromUserId(), request.getToUserId())) {
            ensureBidirectionalContacts(request.getFromUserId(), request.getToUserId());
            request.setState(ContactRequestState.ACCEPTED);
            request.setNextEligibleAt(null);
            friendRequestRepository.save(request);
            return ContactStatusDTO.builder().state(ContactRequestState.ACCEPTED).build();
        }

        if (request.getState() != ContactRequestState.PENDING) {
            throw new IllegalArgumentException("Only pending requests can be accepted");
        }

        request.setState(ContactRequestState.ACCEPTED);
        request.setNextEligibleAt(null);
        friendRequestRepository.save(request);
        ensureBidirectionalContacts(request.getFromUserId(), request.getToUserId());
        return ContactStatusDTO.builder().state(ContactRequestState.ACCEPTED).build();
    }

    public ContactStatusDTO declineWithSnooze(Long requestId, Long currentUserId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Contact request not found"));
        if (!request.getToUserId().equals(currentUserId)) {
            throw new IllegalArgumentException("User cannot decline this contact request");
        }
        if (request.getState() != ContactRequestState.PENDING && request.getState() != ContactRequestState.SNOOZED) {
            throw new IllegalArgumentException("Only pending requests can be snoozed");
        }

        LocalDateTime nextEligibleAt = LocalDateTime.now().plusDays(snoozeDays);
        request.setState(ContactRequestState.SNOOZED);
        request.setNextEligibleAt(nextEligibleAt);
        friendRequestRepository.save(request);
        return ContactStatusDTO.builder().state(ContactRequestState.SNOOZED).build();
    }

    @Transactional(readOnly = true)
    public ContactStatusDTO getContactStatus(Long currentUserId, Long otherUserId) {
        validatePair(currentUserId, otherUserId);
        if (areContacts(currentUserId, otherUserId)) {
            return ContactStatusDTO.builder().state(ContactRequestState.ACCEPTED).build();
        }

        FriendRequest incomingPending = friendRequestRepository
                .findFirstByFromUserIdAndToUserIdAndStateOrderByCreatedAtDesc(otherUserId, currentUserId, ContactRequestState.PENDING)
                .orElse(null);
        if (incomingPending != null) {
            return ContactStatusDTO.builder()
                    .state(ContactRequestState.PENDING)
                    .prompt(ContactPromptDescriptorDTO.builder()
                            .requestId(incomingPending.getId())
                            .fromUserId(incomingPending.getFromUserId())
                            .toUserId(incomingPending.getToUserId())
                            .nextEligibleAt(incomingPending.getNextEligibleAt())
                            .build())
                    .build();
        }

        FriendRequest outgoingSnoozed = friendRequestRepository
                .findFirstByFromUserIdAndToUserIdAndStateOrderByCreatedAtDesc(otherUserId, currentUserId, ContactRequestState.SNOOZED)
                .orElse(null);
        if (outgoingSnoozed != null && outgoingSnoozed.getNextEligibleAt() != null
                && outgoingSnoozed.getNextEligibleAt().isAfter(LocalDateTime.now())) {
            return ContactStatusDTO.builder()
                    .state(ContactRequestState.SNOOZED)
                    .prompt(ContactPromptDescriptorDTO.builder()
                            .requestId(outgoingSnoozed.getId())
                            .fromUserId(outgoingSnoozed.getFromUserId())
                            .toUserId(outgoingSnoozed.getToUserId())
                            .nextEligibleAt(outgoingSnoozed.getNextEligibleAt())
                            .build())
                    .build();
        }

        return ContactStatusDTO.builder().state(ContactRequestState.NONE).build();
    }

    private boolean areContacts(Long userId, Long otherUserId) {
        return userContactRepository.existsByUserIdAndContactUserId(userId, otherUserId)
                && userContactRepository.existsByUserIdAndContactUserId(otherUserId, userId);
    }

    private void ensureBidirectionalContacts(Long userA, Long userB) {
        if (!userContactRepository.existsByUserIdAndContactUserId(userA, userB)) {
            userContactRepository.save(UserContact.builder().userId(userA).contactUserId(userB).build());
        }
        if (!userContactRepository.existsByUserIdAndContactUserId(userB, userA)) {
            userContactRepository.save(UserContact.builder().userId(userB).contactUserId(userA).build());
        }
    }

    private void validatePair(Long fromUserId, Long toUserId) {
        if (fromUserId == null || toUserId == null) {
            throw new IllegalArgumentException("Both user IDs are required");
        }
        if (fromUserId.equals(toUserId)) {
            throw new IllegalArgumentException("Cannot create contact request to self");
        }
    }
}
