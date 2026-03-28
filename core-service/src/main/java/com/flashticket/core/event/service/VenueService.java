package com.flashticket.core.event.service;

import com.flashticket.core.event.dto.VenueResponse;
import com.flashticket.core.event.entity.Venue;
import com.flashticket.core.event.repository.VenueRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Service cho Venue
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VenueService {
    
    private final VenueRepository venueRepository;
    
    /**
     * Lấy danh sách tất cả địa điểm active và sắp xếp theo thành phố -> tên
     */
    @Transactional(readOnly = true)
    public List<VenueResponse> getAllActiveVenues() {
        log.info("Fetching all active venues");
        List<Venue> venues = venueRepository.findByIsActiveTrueAndIsDeletedFalseOrderByCityAscNameAsc();
        
        return venues.stream()
            .map(this::mapToResponse)
            .toList();
    }
    
    private VenueResponse mapToResponse(Venue venue) {
        return VenueResponse.builder()
            .id(venue.getId())
            .name(venue.getName())
            .slug(venue.getSlug())
            .description(venue.getDescription())
            .address(venue.getAddress())
            .district(venue.getDistrict())
            .city(venue.getCity())
            .latitude(venue.getLatitude())
            .longitude(venue.getLongitude())
            .totalCapacity(venue.getTotalCapacity())
            .facilities(venue.getFacilities())
            .imageUrls(venue.getImageUrls())
            .build();
    }
}
