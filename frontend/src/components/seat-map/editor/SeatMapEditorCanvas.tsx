import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { SeatMapEditorDocument, SeatMapEditorViewport } from "./seatMapEditorTypes";
import { SectorRenderer } from "../shared/SectorRenderer";
import { SeatRenderer } from "../shared/SeatRenderer";
import {
  asNumber,
  createFanSectorPath,
  createRingSectorPath,
  BoundsLike,
  polarToCartesian,
} from "../shared/sectorPathUtils";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_RATIO = 1.08;
const DEFAULT_VIEWPORT_WIDTH = 960;
const DEFAULT_VIEWPORT_HEIGHT = 640;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useHtmlImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.src = src;

    const handleLoad = () => setImage(nextImage);
    nextImage.addEventListener("load", handleLoad);

    return () => {
      nextImage.removeEventListener("load", handleLoad);
    };
  }, [src]);

  return image;
}

export interface SeatMapEditorCanvasProps {
  document: SeatMapEditorDocument;
  viewport: SeatMapEditorViewport;
  referenceImageVisible: boolean;
  selectedShapeIds: string[];
  selectedSeatId: string | null;
  selectedSeatIds: string[];
  onClearSeatSelection: () => void;
  onSelectShape: (shapeId: string | null, additive?: boolean) => void;
  onSelectSeat: (shapeId: string, seatId: string | null, additive?: boolean) => void;
  onViewportChange: (viewport: SeatMapEditorViewport) => void;
  onResizeShape: (
    shapeId: string,
    nextBounds: { x: number; y: number; width: number; height: number },
    nextPoints?: number[],
  ) => void;
  onSelectShapes: (shapeIds: string[]) => void;
  onTransformPolygon: (
    shapeId: string,
    nextBounds: { x: number; y: number; width: number; height: number },
    scaleX: number,
    scaleY: number,
  ) => void;
  onTranslateShape: (shapeId: string, deltaX: number, deltaY: number) => void;
  onTranslateShapes: (shapeIds: string[], deltaX: number, deltaY: number) => void;
  onMoveSeat: (shapeId: string, seatId: string, nextX: number, nextY: number) => void;
  onMoveSeatBlock: (shapeId: string, deltaX: number, deltaY: number) => void;
  resetViewKey?: number;
  onResizeSeatBlock: (
    shapeId: string,
    previousBounds: { x: number; y: number; width: number; height: number },
    nextBounds: { x: number; y: number; width: number; height: number },
  ) => void;
}

