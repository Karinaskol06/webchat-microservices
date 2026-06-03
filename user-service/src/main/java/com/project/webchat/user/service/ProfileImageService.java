package com.project.webchat.user.service;

import com.project.webchat.user.entity.ProfileImage;
import com.project.webchat.user.repository.ProfileImageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Service
@RequiredArgsConstructor
@Transactional
public class ProfileImageService {

    public static final String KIND_AVATAR = "AVATAR";
    public static final String KIND_BACKGROUND = "BACKGROUND";

    private final ProfileImageRepository profileImageRepository;

    public void upload(Long userId, String kind, MultipartFile file) {
        validateKind(kind);
        ProfileImageUploadValidator.validate(file);

        byte[] data;
        try {
            data = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Unable to read uploaded file", e);
        }

        ProfileImage existing = profileImageRepository.findByUserIdAndKind(userId, kind).orElse(null);
        if (existing == null) {
            existing = ProfileImage.builder()
                    .userId(userId)
                    .kind(kind)
                    .build();
        }
        existing.setContentType(file.getContentType());
        existing.setData(data);
        profileImageRepository.save(existing);
    }

    public void delete(Long userId, String kind) {
        validateKind(kind);
        profileImageRepository.deleteByUserIdAndKind(userId, kind);
    }

    @Transactional(readOnly = true)
    public ProfileImage load(Long userId, String kind) {
        validateKind(kind);
        return profileImageRepository.findByUserIdAndKind(userId, kind).orElse(null);
    }

    private void validateKind(String kind) {
        if (!KIND_AVATAR.equals(kind) && !KIND_BACKGROUND.equals(kind)) {
            throw new IllegalArgumentException("Unsupported image kind: " + kind);
        }
    }
}
