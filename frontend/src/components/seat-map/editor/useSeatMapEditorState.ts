import { useEffect, useMemo, useState } from "react";
import { OrganizerSeatMap } from "../../../services/organizerWorkspaceService";
import {
  SeatMapEditorDocument,
  SeatMapEditorSeat,
  SeatMapEditorSeatLayoutConfig,
  SeatMapEditorShape,
  SeatMapEditorTool,
  SeatMapEditorViewport,
} from "./seatMapEditorTypes";
import {
  buildSeatMapEditorDocument,
  createCircleShape,
  createEditorDraftKey,
  createDiamondShape,
  createEllipseShape,
  createHexagonShape,
  createPolygonShape,
  createRectangleShape,
  createTrapezoidShape,
  deserializeEditorDocument,
  generateSeatsForShape,
  moveSeatWithinShape,
  restoreHiddenSeats,
  scalePolygonPoints,
  scaleSeatsWithinBounds,
  serializeEditorDocument,
  setSeatHiddenState,
  sortShapesByZIndex,
  translateShape,
} from "./seatMapEditorUtils";

function getCenteredViewport(document: SeatMapEditorDocument | null, containerWidth = 960, containerHeight = 640): SeatMapEditorViewport {
  if (!document) {
    return { scale: 0.35, x: 0, y: 0 };
  }
  const scale = 0.35;
  const docW = document.width || 1000;
  const docH = document.height || 1000;
  return {
    scale,
    x: (containerWidth - docW * scale) / 2,
    y: (containerHeight - docH * scale) / 2,
  };
}

function ensureSelection(selectedShapeIds: string[], document: SeatMapEditorDocument | null) {
  if (!document?.shapes.length) {
    return [];
  }

  const availableIds = new Set(document.shapes.map((shape) => shape.id));
  const nextSelectedShapeIds = selectedShapeIds.filter((shapeId) => availableIds.has(shapeId));
  return nextSelectedShapeIds.length ? nextSelectedShapeIds : [document.shapes[0].id];
}

function buildSeatBounds(seats: SeatMapEditorShape["seats"]) {
  if (!seats.length) {
    return null;
  }

  const xs = seats.map((seat) => seat.x);
  const ys = seats.map((seat) => seat.y);

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(Math.max(...xs) - Math.min(...xs), 1),
    height: Math.max(Math.max(...ys) - Math.min(...ys), 1),
  };
}

