package com.project.webchat.chat.service.room;



import com.project.webchat.chat.dto.ChatRoomDTO;

import com.project.webchat.chat.entity.ChatRoom;

import com.project.webchat.chat.entity.ChatType;

import com.project.webchat.chat.repository.ChatRoomRepository;

import com.project.webchat.chat.service.WebSocketService;

import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;

import com.project.webchat.chat.service.support.UserBanGuardService;

import com.project.webchat.chat.service.user.ChatUserInfoService;

import com.project.webchat.shared.dto.UserInfoDTO;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;



import java.time.LocalDateTime;

import java.util.List;

import java.util.Optional;

import java.util.Set;



@Service

@RequiredArgsConstructor

public class PrivateChatService {



    private final ChatRoomRepository chatRoomRepository;

    private final WebSocketService webSocketService;

    private final ChatRoomEnrichmentService roomEnrichmentService;

    private final UserBanGuardService userBanGuardService;

    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomManagementService chatRoomManagementService;



    @Transactional

    public ChatRoomDTO createChat(Long userId1, Long userId2) {

        UserInfoDTO otherUser = chatUserInfoService.getUserInfo(userId2);

        userBanGuardService.assertPrivateChatAccessible(
                ChatRoom.builder().type(ChatType.PRIVATE).memberIds(Set.of(userId1, userId2)).build(),
                userId1,
                otherUser);



        PrivateChatLookup lookup = findOrCreatePrivateChat(userId1, userId2);

        ChatRoom chatRoom = lookup.chatRoom();

        if (!lookup.createdNew()) {
            int unreadCount = roomEnrichmentService.getUnreadCount(chatRoom.getId(), userId1);
            notifyPrivateChatMembers(chatRoom, userId1, userId2, unreadCount);
            return roomEnrichmentService.enrichChatWithUserData(chatRoom, userId1, unreadCount);
        }

        notifyPrivateChatMembers(chatRoom, userId1, userId2, 0);
        return roomEnrichmentService.enrichChatWithUserData(chatRoom, userId1, 0);
    }

    private void notifyPrivateChatMembers(ChatRoom chatRoom, Long userId1, Long userId2, int unreadForUser1) {
        int unreadForUser2 = roomEnrichmentService.getUnreadCount(chatRoom.getId(), userId2);
        webSocketService.notifyChatCreated(userId1,
                roomEnrichmentService.enrichChatWithUserData(chatRoom, userId1, unreadForUser1));
        webSocketService.notifyChatCreated(userId2,
                roomEnrichmentService.enrichChatWithUserData(chatRoom, userId2, unreadForUser2));

    }



    public PrivateChatLookup findOrCreatePrivateChat(Long userId1, Long userId2) {

        Optional<ChatRoom> existsAlready = chatRoomRepository

                .findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(userId1, userId2));

        if (existsAlready.isPresent()) {

            ChatRoom existing = existsAlready.get();
            chatRoomManagementService.revealChatForMember(existing.getId(), userId1);
            return new PrivateChatLookup(chatRoomRepository.findById(existing.getId()).orElse(existing), false);

        }



        ChatRoom entity = ChatRoom.builder()

                .type(ChatType.PRIVATE)

                .memberIds(Set.of(userId1, userId2))

                .lastActivity(LocalDateTime.now())

                .createdAt(LocalDateTime.now())

                .lastMessage("Chat was created!")

                .build();

        return new PrivateChatLookup(chatRoomRepository.save(entity), true);

    }



    public record PrivateChatLookup(ChatRoom chatRoom, boolean createdNew) {}

}


