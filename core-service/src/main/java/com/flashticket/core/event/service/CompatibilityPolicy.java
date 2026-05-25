package com.flashticket.core.event.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.event.entity.TicketType.AccessScope;
import com.flashticket.core.event.entity.TicketType.InventoryMode;
import org.springframework.stereotype.Component;

import java.util.UUID;


/**
 * Nếu eventSectorId == null → derive accessScope = EVENT, inventoryMode = QUANTITY.
 * Nếu sector là STANDING → derive accessScope = SECTOR, inventoryMode = QUANTITY.
 * Nếu sector là SEATED → derive accessScope = SECTOR, inventoryMode = ASSIGNED_SEAT.
 * Nếu VIP_BOX, ACCESSIBLE, hoặc combo sai → reject.
 * */


@Component
public class CompatibilityPolicy {

    public Compatibility derive(UUID eventSectorId, String rawSectorType) {
        if (eventSectorId == null) {
            return new Compatibility(AccessScope.EVENT, InventoryMode.QUANTITY, null);
        }

        String sectorType = normalizeSectorType(rawSectorType);
        return switch (sectorType) {
            case "STANDING" -> new Compatibility(AccessScope.SECTOR, InventoryMode.QUANTITY, sectorType);
            case "SEATED" -> new Compatibility(AccessScope.SECTOR, InventoryMode.ASSIGNED_SEAT, sectorType);
            case "VIP_BOX", "ACCESSIBLE" -> throw new InvalidRequestException(
                "Sector type " + sectorType + " is not supported in MVP");
            default -> throw new InvalidRequestException("Unsupported sector type: " + rawSectorType);
        };
    }

    public void validate(AccessScope accessScope, String rawSectorType, InventoryMode inventoryMode) {
        if (accessScope == null || inventoryMode == null) {
            throw new InvalidRequestException("Ticket inventory configuration is required");
        }

        if (accessScope == AccessScope.EVENT) {
            if (inventoryMode != InventoryMode.QUANTITY) {
                throw new InvalidRequestException("Event-level tickets only support quantity booking");
            }
            return;
        }

        String sectorType = normalizeSectorType(rawSectorType);
        if ("VIP_BOX".equals(sectorType) || "ACCESSIBLE".equals(sectorType)) {
            throw new InvalidRequestException("Sector type " + sectorType + " is not supported in MVP");
        }
        if ("STANDING".equals(sectorType) && inventoryMode == InventoryMode.ASSIGNED_SEAT) {
            throw new InvalidRequestException("Standing sectors do not support assigned seats");
        }
        if ("SEATED".equals(sectorType) && inventoryMode == InventoryMode.QUANTITY) {
            throw new InvalidRequestException("Seated sectors only support assigned seats in MVP");
        }
        if (!"STANDING".equals(sectorType) && !"SEATED".equals(sectorType)) {
            throw new InvalidRequestException("Unsupported sector type: " + rawSectorType);
        }
    }

    private String normalizeSectorType(String rawSectorType) {
        if (rawSectorType == null || rawSectorType.isBlank()) {
            throw new InvalidRequestException("Sector type is required for sector-level ticket"); // Muốn tạo ticket gắn ở mức sector thì sector phải có type.
        }
        return rawSectorType.trim().toUpperCase();
    }

    public record Compatibility(
        AccessScope accessScope,
        InventoryMode inventoryMode,
        String sectorType
    ) {}
}
