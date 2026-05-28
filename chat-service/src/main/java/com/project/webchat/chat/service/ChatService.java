package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.AdminMutationRequest;
import com.project.webchat.chat.dto.AttachmentDTO;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.CreateGroupChannelRequest;
import com.project.webchat.chat.dto.DiscoverableRoomDTO;
import com.project.webchat.chat.dto.InvitePayloadDTO;
import com.project.webchat.chat.dto.MessageReactionDTO;
import com.project.webchat.chat.dto.MessageWithAttachmentsDTO;
import com.project.webchat.chat.dto.RoomMemberInviteDTO;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.service.message.ChatMessageCommandService;
import com.project.webchat.chat.service.message.MessageReactionService;
import com.project.webchat.chat.service.room.ChatRoomManagementService;
import com.project.webchat.chat.service.room.PersonalSpaceService;
import com.project.webchat.chat.service.room.PrivateChatService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Facade for chat operations. Delegates to focused services by domain area.
 */
@Service
@RequiredArgsConstructor
public class ChatService {

    private final PrivateChatService privateChatService;
    private final ChatMessageCommandService chatMessageCommandService;
    private final MessageReactionService messageReactionService;
    private final ChatRoomManagementService chatRoomManagementService;
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final PersonalSpaceService personalSpaceService;

    @Transactional
    public ChatRoomDTO getOrCreatePersonalSpace(Long userId) {
        return personalSpaceService.getOrCreatePersonalSpace(userId);
    }

    @Transactional
    public ChatMessageDTO sendRichMessage(Long senderId, String chatId, MessageType type,
                                          String content, String replyToMessageId) {
        return chatMessageCommandService.sendRichMessage(senderId, chatId, type, content, replyToMessageId);
    }

