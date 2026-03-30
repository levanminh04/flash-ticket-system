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

import java.util.List;
import java.util.Map;
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
}
