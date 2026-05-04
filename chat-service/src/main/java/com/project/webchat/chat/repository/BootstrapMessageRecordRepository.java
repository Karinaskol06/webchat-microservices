package com.project.webchat.chat.repository;

import com.project.webchat.chat.entity.BootstrapMessageRecord;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface BootstrapMessageRecordRepository extends MongoRepository<BootstrapMessageRecord, String> {
    Optional<BootstrapMessageRecord> findBySenderIdAndClientRequestKey(Long senderId, String clientRequestKey);
}
