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

            ChatRoomDTO dto = roomEnrichmentService.enrichChatWithUserData(chatRoom, userId1, unreadCount);

            webSocketService.notifyChatCreated(userId2, dto);

            webSocketService.notifyChatCreated(userId1, dto);

            return dto;

        }



        ChatRoomDTO dto = roomEnrichmentService.enrichChatWithUserData(chatRoom, userId1, 0);

        webSocketService.notifyChatCreated(userId1, dto);

        webSocketService.notifyChatCreated(userId2, dto);

        return dto;

    }



    public PrivateChatLookup findOrCreatePrivateChat(Long userId1, Long userId2) {

        Optional<ChatRoom> existsAlready = chatRoomRepository

                .findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(userId1, userId2));

        if (existsAlready.isPresent()) {

            return new PrivateChatLookup(existsAlready.get(), false);

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