export function useSeatMapEditorState(eventId: string | undefined, seatMap: OrganizerSeatMap | null) {
  const sourceDocument = useMemo(() => buildSeatMapEditorDocument(seatMap), [seatMap]);
  const [document, setDocument] = useState<SeatMapEditorDocument | null>(sourceDocument);
  const [viewport, setViewport] = useState<SeatMapEditorViewport>(() => getCenteredViewport(sourceDocument));
  const [referenceImageVisible, setReferenceImageVisible] = useState(true);
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<SeatMapEditorTool>("select");
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (!eventId) {
      setDocument(sourceDocument);
      setHasDraft(false);
      return;
    }

    const draftKey = createEditorDraftKey(eventId);
    const rawDraft = window.localStorage.getItem(draftKey);
    const draftDocument = rawDraft ? deserializeEditorDocument(rawDraft) : null;

    setDocument(draftDocument ?? sourceDocument);
    setHasDraft(Boolean(draftDocument));
  }, [eventId, sourceDocument]);

  useEffect(() => {
    setSelectedShapeIds((current) => ensureSelection(current, document));
  }, [document]);

  useEffect(() => {
    setViewport(getCenteredViewport(sourceDocument));
    setReferenceImageVisible(true);
  }, [eventId, sourceDocument]);

  useEffect(() => {
    if (!document?.referenceImageUrl) {
      setReferenceImageVisible(false);
    }
  }, [document?.referenceImageUrl]);

  useEffect(() => {
    if (!eventId || !document) {
      return;
    }

    const draftKey = createEditorDraftKey(eventId);
    window.localStorage.setItem(draftKey, serializeEditorDocument(document));
    setHasDraft(true);
  }, [document, eventId]);

  const selectedShapeId = selectedShapeIds[0] ?? null;
  const selectedShape =
    document?.shapes.find((shape) => shape.id === selectedShapeId) ?? null;
  const selectedSeat =
    selectedShape?.seats.find((seat) => seat.id === selectedSeatId) ?? null;

  const updateDocument = (updater: (current: SeatMapEditorDocument) => SeatMapEditorDocument) => {
    setDocument((current) => (current ? updater(current) : current));
  };

  const selectShape = (shapeId: string | null, additive = false) => {
    setSelectedSeatId(null);

    if (!shapeId) {
      setSelectedShapeIds([]);
      return;
    }

    setSelectedShapeIds((current) => {
      if (!additive) {
        return [shapeId];
      }

      if (current.includes(shapeId)) {
        const nextSelection = current.filter((currentShapeId) => currentShapeId !== shapeId);
        return nextSelection.length ? nextSelection : [];
      }

      return [shapeId, ...current];
    });
  };

  const clearSelection = () => {
    setSelectedShapeIds([]);
    setSelectedSeatId(null);
  };

  const selectSeat = (shapeId: string, seatId: string | null) => {
    setSelectedShapeIds(shapeId ? [shapeId] : []);
    setSelectedSeatId(seatId);
  };

  const addRectangle = () => {
    updateDocument((current) => {
      const nextShape = createRectangleShape(current.shapes.length, current);
      const nextDocument = {
        ...current,
        shapes: sortShapesByZIndex([...current.shapes, nextShape]),
      };
      setSelectedShapeIds([nextShape.id]);
      setSelectedSeatId(null);
      setActiveTool("select");
      return nextDocument;
    });
  };

  const addPolygon = () => {
    updateDocument((current) => {
      const nextShape = createPolygonShape(current.shapes.length, current);
      const nextDocument = {
        ...current,
        shapes: sortShapesByZIndex([...current.shapes, nextShape]),
      };
      setSelectedShapeIds([nextShape.id]);
      setSelectedSeatId(null);
      setActiveTool("select");
      return nextDocument;
    });
  };

  const addTrapezoid = () => {
    updateDocument((current) => {
      const nextShape = createTrapezoidShape(current.shapes.length, current);
      const nextDocument = {
        ...current,
        shapes: sortShapesByZIndex([...current.shapes, nextShape]),
      };
      setSelectedShapeIds([nextShape.id]);
      setSelectedSeatId(null);
      setActiveTool("select");
      return nextDocument;
    });
  };

  const addDiamond = () => {
    updateDocument((current) => {
      const nextShape = createDiamondShape(current.shapes.length, current);
      const nextDocument = {
        ...current,
        shapes: sortShapesByZIndex([...current.shapes, nextShape]),
      };
      setSelectedShapeIds([nextShape.id]);
      setSelectedSeatId(null);
      setActiveTool("select");
      return nextDocument;
    });
  };

  const addHexagon = () => {
    updateDocument((current) => {
      const nextShape = createHexagonShape(current.shapes.length, current);
      const nextDocument = {
        ...current,
        shapes: sortShapesByZIndex([...current.shapes, nextShape]),
      };
      setSelectedShapeIds([nextShape.id]);
      setSelectedSeatId(null);
      setActiveTool("select");
      return nextDocument;
    });
  };

  const addCircle = () => {
    updateDocument((current) => {
      const nextShape = createCircleShape(current.shapes.length, current);
      const nextDocument = {
        ...current,
        shapes: sortShapesByZIndex([...current.shapes, nextShape]),
      };
      setSelectedShapeIds([nextShape.id]);
      setSelectedSeatId(null);
      setActiveTool("select");
      return nextDocument;
    });
  };

  const addEllipse = () => {
    updateDocument((current) => {
      const nextShape = createEllipseShape(current.shapes.length, current);
      const nextDocument = {
        ...current,
        shapes: sortShapesByZIndex([...current.shapes, nextShape]),
      };
      setSelectedShapeIds([nextShape.id]);
      setSelectedSeatId(null);
      setActiveTool("select");
      return nextDocument;
    });
  };

  const updateShape = (shapeId: string, updater: (shape: SeatMapEditorShape) => SeatMapEditorShape) => {
    updateDocument((current) => ({
      ...current,
      shapes: sortShapesByZIndex(
        current.shapes.map((shape) => (shape.id === shapeId ? updater(shape) : shape)),
      ),
    }));
  };

  const translateShapeBy = (shapeId: string, deltaX: number, deltaY: number) => {
    updateShape(shapeId, (shape) => translateShape(shape, deltaX, deltaY));
  };

  const resizeShape = (
    shapeId: string,
    nextBounds: SeatMapEditorShape["bounds"],
    nextPoints?: number[],
  ) => {
    updateShape(shapeId, (shape) => ({
      ...shape,
      bounds: nextBounds,
      points: nextPoints ?? shape.points,
      seats: scaleSeatsWithinBounds(shape.seats, shape.bounds, nextBounds),
    }));
  };

  const transformPolygon = (
    shapeId: string,
    nextBounds: SeatMapEditorShape["bounds"],
    scaleX: number,
    scaleY: number,
  ) => {
    updateShape(shapeId, (shape) => ({
      ...shape,
      bounds: nextBounds,
      points: scalePolygonPoints(shape.points, scaleX, scaleY),
      seats: scaleSeatsWithinBounds(shape.seats, shape.bounds, nextBounds),
    }));
  };

  const toggleShapeVisibility = (shapeId: string) => {
    updateShape(shapeId, (shape) => ({
      ...shape,
      visible: !shape.visible,
    }));
  };

  const toggleShapeLocked = (shapeId: string) => {
    updateShape(shapeId, (shape) => ({
      ...shape,
      locked: !shape.locked,
    }));
  };

  const moveShapeZIndex = (shapeId: string, direction: "up" | "down") => {
    updateDocument((current) => {
      const sortedShapes = sortShapesByZIndex(current.shapes);
      const currentIndex = sortedShapes.findIndex((shape) => shape.id === shapeId);
      if (currentIndex < 0) {
        return current;
      }

      const targetIndex = direction === "up" ? currentIndex + 1 : currentIndex - 1;
      if (targetIndex < 0 || targetIndex >= sortedShapes.length) {
        return current;
      }

      const nextShapes = [...sortedShapes];
      const [movingShape] = nextShapes.splice(currentIndex, 1);
      nextShapes.splice(targetIndex, 0, movingShape);

      return {
        ...current,
        shapes: nextShapes.map((shape, index) => ({
          ...shape,
          zIndex: index,
        })),
      };
    });
  };

  const updateSeatLayout = (shapeId: string, patch: Partial<SeatMapEditorSeatLayoutConfig>) => {
    updateShape(shapeId, (shape) => ({
      ...shape,
      seatLayout: {
        ...shape.seatLayout,
        ...patch,
      },
    }));
  };

  const regenerateSeats = (shapeId: string) => {
    updateShape(shapeId, (shape) => generateSeatsForShape(shape));
    setSelectedSeatId(null);
  };

  const updateSeat = (shapeId: string, seatId: string, patch: Partial<SeatMapEditorSeat>) => {
    updateShape(shapeId, (shape) => {
      const nextSeats = shape.seats.map((seat) => {
        if (seat.id !== seatId) {
          return seat;
        }

        return {
          ...seat,
          ...patch,
          // Sync label to rowName-seatNumber
          label: `${patch.rowName ?? seat.rowName}-${patch.seatNumber ?? seat.seatNumber}`
        };
      });

      return {
        ...shape,
        seats: nextSeats,
      };
    });
  };

  const clearSeats = (shapeId: string) => {
    updateShape(shapeId, (shape) => ({
      ...shape,
      seats: [],
      seatCount: 0,
    }));
    setSelectedSeatId(null);
  };

  const removeShape = (shapeId: string) => {
    updateDocument((current) => {
      const nextShapes = current.shapes
        .filter((shape) => shape.id !== shapeId)
        .map((shape, index) => ({
          ...shape,
          zIndex: index,
        }));

      return {
        ...current,
        shapes: nextShapes,
      };
    });

    setSelectedShapeIds((current) => current.filter((currentShapeId) => currentShapeId !== shapeId));
    setSelectedSeatId(null);
  };

  const moveSeat = (shapeId: string, seatId: string, nextX: number, nextY: number) => {
    updateShape(shapeId, (shape) => moveSeatWithinShape(shape, seatId, nextX, nextY));
  };

  const moveSeatBlock = (shapeId: string, deltaX: number, deltaY: number) => {
    updateShape(shapeId, (shape) => {
      if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) {
        return shape;
      }

      return {
        ...shape,
        seats: shape.seats.map((seat) => ({
          ...seat,
          x: seat.x + deltaX,
          y: seat.y + deltaY,
          manualAdjusted: true,
        })),
        seatLayout: {
          ...shape.seatLayout,
          offsetX: shape.seatLayout.offsetX + deltaX,
          offsetY: shape.seatLayout.offsetY + deltaY,
        },
      };
    });
  };

  const resizeSeatBlock = (
    shapeId: string,
    previousBounds: SeatMapEditorShape["bounds"],
    nextBounds: SeatMapEditorShape["bounds"],
  ) => {
    updateShape(shapeId, (shape) => {
      if (!shape.seats.length) {
        return shape;
      }

      const nextSeats = scaleSeatsWithinBounds(shape.seats, previousBounds, nextBounds).map((seat) => ({
        ...seat,
        manualAdjusted: true,
      }));

      const nextSeatBounds = buildSeatBounds(nextSeats);
      if (!nextSeatBounds) {
        return {
          ...shape,
          seats: nextSeats,
        };
      }

      const nextGapX =
        shape.seatLayout.seatsPerRow > 1
          ? Math.max(8, nextSeatBounds.width / (shape.seatLayout.seatsPerRow - 1))
          : shape.seatLayout.gapX;
      const nextGapY =
        shape.seatLayout.rows > 1
          ? Math.max(8, nextSeatBounds.height / (shape.seatLayout.rows - 1))
          : shape.seatLayout.gapY;

      return {
        ...shape,
        seats: nextSeats,
        seatLayout: {
          ...shape.seatLayout,
          gapX: nextGapX,
          gapY: nextGapY,
          offsetX: nextSeatBounds.x - shape.bounds.x - shape.seatLayout.paddingX,
          offsetY: nextSeatBounds.y - shape.bounds.y - shape.seatLayout.paddingY,
        },
      };
    });
  };

  const hideSeat = (shapeId: string, seatId: string) => {
    updateShape(shapeId, (shape) => setSeatHiddenState(shape, seatId, true));
    setSelectedSeatId((current) => (current === seatId ? null : current));
  };

  const restoreSeat = (shapeId: string, seatId: string) => {
    updateShape(shapeId, (shape) => setSeatHiddenState(shape, seatId, false));
  };

  const restoreAllSeats = (shapeId: string) => {
    updateShape(shapeId, (shape) => restoreHiddenSeats(shape));
  };

  const clearDraft = () => {
    if (eventId) {
      window.localStorage.removeItem(createEditorDraftKey(eventId));
    }

    setDocument(sourceDocument);
    setHasDraft(false);
    setSelectedShapeIds([]);
    setSelectedSeatId(null);
  };

  const replaceDocument = (nextDocument: SeatMapEditorDocument) => {
    setDocument(nextDocument);
    setViewport(getCenteredViewport(nextDocument));
    setReferenceImageVisible(Boolean(nextDocument.referenceImageUrl));
    setSelectedShapeIds(ensureSelection([], nextDocument));
    setSelectedSeatId(null);
    setActiveTool("select");
    setHasDraft(Boolean(eventId));
  };

  return {
    activeTool,
    document,
    hasDraft,
    referenceImageVisible,
    selectedSeat,
    selectedSeatId,
    selectedShape,
    selectedShapeId,
    selectedShapeIds,
    viewport,
    addPolygon,
    addTrapezoid,
    addDiamond,
    addCircle,
    addEllipse,
    addHexagon,
    addRectangle,
    clearDraft,
    clearSeats,
    clearSelection,
    hideSeat,
    moveSeat,
    updateSeat,
    moveSeatBlock,
    resizeSeatBlock,
    moveShapeZIndex,
    regenerateSeats,
    removeShape,
    replaceDocument,
    resetViewport: () => setViewport(getCenteredViewport(document)),
    resizeShape,
    restoreAllSeats,
    restoreSeat,
    selectSeat,
    selectShape,
    setActiveTool,
    setReferenceImageVisible,
    setViewport,
    toggleShapeLocked,
    toggleShapeVisibility,
    transformPolygon,
    translateShapeBy,
    updateSeatLayout,
    updateShape,
  };
}
