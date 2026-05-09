package com.flashticket.core.event.service;

import com.flashticket.core.event.dto.SeatMapResponse;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.EventLayout;
import com.flashticket.core.event.entity.EventSeat;
import com.flashticket.core.event.entity.EventSector;
import com.flashticket.core.event.entity.EventSeatInventory;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import com.flashticket.core.event.repository.EventLayoutRepository;
import com.flashticket.core.event.repository.EventRepository;
import com.flashticket.core.event.repository.EventSeatInventoryRepository;
import com.flashticket.core.event.repository.EventSeatRepository;
import com.flashticket.core.event.repository.EventSectorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SeatMapSyncService {

    private final EventRepository eventRepository;
    private final EventLayoutRepository eventLayoutRepository;
    private final EventSectorRepository eventSectorRepository;
    private final EventSeatRepository eventSeatRepository;
    private final EventSeatInventoryRepository eventSeatInventoryRepository;

    @Transactional
    public void publishSeatMap(UUID eventId, String organizerId, SeatMapPublishRequest request) {
        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Event khÃ´ng tá»“n táº¡i"));

        if (!event.getOrganizerId().equals(organizerId)) {
            throw new AccessDeniedException("Báº¡n khÃ´ng cÃ³ quyá»n truy cáº­p sÆ¡ Ä‘á»“ sá»± kiá»‡n nÃ y");
        }

        EventLayout layout = eventLayoutRepository.findByEventId(eventId)
            .orElseGet(() -> EventLayout.builder()
                .event(event)
                .sourceType(EventLayout.SourceType.CUSTOM)
                .build());

        if (request.name() != null) layout.setName(request.name());
        if (request.backgroundImageUrl() != null) layout.setBackgroundImageUrl(request.backgroundImageUrl());
        if (request.backgroundPublicId() != null) layout.setBackgroundPublicId(request.backgroundPublicId());
        if (request.backgroundWidth() != null) layout.setBackgroundWidth(request.backgroundWidth());
        if (request.backgroundHeight() != null) layout.setBackgroundHeight(request.backgroundHeight());
        if (request.mapConfig() != null) layout.setMapConfig(request.mapConfig());

        layout = eventLayoutRepository.save(layout);

        List<EventSector> existingSectors = eventSectorRepository.findByLayoutId(layout.getId());
        Map<UUID, EventSector> existingSectorMap = existingSectors.stream()
            .collect(Collectors.toMap(EventSector::getId, sector -> sector));
        List<SeatMapPublishRequest.SectorRequest> requestedSectors =
            request.sectors() != null ? request.sectors() : List.of();
        Set<UUID> requestedExistingSectorIds = new HashSet<>();
        List<EventSector> sectorsToSave = new ArrayList<>();

        for (int index = 0; index < requestedSectors.size(); index++) {
            SeatMapPublishRequest.SectorRequest sectorRequest = requestedSectors.get(index);
            EventSector sector = sectorRequest.id() != null ? existingSectorMap.get(sectorRequest.id()) : null;
            if (sector != null) {
                requestedExistingSectorIds.add(sector.getId());
            } else {
                sector = new EventSector();
                sector.setCreatedAt(Instant.now());
            }

            sector.setLayout(layout);
            sector.setName(sectorRequest.name() != null ? sectorRequest.name() : "Unnamed sector");
            sector.setCode(sectorRequest.code());
            sector.setSectorType(sectorRequest.sectorType() != null ? sectorRequest.sectorType() : "SEATED");
            sector.setColorCode(sectorRequest.colorCode());
            sector.setDisplayOrder(sectorRequest.displayOrder() != null ? sectorRequest.displayOrder() : index);
            sector.setMapData(sectorRequest.mapData());
            sector.setIsActive(sectorRequest.visible() == null || sectorRequest.visible());
            sector.setTotalCapacity(countActiveSeats(sectorRequest.seats()));
            sector.setUpdatedAt(Instant.now());
            sectorsToSave.add(sector);
        }

        List<EventSector> savedSectors = eventSectorRepository.saveAll(sectorsToSave);
        for (int index = 0; index < savedSectors.size(); index++) {
            syncSeatsForSector(savedSectors.get(index), requestedSectors.get(index).seats());
        }

        for (EventSector existingSector : existingSectors) {
            if (!requestedExistingSectorIds.contains(existingSector.getId())) {
                existingSector.setIsActive(false);
                existingSector.setUpdatedAt(Instant.now());
                eventSectorRepository.save(existingSector);
                deactivateSeatsForSector(existingSector.getId());
            }
        }

        log.info("Published seat map for event {} with {} sectors", eventId, requestedSectors.size());
    }

    @Transactional(readOnly = true)
    public SeatMapResponse getSeatMap(UUID eventId, String organizerId) {
        // Kiểm tra quyền tải sơ đồ (IDOR validation)
        Event event = eventRepository.findById(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Event không tồn tại"));

        if (!event.getOrganizerId().equals(organizerId)) {
            throw new AccessDeniedException("Bạn không có quyền truy cập sơ đồ sự kiện này");
        }

        // Lấy Layout chính của Event
        EventLayout layout = eventLayoutRepository.findByEventId(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Event này chưa khởi tạo Layout"));

        // Lấy toàn bộ Sector đang Active thuộc về Layout này
        List<EventSector> sectors = eventSectorRepository.findByLayoutIdAndIsActiveTrue(layout.getId());

        // Lấy toàn bộ trạng thái ghế (Inventory) để trộn vào Data
        List<EventSeatInventory> inventoryList = eventSeatInventoryRepository.findByEventId(eventId);
        Map<UUID, String> inventoryStatusMap = inventoryList.stream()
            .collect(Collectors.toMap(
                inv -> inv.getEventSeat().getId(),
                EventSeatInventory::getStatus,
                (v1, v2) -> v1 // Đề phòng duplicate data rac
            ));

        // Query mảng Seat lớn và map vào Entity theo Sector
        List<SeatMapResponse.SectorDto> sectorDtos = sectors.stream().map(sector -> {
            
            // Query các ghế trong sector
            List<EventSeat> seatsInSector = eventSeatRepository.findBySectorIdAndIsActiveTrue(sector.getId());
            
            // Map từ EventSeat -> SeatDto
            List<SeatMapResponse.SeatDto> seatDtos = seatsInSector.stream().map(seat -> {
                // Xác định trạng thái của Ghế:
                // Nếu chưa có trong bảng Inventory thì mặc định nó là AVAILABLE - mới đầu thì sẽ là full AVAILABLE, nếu có ghế đã mua -> trộn kèm các ghế đã SOLD
                String status = inventoryStatusMap.getOrDefault(seat.getId(), "AVAILABLE"); // đã lọc ghế bị soft delete bằng findBySectorIdAndIsActiveTrue
                
                return SeatMapResponse.SeatDto.builder()
                        .id(seat.getId())
                        .rowName(seat.getRowName())
                        .seatNumber(seat.getSeatNumber())
                        .seatLabel(seat.getSeatLabel())
                        .coordX(seat.getCoordX())
                        .coordY(seat.getCoordY())
                        .seatType(seat.getSeatType())
                        .isActive(seat.getIsActive())
                        .inventoryStatus(status) 
                        .build();
            }).collect(Collectors.toList());

            return SeatMapResponse.SectorDto.builder()
                    .id(sector.getId())
                    .name(sector.getName())
                    .sectorType(sector.getSectorType())
                    .mapData(sector.getMapData())
                    .colorCode(sector.getColorCode())
                    .seatsData(seatDtos)
                    .build();
        }).collect(Collectors.toList());

        log.info("Successfully reconstructed SeatMap for event {} with {} sectors", eventId, sectors.size());

        // 6. Đóng gói kết quả gửi về Frontend
        return SeatMapResponse.builder()
                .layoutId(layout.getId())
                .backgroundImageUrl(layout.getBackgroundImageUrl())
                .backgroundWidth(layout.getBackgroundWidth())
                .backgroundHeight(layout.getBackgroundHeight())
                .mapConfig(layout.getMapConfig())
                .sectors(sectorDtos)
                .build();
    }

    @Transactional(readOnly = true)
    public SeatMapResponse getPublicSeatMap(UUID eventId) {
        Event event = eventRepository.findByIdAndIsDeletedFalse(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Event khÃ´ng tá»“n táº¡i"));
        return getSeatMap(eventId, event.getOrganizerId());
    }

    private void syncSeatsForSector(EventSector sector, List<SeatMapPublishRequest.SeatRequest> requestedSeats) {
        List<EventSeat> existingSeats = eventSeatRepository.findBySectorId(sector.getId());
        Map<UUID, EventSeat> existingSeatMap = existingSeats.stream()
            .collect(Collectors.toMap(EventSeat::getId, seat -> seat));
        List<SeatMapPublishRequest.SeatRequest> normalizedRequestedSeats =
            requestedSeats != null ? requestedSeats : List.of();
        Set<UUID> requestedExistingSeatIds = new HashSet<>();
        List<EventSeat> seatsToSave = new ArrayList<>();

        for (SeatMapPublishRequest.SeatRequest seatRequest : normalizedRequestedSeats) {
            EventSeat seat = seatRequest.id() != null ? existingSeatMap.get(seatRequest.id()) : null;
            if (seat != null) {
                requestedExistingSeatIds.add(seat.getId());
            } else {
                seat = new EventSeat();
                seat.setCreatedAt(Instant.now());
            }

            seat.setSector(sector);
            seat.setRowName(seatRequest.rowName() != null ? seatRequest.rowName() : "");
            seat.setSeatNumber(seatRequest.seatNumber() != null ? seatRequest.seatNumber() : "");
            seat.setSeatLabel(seatRequest.seatLabel());
            seat.setCoordX(seatRequest.coordX() != null ? seatRequest.coordX() : BigDecimal.ZERO);
            seat.setCoordY(seatRequest.coordY() != null ? seatRequest.coordY() : BigDecimal.ZERO);
            seat.setSeatType(seatRequest.seatType() != null ? seatRequest.seatType() : "REGULAR");
            seat.setCoordMetadata(seatRequest.coordMetadata());
            seat.setIsActive(seatRequest.isActive() == null || seatRequest.isActive());
            seatsToSave.add(seat);
        }

        eventSeatRepository.saveAll(seatsToSave);

        for (EventSeat existingSeat : existingSeats) {
            if (!requestedExistingSeatIds.contains(existingSeat.getId())) {
                existingSeat.setIsActive(false);
                eventSeatRepository.save(existingSeat);
            }
        }
    }

    private void deactivateSeatsForSector(UUID sectorId) {
        List<EventSeat> seats = eventSeatRepository.findBySectorId(sectorId);
        for (EventSeat seat : seats) {
            seat.setIsActive(false);
        }
        eventSeatRepository.saveAll(seats);
    }

    private int countActiveSeats(List<SeatMapPublishRequest.SeatRequest> seats) {
        if (seats == null) {
            return 0;
        }
        int total = 0;
        for (SeatMapPublishRequest.SeatRequest seat : seats) {
            if (seat.isActive() == null || seat.isActive()) {
                total += 1;
            }
        }
        return total;
    }

    public record SeatMapPublishRequest(
        String name,
        String backgroundImageUrl,
        String backgroundPublicId,
        Integer backgroundWidth,
        Integer backgroundHeight,
        Map<String, Object> mapConfig,
        List<SectorRequest> sectors
    ) {
        public record SectorRequest(
            UUID id,
            String name,
            String code,
            String sectorType,
            String colorCode,
            Boolean visible,
            Integer displayOrder,
            Map<String, Object> mapData,
            List<SeatRequest> seats
        ) {}

        public record SeatRequest(
            UUID id,
            String rowName,
            String seatNumber,
            String seatLabel,
            BigDecimal coordX,
            BigDecimal coordY,
            String seatType,
            Boolean isActive,
            Map<String, Object> coordMetadata
        ) {}
    }
}
