package com.project.webchat.chat.repository;

import com.project.webchat.chat.entity.RoomMemberInvite;
import com.project.webchat.chat.entity.RoomMemberInviteState;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface RoomMemberInviteRepository extends MongoRepository<RoomMemberInvite, String> {

    List<RoomMemberInvite> findByInviteeUserIdAndStateOrderByCreatedAtDesc(
            Long inviteeUserId,
            RoomMemberInviteState state);

    Optional<RoomMemberInvite> findByRoomIdAndInviteeUserIdAndState(
            String roomId,
            Long inviteeUserId,
            RoomMemberInviteState state);

    void deleteByRoomId(String roomId);
}
