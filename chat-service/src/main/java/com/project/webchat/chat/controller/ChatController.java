package com.project.webchat.chat.controller;

import com.project.webchat.chat.dto.AddRoomMemberRequest;
import com.project.webchat.chat.dto.AdminMutationRequest;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.CreateChatRequest;
import com.project.webchat.chat.dto.CreateGroupChannelRequest;
import com.project.webchat.chat.dto.CreatePersonalSpaceRequest;
import com.project.webchat.chat.dto.DiscoverableRoomDTO;
import com.project.webchat.chat.dto.EditMessageRequest;
import com.project.webchat.chat.dto.MessageReactionDTO;
import com.project.webchat.chat.dto.ToggleReactionRequest;
import com.project.webchat.chat.dto.InvitePayloadDTO;
import com.project.webchat.chat.dto.InviteMemberByUsernameRequest;
import com.project.webchat.chat.dto.PollVoteRequest;
import com.project.webchat.chat.dto.JoinInviteRequest;
import com.project.webchat.chat.dto.RoomMemberInviteDTO;
import com.project.webchat.chat.dto.SendRichMessageRequest;
import com.project.webchat.chat.dto.UpdateRoomPhotoRequest;
import com.project.webchat.chat.dto.UpdateRoomProfileRequest;
import com.project.webchat.chat.security.CustomUserDetails;
import com.project.webchat.chat.service.ChatService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
@RequestMapping("/api/chat")
@Validated
public class ChatController {

    private final ChatService chatService;
    private final WebSocketService webSocketService;

    //create a private chat between users
    @PostMapping("/create")
    public ResponseEntity<ChatRoomDTO> create(
            @RequestBody CreateChatRequest createChatRequest,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("Creating a private chat between users {} and {}",
                currentUser.getId(), createChatRequest.getOtherUserId());

        ChatRoomDTO chat = chatService.createChat(
                currentUser.getId(), createChatRequest.getOtherUserId());

        webSocketService.notifyChatCreated(currentUser.getId(), chat);

        return ResponseEntity.status(HttpStatus.CREATED).body(chat);
    }

  @GetMapping("/personal-space")
    public ResponseEntity<ChatRoomDTO> getPersonalSpace(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(chatService.getOrCreatePersonalSpace(currentUser.getId()));
    }

    @GetMapping("/personal-spaces")
    public ResponseEntity<List<ChatRoomDTO>> listPersonalSpaces(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(chatService.listPersonalSpaces(currentUser.getId()));
    }

