import { useEffect, useMemo, useRef, useState } from "react";
import {
  Group,
  Layer,
  Rect,
  Stage,
  Text,
} from "react-konva";
import { PublicSeatMap, PublicSeatSector, PublicSeat } from "../../../types/api";
import { SectorRenderer } from "../shared/SectorRenderer";
import { SeatRenderer } from "../shared/SeatRenderer";

interface BuyerSeatMapCanvasProps {
  seatMap: PublicSeatMap;
  zoom: number;
  selectedSeatIds: string[];
  selectedSectorId?: string | null;
  getSeatColor?: (sector: PublicSeatSector, seat: PublicSeat) => string;
  onZoomChange: (zoom: number) => void;
  onSeatClick: (sector: PublicSeatSector, seat: PublicSeat) => void;
  onSectorClick?: (sector: PublicSeatSector) => void;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getSectorBounds(sector: PublicSeatSector) {
  const mapData = sector.mapData ?? {};
  const bounds = mapData.bounds as Record<string, unknown> | undefined;
  const x = asNumber(bounds?.x ?? mapData.x) ?? 0;
  const y = asNumber(bounds?.y ?? mapData.y) ?? 0;
  const width = Math.max(asNumber(bounds?.width ?? mapData.width) ?? 180, 24);
  const height = Math.max(asNumber(bounds?.height ?? mapData.height) ?? 120, 24);

  return { x, y, width, height };
}

function getSeatRadius(sector: PublicSeatSector) {
  return Math.max(
    asNumber((sector.mapData?.seatLayout as Record<string, unknown> | undefined)?.seatRadius) ?? 6,
    4,
  );
}

function getSeatPosition(seat: PublicSeat) {
  return {
    x: asNumber(seat.coordX) ?? 0,
    y: asNumber(seat.coordY) ?? 0,
  };
}

export default function BuyerSeatMapCanvas({
  seatMap,
  zoom,
  selectedSeatIds,
  selectedSectorId,
  getSeatColor,
  onZoomChange,
  onSeatClick,
  onSectorClick,
}: BuyerSeatMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 620 });

  const maxSectorRight = Math.max(0, ...(seatMap.sectors ?? []).map(s => getSectorBounds(s).x + getSectorBounds(s).width));
  const maxSectorBottom = Math.max(0, ...(seatMap.sectors ?? []).map(s => getSectorBounds(s).y + getSectorBounds(s).height));

  // Add bottom/right padding so seats do not sit on the edge.
  const fallbackWidth = maxSectorRight + 80;
  const fallbackHeight = maxSectorBottom + 80;
  const maxSeatRight = Math.max(
    0,
    ...(seatMap.sectors ?? []).flatMap((sector) => {
      const radius = getSeatRadius(sector);
      return (sector.seatsData ?? []).map((seat) => getSeatPosition(seat).x + radius);
    }),
  );
  const maxSeatBottom = Math.max(
    0,
    ...(seatMap.sectors ?? []).flatMap((sector) => {
      const radius = getSeatRadius(sector);
      return (sector.seatsData ?? []).map((seat) => getSeatPosition(seat).y + radius);
    }),
  );

  const documentWidth = Math.max(seatMap.backgroundWidth ?? 0, fallbackWidth, maxSeatRight + 60, 640);
  const documentHeight = Math.max(seatMap.backgroundHeight ?? 0, fallbackHeight + 160, maxSeatBottom + 160, 600);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? element.clientWidth;
      const nextHeight = entries[0]?.contentRect.height ?? element.clientHeight;
      setViewportSize({
        width: Math.max(320, nextWidth),
        height: Math.max(400, nextHeight),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitZoom = clamp(
    Math.min(viewportSize.width / documentWidth, viewportSize.height / documentHeight) * 0.85,
    0.1,
    3,
  );
  const effectiveZoom = zoom > 0 ? zoom : fitZoom;
  const baseX = (viewportSize.width - documentWidth * effectiveZoom) / 2;
  const baseY = (viewportSize.height - documentHeight * effectiveZoom) / 2;

  useEffect(() => {
    if (zoom <= 0) {
      onZoomChange(fitZoom);
    }
  }, [fitZoom, onZoomChange, zoom]);

  const worldStyle = useMemo(
    () => ({
      x: baseX,
      y: baseY,
      scaleX: effectiveZoom,
      scaleY: effectiveZoom,
    }),
    [baseX, baseY, effectiveZoom],
  );

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    const oldScale = effectiveZoom;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextScale = clamp(direction > 0 ? oldScale * 1.08 : oldScale / 1.08, 0.1, 3);

    onZoomChange(nextScale);
  };

  return (
    <div
      ref={containerRef}
      className="buyer-seat-map-canvas"
    >
      <Stage
        width={viewportSize.width}
        height={viewportSize.height}
        onWheel={handleWheel}
      >
        <Layer>
          <Group {...worldStyle}>
            <Rect
              x={0}
              y={0}
              width={documentWidth}
              height={documentHeight}
              cornerRadius={24}
              fill="#0f172a"
              stroke="rgba(148, 163, 184, 0.34)"
              strokeWidth={1}
            />

            <Rect
              x={0}
              y={0}
              width={documentWidth}
              height={documentHeight}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: documentWidth, y: documentHeight }}
              fillLinearGradientColorStops={[0, "#0b1220", 0.5, "#102231", 1, "#0d1d2b"]}
              cornerRadius={24}
              opacity={0.98}
              listening={false}
            />

            <Rect
              x={documentWidth / 2 - Math.min(documentWidth * 0.4, 250)}
              y={40}
              width={Math.min(documentWidth * 0.8, 500)}
              height={80}
              cornerRadius={16}
              fill="#1e293b"
              stroke="#334155"
              strokeWidth={2}
              listening={false}
            />
            <Text
              x={documentWidth / 2 - Math.min(documentWidth * 0.4, 250)}
              y={64}
              width={Math.min(documentWidth * 0.8, 500)}
              align="center"
              text="SÂN KHẤU"
              fontSize={32}
              fontStyle="700"
              fill="#94a3b8"
              listening={false}
              shadowColor="rgba(0, 0, 0, 0.5)"
              shadowBlur={4}
              shadowOffset={{ x: 0, y: 2 }}
              shadowOpacity={1}
            />

            {(seatMap.sectors ?? []).map((sector) => {
              const bounds = getSectorBounds(sector);
              const seatRadius = getSeatRadius(sector);
              const colorCode = sector.colorCode || "#16a34a";
              const isStandingSector = String(sector.sectorType || "").toUpperCase() === "STANDING";
              const canSelectSector = Boolean(onSectorClick) && isStandingSector;

              return (
                <Group key={sector.id}>
                  <SectorRenderer
                    sector={{
                      id: sector.id,
                      name: sector.name,
                      sectorType: sector.sectorType,
                      colorCode,
                      bounds,
                      mapData: sector.mapData,
                    }}
                    selected={selectedSectorId === sector.id}
                    listening={canSelectSector}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      onSectorClick?.(sector);
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      onSectorClick?.(sector);
                    }}
                    onMouseEnter={(event) => {
                      const container = event.target.getStage()?.container();
                      if (container && canSelectSector) {
                        container.style.cursor = "pointer";
                      }
                    }}
                    onMouseLeave={(event) => {
                      const container = event.target.getStage()?.container();
                      if (container) {
                        container.style.cursor = "";
                      }
                    }}
                    showDepth
                    showLabel={false}
                  />

                  {(sector.seatsData ?? []).map((seat) => {
                    const isSelected = selectedSeatIds.includes(seat.id);
                    const disabledStatuses = new Set(["RESERVED", "SOLD", "BLOCKED", "LOCKED"]);
                    const disabled =
                      seat.isActive === false ||
                      disabledStatuses.has(String(seat.inventoryStatus || "").toUpperCase()) ||
                      seat.inventoryStatus !== "AVAILABLE";
                    const x = asNumber(seat.coordX) ?? 0;
                    const y = asNumber(seat.coordY) ?? 0;

                    return (
                      <SeatRenderer
                        key={seat.id}
                        id={seat.id}
                        x={x}
                        y={y}
                        radius={seatRadius}
                        status={seat.inventoryStatus}
                        selected={isSelected}
                        disabled={disabled}
                        color={getSeatColor?.(sector, seat) ?? seat.colorCode ?? colorCode}
                        onClick={() => onSeatClick(sector, seat)}
                        onTap={() => onSeatClick(sector, seat)}
                        onMouseEnter={(e) => {
                          const container = e.target.getStage()?.container();
                          if (container) {
                            container.style.cursor = disabled ? "not-allowed" : "pointer";
                          }
                        }}
                        onMouseLeave={(e) => {
                          const container = e.target.getStage()?.container();
                          if (container) {
                            container.style.cursor = "";
                          }
                        }}
                      />
                    );
                  })}
                </Group>
              );
            })}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
