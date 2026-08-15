package com.project.webchat.shared.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContactStatusDTO {
    private ContactRequestState state;
    private ContactPromptDescriptorDTO prompt;
    /** True when current user already has the other user on their own contact list (one-sided OK). */
    private Boolean onMyList;
}
