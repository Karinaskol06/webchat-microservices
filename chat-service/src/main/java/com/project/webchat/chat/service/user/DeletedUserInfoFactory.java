package com.project.webchat.chat.service.user;

import com.project.webchat.shared.dto.DeletedAccountProfile;
import com.project.webchat.shared.dto.UserInfoDTO;

public final class DeletedUserInfoFactory {

    private DeletedUserInfoFactory() {
    }

    public static UserInfoDTO build(Long userId) {
        return UserInfoDTO.builder()
                .id(userId)
                .username(DeletedAccountProfile.DISPLAY_LABEL)
                .firstName(null)
                .lastName(null)
                .profilePicture(null)
                .online(false)
                .deleted(true)
                .build();
    }
}
