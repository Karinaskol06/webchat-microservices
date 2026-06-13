package com.project.webchat.chat.service.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.context.ActiveProfiles;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest(classes = {
        ChatRoomManagementService.class,
        RedisService.class
})
@Import(ChatRoomParticipantsRedisCacheIntegrationTest.LocalTestConfig.class)
@ActiveProfiles("test")
class ChatRoomParticipantsRedisCacheIntegrationTest {

    @TestConfiguration
    static class LocalTestConfig {
        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper();
        }
    }

    @MockBean
    private ChatRoomRepository chatRoomRepository;
    @MockBean
    private ChatUserInfoService chatUserInfoService;
    @MockBean
    private RedisTemplate<String, String> redisTemplate;
    @MockBean
    private ValueOperations<String, String> valueOperations;

    @Autowired
    private ChatRoomManagementService chatRoomManagementService;

    private final Map<String, String> redisValues = new HashMap<>();

    @BeforeEach
    void setUpRedisMock() {
        redisValues.clear();
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString()))
                .thenAnswer(invocation -> redisValues.get(invocation.getArgument(0)));
        doAnswer(invocation -> {
            redisValues.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(valueOperations).set(anyString(), anyString(), any(Duration.class));
        doAnswer(invocation -> {
            redisValues.remove(invocation.getArgument(0));
            return true;
        }).when(redisTemplate).delete(anyString());
    }

    @Test
    void repeatedParticipantsRequest_usesRedisCache_andSkipsSecondMongoLookup() {
        String roomId = "room-1";
        Long requestingUserId = 10L;
        Set<Long> memberIds = Set.of(10L, 11L, 12L);

        ChatRoom room = ChatRoom.builder()
                .id(roomId)
                .type(ChatType.GROUP)
                .memberIds(memberIds)
                .createdAt(LocalDateTime.now())
                .lastActivity(LocalDateTime.now())
                .build();

        when(chatRoomRepository.findById(roomId)).thenReturn(Optional.of(room));
        when(chatUserInfoService.getUserInfo(any(Long.class)))
                .thenAnswer(invocation -> UserInfoDTO.builder()
                        .id(invocation.getArgument(0))
                        .username("user-" + invocation.getArgument(0))
                        .build());

        var firstCall = chatRoomManagementService.getRoomParticipantsForMember(roomId, requestingUserId);
        var secondCall = chatRoomManagementService.getRoomParticipantsForMember(roomId, requestingUserId);

        assertThat(firstCall).hasSize(3);
        assertThat(secondCall).hasSize(3);
        verify(chatRoomRepository).findById(eq(roomId));
    }
}

