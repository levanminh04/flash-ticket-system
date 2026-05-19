import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { SeatMapEditorDocument, SeatMapEditorViewport } from "./seatMapEditorTypes";

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const ZOOM_RATIO = 1.08;

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
  onClearSelection: () => void;
  onSelectShape: (shapeId: string | null, additive?: boolean) => void;
  onSelectSeat: (shapeId: string, seatId: string | null) => void;
  onViewportChange: (viewport: SeatMapEditorViewport) => void;
  onResizeShape: (
    shapeId: string,
    nextBounds: { x: number; y: number; width: number; height: number },
    nextPoints?: number[],
  ) => void;
  onTransformPolygon: (
    shapeId: string,
    nextBounds: { x: number; y: number; width: number; height: number },
    scaleX: number,
    scaleY: number,
  ) => void;
  onTranslateShape: (shapeId: string, deltaX: number, deltaY: number) => void;
  onMoveSeat: (shapeId: string, seatId: string, nextX: number, nextY: number) => void;
  onMoveSeatBlock: (shapeId: string, deltaX: number, deltaY: number) => void;
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

export default function SeatMapEditorCanvas({
  document,
  viewport,
  referenceImageVisible,
  selectedShapeIds,
  selectedSeatId,
  onClearSelection,
  onSelectShape,
  onSelectSeat,
  onViewportChange,
  onResizeShape,
  onTransformPolygon,
  onTranslateShape,
  onMoveSeat,
  onMoveSeatBlock,
  onResizeSeatBlock,
}: SeatMapEditorCanvasProps) {
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
  const [viewportSize, setViewportSize] = useState({ width: 960, height: 640 });
  const [isPanning, setIsPanning] = useState(false);
  const [seatBlockGuide, setSeatBlockGuide] = useState<{
    shapeId: string;
    showVertical: boolean;
    showHorizontal: boolean;
    lineX: number;
    lineY: number;
  } | null>(null);
  const panOriginRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(
    null,
  );
  const referenceImage = useHtmlImage(document.referenceImageUrl);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? element.clientWidth;
      const nextHeight = Math.max(480, Math.min(820, nextWidth * 0.62));
      setViewportSize({
        width: Math.max(nextWidth, 320),
        height: nextHeight,
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

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
      x: viewport.x,
      y: viewport.y,
      scaleX: viewport.scale,
      scaleY: viewport.scale,
    }),
    [viewport],
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
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };

    onViewportChange({
      scale: nextScale,
      x: pointer.x - mousePoint.x * nextScale,
      y: pointer.y - mousePoint.y * nextScale,
    });
  };

  const beginPan = (pointerX: number, pointerY: number) => {
    panOriginRef.current = {
      pointerX,
      pointerY,
      x: viewport.x,
      y: viewport.y,
    };
    setIsPanning(true);
  };

  const handleMouseDown = (event: any) => {
    const targetName = event.target.attrs?.name;
    if (
      targetName === "shape-node" ||
      targetName === "seat-node" ||
      targetName === "seat-block-node" ||
      (typeof targetName === "string" && targetName.includes("anchor"))
    ) {
      return;
    }

    beginPan(event.evt.clientX, event.evt.clientY);
    if (targetName === "seat-map-background") {
      onClearSelection();
    }
  };

  const handleMouseMove = (event: any) => {
    if (!isPanning || !panOriginRef.current) {
      return;
    }

    const deltaX = event.evt.clientX - panOriginRef.current.pointerX;
    const deltaY = event.evt.clientY - panOriginRef.current.pointerY;

    onViewportChange({
      ...viewport,
      x: panOriginRef.current.x + deltaX,
      y: panOriginRef.current.y + deltaY,
    });
  };

  const endPan = () => {
    panOriginRef.current = null;
    setIsPanning(false);
  };

  const isAdditiveSelection = (nativeEvent: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) =>
    Boolean(nativeEvent.ctrlKey || nativeEvent.metaKey || nativeEvent.shiftKey);

  return (
    <div
      ref={containerRef}
      className={`organizer-seat-map-canvas-shell ${isPanning ? "is-panning" : ""}`}
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
            name="seat-map-background"
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
              name="seat-map-background"
              x={0}
              y={0}
              width={document.width}
              height={document.height}
              cornerRadius={24}
              fill="#0f172a"
              stroke="rgba(148, 163, 184, 0.34)"
              strokeWidth={1}
            />

            <Rect
              x={0}
              y={0}
              width={document.width}
              height={document.height}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: document.width, y: document.height }}
              fillLinearGradientColorStops={[0, "#0b1220", 0.5, "#102231", 1, "#0d1d2b"]}
              cornerRadius={24}
              opacity={0.98}
            />

            <Rect
              x={document.width / 2 - Math.min(document.width * 0.4, 250)}
              y={40}
              width={Math.min(document.width * 0.8, 500)}
              height={80}
              cornerRadius={16}
              fill="#1e293b"
              stroke="#334155"
              strokeWidth={2}
              listening={false}
            />
            <Text
              x={document.width / 2 - Math.min(document.width * 0.4, 250)}
              y={64}
              width={Math.min(document.width * 0.8, 500)}
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

            {document.shapes.map((shape) => {
              if (!shape.visible) {
                return null;
              }

              const isSelected = selectedShapeIds.includes(shape.id);
              const draggable = !shape.locked;

              return (
                <Group key={shape.id}>
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
                        fill={`${shape.color}33`}
                        stroke={isSelected ? "#ffffff" : shape.color}
                        strokeWidth={isSelected ? 3 : 2}
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
                          const nextX = event.target.x();
                          const nextY = event.target.y();
                          onTranslateShape(shape.id, nextX - origin.x, nextY - origin.y);
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

                      {isSelected && shape.seats.length ? (() => {
                        const seatBlockBounds = getSeatBlockBounds(shape.seats, shape.seatLayout.seatRadius);
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
                            hitStrokeWidth={0}
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
                              const nextWidth = Math.max(origin.width * scaleX, 18);
                              const nextHeight = Math.max(origin.height * scaleY, 18);
                              const deltaX = node.x() - origin.x;
                              const deltaY = node.y() - origin.y;

                              onResizeSeatBlock(shape.id, origin, {
                                x: origin.x + deltaX,
                                y: origin.y + deltaY,
                                width: nextWidth,
                                height: nextHeight,
                              });
                              node.scaleX(1);
                              node.scaleY(1);
                              node.position({ x: origin.x, y: origin.y });
                              node.size({ width: origin.width, height: origin.height });
                            }}
                          />
                        );
                      })() : null}
                    </>
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
                        fill={`${shape.color}30`}
                        stroke={isSelected ? "#ffffff" : shape.color}
                        strokeWidth={isSelected ? 3 : 2}
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
                          const nextX = event.target.x();
                          const nextY = event.target.y();
                          onTranslateShape(shape.id, nextX - origin.x, nextY - origin.y);
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

                      {isSelected && shape.seats.length ? (() => {
                        const seatBlockBounds = getSeatBlockBounds(shape.seats, shape.seatLayout.seatRadius);
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
                            hitStrokeWidth={0}
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
                              const nextWidth = Math.max(origin.width * scaleX, 18);
                              const nextHeight = Math.max(origin.height * scaleY, 18);
                              const deltaX = node.x() - origin.x;
                              const deltaY = node.y() - origin.y;

                              onResizeSeatBlock(shape.id, origin, {
                                x: origin.x + deltaX,
                                y: origin.y + deltaY,
                                width: nextWidth,
                                height: nextHeight,
                              });
                              node.scaleX(1);
                              node.scaleY(1);
                              node.position({ x: origin.x, y: origin.y });
                              node.size({ width: origin.width, height: origin.height });
                            }}
                          />
                        );
                      })() : null}
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
                        fill={`${shape.color}30`}
                        stroke={isSelected ? "#ffffff" : shape.color}
                        strokeWidth={isSelected ? 3 : 2}
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
                          const nextX = event.target.x();
                          const nextY = event.target.y();
                          onTranslateShape(shape.id, nextX - origin.x, nextY - origin.y);
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

                      {isSelected && shape.seats.length ? (() => {
                        const seatBlockBounds = getSeatBlockBounds(shape.seats, shape.seatLayout.seatRadius);
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
                            hitStrokeWidth={0}
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
                              const nextWidth = Math.max(origin.width * scaleX, 18);
                              const nextHeight = Math.max(origin.height * scaleY, 18);
                              const deltaX = node.x() - origin.x;
                              const deltaY = node.y() - origin.y;

                              onResizeSeatBlock(shape.id, origin, {
                                x: origin.x + deltaX,
                                y: origin.y + deltaY,
                                width: nextWidth,
                                height: nextHeight,
                              });
                              node.scaleX(1);
                              node.scaleY(1);
                              node.position({ x: origin.x, y: origin.y });
                              node.size({ width: origin.width, height: origin.height });
                            }}
                          />
                        );
                      })() : null}
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
                  {isSelected && shape.seats.length ? (() => {
                    const seatBlockBounds = getSeatBlockBounds(shape.seats, shape.seatLayout.seatRadius);
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
                          hitStrokeWidth={0}
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
                            const nextWidth = Math.max(origin.width * scaleX, 18);
                            const nextHeight = Math.max(origin.height * scaleY, 18);
                            const deltaX = node.x() - origin.x;
                            const deltaY = node.y() - origin.y;

                            onResizeSeatBlock(shape.id, origin, {
                              x: origin.x + deltaX,
                              y: origin.y + deltaY,
                              width: nextWidth,
                              height: nextHeight,
                            });
                            node.scaleX(1);
                            node.scaleY(1);
                            node.position({ x: origin.x, y: origin.y });
                            node.size({ width: origin.width, height: origin.height });
                          }}
                        />
                      </>
                    );
                  })() : null}
                  {isSelected && shape.seats.length ? (() => {
                    const seatBlockBounds = getSeatBlockBounds(shape.seats, shape.seatLayout.seatRadius);
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
                            const nextWidth = Math.max(origin.width * scaleX, 18);
                            const nextHeight = Math.max(origin.height * scaleY, 18);
                            const deltaX = node.x() - origin.x;
                            const deltaY = node.y() - origin.y;

                            onResizeSeatBlock(shape.id, origin, {
                              x: origin.x + deltaX,
                              y: origin.y + deltaY,
                              width: nextWidth,
                              height: nextHeight,
                            });
                            node.scaleX(1);
                            node.scaleY(1);
                            node.position({ x: origin.x, y: origin.y });
                            node.size({ width: origin.width, height: origin.height });
                          }}
                        />
                      </>
                    );
                  })() : null}

                  {shape.seats.map((seat) => {
                    const isSeatSelected = selectedSeatId === seat.id;
                    const isSeatHidden = seat.hidden === true;
                    const seatEditingEnabled = shape.locked;

                    return (
                      <Group key={seat.id}>
                        <Circle
                          name="seat-node"
                          x={seat.x}
                          y={seat.y}
                          radius={shape.seatLayout.seatRadius}
                          fill={
                            isSeatSelected
                              ? "#22c55e"
                              : isSeatHidden
                                ? "rgba(148, 163, 184, 0.22)"
                                : seat.inventoryStatus === "SOLD"
                                  ? "#ef4444"
                                  : "#f8fafc"
                          }
                          stroke={isSeatSelected ? "#ffffff" : shape.color}
                          strokeWidth={isSeatSelected ? 2 : 1.5}
                          opacity={isSeatHidden ? 0.45 : 1}
                          listening={seatEditingEnabled}
                          draggable={seatEditingEnabled && !isSeatHidden}
                          onClick={(event) => {
                            if (!seatEditingEnabled) {
                              return;
                            }
                            event.cancelBubble = true;
                            onSelectSeat(shape.id, seat.id);
                          }}
                          onTap={(event) => {
                            if (!seatEditingEnabled) {
                              return;
                            }
                            event.cancelBubble = true;
                            onSelectSeat(shape.id, seat.id);
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

                        {isSeatSelected ? (
                          <Text
                            x={seat.x - shape.seatLayout.seatRadius}
                            y={seat.y - shape.seatLayout.seatRadius - 1}
                            width={shape.seatLayout.seatRadius * 2}
                            height={shape.seatLayout.seatRadius * 2}
                            text="✓"
                            align="center"
                            verticalAlign="middle"
                            fill="#ffffff"
                            fontStyle="700"
                            fontSize={Math.max(10, shape.seatLayout.seatRadius * 1.35)}
                            listening={false}
                          />
                        ) : null}
                      </Group>
                    );
                  })}

                  {isSelected && shape.seats.length ? (() => {
                    const seatBlockBounds = getSeatBlockBounds(shape.seats, shape.seatLayout.seatRadius);
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