    @Transactional
    public ChatRoomDTO createChat(Long userId1, Long userId2) {
        return privateChatService.createChat(userId1, userId2);
    }

    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, SendMessageRequest sendMessageRequest) {
        return chatMessageCommandService.sendMessage(senderId, sendMessageRequest);
    }

    @Transactional
    public ChatMessageDTO forwardMessage(Long senderId, String targetChatId, String forwardSourceMessageId) {
        return chatMessageCommandService.forwardMessage(senderId, targetChatId, forwardSourceMessageId);
    }

    @Transactional
    public MessageWithAttachmentsDTO sendMixedMessage(Long senderId, String chatId,
                                                      String content, List<String> attachmentIds,
                                                      MessageType type, String replyToMessageId) {
        return chatMessageCommandService.sendMixedMessage(senderId, chatId, content, attachmentIds, type, replyToMessageId);
    }

    @Transactional
    public MessageWithAttachmentsDTO sendAttachmentsOnlyMessage(Long senderId, String chatId,
                                                                List<String> attachmentIds,
                                                                MessageType type,
                                                                String replyToMessageId) {
        return chatMessageCommandService.sendAttachmentsOnlyMessage(senderId, chatId, attachmentIds, type, replyToMessageId);
    }

    public Page<ChatRoomDTO> getAllUserChatsSorted(Long userId, Pageable pageable) {
        return chatRoomManagementService.getAllUserChatsSorted(userId, pageable);
    }

    public Page<ChatMessageDTO> getMessageHistory(String chatId, Long currentUserId, Pageable pageable) {
        return chatMessageCommandService.getMessageHistory(chatId, currentUserId, pageable);
    }

    @Transactional
    public void markMessagesAsRead(String chatId, Long senderId) {
        chatMessageCommandService.markMessagesAsRead(chatId, senderId);
    }

    @Transactional
    public void deleteMessage(String messageId, Long actorId) {
        chatMessageCommandService.deleteMessage(messageId, actorId);
    }

    @Transactional
    public ChatMessageDTO editMessage(String messageId, Long actorId, String newContent) {
        return chatMessageCommandService.editMessage(messageId, actorId, newContent);
    }

    @Transactional
    public List<MessageReactionDTO> toggleMessageReaction(String chatId, String messageId, Long userId, String emojiRaw) {
        return messageReactionService.toggleMessageReaction(chatId, messageId, userId, emojiRaw);
    }

    @Transactional
    public void leaveChat(String chatId, Long userId) {
        chatRoomManagementService.leaveChat(chatId, userId);
    }

    @Transactional
    public void deleteRoom(String roomId, Long userId) {
        chatRoomManagementService.deleteRoom(roomId, userId);
    }

    @Transactional
    public ChatRoomDTO createGroupRoom(Long creatorId, CreateGroupChannelRequest request) {
        return chatRoomManagementService.createGroupRoom(creatorId, request);
    }

    @Transactional
    public ChatRoomDTO createChannelRoom(Long creatorId, CreateGroupChannelRequest request) {
        return chatRoomManagementService.createChannelRoom(creatorId, request);
    }

    public Page<DiscoverableRoomDTO> discoverPublicRooms(Long currentUserId, String q, Pageable pageable) {
        return chatRoomManagementService.discoverPublicRooms(currentUserId, q, pageable);
    }

    public Page<DiscoverableRoomDTO> searchMyGroupChannels(Long currentUserId, String q, Pageable pageable) {
        return chatRoomManagementService.searchMyGroupChannels(currentUserId, q, pageable);
    }

    public ChatRoomDTO getRoomForMember(String roomId, Long userId) {
        return chatRoomManagementService.getRoomForMember(roomId, userId);
    }

    @Transactional
    public ChatRoomDTO joinPublicRoom(String roomId, Long userId) {
        return chatRoomManagementService.joinPublicRoom(roomId, userId);
    }

    @Transactional
    public ChatRoomDTO joinByInvite(Long userId, String rawToken) {
        return chatRoomManagementService.joinByInvite(userId, rawToken);
    }

    @Transactional
    public InvitePayloadDTO regenerateInvite(String roomId, Long userId) {
        return chatRoomManagementService.regenerateInvite(roomId, userId);
    }

    public InvitePayloadDTO getInvitePayload(String roomId, Long userId) {
        return chatRoomManagementService.getInvitePayload(roomId, userId);
    }

    @Transactional
    public ChatRoomDTO mutateGroupAdmins(String roomId, Long actorId, AdminMutationRequest request) {
        return chatRoomManagementService.mutateGroupAdmins(roomId, actorId, request);
    }

    @Transactional
    public ChatRoomDTO addRoomMember(String roomId, Long actorId, Long newMemberId) {
        return chatRoomManagementService.addRoomMember(roomId, actorId, newMemberId);
    }

    @Transactional
    public ChatRoomDTO updateRoomPhoto(String roomId, Long actorId, String groupPhotoRaw) {
        return chatRoomManagementService.updateRoomPhoto(roomId, actorId, groupPhotoRaw);
    }

    @Transactional
    public ChatRoomDTO updateRoomProfile(String roomId, Long actorId,
                                         com.project.webchat.chat.dto.UpdateRoomProfileRequest request) {
        return chatRoomManagementService.updateRoomProfile(roomId, actorId, request);
    }

    public List<RoomMemberInviteDTO> listPendingRoomMemberInvites(Long inviteeUserId) {
        return chatRoomManagementService.listPendingRoomMemberInvites(inviteeUserId);
    }

    @Transactional
    public RoomMemberInviteDTO inviteRoomMemberByUsername(String roomId, Long actorId, String rawUsername) {
        return chatRoomManagementService.inviteRoomMemberByUsername(roomId, actorId, rawUsername);
    }

    @Transactional
    public ChatRoomDTO acceptRoomMemberInvite(String inviteId, Long inviteeId) {
        return chatRoomManagementService.acceptRoomMemberInvite(inviteId, inviteeId);
    }

    @Transactional
    public void declineRoomMemberInvite(String inviteId, Long inviteeId) {
        chatRoomManagementService.declineRoomMemberInvite(inviteId, inviteeId);
    }

    public boolean isUserChatMember(String chatId, Long userId) {
        return chatMessageCommandService.isUserChatMember(chatId, userId);
    }

    public List<AttachmentDTO> listChatAttachmentsForRoom(String chatId) {
        return chatMessageCommandService.listChatAttachmentsForRoom(chatId);
    }

    public int getUnreadCount(String chatId, Long currentUserId) {
        return roomEnrichmentService.getUnreadCount(chatId, currentUserId);
    }
}
