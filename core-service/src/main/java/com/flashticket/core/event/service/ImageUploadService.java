package com.flashticket.core.event.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.Transformation;
import com.cloudinary.utils.ObjectUtils;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.dto.UpdateImageRequest;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.EventImage;
import com.flashticket.core.event.repository.EventImageRepository;
import com.flashticket.core.event.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;


@Service
@RequiredArgsConstructor
@Slf4j
public class ImageUploadService {
    
    private final Cloudinary cloudinary;
    private final EventImageRepository eventImageRepository;
    private final EventRepository eventRepository;
    
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    private static final List<String> ALLOWED_TYPES = List.of("image/jpeg", "image/png", "image/jpg", "image/webp");
    
    // Các loại ảnh chỉ được phép có duy nhất 1 bản cho mỗi sự kiện (Tự động thay thế khi tải mới)
    private static final List<EventImage.ImageType> SINGULAR_IMAGE_TYPES = List.of(
        EventImage.ImageType.BANNER,
        EventImage.ImageType.POSTER,
        EventImage.ImageType.SEAT_MAP,
        EventImage.ImageType.THUMBNAIL
    );
    
    /**
     * Upload image to Cloudinary và save metadata vào database
     * @param imageType Type of image (BANNER, POSTER, GALLERY, etc.)
     */
    @Transactional
    public EventImage uploadEventImage(
        UUID eventId,
        MultipartFile file,
        EventImage.ImageType imageType
    ) throws IOException {
        log.info("Uploading {} image for event {}", imageType, eventId);
        
        // Validate file
        validateImage(file);
        
        // Find event
        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Event", "id", eventId));
        
        // --- XỬ LÝ AUTO-REPLACE (Chặn Edge Case rác dữ liệu) ---
        if (SINGULAR_IMAGE_TYPES.contains(imageType)) {
            log.info("Singular image type {} detected, cleaning up old images for event {}", imageType, eventId);
            List<EventImage> existingImages = eventImageRepository
                .findByEventIdAndImageTypeAndIsDeletedFalseOrderByDisplayOrderAsc(eventId, imageType);
            
            for (EventImage oldImg : existingImages) {
                try {
                    // Xóa file trên Cloudinary và mark deleted trong DB
                    deleteEventImage(oldImg.getId());
                } catch (Exception e) {
                    log.error("Failed to cleanup old image {}: {}", oldImg.getId(), e.getMessage());
                    // Không chặn hoàn toàn luồng upload nếu lỗi xóa ảnh cũ (giúp UX mượt hơn)
                }
            }
        }
        
        // Upload to Cloudinary
        Map uploadResult = uploadToCloudinary(file, eventId, imageType);
        
        // Save metadata to database
        EventImage image = EventImage.builder()
            .event(event)
            .imageUrl((String) uploadResult.get("secure_url"))
            .publicId((String) uploadResult.get("public_id"))
            .imageType(imageType)
            .altText(file.getOriginalFilename())
            .width((Integer) uploadResult.get("width"))
            .height((Integer) uploadResult.get("height"))
            .fileSizeBytes(((Number) uploadResult.get("bytes")).longValue())
            .isPrimary(imageType == EventImage.ImageType.BANNER)
            .displayOrder(0)
            .isDeleted(false)
            .build();
        
        EventImage saved = eventImageRepository.save(image);
        
        // Update denormalized bannerUrl nếu là BANNER
        if (imageType == EventImage.ImageType.BANNER) {
            event.setBannerUrl(saved.getImageUrl());
            eventRepository.save(event);
            log.info("Updated event {} banner_url to {}", eventId, saved.getImageUrl());
        }
        
        log.info("Successfully uploaded image {} for event {}", saved.getPublicId(), eventId);
        return saved;
    }
    
    /**
     * Delete image from Cloudinary và database
     * 
     * @param imageId EventImage ID
     */
    @Transactional
    public void deleteEventImage(UUID imageId) throws IOException {
        log.info("Deleting image {}", imageId);
        
        EventImage image = eventImageRepository.findById(imageId)
            .orElseThrow(() -> new ResourceNotFoundException("EventImage", "id", imageId));
        
        // Delete from Cloudinary
        Map result = cloudinary.uploader().destroy(image.getPublicId(), ObjectUtils.emptyMap());
        log.info("Cloudinary delete result: {}", result.get("result"));
        
        // Soft delete from database
        image.setIsDeleted(true);
        eventImageRepository.save(image);
        
        // If this was the banner, clear event.bannerUrl
        if (image.getImageType() == EventImage.ImageType.BANNER && image.getIsPrimary()) {
            Event event = image.getEvent();
            event.setBannerUrl(null);
            eventRepository.save(event);
            log.info("Cleared event {} banner_url", event.getId());
        }
        
        log.info("Successfully deleted image {}", imageId);
    }
    
