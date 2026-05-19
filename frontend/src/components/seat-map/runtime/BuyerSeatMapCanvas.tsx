import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Ellipse,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";
import { PublicSeatMap, PublicSeatSector, PublicSeat } from "../../../types/api";

interface BuyerSeatMapCanvasProps {
  seatMap: PublicSeatMap;
  zoom: number;
  pan: { x: number; y: number };
  selectedSeatIds: string[];
  onPanChange: (pan: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  onSeatClick: (sector: PublicSeatSector, seat: PublicSeat) => void;
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

function getPolygonPoints(sector: PublicSeatSector) {
  const points = Array.isArray(sector.mapData?.points) ? sector.mapData?.points : [];
  return points.filter((point): point is number => typeof point === "number");
}

function getShapeType(sector: PublicSeatSector) {
  return typeof sector.mapData?.shapeType === "string" ? sector.mapData.shapeType : "rectangle";
}

function getSeatRadius(sector: PublicSeatSector) {
  return Math.max(
    asNumber((sector.mapData?.seatLayout as Record<string, unknown> | undefined)?.seatRadius) ?? 6,
    4,
  );
}

function getSeatFill(status?: string, selected = false) {
  if (selected) {
    return "#16a34a";
  }

  switch (status) {
    case "SOLD":
      return "#e2e8f0";
    case "RESERVED":
      return "#fef3c7";
    case "LOCKED":
      return "#dbeafe";
    default:
      return "#f8fafc";
  }
}

function getSeatStroke(status?: string, selected = false, colorCode?: string) {
  if (selected) {
    return "#166534";
  }

  switch (status) {
    case "SOLD":
      return "#cbd5e1";
    case "RESERVED":
      return "#f59e0b";
    case "LOCKED":
      return "#60a5fa";
    default:
      return colorCode || "#16a34a";
  }
}

export default function BuyerSeatMapCanvas({
  seatMap,
  zoom,
  pan,
  selectedSeatIds,
  onPanChange,
  onZoomChange,
  onSeatClick,
}: BuyerSeatMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 620 });
  const [isPanning, setIsPanning] = useState(false);
  const panOriginRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(
    null,
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? element.clientWidth;
      const nextHeight = Math.max(420, Math.min(760, nextWidth * 0.62));
      setViewportSize({
        width: Math.max(320, nextWidth),
        height: nextHeight,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const maxSectorRight = Math.max(0, ...(seatMap.sectors ?? []).map(s => getSectorBounds(s).x + getSectorBounds(s).width));
  const maxSectorBottom = Math.max(0, ...(seatMap.sectors ?? []).map(s => getSectorBounds(s).y + getSectorBounds(s).height));

  // Tăng vùng đệm bottom/right để các ghế không bị sát mép
  const fallbackWidth = maxSectorRight + 160;
  const fallbackHeight = maxSectorBottom + 160;

  // Tính toán vùng render vừa khít với nội dung map + lề thay vì lấy cứng 1280x720 gây khoảng trắng dư
  const documentWidth = Math.max(seatMap.backgroundWidth ? Math.min(seatMap.backgroundWidth, fallbackWidth) : fallbackWidth, 640);
  const documentHeight = Math.max(seatMap.backgroundHeight ? Math.min(seatMap.backgroundHeight, fallbackHeight) : fallbackHeight, 420);

  const baseX = (viewportSize.width - documentWidth * zoom) / 2;
  const baseY = (viewportSize.height - documentHeight * zoom) / 2;

  const worldStyle = useMemo(
    () => ({
      x: baseX + pan.x,
      y: baseY + pan.y,
      scaleX: zoom,
      scaleY: zoom,
    }),
    [baseX, baseY, pan.x, pan.y, zoom],
  );

  const handleWheel = (event: any) => {
    event.evt.preventDefault();
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) {
      return;
    }

    const oldScale = zoom;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextScale = clamp(direction > 0 ? oldScale * 1.08 : oldScale / 1.08, 0.2, 3);
    
    // Position of mouse relative to unscaled document
    const mousePoint = {
      x: (pointer.x - (baseX + pan.x)) / oldScale,
      y: (pointer.y - (baseY + pan.y)) / oldScale,
    };

    const nextBaseX = (viewportSize.width - documentWidth * nextScale) / 2;
    const nextBaseY = (viewportSize.height - documentHeight * nextScale) / 2;

    const newWorldX = pointer.x - mousePoint.x * nextScale;
    const newWorldY = pointer.y - mousePoint.y * nextScale;

    onZoomChange(nextScale);
    onPanChange({
      x: newWorldX - nextBaseX,
      y: newWorldY - nextBaseY,
    });
  };

  const handleMouseDown = (event: any) => {
    if (event.target.attrs?.name === "seat-node") {
      return;
    }

    panOriginRef.current = {
      pointerX: event.evt.clientX,
      pointerY: event.evt.clientY,
      x: pan.x,
      y: pan.y,
    };
    setIsPanning(true);
  };

  const handleMouseMove = (event: any) => {
    if (!isPanning || !panOriginRef.current) {
      return;
    }

    onPanChange({
      x: panOriginRef.current.x + event.evt.clientX - panOriginRef.current.pointerX,
      y: panOriginRef.current.y + event.evt.clientY - panOriginRef.current.pointerY,
    });
  };

  const endPan = () => {
    panOriginRef.current = null;
    setIsPanning(false);
  };

  return (
    <div
      ref={containerRef}
      className={`buyer-seat-map-canvas ${isPanning ? "is-panning" : ""}`}
    >
      <Stage
        width={viewportSize.width}
        height={viewportSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endPan}
        onMouseLeave={endPan}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={viewportSize.width}
            height={viewportSize.height}
            fill="#071722"
          />
        </Layer>
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
              const points = getPolygonPoints(sector);
              const shapeType = getShapeType(sector);
              const seatRadius = getSeatRadius(sector);
              const colorCode = sector.colorCode || "#16a34a";

              return (
                <Group key={sector.id}>
                  {points.length >= 6 ? (
                    <Line
                      x={0}
                      y={0}
                      points={points}
                      closed
                      fill={`${colorCode}1f`}
                      stroke={colorCode}
                      strokeWidth={2}
                      listening={false}
                    />
                  ) : shapeType === "circle" || shapeType === "ellipse" ? (
                    <Ellipse
                      x={bounds.x + bounds.width / 2}
                      y={bounds.y + bounds.height / 2}
                      radiusX={bounds.width / 2}
                      radiusY={bounds.height / 2}
                      fill={`${colorCode}1f`}
                      stroke={colorCode}
                      strokeWidth={2}
                      listening={false}
                    />
                  ) : (
                    <Rect
                      x={bounds.x}
                      y={bounds.y}
                      width={bounds.width}
                      height={bounds.height}
                      cornerRadius={20}
                      fill={`${colorCode}1f`}
                      stroke={colorCode}
                      strokeWidth={2}
                      listening={false}
                    />
                  )}


                  {(sector.seatsData ?? []).map((seat) => {
                    const isSelected = selectedSeatIds.includes(seat.id);
                    const disabled = seat.isActive === false || seat.inventoryStatus !== "AVAILABLE";
                    const x = asNumber(seat.coordX) ?? 0;
                    const y = asNumber(seat.coordY) ?? 0;

                    return (
                      <Group
                        key={seat.id}
                        name="seat-node"
                        x={x}
                        y={y}
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
                        opacity={disabled ? 0.78 : 1}
                      >
                        <Circle
                          x={0}
                          y={0}
                          radius={seatRadius}
                          fill={getSeatFill(seat.inventoryStatus, isSelected)}
                          stroke={getSeatStroke(seat.inventoryStatus, isSelected, colorCode)}
                          strokeWidth={isSelected ? 2 : 1.5}
                        />
                        {isSelected && (
                          <Line
                            x={0}
                            y={0}
                            points={[
                              -seatRadius * 0.35,
                              0,
                              -seatRadius * 0.1,
                              seatRadius * 0.3,
                              seatRadius * 0.5,
                              -seatRadius * 0.35,
                            ]}
                            stroke="#ffffff"
                            strokeWidth={Math.max(1.5, seatRadius * 0.3)}
                            lineCap="round"
                            lineJoin="round"
                            listening={false}
                          />
                        )}
                      </Group>
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
