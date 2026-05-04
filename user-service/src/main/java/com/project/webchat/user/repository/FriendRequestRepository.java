package com.project.webchat.user.repository;

import com.project.webchat.user.entity.FriendRequest;
import com.project.webchat.shared.dto.ContactRequestState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    //fromUserId - sender, toUserId - receiver, state (PENDING, ACCEPTED, REJECTED)

    //check if user already has a pending request to another user to avoid sending duplicates
    Optional<FriendRequest> findByFromUserIdAndToUserIdAndState(Long fromUserId, Long toUserId,
                                                                ContactRequestState state);

    //all friend requests received by toUserId that have the given state (pending)
    List<FriendRequest> findByToUserIdAndStateOrderByCreatedAtDesc(Long toUserId,
                                                                   ContactRequestState state);

    //get the last known relationship status between users
    Optional<FriendRequest> findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(Long fromUserId,
                                                                                 Long toUserId);

    //the latest request of a particular status (rejected to avoid spamming)
    Optional<FriendRequest> findFirstByFromUserIdAndToUserIdAndStateOrderByCreatedAtDesc(
            Long fromUserId, Long toUserId, ContactRequestState state);

    //check if there is any existing request that is either pending or accepted (example)
    Optional<FriendRequest> findFirstByFromUserIdAndToUserIdAndStateInOrderByCreatedAtDesc(
            Long fromUserId, Long toUserId, List<ContactRequestState> states);

    //prevent user from sending another until the cooldown period ends
    Optional<FriendRequest> findFirstByFromUserIdAndToUserIdAndStateInAndNextEligibleAtAfterOrderByCreatedAtDesc(
            Long fromUserId, Long toUserId, List<ContactRequestState> states, java.time.LocalDateTime threshold);
}