    /**
     * Cập nhật metadata của ảnh (isPrimary, altText, displayOrder)
     * Đảm bảo chỉ có 1 ảnh Primary cho mỗi loại (Banner/Poster)
     */
    @Transactional
    public EventImage updateImageMetadata(UUID imageId, UpdateImageRequest req) {
        log.info("Updating metadata for image {}", imageId);
        
        EventImage image = eventImageRepository.findById(imageId)
            .orElseThrow(() -> new ResourceNotFoundException("EventImage", "id", imageId));

        if (req.altText() != null) image.setAltText(req.altText());
        if (req.displayOrder() != null) image.setDisplayOrder(req.displayOrder());

        // Nếu có sự thay đổi về ImageType
        if (req.imageType() != null && req.imageType() != image.getImageType()) {
            EventImage.ImageType newType = req.imageType();
            
            // XỬ LÝ AUTO-REPLACE (Nếu biến thành loại ảnh duy nhất)
            if (SINGULAR_IMAGE_TYPES.contains(newType)) {
                log.info("Transition to Singular type {}, cleaning up old images", newType);
                List<EventImage> existingImages = eventImageRepository
                    .findByEventIdAndImageTypeAndIsDeletedFalseOrderByDisplayOrderAsc(image.getEvent().getId(), newType);
                
                for (EventImage oldImg : existingImages) {
                    if (!oldImg.getId().equals(imageId)) { // Không tự xóa chính nó
                        try {
                            // Xóa file trên Cloudinary và mark deleted trong DB
                            deleteEventImage(oldImg.getId());
                        } catch (Exception e) {
                            log.error("Failed to cleanup old image {}: {}", oldImg.getId(), e.getMessage());
                        }
                    }
                }
            }
            
            // Cập nhật bannerUrl của Event nếu liên quan đến BANNER
            Event event = image.getEvent();
            if (image.getImageType() == EventImage.ImageType.BANNER && newType != EventImage.ImageType.BANNER) {
                // Đang là BANNER, giờ bị giáng cấp thành loại khác -> Clear banner url
                event.setBannerUrl(null);
                eventRepository.save(event);
            } else if (newType == EventImage.ImageType.BANNER) {
                // Trở thành BANNER mới
                event.setBannerUrl(image.getImageUrl());
                eventRepository.save(event);
            }

            image.setImageType(newType);
            image.setIsPrimary(newType == EventImage.ImageType.BANNER);
        }

        // Loại bỏ hoàn toàn logic xử lý req.isPrimary() cũ vì flag này phụ thuộc chặt vào ImageType.
        return eventImageRepository.save(image);
    }
    
    /**
     * Get all images of an event
     */
    @Transactional(readOnly = true)
    public List<EventImage> getEventImages(UUID eventId) {
        return eventImageRepository.findByEventIdAndIsDeletedFalseOrderByDisplayOrderAsc(eventId);
    }
    
    /**
     * Upload file to Cloudinary với transformations
     */
    private Map uploadToCloudinary(MultipartFile file, UUID eventId, EventImage.ImageType imageType) throws IOException {
        // Transformation based on image type
        Transformation transformation = getTransformation(imageType);
        
        Map<String, Object> uploadParams = ObjectUtils.asMap(
            "folder", "flash-ticket/events/" + eventId,
            "resource_type", "image",
            "transformation", transformation,
            "use_filename", true,
            "unique_filename", true
        );
        //  Upload từ byte array, không cần tạo File tạm
        return cloudinary.uploader().upload(file.getBytes(), uploadParams);
    }
    
    /**
     * Get Cloudinary transformation based on image type
     */
    private Transformation getTransformation(EventImage.ImageType imageType) {
        return switch (imageType) {
            case BANNER -> new Transformation()
                .width(1200).height(800).crop("fill")
                .quality("auto").fetchFormat("auto");
            case POSTER -> new Transformation()
                .width(800).height(1200).crop("fill")
                .quality("auto").fetchFormat("auto");
            case THUMBNAIL -> new Transformation()
                .width(400).height(300).crop("fill")
                .quality("auto").fetchFormat("auto");
            case GALLERY -> new Transformation()
                .width(1000).height(750).crop("fill")
                .quality("auto").fetchFormat("auto");
            case SEAT_MAP -> new Transformation()
                .width(1500).height(1000).crop("fit")
                .quality("auto").fetchFormat("auto");
        };
    }
    
    /**
     * Validate uploaded image
     */
    private void validateImage(MultipartFile file) {
        if (file.isEmpty()) {
            throw new InvalidRequestException("File is empty");
        }
        
        // Check file size
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new InvalidRequestException(
                String.format("File size exceeds maximum allowed size of %d MB", MAX_FILE_SIZE / (1024 * 1024))
            );
        }
        
        // Check file type
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new InvalidRequestException(
                "Invalid file type. Allowed types: JPEG, PNG, JPG, WEBP"
            );
        }
    }
}
