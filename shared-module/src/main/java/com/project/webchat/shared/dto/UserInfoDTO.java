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

    //helper method for displaying name
    public String getDisplayName() {
        if (firstName != null && lastName != null) {
            return firstName + " " + lastName;
        } else if (firstName != null) {
            return firstName;
        } else {
            return username;
        }
    }

    //for profile click
    public String getProfileUrl() {
        return "/profile/" + id;
    }
}
