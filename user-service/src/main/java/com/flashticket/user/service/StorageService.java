package com.flashticket.user.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.flashticket.user.common.exception.InvalidRequestException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Service for uploading images to Cloudinary.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StorageService {

    private final Cloudinary cloudinary;

    @Value("${cloudinary.folders.user-avatars:flash-ticket/users/avatars}")
    private String avatarFolder;

    @Value("${cloudinary.folders.organizer-logos:flash-ticket/organizers/logos}")
    private String logoFolder;

    @Value("${cloudinary.folders.organizer-banners:flash-ticket/organizers/banners}")
    private String bannerFolder;

    private static final List<String> ALLOWED_CONTENT_TYPES = Arrays.asList(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private static final long MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

    public String uploadAvatar(String userId, MultipartFile file) {
        validateFile(file);
        return uploadImage(file, avatarFolder, "avatar_" + userId + "_" + UUID.randomUUID().toString().substring(0, 8));
    }

    public String uploadOrganizerLogo(String organizerProfileId, MultipartFile file) {
        validateFile(file);
        return uploadImage(file, logoFolder, "logo_" + organizerProfileId + "_" + UUID.randomUUID().toString().substring(0, 8));
    }

    public String uploadOrganizerBanner(String organizerProfileId, MultipartFile file) {
        validateFile(file);
        return uploadImage(file, bannerFolder, "banner_" + organizerProfileId + "_" + UUID.randomUUID().toString().substring(0, 8));
    }

    private String uploadImage(MultipartFile file, String folder, String publicId) {
        try {
            Map uploadParams = ObjectUtils.asMap(
                    "folder", folder,
                    "public_id", publicId,
                    "overwrite", true,
                    "resource_type", "image"
            );

            Map result = cloudinary.uploader().upload(file.getBytes(), uploadParams);
            return result.get("secure_url").toString();
        } catch (IOException e) {
            log.error("Failed to upload image to Cloudinary", e);
            throw new RuntimeException("Failed to upload image. Please try again later.", e);
        }
    }

    public void deleteFile(String publicId) {
        try {
            cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
            log.info("Deleted image from Cloudinary: {}", publicId);
        } catch (IOException e) {
            log.error("Failed to delete image: {}", publicId, e);
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidRequestException("File is required");
        }

        if (!ALLOWED_CONTENT_TYPES.contains(file.getContentType())) {
            throw new InvalidRequestException("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new InvalidRequestException("File size exceeds maximum limit of 2MB");
        }
    }
}