    @PostMapping("/personal-spaces")
    public ResponseEntity<ChatRoomDTO> createPersonalSpace(
            @RequestBody @jakarta.validation.Valid CreatePersonalSpaceRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        ChatRoomDTO created = chatService.createPersonalSpace(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{chatId}/rich-messages")
    public ResponseEntity<ChatMessageDTO> sendRichMessage(
            @PathVariable String chatId,
            @RequestBody @jakarta.validation.Valid SendRichMessageRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        if (!chatService.isUserChatMember(chatId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        ChatMessageDTO dto = chatService.sendRichMessage(
                currentUser.getId(),
                chatId,
                request.getType(),
                request.getContent(),
                request.getReplyToMessageId());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    //get all chats for the authenticated user
    @GetMapping
    public ResponseEntity<Page<ChatRoomDTO>> getAllUserChats(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PageableDefault(size = 20, sort = "lastActivity", direction = Sort.Direction.DESC)
            Pageable pageable) {

        log.info("Fetching chats for user {}", userDetails.getId());
        Page<ChatRoomDTO> chats = chatService.getAllUserChatsSorted(
                userDetails.getId(), pageable);

        return ResponseEntity.ok(chats);
    }

    //get message history for a chat
    @GetMapping("/{chatId}/messages")
    public ResponseEntity<Page<ChatMessageDTO>> getAllMessages(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            // return newest messages by default (page 0 = latest)
            @PageableDefault(size = 50, sort = "timestamp", direction = Sort.Direction.DESC)
            Pageable pageable) {

        log.info("Fetching chat message for user {} from {}", currentUser.getId(), chatId);

        if (!chatService.isUserChatMember(chatId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Page<ChatMessageDTO> messages = chatService.getMessageHistory(chatId, currentUser.getId(), pageable);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/{chatId}/typing")
    public ResponseEntity<Void> typing(
            @PathVariable String chatId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal CustomUserDetails userTyping) {
        log.debug("User {} is typing in chat {}", userTyping.getId(), chatId);

        boolean isTyping = true;
        if (body != null && body.containsKey("typing")) {
            Object raw = body.get("typing");
            if (raw instanceof Boolean b) {
                isTyping = b;
            } else if (raw instanceof String s) {
                isTyping = Boolean.parseBoolean(s);
            }
        }
        webSocketService.sendTypingMessage(chatId, userTyping.getId(), isTyping);

        return ResponseEntity.ok().build();
    }

    //mark messages as read in a chat
    @PostMapping("/{chatId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is marking a read in a chat {}", currentUser.getId(), chatId);
        chatService.markMessagesAsRead(chatId, currentUser.getId());

        return ResponseEntity.ok().build();
    }

    //get unread count for a specific chat
    @GetMapping("/{chatId}/unread-count")
    public ResponseEntity<Map<String, Integer>> getUnreadCount(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        int unreadCount = chatService.getUnreadCount(chatId, currentUser.getId());

        return ResponseEntity.ok(Map.of("unreadCount", unreadCount));
    }

    //delete a message
    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable String messageId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is deleting message {}", currentUser.getId(), messageId);
        chatService.deleteMessage(messageId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/messages/{messageId}")
    public ResponseEntity<ChatMessageDTO> editMessage(
            @PathVariable String messageId,
            @RequestBody @jakarta.validation.Valid EditMessageRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is editing message {}", currentUser.getId(), messageId);
        ChatMessageDTO updatedMessage = chatService.editMessage(messageId, currentUser.getId(), request.getContent());
        return ResponseEntity.ok(updatedMessage);
    }

    @PostMapping("/messages/{messageId}/poll-vote")
    public ResponseEntity<ChatMessageDTO> castPollVote(
            @PathVariable String messageId,
            @RequestBody @jakarta.validation.Valid PollVoteRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.debug("User {} voting on poll message {}", currentUser.getId(), messageId);
        ChatMessageDTO updated = chatService.castPollVote(
                messageId, currentUser.getId(), request.getOptionIds());
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{chatId}/messages/{messageId}/reactions")
    public ResponseEntity<List<MessageReactionDTO>> toggleMessageReaction(
            @PathVariable String chatId,
            @PathVariable String messageId,
            @RequestBody @jakarta.validation.Valid ToggleReactionRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        if (currentUser == null || currentUser.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (!chatService.isUserChatMember(chatId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        log.debug("User {} toggling reaction on message {} in chat {}", currentUser.getId(), messageId, chatId);
        List<MessageReactionDTO> reactions = chatService.toggleMessageReaction(
                chatId, messageId, currentUser.getId(), request.getEmoji());
        return ResponseEntity.ok(reactions);
    }

    //leave a chat
    @PostMapping("/{chatId}/leave")
    public ResponseEntity<Void> leaveChat(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is leaving chat {}", currentUser.getId(), chatId);
        chatService.leaveChat(chatId, currentUser.getId());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/rooms/{id}")
    public ResponseEntity<Void> deleteRoom(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        log.info("User {} is deleting room {}", currentUser.getId(), id);
        chatService.deleteRoom(id, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/rooms/group")
    public ResponseEntity<ChatRoomDTO> createGroupRoom(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid CreateGroupChannelRequest request) {
        ChatRoomDTO dto = chatService.createGroupRoom(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping("/rooms/channel")
    public ResponseEntity<ChatRoomDTO> createChannelRoom(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid CreateGroupChannelRequest request) {
        ChatRoomDTO dto = chatService.createChannelRoom(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    /**
     * Returns a single group/channel/private room for the current user (member-only).
     */
    @GetMapping("/rooms/{id}")
    public ResponseEntity<ChatRoomDTO> getRoomForMember(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        ChatRoomDTO dto = chatService.getRoomForMember(id, currentUser.getId());
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/rooms/{id}/participants")
    public ResponseEntity<List<UserInfoDTO>> getRoomParticipantsForMember(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        List<UserInfoDTO> participants = chatService.getRoomParticipantsForMember(id, currentUser.getId());
        return ResponseEntity.ok(participants);
    }

    /**
     * Search group chats and channels the user already belongs to, by name.
     */
    @GetMapping("/my-rooms")
    public ResponseEntity<Page<DiscoverableRoomDTO>> searchMyGroupChannels(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "lastActivity", direction = Sort.Direction.DESC)
            Pageable pageable) {
        Page<DiscoverableRoomDTO> page = chatService.searchMyGroupChannels(currentUser.getId(), q, pageable);
        return ResponseEntity.ok(page);
    }

    @GetMapping("/discover")
    public ResponseEntity<Page<DiscoverableRoomDTO>> discoverRooms(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "lastActivity", direction = Sort.Direction.DESC)
            Pageable pageable) {
        Page<DiscoverableRoomDTO> page = chatService.discoverPublicRooms(currentUser.getId(), q, pageable);
        return ResponseEntity.ok(page);
    }

    @PostMapping("/rooms/{id}/join")
    public ResponseEntity<ChatRoomDTO> joinPublicRoom(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        ChatRoomDTO dto = chatService.joinPublicRoom(id, currentUser.getId());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/join-invite")
    public ResponseEntity<ChatRoomDTO> joinByInvite(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid JoinInviteRequest request) {
        ChatRoomDTO dto = chatService.joinByInvite(currentUser.getId(), request.getToken());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/rooms/{id}/invite/regenerate")
    public ResponseEntity<InvitePayloadDTO> regenerateInvite(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        InvitePayloadDTO payload = chatService.regenerateInvite(id, currentUser.getId());
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/rooms/{id}/invite")
    public ResponseEntity<InvitePayloadDTO> getInvite(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        InvitePayloadDTO payload = chatService.getInvitePayload(id, currentUser.getId());
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/rooms/{id}/admins")
    public ResponseEntity<ChatRoomDTO> mutateGroupAdmins(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid AdminMutationRequest request) {
        ChatRoomDTO dto = chatService.mutateGroupAdmins(id, currentUser.getId(), request);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/rooms/{id}/members")
    public ResponseEntity<ChatRoomDTO> addRoomMember(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid AddRoomMemberRequest request) {
        ChatRoomDTO dto = chatService.addRoomMember(id, currentUser.getId(), request.getUserId());
        return ResponseEntity.ok(dto);
    }

    @PatchMapping("/rooms/{id}/photo")
    public ResponseEntity<ChatRoomDTO> updateRoomPhoto(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid UpdateRoomPhotoRequest request) {
        ChatRoomDTO dto = chatService.updateRoomPhoto(id, currentUser.getId(), request.getGroupPhoto());
        return ResponseEntity.ok(dto);
    }

    @PatchMapping("/rooms/{id}")
    public ResponseEntity<ChatRoomDTO> updateRoomProfile(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid UpdateRoomProfileRequest request) {
        ChatRoomDTO dto = chatService.updateRoomProfile(id, currentUser.getId(), request);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/member-invites/pending")
    public ResponseEntity<List<RoomMemberInviteDTO>> listPendingMemberInvites(
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(chatService.listPendingRoomMemberInvites(currentUser.getId()));
    }

    @PostMapping("/rooms/{id}/member-invites")
    public ResponseEntity<RoomMemberInviteDTO> inviteRoomMemberByUsername(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid InviteMemberByUsernameRequest request) {
        RoomMemberInviteDTO dto = chatService.inviteRoomMemberByUsername(
                id, currentUser.getId(), request.getUsername());
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping("/member-invites/{inviteId}/accept")
    public ResponseEntity<ChatRoomDTO> acceptRoomMemberInvite(
            @PathVariable String inviteId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        ChatRoomDTO dto = chatService.acceptRoomMemberInvite(inviteId, currentUser.getId());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/member-invites/{inviteId}/decline")
    public ResponseEntity<Void> declineRoomMemberInvite(
            @PathVariable String inviteId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        chatService.declineRoomMemberInvite(inviteId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/rooms/{id}/members/{userId}/ban")
    public ResponseEntity<ChatRoomDTO> banRoomMember(
            @PathVariable String id,
            @PathVariable Long userId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        ChatRoomDTO dto = chatService.banRoomMember(id, currentUser.getId(), userId);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/rooms/{id}/bans/{userId}")
    public ResponseEntity<ChatRoomDTO> unbanRoomMember(
            @PathVariable String id,
            @PathVariable Long userId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        ChatRoomDTO dto = chatService.unbanRoomMember(id, currentUser.getId(), userId);
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/rooms/{id}/bans")
    public ResponseEntity<List<UserInfoDTO>> listBannedRoomMembers(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(chatService.listBannedRoomMembers(id, currentUser.getId()));
    }

}
