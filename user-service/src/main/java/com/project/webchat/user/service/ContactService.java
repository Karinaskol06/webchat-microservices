package com.project.webchat.user.service;

import com.project.webchat.shared.dto.ContactPromptDecision;
import com.project.webchat.shared.dto.ContactPromptDescriptorDTO;
import com.project.webchat.shared.dto.ContactRequestState;
import com.project.webchat.shared.dto.ContactStatusDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.dto.IncomingContactRequestDTO;
import com.project.webchat.user.entity.FriendRequest;
import com.project.webchat.user.entity.UserContact;
import com.project.webchat.user.repository.FriendRequestRepository;
import com.project.webchat.user.repository.UserContactRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class ContactService {
    private final FriendRequestRepository friendRequestRepository;
    private final UserContactRepository userContactRepository;
    private final UserProfileService userProfileService;

    /**
     * Create the one-time contact-prompt opportunity for a private pair (first message).
     * Never recreates if any request already exists for the pair (either direction).
     */
    public FriendRequest createPendingRequestIfEligible(Long fromUserId, Long toUserId) {
        validatePair(fromUserId, toUserId);
        if (areContacts(fromUserId, toUserId)) {
            return null;
        }
        if (findPairRequest(fromUserId, toUserId).isPresent()) {
            return null;
        }

        FriendRequest request = FriendRequest.builder()
                .fromUserId(fromUserId)
                .toUserId(toUserId)
                .state(ContactRequestState.PENDING)
                .fromUserDecision(ContactPromptDecision.PENDING)
                .toUserDecision(ContactPromptDecision.PENDING)
                .nextEligibleAt(null)
                .build();
        return friendRequestRepository.save(request);
    }

    @Transactional(readOnly = true)
    public List<FriendRequest> getIncomingPendingRequests(Long userId) {
        return friendRequestRepository.findByToUserIdAndStateOrderByCreatedAtDesc(userId, ContactRequestState.PENDING)
                .stream()
                .filter(r -> decisionFor(r, userId) == ContactPromptDecision.PENDING)
                .toList();
    }

    public void removeContact(Long userId, Long contactUserId) {
        validatePair(userId, contactUserId);
        if (!userContactRepository.existsByUserIdAndContactUserId(userId, contactUserId)) {
            throw new IllegalArgumentException("Contact not found");
        }
        userContactRepository.deleteByUserIdAndContactUserId(userId, contactUserId);
    }

    @Transactional(readOnly = true)
    public List<UserDTO> getContacts(Long userId) {
        return userContactRepository.findByUserIdOrderByIdDesc(userId).stream()
                .map(UserContact::getContactUserId)
                .distinct()
                .map(userProfileService::getUserDTOById)
                .sorted(Comparator.comparing(this::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<IncomingContactRequestDTO> getIncomingPendingRequestViews(Long userId) {
        return getIncomingPendingRequests(userId).stream()
                .map(request -> IncomingContactRequestDTO.builder()
                        .id(request.getId())
                        .state(request.getState())
                        .createdAt(request.getCreatedAt())
                        .nextEligibleAt(request.getNextEligibleAt())
                        .fromUser(userProfileService.getUserDTOById(request.getFromUserId()))
                        .build())
                .toList();
    }

    /** Direct one-sided add (e.g. from profile). Also closes my pending prompt if any. */
    public ContactStatusDTO addDirectContact(Long currentUserId, Long otherUserId) {
        validatePair(currentUserId, otherUserId);
        if (!userContactRepository.existsByUserIdAndContactUserId(currentUserId, otherUserId)) {
            userContactRepository.save(UserContact.builder()
                    .userId(currentUserId)
                    .contactUserId(otherUserId)
                    .build());
        }
        findPairRequest(currentUserId, otherUserId).ifPresent(request -> {
            if (decisionFor(request, currentUserId) == ContactPromptDecision.PENDING) {
                setDecision(request, currentUserId, ContactPromptDecision.ADDED);
                refreshAggregateState(request);
                friendRequestRepository.save(request);
            }
        });
        return getContactStatus(currentUserId, otherUserId);
    }

    /** Either participant: add other to my contacts and close my prompt. */
    public ContactStatusDTO addFromPrompt(Long requestId, Long currentUserId) {
        FriendRequest request = loadParticipantRequest(requestId, currentUserId);
        Long otherId = otherUserId(request, currentUserId);
        if (decisionFor(request, currentUserId) != ContactPromptDecision.PENDING) {
            return getContactStatus(currentUserId, otherId);
        }

        if (!userContactRepository.existsByUserIdAndContactUserId(currentUserId, otherId)) {
            userContactRepository.save(UserContact.builder()
                    .userId(currentUserId)
                    .contactUserId(otherId)
                    .build());
        }
        setDecision(request, currentUserId, ContactPromptDecision.ADDED);
        refreshAggregateState(request);
        friendRequestRepository.save(request);
        return getContactStatus(currentUserId, otherId);
    }

    /** Either participant: close my prompt without adding a contact. */
    public ContactStatusDTO dismissPrompt(Long requestId, Long currentUserId) {
        FriendRequest request = loadParticipantRequest(requestId, currentUserId);
        Long otherId = otherUserId(request, currentUserId);
        if (decisionFor(request, currentUserId) != ContactPromptDecision.PENDING) {
            return getContactStatus(currentUserId, otherId);
        }
        setDecision(request, currentUserId, ContactPromptDecision.DISMISSED);
        refreshAggregateState(request);
        friendRequestRepository.save(request);
        return getContactStatus(currentUserId, otherId);
    }

    /** @deprecated use {@link #addFromPrompt} */
    public ContactStatusDTO acceptRequest(Long requestId, Long currentUserId) {
        return addFromPrompt(requestId, currentUserId);
    }

    /** @deprecated use {@link #addFromPrompt} */
    public ContactStatusDTO addSenderContact(Long requestId, Long currentUserId) {
        return addFromPrompt(requestId, currentUserId);
    }

    /** @deprecated use {@link #dismissPrompt} */
    public ContactStatusDTO refuseRequest(Long requestId, Long currentUserId) {
        return dismissPrompt(requestId, currentUserId);
    }

    @Transactional(readOnly = true)
    public ContactStatusDTO getContactStatus(Long currentUserId, Long otherUserId) {
        validatePair(currentUserId, otherUserId);
        boolean onMyList = userContactRepository.existsByUserIdAndContactUserId(currentUserId, otherUserId);

        if (areContacts(currentUserId, otherUserId)) {
            return ContactStatusDTO.builder()
                    .state(ContactRequestState.ACCEPTED)
                    .onMyList(true)
                    .build();
        }

        Optional<FriendRequest> pair = findPairRequest(currentUserId, otherUserId);
        if (pair.isEmpty()) {
            return ContactStatusDTO.builder()
                    .state(ContactRequestState.NONE)
                    .onMyList(onMyList)
                    .build();
        }

        FriendRequest request = pair.get();
        if (decisionFor(request, currentUserId) == ContactPromptDecision.PENDING) {
            return ContactStatusDTO.builder()
                    .state(ContactRequestState.PENDING)
                    .onMyList(onMyList)
                    .prompt(ContactPromptDescriptorDTO.builder()
                            .requestId(request.getId())
                            .fromUserId(request.getFromUserId())
                            .toUserId(request.getToUserId())
                            .nextEligibleAt(request.getNextEligibleAt())
                            .build())
                    .build();
        }

        return ContactStatusDTO.builder()
                .state(ContactRequestState.NONE)
                .onMyList(onMyList)
                .build();
    }

    private Optional<FriendRequest> findPairRequest(Long userA, Long userB) {
        Optional<FriendRequest> ab = friendRequestRepository
                .findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(userA, userB);
        if (ab.isPresent()) {
            return ab;
        }
        return friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(userB, userA);
    }

    private FriendRequest loadParticipantRequest(Long requestId, Long currentUserId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Contact request not found"));
        if (!request.getFromUserId().equals(currentUserId) && !request.getToUserId().equals(currentUserId)) {
            throw new IllegalArgumentException("User is not a participant of this contact request");
        }
        return request;
    }

    private ContactPromptDecision decisionFor(FriendRequest request, Long userId) {
        ContactPromptDecision decision;
        if (request.getFromUserId().equals(userId)) {
            decision = request.getFromUserDecision();
        } else if (request.getToUserId().equals(userId)) {
            decision = request.getToUserDecision();
        } else {
            return ContactPromptDecision.DISMISSED;
        }
        // Legacy rows before per-user decisions: treat null as PENDING while aggregate is PENDING.
        if (decision == null) {
            return request.getState() == ContactRequestState.PENDING
                    ? ContactPromptDecision.PENDING
                    : ContactPromptDecision.DISMISSED;
        }
        return decision;
    }

    private void setDecision(FriendRequest request, Long userId, ContactPromptDecision decision) {
        if (request.getFromUserId().equals(userId)) {
            request.setFromUserDecision(decision);
        } else {
            request.setToUserDecision(decision);
        }
    }

    private Long otherUserId(FriendRequest request, Long currentUserId) {
        return request.getFromUserId().equals(currentUserId)
                ? request.getToUserId()
                : request.getFromUserId();
    }

    private void refreshAggregateState(FriendRequest request) {
        ContactPromptDecision from = decisionFor(request, request.getFromUserId());
        ContactPromptDecision to = decisionFor(request, request.getToUserId());
        if (from == ContactPromptDecision.PENDING || to == ContactPromptDecision.PENDING) {
            request.setState(ContactRequestState.PENDING);
        } else if (from == ContactPromptDecision.ADDED && to == ContactPromptDecision.ADDED) {
            request.setState(ContactRequestState.ACCEPTED);
        } else {
            request.setState(ContactRequestState.REJECTED);
        }
    }

    private boolean areContacts(Long userId, Long otherUserId) {
        return userContactRepository.existsByUserIdAndContactUserId(userId, otherUserId)
                && userContactRepository.existsByUserIdAndContactUserId(otherUserId, userId);
    }

    private void validatePair(Long fromUserId, Long toUserId) {
        if (fromUserId == null || toUserId == null) {
            throw new IllegalArgumentException("Both user IDs are required");
        }
        if (fromUserId.equals(toUserId)) {
            throw new IllegalArgumentException("Cannot create contact request to self");
        }
    }

    private String displayName(UserDTO user) {
        if (user == null) {
            return "";
        }
        String fullName = ((user.getFirstName() == null ? "" : user.getFirstName().trim()) + " "
                + (user.getLastName() == null ? "" : user.getLastName().trim())).trim();
        if (!fullName.isEmpty()) {
            return fullName;
        }
        return user.getUsername() == null ? "" : user.getUsername().toLowerCase(Locale.ROOT);
    }
}
