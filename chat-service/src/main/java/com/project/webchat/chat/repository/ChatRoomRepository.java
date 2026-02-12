package com.project.webchat.chat.repository;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {

    //find all user chats
    List<ChatRoom> findByMemberIdsContains(Long userId);

    //with pagination
    Page<ChatRoom> findByMemberIdsContainsOrderByLastActivityDesc(Long userId, Pageable pageable);

    //find a private chat
    @Query("{ 'type': 'PRIVATE', 'memberIds': { $all: ?1 }, 'memberIdsSize': 2 }")
    Optional<ChatRoom> findPrivateChatBetweenUsers(ChatType type, List<Long> userIds);

    //check if chat exists for specified user
    boolean existsByIdAndMemberIdsContains(String chatId, Long userId);
}
