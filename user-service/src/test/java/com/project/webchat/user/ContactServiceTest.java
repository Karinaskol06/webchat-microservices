package com.project.webchat.user;

import com.project.webchat.shared.dto.ContactRequestState;
import com.project.webchat.shared.dto.ContactStatusDTO;
import com.project.webchat.user.entity.FriendRequest;
import com.project.webchat.user.entity.UserContact;
import com.project.webchat.user.repository.FriendRequestRepository;
import com.project.webchat.user.repository.UserContactRepository;
import com.project.webchat.user.service.ContactService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContactServiceTest {

    @Mock
    private FriendRequestRepository friendRequestRepository;

    @Mock
    private UserContactRepository userContactRepository;

    @InjectMocks
    private ContactService contactService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(contactService, "snoozeDays", 7L);
    }

    @Test
    void createPendingRequestReturnsExistingPending() {
        FriendRequest existing = FriendRequest.builder()
                .id(10L)
                .fromUserId(1L)
                .toUserId(2L)
                .state(ContactRequestState.PENDING)
                .build();

        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);
        when(friendRequestRepository.findByFromUserIdAndToUserIdAndState(1L, 2L, ContactRequestState.PENDING))
                .thenReturn(Optional.of(existing));

        FriendRequest result = contactService.createPendingRequestIfEligible(1L, 2L);

        assertThat(result.getId()).isEqualTo(10L);
        verify(friendRequestRepository, never()).save(any(FriendRequest.class));
    }

    @Test
    void createPendingRequestSkipsWhenSnoozedWindowActive() {
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);
        when(friendRequestRepository.findByFromUserIdAndToUserIdAndState(1L, 2L, ContactRequestState.PENDING))
                .thenReturn(Optional.empty());
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdAndStateInAndNextEligibleAtAfterOrderByCreatedAtDesc(
                any(), any(), any(), any()))
                .thenReturn(Optional.of(FriendRequest.builder().id(22L).state(ContactRequestState.SNOOZED).build()));

        FriendRequest result = contactService.createPendingRequestIfEligible(1L, 2L);

        assertThat(result).isNull();
        verify(friendRequestRepository, never()).save(any(FriendRequest.class));
    }

    @Test
    void acceptRequestCreatesBidirectionalContacts() {
        FriendRequest pending = FriendRequest.builder()
                .id(7L)
                .fromUserId(1L)
                .toUserId(2L)
                .state(ContactRequestState.PENDING)
                .build();

        when(friendRequestRepository.findById(7L)).thenReturn(Optional.of(pending));
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);
        when(userContactRepository.existsByUserIdAndContactUserId(2L, 1L)).thenReturn(false);

        ContactStatusDTO status = contactService.acceptRequest(7L, 2L);

        assertThat(status.getState()).isEqualTo(ContactRequestState.ACCEPTED);
        verify(userContactRepository).save(UserContact.builder().userId(1L).contactUserId(2L).build());
        verify(userContactRepository).save(UserContact.builder().userId(2L).contactUserId(1L).build());
    }

    @Test
    void getContactStatusReturnsPendingPromptForIncomingRequest() {
        when(userContactRepository.existsByUserIdAndContactUserId(2L, 1L)).thenReturn(false);
        FriendRequest pending = FriendRequest.builder()
                .id(31L)
                .fromUserId(1L)
                .toUserId(2L)
                .state(ContactRequestState.PENDING)
                .nextEligibleAt(LocalDateTime.now())
                .build();
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdAndStateOrderByCreatedAtDesc(1L, 2L, ContactRequestState.PENDING))
                .thenReturn(Optional.of(pending));

        ContactStatusDTO status = contactService.getContactStatus(2L, 1L);

        assertThat(status.getState()).isEqualTo(ContactRequestState.PENDING);
        assertThat(status.getPrompt()).isNotNull();
        assertThat(status.getPrompt().getRequestId()).isEqualTo(31L);
    }
}
