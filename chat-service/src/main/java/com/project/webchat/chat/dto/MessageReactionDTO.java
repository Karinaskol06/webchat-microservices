package com.project.webchat.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.project.webchat.chat.entity.MessageReaction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageReactionDTO {

    private String emoji;
    private int count;
    private List<Long> userIds;
    private boolean reactedByMe;

    public static MessageReactionDTO fromEntity(MessageReaction reaction, Long currentUserId) {
        List<Long> ids = reaction.getUserIds() != null ? reaction.getUserIds() : List.of();
        boolean reactedByMe = currentUserId != null && ids.contains(currentUserId);
        return MessageReactionDTO.builder()
                .emoji(reaction.getEmoji())
                .count(ids.size())
                .userIds(new ArrayList<>(ids))
                .reactedByMe(reactedByMe)
                .build();
    }
}