function getSeatBlockBounds(seats: Array<{ x: number; y: number }>, seatRadius: number = 0) {
  if (!seats.length) {
    return null;
  }

  const xs = seats.map((seat) => seat.x);
  const ys = seats.map((seat) => seat.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  const padding = 4;
  return {
    x: minX - seatRadius - padding,
    y: minY - seatRadius - padding,
    width: Math.max(maxX - minX + (seatRadius + padding) * 2, 1),
    height: Math.max(maxY - minY + (seatRadius + padding) * 2, 1),
  };
}

function getMapDataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function isAngleInSweep(angle: number, startAngle: number, endAngle: number) {
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  const target = normalizeAngle(angle);

  if (end >= start) {
    return target >= start && target <= end;
  }

  return target >= start || target <= end;
}

function getBoundsFromCoordinates(points: Array<{ x: number; y: number }>): BoundsLike {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function getShapeSeatRadius(shape: SeatMapEditorDocument["shapes"][number]) {
  return shape.seatLayout?.seatRadius ?? 6;
}

function getRadialShapeConfig(shape: SeatMapEditorDocument["shapes"][number]) {
  const mapData = getMapDataObject(shape.mapData);
  const cx = asNumber(mapData.cx) ?? shape.bounds.x + shape.bounds.width / 2;
  const cy = asNumber(mapData.cy) ?? shape.bounds.y + shape.bounds.height / 2;
  const outerRadius = Math.max(asNumber(mapData.outerRadius) ?? Math.max(shape.bounds.width, shape.bounds.height) / 2, 1);
  const innerRadius = Math.max(asNumber(mapData.innerRadius) ?? (shape.shapeType === "ringSection" ? outerRadius * 0.72 : 0), 0);
  const startAngle = asNumber(mapData.startAngle) ?? -70;
  const endAngle = asNumber(mapData.endAngle) ?? 70;

  return { cx, cy, outerRadius, innerRadius, startAngle, endAngle };
}

function getRadialShapeBounds(shape: SeatMapEditorDocument["shapes"][number]): BoundsLike {
  const config = getRadialShapeConfig(shape);
  const sampleAngles = [config.startAngle, config.endAngle, -180, -90, 0, 90, 180]
    .filter((angle) => isAngleInSweep(angle, config.startAngle, config.endAngle));
  const points = sampleAngles.flatMap((angle) => [
    polarToCartesian(config.cx, config.cy, config.outerRadius, angle),
    polarToCartesian(config.cx, config.cy, config.innerRadius, angle),
  ]);

  return getBoundsFromCoordinates(points);
}

function getShapeSelectionBounds(shape: SeatMapEditorDocument["shapes"][number]): BoundsLike {
  if (shape.shapeType === "ringSection" || shape.shapeType === "fan") {
    return getRadialShapeBounds(shape);
  }

  return shape.bounds;
}

function rectsIntersect(a: BoundsLike, b: BoundsLike) {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

function getRadialPathData(shape: SeatMapEditorDocument["shapes"][number]) {
  if (shape.shapeType !== "ringSection" && shape.shapeType !== "fan") {
    return null;
  }

  const config = getRadialShapeConfig(shape);
  return shape.shapeType === "ringSection"
    ? createRingSectorPath(config)
    : createFanSectorPath(config);
}

export default function SeatMapEditorCanvas({
  document,
  viewport,
  referenceImageVisible,
  selectedShapeIds,
  selectedSeatId,
  selectedSeatIds,
  onClearSeatSelection,
  onSelectShape,
  onSelectSeat,
  onViewportChange,
  onResizeShape,
  onSelectShapes,
  onTransformPolygon,
  onTranslateShape,
  onTranslateShapes,
  onMoveSeat,
  onMoveSeatBlock,
  resetViewKey = 0,
  onResizeSeatBlock,
}: SeatMapEditorCanvasProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transformerRef = useRef<any>(null);
  const seatOverlayTransformerRef = useRef<any>(null);
  const nodeRefs = useRef<Record<string, any>>({});
  const seatOverlayNodeRefs = useRef<Record<string, any>>({});
  const dragOriginRef = useRef<Record<string, { x: number; y: number }>>({});
  const seatDragOriginRef = useRef<Record<string, { x: number; y: number }>>({});
  const seatBlockDragOriginRef = useRef<
    Record<string, { x: number; y: number; width: number; height: number }>
  >({});
  const panStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    viewportX: number;
    viewportY: number;
    moved: boolean;
  } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 640 });
  const [isPanning, setIsPanning] = useState(false);
  const [selectionBox, setSelectionBox] = useState<BoundsLike | null>(null);
  const [seatBlockGuide, setSeatBlockGuide] = useState<{
    shapeId: string;
    showVertical: boolean;
    showHorizontal: boolean;
    lineX: number;
    lineY: number;
  } | null>(null);
  const lastFitKeyRef = useRef<string | null>(null);
  const referenceImage = useHtmlImage(document.referenceImageUrl);
  const stageOffset = useMemo(
    () => ({
      x: (viewportSize.width - DEFAULT_VIEWPORT_WIDTH) / 2,
      y: (viewportSize.height - DEFAULT_VIEWPORT_HEIGHT) / 2,
    }),
    [viewportSize.height, viewportSize.width],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? element.clientWidth;
      const nextHeight = entries[0]?.contentRect.height ?? element.clientHeight;
      setViewportSize({
        width: Math.max(nextWidth, 320),
        height: Math.max(nextHeight, 480),
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document.width || !document.height || !viewportSize.width || !viewportSize.height) {
      return;
    }

    const fitKey = `${document.width}x${document.height}:${resetViewKey}`;
    if (lastFitKeyRef.current === fitKey) {
      return;
    }
    lastFitKeyRef.current = fitKey;

    const horizontalPadding = 56;
    const topPadding = 96;
    const availableWidth = Math.max(viewportSize.width - horizontalPadding * 2, 320);
    const nextScale = clamp(
      availableWidth / document.width,
      MIN_SCALE,
      MAX_SCALE,
    );

    onViewportChange({
      scale: nextScale,
      x: (viewportSize.width - document.width * nextScale) / 2 - stageOffset.x,
      y: topPadding - stageOffset.y,
    });
  }, [
    document.height,
    document.width,
    onViewportChange,
    resetViewKey,
    stageOffset.x,
    stageOffset.y,
    viewportSize.height,
    viewportSize.width,
  ]);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }

    const selectedNodes = selectedShapeIds
      .map((shapeId) => {
        const targetShape = document.shapes.find((shape) => shape.id === shapeId);
        if (!targetShape || targetShape.locked) {
          return null;
        }

        return nodeRefs.current[shapeId];
      })
      .filter(Boolean);

    transformer.nodes(selectedNodes.length === 1 ? selectedNodes : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedShapeIds, document.shapes]);

  useEffect(() => {
    const transformer = seatOverlayTransformerRef.current;
    if (!transformer) {
      return;
    }

    const selectedShapeId = selectedShapeIds[0];
    const selectedShape = document.shapes.find((shape) => shape.id === selectedShapeId);
    const selectedNode = selectedShapeId ? seatOverlayNodeRefs.current[selectedShapeId] : null;

    if (selectedShape && selectedShape.seats.length && selectedNode) {
      transformer.nodes([selectedNode]);
    } else {
      transformer.nodes([]);
    }

    transformer.getLayer()?.batchDraw();
  }, [selectedShapeIds, document.shapes]);

  const worldStyle = useMemo(
    () => ({
      x: viewport.x + stageOffset.x,
      y: viewport.y + stageOffset.y,
      scaleX: viewport.scale,
      scaleY: viewport.scale,
    }),
    [stageOffset.x, stageOffset.y, viewport],
  );

  const handleWheel = (event: any) => {
    event.evt.preventDefault();

    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) {
      return;
    }

    const oldScale = viewport.scale;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextScale = clamp(
      direction > 0 ? oldScale * ZOOM_RATIO : oldScale / ZOOM_RATIO,
      MIN_SCALE,
      MAX_SCALE,
    );

    const mousePoint = {
      x: (pointer.x - worldStyle.x) / oldScale,
      y: (pointer.y - worldStyle.y) / oldScale,
    };

    onViewportChange({
      scale: nextScale,
      x: pointer.x - mousePoint.x * nextScale - stageOffset.x,
      y: pointer.y - mousePoint.y * nextScale - stageOffset.y,
    });
  };

  const getWorldPointer = (event: any) => {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) {
      return null;
    }

    return {
      x: (pointer.x - worldStyle.x) / viewport.scale,
      y: (pointer.y - worldStyle.y) / viewport.scale,
    };
  };

  const normalizeSelectionBox = (start: { x: number; y: number }, end: { x: number; y: number }): BoundsLike => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  });

  const handleMouseDown = (event: any) => {
    if (event.evt.button === 2) {
      const pointer = getWorldPointer(event);
      if (!pointer) {
        return;
      }

      event.evt.preventDefault();
      selectionStartRef.current = pointer;
      setSelectionBox({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
      return;
    }

    const targetName = event.target.attrs?.name;
    if (
      targetName === "shape-node" ||
      targetName === "seat-node" ||
      targetName === "seat-block-node" ||
      (typeof targetName === "string" && targetName.includes("anchor"))
    ) {
      return;
    }

    if (targetName === "seat-map-background") {
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) {
        return;
      }

      event.evt.preventDefault();
      panStartRef.current = {
        pointerX: pointer.x,
        pointerY: pointer.y,
        viewportX: viewport.x,
        viewportY: viewport.y,
        moved: false,
      };
      setIsPanning(true);
    }
  };

  const handleMouseMove = (event: any) => {
    const selectionStart = selectionStartRef.current;
    if (selectionStart) {
      const pointer = getWorldPointer(event);
      if (!pointer) {
        return;
      }

      event.evt.preventDefault();
      setSelectionBox(normalizeSelectionBox(selectionStart, pointer));
      return;
    }

    const panStart = panStartRef.current;
    if (!panStart) {
      return;
    }

    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) {
      return;
    }

    const deltaX = pointer.x - panStart.pointerX;
    const deltaY = pointer.y - panStart.pointerY;
    const moved = Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;
    panStartRef.current = {
      ...panStart,
      moved: panStart.moved || moved,
    };

    onViewportChange({
      ...viewport,
      x: panStart.viewportX + deltaX,
      y: panStart.viewportY + deltaY,
    });
  };

  const handleMouseUp = () => {
    const selectionStart = selectionStartRef.current;
    if (selectionStart && selectionBox) {
      const selectedIds = document.shapes
        .filter((shape) => shape.visible !== false && shape.mapData?.decorative !== true)
        .filter((shape) => shape.shapeType !== "stage" && shape.shapeType !== "foh")
        .filter((shape) => rectsIntersect(selectionBox, getShapeSelectionBounds(shape)))
        .map((shape) => shape.id);

      selectionStartRef.current = null;
      setSelectionBox(null);
      onSelectShapes(selectedIds);
      return;
    }

    const panStart = panStartRef.current;
    if (!panStart) {
      return;
    }

    panStartRef.current = null;
    setIsPanning(false);

    if (!panStart.moved) {
      onClearSeatSelection();
    }
  };

  const isAdditiveSelection = (nativeEvent: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) =>
    Boolean(nativeEvent.ctrlKey || nativeEvent.metaKey || nativeEvent.shiftKey);
  const getShapeMoveTargetIds = (shapeId: string) =>
    selectedShapeIds.length > 1 && selectedShapeIds.includes(shapeId) ? selectedShapeIds : [shapeId];
  const orderedShapes = useMemo(() => {
    const regularShapes = document.shapes.filter(
      (shape) => shape.shapeType !== "stage" && shape.shapeType !== "foh" && shape.mapData?.decorative !== true,
    );
    const overlayShapes = document.shapes.filter(
      (shape) => shape.shapeType === "stage" || shape.shapeType === "foh" || shape.mapData?.decorative === true,
    );
    return [...regularShapes, ...overlayShapes];
  }, [document.shapes]);
  const stageBlockWidth = Math.min(document.width * 0.76, 620);
  const stageBlockHeight = 135;
  const stageBlockX = (document.width - stageBlockWidth) / 2;
  const stageBlockY = 92;
  const stageBlockPath = `
    M ${stageBlockX} ${stageBlockY}
    Q ${stageBlockX + stageBlockWidth / 2} ${stageBlockY - 34}
      ${stageBlockX + stageBlockWidth} ${stageBlockY}
    L ${stageBlockX + stageBlockWidth} ${stageBlockY + 28}
    C ${stageBlockX + stageBlockWidth * 0.82} ${stageBlockY + stageBlockHeight},
      ${stageBlockX + stageBlockWidth * 0.18} ${stageBlockY + stageBlockHeight},
      ${stageBlockX} ${stageBlockY + 28}
    Z
  `;
  return (
    <div
      ref={containerRef}
      className={`organizer-seat-map-canvas-shell${isPanning ? " is-panning" : ""}`}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Stage
        width={viewportSize.width}
        height={viewportSize.height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        onContextMenu={(event: any) => event.evt.preventDefault()}
      >
        <Layer>
          <Rect
            name="seat-map-background"
            x={0}
            y={0}
            width={viewportSize.width}
            height={viewportSize.height}
            cornerRadius={24}
            fill="#0f172a"
            stroke="rgba(148, 163, 184, 0.34)"
            strokeWidth={1}
          />
          <Rect
            name="seat-map-background"
            x={0}
            y={0}
            width={viewportSize.width}
            height={viewportSize.height}
            fillLinearGradientStartPoint={{ x: 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: viewportSize.width, y: viewportSize.height }}
            fillLinearGradientColorStops={[0, "#0b1220", 0.5, "#102231", 1, "#0d1d2b"]}
            cornerRadius={24}
            opacity={0.98}
          />
        </Layer>

        <Layer>
          <Group {...worldStyle}>
            {referenceImageVisible && referenceImage ? (
              <KonvaImage
                image={referenceImage}
                x={0}
                y={0}
                width={document.width}
                height={document.height}
                opacity={0.34}
                listening={false}
              />
            ) : null}

            {orderedShapes.map((shape) => {
              if (!shape.visible) {
                return null;
              }

              const isSelected = selectedShapeIds.includes(shape.id);
              const draggable = !shape.locked;

              return (
                <Group key={shape.id}>
                  <SectorRenderer
                    sector={{
                      id: shape.id,
                      name: shape.name,
                      label: shape.label,
                      sectorType: shape.sectorType,
                      shapeType: shape.shapeType,
                      color: shape.color,
                      bounds: shape.bounds,
                      points: shape.points,
                      mapData: shape.mapData,
                    }}
                    selected={isSelected}
                    draggable={false}
                    pointsAreRelative
                    showDepth
                    showLabel={false}
                    listening={false}
                  />
                  {shape.shapeType === "polygon" && shape.points.length >= 6 ? (
                    <>
                      <Line
                        ref={(node) => {
                          nodeRefs.current[shape.id] = node;
                        }}
                        name="shape-node"
                        x={shape.bounds.x}
                        y={shape.bounds.y}
                        points={shape.points}
                        closed
                        draggable={draggable}
                        fill="rgba(0, 0, 0, 0)"
                        stroke="rgba(0, 0, 0, 0)"
                        strokeWidth={Math.max(isSelected ? 3 : 2, 12)}
                        onClick={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                        onTap={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                        onDragStart={() => {
                          dragOriginRef.current[shape.id] = {
                            x: shape.bounds.x,
                            y: shape.bounds.y,
                          };
                        }}
                        onDragEnd={(event) => {
                          const origin = dragOriginRef.current[shape.id];
                          if (!origin) {
                            return;
                          }
                          const nextX = event.target.x();
                          const nextY = event.target.y();
                          const targetShapeIds = getShapeMoveTargetIds(shape.id);
                          const deltaX = nextX - origin.x;
                          const deltaY = nextY - origin.y;
                          if (targetShapeIds.length > 1) {
                            onTranslateShapes(targetShapeIds, deltaX, deltaY);
                          } else {
                            onTranslateShape(shape.id, deltaX, deltaY);
                          }
                          event.target.position({ x: shape.bounds.x, y: shape.bounds.y });
                        }}
                        onTransformEnd={(event) => {
                          const node = event.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          const nextBounds = {
                            x: node.x(),
                            y: node.y(),
                            width: Math.max(shape.bounds.width * scaleX, 24),
                            height: Math.max(shape.bounds.height * scaleY, 24),
                          };

                          onTransformPolygon(shape.id, nextBounds, scaleX, scaleY);
                          node.scaleX(1);
                          node.scaleY(1);
                          node.position({ x: nextBounds.x, y: nextBounds.y });
                        }}
                      />

                    </>
                  ) : shape.shapeType === "ringSection" || shape.shapeType === "fan" ? (
                    <Path
                      ref={(node) => {
                        nodeRefs.current[shape.id] = node;
                      }}
                      name="shape-node"
                      data={getRadialPathData(shape) ?? ""}
                      draggable={draggable}
                      fill="rgba(0, 0, 0, 0.01)"
                      stroke="rgba(0, 0, 0, 0)"
                      strokeWidth={Math.max(isSelected ? 3 : 2, 12)}
                      onClick={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                      onTap={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                      onDragStart={() => {
                        dragOriginRef.current[shape.id] = { x: 0, y: 0 };
                      }}
                      onDragEnd={(event) => {
                        const origin = dragOriginRef.current[shape.id];
                        if (!origin) {
                          return;
                        }
                        const nextX = event.target.x();
                        const nextY = event.target.y();
                        const targetShapeIds = getShapeMoveTargetIds(shape.id);
                        const deltaX = nextX - origin.x;
                        const deltaY = nextY - origin.y;
                        if (targetShapeIds.length > 1) {
                          onTranslateShapes(targetShapeIds, deltaX, deltaY);
                        } else {
                          onTranslateShape(shape.id, deltaX, deltaY);
                        }
                        event.target.position({ x: 0, y: 0 });
                      }}
                      onTransformEnd={(event) => {
                        const node = event.target as any;
                        node.scaleX(1);
                        node.scaleY(1);
                        node.position({ x: 0, y: 0 });
                      }}
                    />
                  ) : shape.shapeType === "circle" || shape.shapeType === "ellipse" ? (
                    <>
                      <Ellipse
                        ref={(node) => {
                          nodeRefs.current[shape.id] = node;
                        }}
                        name="shape-node"
                        x={shape.bounds.x + shape.bounds.width / 2}
                        y={shape.bounds.y + shape.bounds.height / 2}
                        radiusX={shape.bounds.width / 2}
                        radiusY={shape.bounds.height / 2}
                        draggable={draggable}
                        fill="rgba(0, 0, 0, 0)"
                        stroke="rgba(0, 0, 0, 0)"
                        strokeWidth={Math.max(isSelected ? 3 : 2, 12)}
                        onClick={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                        onTap={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                        onDragStart={() => {
                          dragOriginRef.current[shape.id] = {
                            x: shape.bounds.x + shape.bounds.width / 2,
                            y: shape.bounds.y + shape.bounds.height / 2,
                          };
                        }}
                        onDragEnd={(event) => {
                          const origin = dragOriginRef.current[shape.id];
                          if (!origin) {
                            return;
                          }
                          const nextX = event.target.x();
                          const nextY = event.target.y();
                          const targetShapeIds = getShapeMoveTargetIds(shape.id);
                          const deltaX = nextX - origin.x;
                          const deltaY = nextY - origin.y;
                          if (targetShapeIds.length > 1) {
                            onTranslateShapes(targetShapeIds, deltaX, deltaY);
                          } else {
                            onTranslateShape(shape.id, deltaX, deltaY);
                          }
                          event.target.position({
                            x: shape.bounds.x + shape.bounds.width / 2,
                            y: shape.bounds.y + shape.bounds.height / 2,
                          });
                        }}
                        onTransformEnd={(event) => {
                          const node = event.target as any;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          const nextWidth = Math.max(shape.bounds.width * scaleX, 24);
                          const nextHeight =
                            shape.shapeType === "circle"
                              ? nextWidth
                              : Math.max(shape.bounds.height * scaleY, 24);
                          const nextBounds = {
                            x: node.x() - nextWidth / 2,
                            y: node.y() - nextHeight / 2,
                            width: nextWidth,
                            height: nextHeight,
                          };

                          onResizeShape(shape.id, nextBounds);
                          node.scaleX(1);
                          node.scaleY(1);
                          node.position({
                            x: nextBounds.x + nextBounds.width / 2,
                            y: nextBounds.y + nextBounds.height / 2,
                          });
                          node.radiusX(nextBounds.width / 2);
                          node.radiusY(nextBounds.height / 2);
                        }}
                      />

                    </>
                  ) : (
                    <>
                      <Rect
                        ref={(node) => {
                          nodeRefs.current[shape.id] = node;
                        }}
                        name="shape-node"
                        x={shape.bounds.x}
                        y={shape.bounds.y}
                        width={shape.bounds.width}
                        height={shape.bounds.height}
                        cornerRadius={20}
                        draggable={draggable}
                        fill="rgba(0, 0, 0, 0)"
                        stroke="rgba(0, 0, 0, 0)"
                        strokeWidth={Math.max(isSelected ? 3 : 2, 12)}
                        onClick={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                        onTap={(event) => onSelectShape(shape.id, isAdditiveSelection(event.evt as any))}
                        onDragStart={() => {
                          dragOriginRef.current[shape.id] = {
                            x: shape.bounds.x,
                            y: shape.bounds.y,
                          };
                        }}
                        onDragEnd={(event) => {
                          const origin = dragOriginRef.current[shape.id];
                          if (!origin) {
                            return;
                          }
                          const nextX = event.target.x();
                          const nextY = event.target.y();
                          const targetShapeIds = getShapeMoveTargetIds(shape.id);
                          const deltaX = nextX - origin.x;
                          const deltaY = nextY - origin.y;
                          if (targetShapeIds.length > 1) {
                            onTranslateShapes(targetShapeIds, deltaX, deltaY);
                          } else {
                            onTranslateShape(shape.id, deltaX, deltaY);
                          }
                          event.target.position({ x: shape.bounds.x, y: shape.bounds.y });
                        }}
                        onTransformEnd={(event) => {
                          const node = event.target;
                          const scaleX = node.scaleX();
                          const scaleY = node.scaleY();
                          const nextBounds = {
                            x: node.x(),
                            y: node.y(),
                            width: Math.max(node.width() * scaleX, 24),
                            height: Math.max(node.height() * scaleY, 24),
                          };

                          onResizeShape(shape.id, nextBounds);
                          node.scaleX(1);
                          node.scaleY(1);
                          node.position({ x: nextBounds.x, y: nextBounds.y });
                          node.size({
                            width: nextBounds.width,
                            height: nextBounds.height,
                          });
                        }}
                      />

                    </>
                  )}

                  <Text
                    x={shape.bounds.x}
                    y={shape.bounds.y + shape.bounds.height + 12}
                    text={`${shape.seatCount} seats`}
                    fontSize={12}
                    fill="rgba(226, 232, 240, 0.86)"
                    listening={false}
                  />

                  {shape.seats.map((seat) => {
                    const isSeatSelected = selectedSeatId === seat.id || selectedSeatIds.includes(seat.id);
                    const isSeatHidden = seat.hidden === true;
                    const seatEditingEnabled = shape.locked;

                    return (
                      <Group key={seat.id}>
                        <SeatRenderer
                          id={seat.id}
                          x={seat.x}
                          y={seat.y}
                          radius={getShapeSeatRadius(shape)}
                          status={seat.inventoryStatus}
                          selected={isSeatSelected}
                          hidden={isSeatHidden}
                          disabled={!seatEditingEnabled}
                          color={seat.colorCode ?? shape.color}
                          editable={seatEditingEnabled}
                          draggable={seatEditingEnabled && !isSeatHidden}
                          memoizeEventHandlers
                          onClick={(event) => {
                            if (!seatEditingEnabled) {
                              return;
                            }
                            event.cancelBubble = true;
                            onSelectSeat(shape.id, seat.id, true);
                          }}
                          onTap={(event) => {
                            if (!seatEditingEnabled) {
                              return;
                            }
                            event.cancelBubble = true;
                            onSelectSeat(shape.id, seat.id, true);
                          }}
                          onDragStart={() => {
                            seatDragOriginRef.current[seat.id] = {
                              x: seat.x,
                              y: seat.y,
                            };
                          }}
                          onDragEnd={(event) => {
                            const nextX = event.target.x();
                            const nextY = event.target.y();
                            onMoveSeat(shape.id, seat.id, nextX, nextY);
                          }}
                        />
                      </Group>
                    );
                  })}

                  {isSelected && shape.seats.length ? (() => {
                    const seatBlockBounds = getSeatBlockBounds(shape.seats, getShapeSeatRadius(shape));
                    if (!seatBlockBounds) {
                      return null;
                    }
                    const frameX = seatBlockBounds.x;
                    const frameY = seatBlockBounds.y;
                    const frameWidth = Math.max(seatBlockBounds.width, 18);
                    const frameHeight = Math.max(seatBlockBounds.height, 18);
                    const shapeCenterX = shape.bounds.x + shape.bounds.width / 2;
                    const shapeCenterY = shape.bounds.y + shape.bounds.height / 2;

                    return (
                      <>
                        <Rect
                          ref={(node) => {
                            seatOverlayNodeRefs.current[shape.id] = node;
                          }}
                          name="seat-block-node"
                          x={frameX}
                          y={frameY}
                          width={frameWidth}
                          height={frameHeight}
                          cornerRadius={12}
                          stroke="rgba(34, 197, 94, 0.9)"
                          strokeWidth={1.5}
                          dash={[8, 6]}
                          hitStrokeWidth={14}
                          fillEnabled={false}
                          draggable
                          onClick={(event) => {
                            event.cancelBubble = true;
                            onSelectShape(shape.id, false);
                          }}
                          onTap={(event) => {
                            event.cancelBubble = true;
                            onSelectShape(shape.id, false);
                          }}
                          onDragStart={(event) => {
                            seatBlockDragOriginRef.current[shape.id] = {
                              x: frameX,
                              y: frameY,
                              width: frameWidth,
                              height: frameHeight,
                            };
                            event.target.opacity(0.9);
                          }}
                          onDragMove={(event) => {
                            const origin = seatBlockDragOriginRef.current[shape.id];
                            if (!origin) {
                              return;
                            }

                            const nextCenterX = event.target.x() + origin.width / 2;
                            const nextCenterY = event.target.y() + origin.height / 2;
                            const showVertical = Math.abs(nextCenterX - shapeCenterX) <= 8;
                            const showHorizontal = Math.abs(nextCenterY - shapeCenterY) <= 8;

                            setSeatBlockGuide({
                              shapeId: shape.id,
                              showVertical,
                              showHorizontal,
                              lineX: shapeCenterX,
                              lineY: shapeCenterY,
                            });
                          }}
                          onDragEnd={(event) => {
                            const origin = seatBlockDragOriginRef.current[shape.id];
                            if (!origin) {
                              return;
                            }

                            const nextX = event.target.x();
                            const nextY = event.target.y();
                            const nextCenterX = nextX + origin.width / 2;
                            const nextCenterY = nextY + origin.height / 2;
                            const snapVertical = Math.abs(nextCenterX - shapeCenterX) <= 8;
                            const snapHorizontal = Math.abs(nextCenterY - shapeCenterY) <= 8;

                            const snapDeltaX = snapVertical ? shapeCenterX - nextCenterX : 0;
                            const snapDeltaY = snapHorizontal ? shapeCenterY - nextCenterY : 0;
                            const deltaX = nextX - origin.x + snapDeltaX;
                            const deltaY = nextY - origin.y + snapDeltaY;

                            onMoveSeatBlock(shape.id, deltaX, deltaY);
                            event.target.opacity(1);
                            event.target.position({ x: origin.x, y: origin.y });
                            setSeatBlockGuide(null);
                          }}
                          onTransformStart={() => {
                            seatBlockDragOriginRef.current[shape.id] = {
                              x: frameX,
                              y: frameY,
                              width: frameWidth,
                              height: frameHeight,
                            };
                          }}
                          onTransformEnd={(event) => {
                            const origin = seatBlockDragOriginRef.current[shape.id];
                            if (!origin) {
                              return;
                            }

                            const node = event.target;
                            const scaleX = node.scaleX();
                            const scaleY = node.scaleY();
                            const nextBounds = {
                              x: node.x(),
                              y: node.y(),
                              width: Math.max(node.width() * scaleX, 18),
                              height: Math.max(node.height() * scaleY, 18),
                            };

                            onResizeSeatBlock(
                              shape.id,
                              {
                                x: origin.x,
                                y: origin.y,
                                width: origin.width,
                                height: origin.height,
                              },
                              nextBounds,
                            );

                            node.scaleX(1);
                            node.scaleY(1);
                            node.position({ x: origin.x, y: origin.y });
                            node.size({ width: origin.width, height: origin.height });
                            setSeatBlockGuide(null);
                          }}
                        />

                        {seatBlockGuide?.shapeId === shape.id && seatBlockGuide.showVertical ? (
                          <Line
                            points={[
                              seatBlockGuide.lineX,
                              shape.bounds.y,
                              seatBlockGuide.lineX,
                              shape.bounds.y + shape.bounds.height,
                            ]}
                            stroke="rgba(34, 197, 94, 0.92)"
                            strokeWidth={1.2}
                            dash={[6, 5]}
                            listening={false}
                          />
                        ) : null}

                        {seatBlockGuide?.shapeId === shape.id && seatBlockGuide.showHorizontal ? (
                          <Line
                            points={[
                              shape.bounds.x,
                              seatBlockGuide.lineY,
                              shape.bounds.x + shape.bounds.width,
                              seatBlockGuide.lineY,
                            ]}
                            stroke="rgba(34, 197, 94, 0.92)"
                            strokeWidth={1.2}
                            dash={[6, 5]}
                            listening={false}
                          />
                        ) : null}
                      </>
                    );
                  })() : null}
                </Group>
              );
            })}

            <Path
              data={stageBlockPath}
              fill="#1e293b"
              stroke="#475569"
              strokeWidth={2.5}
              listening={false}
              shadowColor="rgba(0, 0, 0, 0.45)"
              shadowBlur={10}
              shadowOffset={{ x: 0, y: 6 }}
              shadowOpacity={0.65}
            />
            <Text
              x={stageBlockX}
              y={stageBlockY + 28}
              width={stageBlockWidth}
              align="center"
              text={t("seatMap.stage")}
              fontSize={34}
              fontStyle="700"
              fill="#94a3b8"
              listening={false}
              shadowColor="rgba(0, 0, 0, 0.5)"
              shadowBlur={4}
              shadowOffset={{ x: 0, y: 2 }}
              shadowOpacity={1}
            />

            {selectionBox ? (
              <Rect
                x={selectionBox.x}
                y={selectionBox.y}
                width={selectionBox.width}
                height={selectionBox.height}
                fill="rgba(34, 197, 94, 0.12)"
                stroke="rgba(255, 255, 255, 0.92)"
                strokeWidth={1.5}
                dash={[8, 6]}
                listening={false}
              />
            ) : null}

            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              borderStroke="#ffffff"
              borderStrokeWidth={1.5}
              anchorStroke="#ffffff"
              anchorFill="#19454f"
              anchorSize={9}
              ignoreStroke
              enabledAnchors={[
                "top-left",
                "top-center",
                "top-right",
                "middle-right",
                "bottom-right",
                "bottom-center",
                "bottom-left",
                "middle-left",
              ]}
              boundBoxFunc={(_, nextBox) => ({
                ...nextBox,
                width: Math.max(nextBox.width, 24),
                height: Math.max(nextBox.height, 24),
              })}
            />

            <Transformer
              ref={seatOverlayTransformerRef}
              rotateEnabled={false}
              borderStroke="rgba(34, 197, 94, 0.95)"
              borderStrokeWidth={1.5}
              anchorStroke="rgba(22, 163, 74, 1)"
              anchorFill="#dcfce7"
              anchorSize={8}
              ignoreStroke
              enabledAnchors={[
                "top-left",
                "top-center",
                "top-right",
                "middle-right",
                "bottom-right",
                "bottom-center",
                "bottom-left",
                "middle-left",
              ]}
              boundBoxFunc={(_, nextBox) => ({
                ...nextBox,
                width: Math.max(nextBox.width, 18),
                height: Math.max(nextBox.height, 18),
              })}
            />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
