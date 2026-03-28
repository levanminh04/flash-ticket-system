package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.UpdateImageRequest;
import com.flashticket.core.event.entity.EventImage;
import com.flashticket.core.event.service.ImageUploadService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;


@RestController
@RequestMapping("/api/organizer/events")
@RequiredArgsConstructor
@Slf4j
public class ImageUploadController {
    
    private final ImageUploadService imageUploadService;
    
    /**
     * POST /api/organizer/events/{eventId}/images
     * 
     * @param eventId Event ID
     * @param file Image file (max 5MB, JPEG/PNG/WEBP)
     * @param imageType Type of image (BANNER, POSTER, GALLERY, SEAT_MAP, THUMBNAIL)
     * @return EventImage metadata
     */
    @PostMapping("/{eventId}/images")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<EventImage> uploadImage(
        @PathVariable UUID eventId,
        @RequestParam("file") MultipartFile file,
        @RequestParam(defaultValue = "GALLERY") EventImage.ImageType imageType
    ) throws IOException {
        log.info("POST /api/organizer/events/{}/images - Uploading {} image", eventId, imageType);
        
        EventImage image = imageUploadService.uploadEventImage(eventId, file, imageType);
        
        log.info("Successfully uploaded image {} for event {}", image.getId(), eventId);
        return ResponseEntity.ok(image);
    }
    
    /**
     * GET /api/organizer/events/{eventId}/images
     * Get all images of an event
     */
    @GetMapping("/{eventId}/images")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<List<EventImage>> getEventImages(@PathVariable UUID eventId) {
        log.info("GET /api/organizer/events/{}/images", eventId);
        
        List<EventImage> images = imageUploadService.getEventImages(eventId);
        
        log.info("Found {} images for event {}", images.size(), eventId);
        return ResponseEntity.ok(images);
    }
    
    /**
     * DELETE /api/organizer/events/{eventId}/images/{imageId}
     * Delete an image
     */
    @DeleteMapping("/{eventId}/images/{imageId}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<Void> deleteImage(
        @PathVariable UUID eventId,
        @PathVariable UUID imageId
    ) throws IOException {
        log.info("DELETE /api/organizer/events/{}/images/{}", eventId, imageId);
        
        imageUploadService.deleteEventImage(imageId);
        
        log.info("Successfully deleted image {}", imageId);
        return ResponseEntity.noContent().build();
    }
    
    /**
     * PATCH /api/organizer/events/{eventId}/images/{imageId}
     * Cập nhật metadata của ảnh (alt text, order, isPrimary)
     */
    @PatchMapping("/{eventId}/images/{imageId}")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<EventImage> updateImageMetadata(
        @PathVariable UUID eventId,
        @PathVariable UUID imageId,
        @RequestBody @Valid UpdateImageRequest req
    ) {
        log.info("PATCH /api/organizer/events/{}/images/{} - Updating metadata", eventId, imageId);
        EventImage image = imageUploadService.updateImageMetadata(imageId, req);
        return ResponseEntity.ok(image);
    }
}
