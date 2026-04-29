package com.project.webchat.chat.repository;

import com.project.webchat.chat.entity.Attachment;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface AttachmentRepository extends MongoRepository<Attachment, String> {

    // find all message attachments
    List<Attachment> findByMessageId(String messageId);

    // find all chat attachments
    List<Attachment> findByChatId(String chatId);

    // find attachment by id and chat id
    Optional<Attachment> findByIdAndChatId(String id, String chatId);

    void deleteByChatId(String chatId);
}
