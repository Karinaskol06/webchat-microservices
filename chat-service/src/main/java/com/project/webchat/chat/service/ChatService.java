package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.AdminMutationRequest;
import com.project.webchat.chat.dto.AttachmentDTO;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.CreateGroupChannelRequest;
import com.project.webchat.chat.dto.CreatePersonalSpaceRequest;
import com.project.webchat.chat.dto.DiscoverableRoomDTO;
import com.project.webchat.chat.dto.InvitePayloadDTO;
import com.project.webchat.chat.dto.MessageReactionDTO;
import com.project.webchat.chat.dto.MessageWithAttachmentsDTO;
import com.project.webchat.chat.dto.RoomMemberInviteDTO;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.dto.UpdateRoomProfileRequest;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.service.message.ChatMessageCommandService;
import com.project.webchat.chat.service.message.MessageReactionService;
import com.project.webchat.chat.service.room.ChatRoomCreationService;
import com.project.webchat.chat.service.room.ChatRoomDiscoveryService;
import com.project.webchat.chat.service.room.ChatRoomInviteService;
import com.project.webchat.chat.service.room.ChatRoomLifecycleService;
import com.project.webchat.chat.service.room.ChatRoomModerationService;
import com.project.webchat.chat.service.room.ChatRoomProfileService;
import com.project.webchat.chat.service.room.ChatRoomQueryService;
import com.project.webchat.chat.service.room.PersonalSpaceService;
import com.project.webchat.chat.service.room.PrivateChatService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.shared.dto.UserInfoDTO;
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
    private final ChatRoomInviteService chatRoomInviteService;
    private final ChatRoomModerationService chatRoomModerationService;
    private final ChatRoomProfileService chatRoomProfileService;
    private final ChatRoomQueryService chatRoomQueryService;
    private final ChatRoomCreationService chatRoomCreationService;
    private final ChatRoomDiscoveryService chatRoomDiscoveryService;
    private final ChatRoomLifecycleService chatRoomLifecycleService;
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final PersonalSpaceService personalSpaceService;

    /** Returns the user's default personal space, creating one if none exists. */
    @Transactional
    public ChatRoomDTO getOrCreatePersonalSpace(Long userId) {
        return personalSpaceService.getOrCreatePersonalSpace(userId);
    }

    /** Lists all personal spaces owned by the user. */
    public List<ChatRoomDTO> listPersonalSpaces(Long userId) {
        return personalSpaceService.listPersonalSpaces(userId);
    }

    /** Creates a new named personal space for the user. */
    @Transactional
    public ChatRoomDTO createPersonalSpace(Long userId, CreatePersonalSpaceRequest request) {
        return personalSpaceService.createPersonalSpace(userId, request);
    }

    /** Sends a typed rich message (poll, to-do); delivery handles push/WS fan-out. */
    @Transactional
    public ChatMessageDTO sendRichMessage(Long senderId, String chatId, MessageType type,
                                          String content, String replyToMessageId) {
        return chatMessageCommandService.sendRichMessage(senderId, chatId, type, content, replyToMessageId);
    }

    /** Opens or creates a private chat between two users. */
    @Transactional
    public ChatRoomDTO createChat(Long userId1, Long userId2) {
        return privateChatService.createChat(userId1, userId2);
    }

    /** Sends a text or simple message to a chat. */
    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, SendMessageRequest sendMessageRequest) {
        return chatMessageCommandService.sendMessage(senderId, sendMessageRequest);
    }

    /** Forwards an existing message into another chat. */
    @Transactional
    public ChatMessageDTO forwardMessage(Long senderId, String targetChatId, String forwardSourceMessageId) {
        return chatMessageCommandService.forwardMessage(senderId, targetChatId, forwardSourceMessageId);
    }

    /** Sends a message with optional text and one or more attachments. */
    @Transactional
    public MessageWithAttachmentsDTO sendMixedMessage(Long senderId, String chatId,
                                                      String content, List<String> attachmentIds,
                                                      MessageType type, String replyToMessageId) {
        return chatMessageCommandService.sendMixedMessage(
                senderId, chatId, content, attachmentIds, type, replyToMessageId);
    }

    /** Sends attachments only (no text body). */
    @Transactional
    public MessageWithAttachmentsDTO sendAttachmentsOnlyMessage(Long senderId, String chatId,
                                                                List<String> attachmentIds,
                                                                MessageType type,
                                                                String replyToMessageId) {
        return chatMessageCommandService.sendAttachmentsOnlyMessage(
                senderId, chatId, attachmentIds, type, replyToMessageId);
    }

    /** Returns the user's chat sidebar, sorted by last activity (excludes hidden/banned). */
    public Page<ChatRoomDTO> getAllUserChatsSorted(Long userId, Pageable pageable) {
        return chatRoomQueryService.getAllUserChatsSorted(userId, pageable);
    }

    /** Returns paginated message history for a chat the user is a member of. */
    public Page<ChatMessageDTO> getMessageHistory(String chatId, Long currentUserId, Pageable pageable) {
        return chatMessageCommandService.getMessageHistory(chatId, currentUserId, pageable);
    }

    /** Marks all messages in the chat as read for the given user. */
    @Transactional
    public void markMessagesAsRead(String chatId, Long senderId) {
        chatMessageCommandService.markMessagesAsRead(chatId, senderId);
    }

    /** Soft-deletes a message when the actor has permission. */
    @Transactional
    public void deleteMessage(String messageId, Long actorId) {
        chatMessageCommandService.deleteMessage(messageId, actorId);
    }

    /** Edits message content when the actor has permission. */
    @Transactional
    public ChatMessageDTO editMessage(String messageId, Long actorId, String newContent) {
        return chatMessageCommandService.editMessage(messageId, actorId, newContent);
    }

    /** Casts or updates the user's vote on a poll message. */
    @Transactional
    public ChatMessageDTO castPollVote(String messageId, Long userId, List<String> optionIds) {
        return chatMessageCommandService.castPollVote(messageId, userId, optionIds);
    }

    /** Adds or removes an emoji reaction on a message; returns the updated reaction list. */
    @Transactional
    public List<MessageReactionDTO> toggleMessageReaction(String chatId, String messageId, Long userId, String emojiRaw) {
        return messageReactionService.toggleMessageReaction(chatId, messageId, userId, emojiRaw);
    }

    /** Removes the user from a group or channel (with owner succession when applicable). */
    @Transactional
    public void leaveChat(String chatId, Long userId) {
        chatRoomLifecycleService.leaveChat(chatId, userId);
    }

    /** Permanently deletes a room when the actor has admin/owner permission. */
    @Transactional
    public void deleteRoom(String roomId, Long userId) {
        chatRoomLifecycleService.deleteRoom(roomId, userId);
    }

    /** Hides a private chat for the user, or leaves a group/channel. */
    @Transactional
    public void deleteChatForMe(String chatId, Long userId) {
        chatRoomLifecycleService.deleteChatForMe(chatId, userId);
    }

    /** Deletes the room for everyone (private purge or admin delete for groups/channels). */
    @Transactional
    public void deleteChatForEveryone(String chatId, Long userId) {
        chatRoomLifecycleService.deleteChatForEveryone(chatId, userId);
    }

    /** Creates a new group room with the given members and visibility. */
    @Transactional
    public ChatRoomDTO createGroupRoom(Long creatorId, CreateGroupChannelRequest request) {
        return chatRoomCreationService.createGroupRoom(creatorId, request);
    }

    /** Creates a new channel room with the given members and visibility. */
    @Transactional
    public ChatRoomDTO createChannelRoom(Long creatorId, CreateGroupChannelRequest request) {
        return chatRoomCreationService.createChannelRoom(creatorId, request);
    }

    /** Searches public groups and channels the user can join. */
    public Page<DiscoverableRoomDTO> discoverPublicRooms(Long currentUserId, String q, Pageable pageable) {
        return chatRoomDiscoveryService.discoverPublicRooms(currentUserId, q, pageable);
    }

    /** Searches groups and channels the user is already a member of. */
    public Page<DiscoverableRoomDTO> searchMyGroupChannels(Long currentUserId, String q, Pageable pageable) {
        return chatRoomDiscoveryService.searchMyGroupChannels(currentUserId, q, pageable);
    }

    /** Returns room details for a member; reveals the chat if hidden for this user. */
    public ChatRoomDTO getRoomForMember(String roomId, Long userId) {
        return chatRoomQueryService.getRoomForMember(roomId, userId);
    }

    /** Returns participant profiles for a room the user belongs to. */
    public List<UserInfoDTO> getRoomParticipantsForMember(String roomId, Long userId) {
        return chatRoomQueryService.getRoomParticipantsForMember(roomId, userId);
    }

    /** Joins a public group or channel from discovery. */
    @Transactional
    public ChatRoomDTO joinPublicRoom(String roomId, Long userId) {
        return chatRoomDiscoveryService.joinPublicRoom(roomId, userId);
    }

    /** Joins a private group or channel using an invite link token. */
    @Transactional
    public ChatRoomDTO joinByInvite(Long userId, String rawToken) {
        return chatRoomDiscoveryService.joinByInvite(userId, rawToken);
    }

    /** Rotates the invite link token for a private room (admin/moderator only). */
    @Transactional
    public InvitePayloadDTO regenerateInvite(String roomId, Long userId) {
        return chatRoomInviteService.regenerateInvite(roomId, userId);
    }

    /** Returns the current invite link token for a private room (admin/moderator only). */
    public InvitePayloadDTO getInvitePayload(String roomId, Long userId) {
        return chatRoomInviteService.getInvitePayload(roomId, userId);
    }

    /** Promotes/demotes group admins or channel moderators/posters. */
    @Transactional
    public ChatRoomDTO mutateGroupAdmins(String roomId, Long actorId, AdminMutationRequest request) {
        return chatRoomModerationService.mutateGroupAdmins(roomId, actorId, request);
    }

    /** Adds a user to a group or channel directly (admin/moderator only). */
    @Transactional
    public ChatRoomDTO addRoomMember(String roomId, Long actorId, Long newMemberId) {
        return chatRoomInviteService.addRoomMember(roomId, actorId, newMemberId);
    }

    /** Updates the room cover photo. */
    @Transactional
    public ChatRoomDTO updateRoomPhoto(String roomId, Long actorId, String groupPhotoRaw) {
        return chatRoomProfileService.updateRoomPhoto(roomId, actorId, groupPhotoRaw);
    }

    /** Updates room name, description, photo, and/or visibility. */
    @Transactional
    public ChatRoomDTO updateRoomProfile(String roomId, Long actorId, UpdateRoomProfileRequest request) {
        return chatRoomProfileService.updateRoomProfile(roomId, actorId, request);
    }

    /** Lists pending username-based invites addressed to the user. */
    public List<RoomMemberInviteDTO> listPendingRoomMemberInvites(Long inviteeUserId) {
        return chatRoomInviteService.listPendingRoomMemberInvites(inviteeUserId);
    }

    /** Invites a user to the room by username (admin/moderator only). */
    @Transactional
    public RoomMemberInviteDTO inviteRoomMemberByUsername(String roomId, Long actorId, String rawUsername) {
        return chatRoomInviteService.inviteRoomMemberByUsername(roomId, actorId, rawUsername);
    }

    /** Accepts a pending room member invite and joins the room. */
    @Transactional
    public ChatRoomDTO acceptRoomMemberInvite(String inviteId, Long inviteeId) {
        return chatRoomInviteService.acceptRoomMemberInvite(inviteId, inviteeId);
    }

    /** Declines a pending room member invite. */
    @Transactional
    public void declineRoomMemberInvite(String inviteId, Long inviteeId) {
        chatRoomInviteService.declineRoomMemberInvite(inviteId, inviteeId);
    }

    /** Bans a member from the room (moderator only); removes them if present. */
    @Transactional
    public ChatRoomDTO banRoomMember(String roomId, Long actorId, Long targetUserId) {
        return chatRoomModerationService.banRoomMember(roomId, actorId, targetUserId);
    }

    /** Lifts a room ban for a user (moderator only). */
    @Transactional
    public ChatRoomDTO unbanRoomMember(String roomId, Long actorId, Long targetUserId) {
        return chatRoomModerationService.unbanRoomMember(roomId, actorId, targetUserId);
    }

    /** Lists users banned from the room (moderator only). */
    public List<UserInfoDTO> listBannedRoomMembers(String roomId, Long actorId) {
        return chatRoomModerationService.listBannedRoomMembers(roomId, actorId);
    }

    /** Returns whether the user is a member of the chat. */
    public boolean isUserChatMember(String chatId, Long userId) {
        return chatMessageCommandService.isUserChatMember(chatId, userId);
    }

    /** Lists attachments shared in the room (for the shared-media panel). */
    public List<AttachmentDTO> listChatAttachmentsForRoom(String chatId) {
        return chatMessageCommandService.listChatAttachmentsForRoom(chatId);
    }

    /** Returns unread message count for the user in the given chat. */
    public int getUnreadCount(String chatId, Long currentUserId) {
        return roomEnrichmentService.getUnreadCount(chatId, currentUserId);
    }
}
