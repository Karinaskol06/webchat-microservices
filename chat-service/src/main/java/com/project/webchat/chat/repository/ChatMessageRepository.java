package com.project.webchat.chat.repository;

import com.project.webchat.chat.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {

    //find all messages with pagination
    Page<ChatMessage> findByChatIdOrderByTimestampDesc(String chatId, Pageable pageable);

    //find unread messages (user is not a sender)
    @Query("{ 'chatId' : ?0, 'senderId' : { $ne: ?1 }, 'isRead' : false }")
    List<ChatMessage> findUnreadMessagesNotFromUser(String chatId, Long senderId);

    //last 30 messages in the chat
    @Query(value = "{ 'chatId' : ?0 }", sort = "{ 'timestamp' : -1 }")
    List<ChatMessage> findLast30ByChatId(String chatId, Pageable pageable);

    //amount of messages in the chat
    Long countByChatId(String chatId);
}
