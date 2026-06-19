package com.project.webchat.chat.service.user;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.shared.dto.ContactRequestCreateDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class PrivateChatContactRequestService {

    private final UserServiceClient userServiceClient;
    private final UserBanGuardService userBanGuardService;

    /**
     * When user A messages user B in a private chat, create a pending contact request
     * from A to B unless they are already contacts or the request is snoozed.
     */
    public void maybeCreateContactRequestForPrivateMessage(ChatRoom room, Long senderId) {
        if (room == null || senderId == null || room.getType() != ChatType.PRIVATE) {
            return;
        }
        Long recipientId = userBanGuardService.getOtherPrivateChatMemberId(room, senderId);
        if (recipientId == null) {
            return;
        }
        try {
            userServiceClient.createContactRequestIfEligible(ContactRequestCreateDTO.builder()
                    .fromUserId(senderId)
                    .toUserId(recipientId)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to create contact request from {} to {}: {}", senderId, recipientId, e.getMessage());
        }
    }
}
