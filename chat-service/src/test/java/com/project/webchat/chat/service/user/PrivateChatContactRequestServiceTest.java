package com.project.webchat.chat.service.user;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.shared.dto.ContactRequestCreateDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Contact request is created only on the first message in a private chat,
 * not on every subsequent send.
 */
@ExtendWith(MockitoExtension.class)
class PrivateChatContactRequestServiceTest {

    private static final Long USER1 = 1L;
    private static final Long USER2 = 2L;

    @Mock private UserServiceClient userServiceClient;
    @Mock private UserBanGuardService userBanGuardService;

    @InjectMocks
    private PrivateChatContactRequestService service;

    @Test
    void firstPrivateMessage_createsContactRequestFromSenderToRecipient() {
        ChatRoom privateChat = privateRoom("dm-1", USER1, USER2);
        when(userBanGuardService.getOtherPrivateChatMemberId(privateChat, USER1)).thenReturn(USER2);

        service.maybeCreateContactRequestForPrivateMessage(privateChat, USER1, 1L);

        ArgumentCaptor<ContactRequestCreateDTO> captor = ArgumentCaptor.forClass(ContactRequestCreateDTO.class);
        verify(userServiceClient).createContactRequestIfEligible(captor.capture());
        assertThat(captor.getValue().getFromUserId()).isEqualTo(USER1);
        assertThat(captor.getValue().getToUserId()).isEqualTo(USER2);
    }

    @Test
    void secondPrivateMessage_doesNotCreateContactRequest() {
        ChatRoom privateChat = privateRoom("dm-1", USER1, USER2);

        service.maybeCreateContactRequestForPrivateMessage(privateChat, USER1, 2L);

        verify(userServiceClient, never()).createContactRequestIfEligible(any());
        verify(userBanGuardService, never()).getOtherPrivateChatMemberId(any(), any());
    }

    @Test
    void firstGroupMessage_doesNotCreateContactRequest() {
        ChatRoom group = ChatRoom.builder()
                .id("g-1")
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(Set.of(USER1, USER2)))
                .build();

        service.maybeCreateContactRequestForPrivateMessage(group, USER1, 1L);

        verify(userServiceClient, never()).createContactRequestIfEligible(any());
    }

    private static ChatRoom privateRoom(String id, Long a, Long b) {
        return ChatRoom.builder()
                .id(id)
                .type(ChatType.PRIVATE)
                .memberIds(new HashSet<>(Set.of(a, b)))
                .build();
    }
}
