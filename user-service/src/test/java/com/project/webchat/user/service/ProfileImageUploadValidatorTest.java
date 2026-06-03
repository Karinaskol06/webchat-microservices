package com.project.webchat.user.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProfileImageUploadValidatorTest {

    @Test
    void validateImageBytes_acceptsJpegWithJpgExtension() {
        byte[] jpeg = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0, 0, 0};
        assertThatCode(() ->
                ProfileImageUploadValidator.validateImageBytes(jpeg, "photo.jpg", null)
        ).doesNotThrowAnyException();
    }

    @Test
    void validateImageBytes_rejectsMismatchedExtension() {
        byte[] png = new byte[]{(byte) 0x89, 0x50, 0x4E, 0x47, 0, 0, 0, 0};
        assertThatThrownBy(() ->
                ProfileImageUploadValidator.validateImageBytes(png, "photo.jpg", "image/jpeg")
        ).hasMessageContaining("doesn't match");
    }

    @Test
    void validateImageBytes_rejectsOversize() {
        byte[] jpeg = new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
        byte[] huge = new byte[(int) ProfileImageUploadValidator.MAX_BYTES + 1];
        System.arraycopy(jpeg, 0, huge, 0, jpeg.length);
        assertThatThrownBy(() ->
                ProfileImageUploadValidator.validateImageBytes(huge, "big.jpg", null)
        ).hasMessageContaining("too large");
    }
}
