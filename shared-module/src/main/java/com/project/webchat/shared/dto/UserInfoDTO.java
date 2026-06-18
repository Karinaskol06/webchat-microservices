package com.project.webchat.shared.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserInfoDTO {
    private Long id;
    private String username;
    private String firstName;
    private String lastName;
    private String profilePicture;
    private boolean online;
    private boolean deleted;

    //helper method for displaying name
    public String getDisplayName() {
        if (deleted) {
            return DeletedAccountProfile.DISPLAY_LABEL;
        }
        if (firstName != null && lastName != null) {
            return firstName + " " + lastName;
        } else if (firstName != null) {
            return firstName;
        } else {
            return username;
        }
    }
}
