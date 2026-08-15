package com.project.webchat.user;

import com.project.webchat.shared.dto.ContactPromptDecision;
import com.project.webchat.shared.dto.ContactRequestState;
import com.project.webchat.shared.dto.ContactStatusDTO;
import com.project.webchat.user.entity.FriendRequest;
import com.project.webchat.user.entity.UserContact;
import com.project.webchat.user.repository.FriendRequestRepository;
import com.project.webchat.user.repository.UserContactRepository;
import com.project.webchat.user.service.ContactService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Independent per-user contact prompts: one opportunity per pair;
 * each user Add/Dismiss only closes their own prompt.
 */
@ExtendWith(MockitoExtension.class)
class ContactServiceTest {

    @Mock
    private FriendRequestRepository friendRequestRepository;

    @Mock
    private UserContactRepository userContactRepository;

    @InjectMocks
    private ContactService contactService;

    @Test
    void createPendingRequest_createsOnceWithBothDecisionsPending() {
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(1L, 2L))
                .thenReturn(Optional.empty());
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(2L, 1L))
                .thenReturn(Optional.empty());
        when(friendRequestRepository.save(any(FriendRequest.class))).thenAnswer(inv -> {
            FriendRequest fr = inv.getArgument(0);
            fr.setId(10L);
            return fr;
        });

        FriendRequest result = contactService.createPendingRequestIfEligible(1L, 2L);

        ArgumentCaptor<FriendRequest> saved = ArgumentCaptor.forClass(FriendRequest.class);
        verify(friendRequestRepository).save(saved.capture());
        assertThat(saved.getValue().getFromUserDecision()).isEqualTo(ContactPromptDecision.PENDING);
        assertThat(saved.getValue().getToUserDecision()).isEqualTo(ContactPromptDecision.PENDING);
        assertThat(result.getId()).isEqualTo(10L);
    }

    @Test
    void createPendingRequest_skipsWhenPairAlreadyHasOpportunity() {
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(1L, 2L))
                .thenReturn(Optional.of(FriendRequest.builder().id(9L).fromUserId(1L).toUserId(2L).build()));

        FriendRequest result = contactService.createPendingRequestIfEligible(1L, 2L);

        assertThat(result).isNull();
        verify(friendRequestRepository, never()).save(any(FriendRequest.class));
    }

    @Test
    void recipientDismisses_closesOnlyRecipientPrompt_senderStillSeesPending() {
        FriendRequest request = openPrompt(41L, 1L, 2L);
        when(friendRequestRepository.findById(41L)).thenReturn(Optional.of(request));
        when(friendRequestRepository.save(any(FriendRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ContactStatusDTO afterDismiss = contactService.dismissPrompt(41L, 2L);

        assertThat(request.getToUserDecision()).isEqualTo(ContactPromptDecision.DISMISSED);
        assertThat(request.getFromUserDecision()).isEqualTo(ContactPromptDecision.PENDING);
        assertThat(afterDismiss.getState()).isEqualTo(ContactRequestState.NONE);
        verify(userContactRepository, never()).save(any(UserContact.class));

        // status for each side
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);
        when(userContactRepository.existsByUserIdAndContactUserId(2L, 1L)).thenReturn(false);
        stubFindPair(request);

        ContactStatusDTO forSender = contactService.getContactStatus(1L, 2L);
        ContactStatusDTO forRecipient = contactService.getContactStatus(2L, 1L);

        assertThat(forSender.getState()).isEqualTo(ContactRequestState.PENDING);
        assertThat(forSender.getPrompt()).isNotNull();
        assertThat(forRecipient.getState()).isEqualTo(ContactRequestState.NONE);
        assertThat(forRecipient.getPrompt()).isNull();
    }

    @Test
    void eitherUserAdd_createsOneSidedContactAndClosesOnlyTheirPrompt() {
        FriendRequest request = openPrompt(41L, 1L, 2L);
        when(friendRequestRepository.findById(41L)).thenReturn(Optional.of(request));
        when(friendRequestRepository.save(any(FriendRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userContactRepository.existsByUserIdAndContactUserId(2L, 1L)).thenReturn(false);

        ContactStatusDTO afterAdd = contactService.addFromPrompt(41L, 2L);

        assertThat(request.getToUserDecision()).isEqualTo(ContactPromptDecision.ADDED);
        assertThat(request.getFromUserDecision()).isEqualTo(ContactPromptDecision.PENDING);
        assertThat(afterAdd.getState()).isEqualTo(ContactRequestState.NONE);
        verify(userContactRepository).save(UserContact.builder().userId(2L).contactUserId(1L).build());
    }

    @Test
    void senderAddAfterRecipientDismissed_stillAllowsOneSidedContactForSender() {
        FriendRequest request = openPrompt(41L, 1L, 2L);
        request.setToUserDecision(ContactPromptDecision.DISMISSED);
        when(friendRequestRepository.findById(41L)).thenReturn(Optional.of(request));
        when(friendRequestRepository.save(any(FriendRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);

        contactService.addFromPrompt(41L, 1L);

        assertThat(request.getFromUserDecision()).isEqualTo(ContactPromptDecision.ADDED);
        assertThat(request.getToUserDecision()).isEqualTo(ContactPromptDecision.DISMISSED);
        verify(userContactRepository).save(UserContact.builder().userId(1L).contactUserId(2L).build());
    }

    @Test
    void pendingPrompt_visibleToBothUntilEachResolves() {
        FriendRequest request = openPrompt(40L, 1L, 2L);
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(false);
        when(userContactRepository.existsByUserIdAndContactUserId(2L, 1L)).thenReturn(false);
        stubFindPair(request);

        ContactStatusDTO forRecipient = contactService.getContactStatus(2L, 1L);
        ContactStatusDTO forSender = contactService.getContactStatus(1L, 2L);

        assertThat(forRecipient.getState()).isEqualTo(ContactRequestState.PENDING);
        assertThat(forRecipient.getPrompt().getRequestId()).isEqualTo(40L);
        assertThat(forSender.getState()).isEqualTo(ContactRequestState.PENDING);
        assertThat(forSender.getPrompt().getRequestId()).isEqualTo(40L);
    }

    @Test
    void addDirectContact_addsOneSidedAndResolvesPendingPrompt() {
        FriendRequest request = openPrompt(50L, 1L, 2L);
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L))
                .thenReturn(false)  // before insert
                .thenReturn(true);  // getContactStatus after insert
        when(userContactRepository.existsByUserIdAndContactUserId(2L, 1L)).thenReturn(false);
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(1L, 2L))
                .thenReturn(Optional.of(request));
        when(friendRequestRepository.save(any(FriendRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        ContactStatusDTO result = contactService.addDirectContact(1L, 2L);

        verify(userContactRepository).save(UserContact.builder().userId(1L).contactUserId(2L).build());
        assertThat(request.getFromUserDecision()).isEqualTo(ContactPromptDecision.ADDED);
        assertThat(request.getToUserDecision()).isEqualTo(ContactPromptDecision.PENDING);
        assertThat(result.getOnMyList()).isTrue();
        assertThat(result.getPrompt()).isNull();
    }

    @Test
    void addDirectContact_whenAlreadyOnList_isIdempotent() {
        when(userContactRepository.existsByUserIdAndContactUserId(1L, 2L)).thenReturn(true);
        when(userContactRepository.existsByUserIdAndContactUserId(2L, 1L)).thenReturn(false);
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(1L, 2L))
                .thenReturn(Optional.empty());
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(2L, 1L))
                .thenReturn(Optional.empty());

        ContactStatusDTO result = contactService.addDirectContact(1L, 2L);

        verify(userContactRepository, never()).save(any(UserContact.class));
        assertThat(result.getOnMyList()).isTrue();
    }

    private static FriendRequest openPrompt(Long id, Long from, Long to) {
        return FriendRequest.builder()
                .id(id)
                .fromUserId(from)
                .toUserId(to)
                .state(ContactRequestState.PENDING)
                .fromUserDecision(ContactPromptDecision.PENDING)
                .toUserDecision(ContactPromptDecision.PENDING)
                .build();
    }

    private void stubFindPair(FriendRequest request) {
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(
                request.getFromUserId(), request.getToUserId())).thenReturn(Optional.of(request));
        when(friendRequestRepository.findFirstByFromUserIdAndToUserIdOrderByCreatedAtDesc(
                request.getToUserId(), request.getFromUserId())).thenReturn(Optional.empty());
    }
}
