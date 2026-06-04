import { ChangeEvent, ReactNode, RefObject, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Circle,
  Diamond,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  Grid3X3,
  Hexagon,
  Layers3,
  Lock,
  LockOpen,
  MousePointer2,
  Pentagon,
  Pencil,
  Plus,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import {
  SeatMapEditorDocument,
  SeatMapEditorSectorType,
  SeatMapEditorSeat,
  SeatMapEditorShape,
} from "./seatMapEditorTypes";
import { OrganizerPublicTicketType } from "../../../services/organizerWorkspaceService";

interface SeatDropdownOptions {
  rows: Array<{ value: string; hidden?: boolean }>;
  seatNumbers: Array<{ value: string; hidden?: boolean }>;
}

interface SeatMapRightSidebarProps {
  assignmentEnabled?: boolean;
  document: SeatMapEditorDocument;
  selectedShape: SeatMapEditorShape | null;
  selectedSeat: SeatMapEditorSeat | null;
  selectedSeats: SeatMapEditorSeat[];
  selectedShapeIds: string[];
  editingShapeId: string | null;
  seatLayoutInputs: Record<string, string>;
  seatDropdownOptions: SeatDropdownOptions;
  ticketTypes: OrganizerPublicTicketType[];
  importFileInputRef: RefObject<HTMLInputElement>;
  onImportJson: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportJsonClick: () => void;
  onExportJson: () => void;
  onSetActiveTool: (tool: "select" | "polygon" | "rectangle") => void;
  onAddTrapezoid: () => void;
  onAddDiamond: () => void;
  onAddHexagon: () => void;
  onAddCircle: () => void;
  onAddEllipse: () => void;
  onAddRoundedBlock: () => void;
  onAddConcertOvalTemplate: () => void;
  onAddVipLeftCurved: () => void;
  onAddVipRightCurved: () => void;
  onAddBottomRingSection: () => void;
  onAddFanSection: () => void;
  onAddLeftSideRing: () => void;
  onAddRightSideRing: () => void;
  onSelectShape: (shapeId: string, additive?: boolean) => void;
  onToggleShapeVisibility: (shapeId: string) => void;
  onToggleShapeLocked: (shapeId: string) => void;
  onRemoveShape: (shapeId: string) => void;
  onSetEditingShapeId: (shapeId: string | null) => void;
  onShapeMetaChange: (
    shapeId: string,
    patch: {
      name?: string;
      color?: string;
      ticketTypeId?: string;
      ticketTypeIds?: string[];
      sectorType?: SeatMapEditorSectorType;
      totalCapacity?: number;
    },
  ) => void;
  onSeatLayoutInputChange: (shapeId: string, key: string) => (event: ChangeEvent<HTMLInputElement>) => void;
  onSeatLayoutInputBlur: (shapeId: string, key: string) => void;
  onGenerateSeats: (shapeId: string) => void;
  onRestoreHiddenSeats: (shapeId: string) => void;
  onClearSeats: (shapeId: string) => void;
  onUpdateSeat: (shapeId: string, seatId: string, patch: Partial<SeatMapEditorSeat>) => void;
  onAssignTicketTypeToSeats: (
    shapeId: string,
    scope: "seat" | "selected" | "all",
    value: string,
    ticketTypeId: string,
  ) => void;
  onHideSeat: (shapeId: string, seatId: string) => void;
  onHideSelectedSeats: (shapeId: string, seatIds: string[]) => void;
  onRestoreSeat: (shapeId: string, seatId: string) => void;
  onRestoreSelectedSeats: (shapeId: string, seatIds: string[]) => void;
  onClearDraft: () => void;
  canClearDraft: boolean;
  onCreateSeatTypeForShape?: (shapeId: string) => void;
}

const sectorTypeOptions: Array<{ value: SeatMapEditorSectorType; label: string }> = [
  { value: "STANDING", label: "seatMap.standingSector" },
  { value: "SEATED", label: "seatMap.seatedSector" },
];

const seatLayoutFields = [
  ["rows", "Rows"],
  ["seatsPerRow", "Seats / Row"],
  ["gapX", "Gap X"],
  ["gapY", "Gap Y"],
  ["paddingX", "Padding X"],
  ["paddingY", "Padding Y"],
  ["seatRadius", "Radius"],
  ["seatStartNumber", "Start No"],
] as const;

function getTicketTypeSectorId(ticketType: OrganizerPublicTicketType) {
  return ticketType.eventSectorId || ticketType.sectorId || "";
}

function getTicketTypeColor(ticketType?: OrganizerPublicTicketType) {
  return ticketType?.colorCode || "#16a34a";
}

function getSectorTicketTypes(ticketTypes: OrganizerPublicTicketType[], shape?: SeatMapEditorShape | null) {
  if (!shape) {
    return [];
  }

  return ticketTypes.filter((ticketType) => getTicketTypeSectorId(ticketType) === shape.id);
}

function isAssignedSeatTicketType(ticketType: OrganizerPublicTicketType) {
  return ticketType.inventoryMode === "ASSIGNED_SEAT" || ticketType.seatSelectionEnabled === true;
}

function getSeatAssignableTicketTypes(ticketTypes: OrganizerPublicTicketType[], shape?: SeatMapEditorShape | null) {
  if (!shape || shape.sectorType !== "SEATED") {
    return [];
  }

  return ticketTypes.filter(
    (ticketType) =>
      getTicketTypeSectorId(ticketType) === shape.id &&
      isAssignedSeatTicketType(ticketType),
  );
}

function getStandingTicketTypeIds(shape: SeatMapEditorShape) {
  const ids = shape.ticketTypeIds ?? (shape.ticketTypeId ? [shape.ticketTypeId] : []);
  return new Set(ids.filter(Boolean));
}

function TicketTypeColorDot({ ticketType }: { ticketType: OrganizerPublicTicketType }) {
  return (
    <span
      className="seat-map-ticket-type-color"
      style={{ backgroundColor: getTicketTypeColor(ticketType) }}
      aria-hidden="true"
    />
  );
}

function TicketTypeSingleDropdown({
  disabled,
  emptyLabel,
  noOptionsLabel,
  onChange,
  onToggle,
  open,
  options,
  value,
}: {
  disabled?: boolean;
  emptyLabel: string;
  noOptionsLabel: string;
  onChange: (ticketTypeId: string) => void;
  onToggle: () => void;
  open: boolean;
  options: OrganizerPublicTicketType[];
  value: string;
}) {
  const selectedTicketType = options.find((ticketType) => ticketType.id === value);

  return (
    <div className={`seat-map-ticket-type-dropdown ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="seat-map-ticket-type-dropdown-trigger"
        disabled={disabled}
        onClick={onToggle}
      >
        <span className="seat-map-ticket-type-trigger-content">
          {selectedTicketType ? (
            <>
              <TicketTypeColorDot ticketType={selectedTicketType} />
              <span>{selectedTicketType.name}</span>
            </>
          ) : (
            <span className="seat-map-ticket-type-placeholder">{emptyLabel}</span>
          )}
        </span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="seat-map-ticket-type-dropdown-menu">
          <button
            type="button"
            className="seat-map-ticket-type-dropdown-option is-empty-option"
            onClick={() => onChange("")}
          >
            <span className="seat-map-ticket-type-placeholder">{emptyLabel}</span>
          </button>
          {!options.length ? (
            <p className="seat-map-editor-empty">{noOptionsLabel}</p>
          ) : (
            options.map((ticketType) => (
              <button
                key={ticketType.id}
                type="button"
                className={`seat-map-ticket-type-dropdown-option ${ticketType.id === value ? "is-selected" : ""}`}
                onClick={() => onChange(ticketType.id)}
              >
                <TicketTypeColorDot ticketType={ticketType} />
                <span>{ticketType.name}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function TicketTypeMultiDropdown({
  disabled,
  emptyLabel,
  noOptionsLabel,
  onChange,
  onToggle,
  open,
  options,
  selectedCountLabel,
  valueIds,
}: {
  disabled?: boolean;
  emptyLabel: string;
  noOptionsLabel: string;
  onChange: (ticketTypeIds: string[]) => void;
  onToggle: () => void;
  open: boolean;
  options: OrganizerPublicTicketType[];
  selectedCountLabel: (count: number) => string;
  valueIds: string[];
}) {
  const selectedTicketTypeIds = new Set(valueIds);
  const selectedTicketTypes = options.filter((ticketType) => selectedTicketTypeIds.has(ticketType.id));
  const triggerText =
    selectedTicketTypes.length === 0
      ? emptyLabel
      : selectedTicketTypes.length === 1
        ? selectedTicketTypes[0].name
        : selectedCountLabel(selectedTicketTypes.length);

  return (
    <div className={`seat-map-ticket-type-dropdown ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="seat-map-ticket-type-dropdown-trigger"
        disabled={disabled}
        onClick={onToggle}
      >
        <span className="seat-map-ticket-type-trigger-content">
          {selectedTicketTypes.length === 1 ? <TicketTypeColorDot ticketType={selectedTicketTypes[0]} /> : null}
          <span className={selectedTicketTypes.length ? "" : "seat-map-ticket-type-placeholder"}>{triggerText}</span>
        </span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="seat-map-ticket-type-dropdown-menu">
          {!options.length ? (
            <p className="seat-map-editor-empty">{noOptionsLabel}</p>
          ) : (
            options.map((ticketType) => {
              const checked = selectedTicketTypeIds.has(ticketType.id);
              const nextIds = checked
                ? valueIds.filter((ticketTypeId) => ticketTypeId !== ticketType.id)
                : [...valueIds, ticketType.id];

              return (
                <label key={ticketType.id} className="seat-map-ticket-type-dropdown-option has-checkbox">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onChange(nextIds)}
                  />
                  <TicketTypeColorDot ticketType={ticketType} />
                  <span>{ticketType.name}</span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function ToolButton({
  active,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`seat-map-tool-button ${active ? "is-active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function SeatMapRightSidebar({
  assignmentEnabled = true,
  document,
  selectedShape,
  selectedSeat,
  selectedSeats,
  selectedShapeIds,
  editingShapeId,
  seatLayoutInputs,
  seatDropdownOptions,
  ticketTypes,
  importFileInputRef,
  onImportJson,
  onImportJsonClick,
  onExportJson,
  onSetActiveTool,
  onAddTrapezoid,
  onAddDiamond,
  onAddHexagon,
  onAddCircle,
  onAddEllipse,
  onAddRoundedBlock,
  onAddConcertOvalTemplate,
  onAddVipLeftCurved,
  onAddVipRightCurved,
  onAddBottomRingSection,
  onAddFanSection,
  onAddLeftSideRing,
  onAddRightSideRing,
  onSelectShape,
  onToggleShapeVisibility,
  onToggleShapeLocked,
  onRemoveShape,
  onSetEditingShapeId,
  onShapeMetaChange,
  onSeatLayoutInputChange,
  onSeatLayoutInputBlur,
  onGenerateSeats,
  onRestoreHiddenSeats,
  onClearSeats,
  onUpdateSeat,
  onAssignTicketTypeToSeats,
  onHideSeat,
  onHideSelectedSeats,
  onRestoreSeat,
  onRestoreSelectedSeats,
  onClearDraft,
  canClearDraft,
  onCreateSeatTypeForShape,
}: SeatMapRightSidebarProps) {
  const { t } = useTranslation();
  void onCreateSeatTypeForShape;
  const [workspaceToolsOpen, setWorkspaceToolsOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);
  const [seatGenerationOpen, setSeatGenerationOpen] = useState(false);
  const [selectedSeatOpen, setSelectedSeatOpen] = useState(false);
  const [openTicketTypeDropdown, setOpenTicketTypeDropdown] = useState<string | null>(null);
  const selectedSectorTicketTypes = getSectorTicketTypes(ticketTypes, selectedShape);
  const selectedSeatAssignableTicketTypes = getSeatAssignableTicketTypes(ticketTypes, selectedShape);

  const otherSectorTicketTypes = selectedShape
    ? ticketTypes.filter((ticketType) => {
        const sectorId = getTicketTypeSectorId(ticketType);
        return sectorId && sectorId !== selectedShape.id;
      })
    : [];

  return (
    <aside className="seat-map-editor-sidebar">
      <input
        ref={importFileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={onImportJson}
      />

      <section className="seat-map-workspace-panel-frame">
        <div className="seat-map-workspace-panel-title">
          <span>
            <MousePointer2 size={16} />
            <span>{t("seatMap.workspaceTools")}</span>
          </span>
          <button type="button" onClick={() => setWorkspaceToolsOpen((current) => !current)} aria-label={t("seatMap.toggleWorkspaceTools")}>
            <ChevronDown size={16} className={workspaceToolsOpen ? "is-open" : ""} />
          </button>
        </div>

        {workspaceToolsOpen ? (
          <div className="seat-map-workspace-panel-body">
          <div className="seat-map-tool-grid">
            <ToolButton icon={<Pentagon size={15} />} label="Trapezoid" onClick={() => { onSetActiveTool("polygon"); onAddTrapezoid(); }} />
            <ToolButton icon={<Diamond size={15} />} label="Diamond" onClick={() => { onSetActiveTool("polygon"); onAddDiamond(); }} />
            <ToolButton icon={<Hexagon size={15} />} label="Hexagon" onClick={() => { onSetActiveTool("polygon"); onAddHexagon(); }} />
            <ToolButton icon={<Circle size={15} />} label="Circle" onClick={() => { onSetActiveTool("rectangle"); onAddCircle(); }} />
            <ToolButton icon={<Ellipsis size={15} />} label="Ellipse" onClick={() => { onSetActiveTool("rectangle"); onAddEllipse(); }} />
            <ToolButton icon={<Square size={15} />} label="Rounded" onClick={() => { onSetActiveTool("rectangle"); onAddRoundedBlock(); }} />
            <ToolButton icon={<Pentagon size={15} />} label="Fan" onClick={() => { onSetActiveTool("select"); onAddFanSection(); }} />
            <ToolButton icon={<Circle size={15} />} label="Ring" onClick={() => { onSetActiveTool("select"); onAddBottomRingSection(); }} />
            <ToolButton icon={<Grid3X3 size={15} />} label={t("seatMap.concertTemplate")} onClick={() => { onSetActiveTool("select"); onAddConcertOvalTemplate(); }} />
            <ToolButton icon={<Pentagon size={15} />} label="Curved L" onClick={() => { onSetActiveTool("select"); onAddVipLeftCurved(); }} />
            <ToolButton icon={<Pentagon size={15} />} label="Curved R" onClick={() => { onSetActiveTool("select"); onAddVipRightCurved(); }} />
            <ToolButton icon={<Pentagon size={15} />} label="Side L" onClick={() => { onSetActiveTool("select"); onAddLeftSideRing(); }} />
            <ToolButton icon={<Pentagon size={15} />} label="Side R" onClick={() => { onSetActiveTool("select"); onAddRightSideRing(); }} />
          </div>

          <div className="seat-map-sidebar-divider" />
          <div className="seat-map-action-grid">
            <button type="button" className="seat-map-editor-button secondary compact" onClick={onImportJsonClick}>
              <Upload size={15} />
              Import JSON
            </button>
            <button type="button" className="seat-map-editor-button secondary compact" onClick={onExportJson}>
              <Download size={15} />
              Export JSON
            </button>
          </div>
          </div>
        ) : null}
      </section>

      <section className="seat-map-layers-panel-frame">
        <div className="seat-map-layers-panel-title">
          <span>
            <Layers3 size={16} />
            <span>{t("seatMap.layers")}</span>
          </span>
          <span className="seat-map-layers-panel-actions">
            <Plus size={14} />
            <button type="button" onClick={() => setLayersOpen((current) => !current)} aria-label={t("seatMap.toggleLayers")}>
              <ChevronDown size={16} className={layersOpen ? "is-open" : ""} />
            </button>
          </span>
        </div>

        {layersOpen ? (
          <div className="seat-map-layers-panel-body">
            {!document.shapes.length ? (
              <p className="seat-map-editor-empty">{t("seatMap.noShapes")}</p>
            ) : (
              <div className="seat-map-layer-list-modern">
                {document.shapes.map((shape) => {
                  const active = selectedShapeIds.includes(shape.id);

                  return (
                    <div key={shape.id} className={`seat-map-layer-row-modern ${active ? "is-active" : ""}`}>
                      <button type="button" className="seat-map-layer-row-main" onClick={(event) => onSelectShape(shape.id, event.ctrlKey || event.metaKey || event.shiftKey)}>
                        <span className="seat-map-layer-color" style={{ backgroundColor: shape.color, opacity: shape.visible ? 1 : 0.35 }} />
                        <span>
                          <strong>{shape.name}</strong>
                          <small>{shape.shapeType} · {t("seatMap.seatCount", { count: shape.seatCount })}</small>
                        </span>
                      </button>
                      <div className="seat-map-layer-row-actions">
                        <button type="button" onClick={() => onToggleShapeVisibility(shape.id)}>{shape.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                        <button type="button" onClick={() => onSetEditingShapeId(editingShapeId === shape.id ? null : shape.id)}><Pencil size={14} /></button>
                        <button type="button" onClick={() => onToggleShapeLocked(shape.id)}>{shape.locked ? <LockOpen size={14} /> : <Lock size={14} />}</button>
                        <button type="button" className="danger" onClick={() => onRemoveShape(shape.id)}><Trash2 size={14} /></button>
                      </div>
                      {editingShapeId === shape.id ? (
                        <div className="seat-map-layer-editor-modern">
                          <label><span>{t("organizer.name")}</span><input value={shape.name} onChange={(event) => onShapeMetaChange(shape.id, { name: event.target.value })} /></label>
                          <label><span>{t("seatMap.color")}</span><input type="color" value={shape.color} onChange={(event) => onShapeMetaChange(shape.id, { color: event.target.value })} /></label>
                          <label>
                            <span>{t("seatMap.sectorType")}</span>
                            <select value={shape.sectorType} onChange={(event) => onShapeMetaChange(shape.id, { sectorType: event.target.value as SeatMapEditorSectorType })}>
                              {sectorTypeOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                            </select>
                          </label>
                          {shape.sectorType === "STANDING" ? (
                            <>
                              <label>
                                <span>{t("seatMap.maxCapacity")}</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={shape.totalCapacity ?? ""}
                                  onChange={(event) => {
                                    const val = event.target.value;
                                    onShapeMetaChange(shape.id, {
                                      totalCapacity: val === "" ? undefined : Math.max(0, parseInt(val, 10) || 0),
                                    });
                                  }}
                                />
                              </label>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="seat-map-seat-generation-panel-frame">
        <div className="seat-map-seat-generation-panel-title">
          <span>
            <Grid3X3 size={16} />
            <span>{t("seatMap.seatGeneration")}</span>
          </span>
          <button type="button" onClick={() => setSeatGenerationOpen((current) => !current)} aria-label={t("seatMap.toggleSeatGeneration")}>
            <ChevronDown size={16} className={seatGenerationOpen ? "is-open" : ""} />
          </button>
        </div>

        {seatGenerationOpen ? (
          <div className="seat-map-seat-generation-panel-body">
            {!selectedShape ? (
              <p className="seat-map-editor-empty">{t("seatMap.selectShapeBeforeGenerate")}</p>
            ) : !assignmentEnabled ? (
              <p className="seat-map-editor-empty">
                {t("seatMap.generateSeatsAfterTicketTypes")}
              </p>
            ) : selectedShape.sectorType === "STANDING" ? (
              <p className="seat-map-editor-empty">{t("seatMap.standingNoPhysicalSeats")}</p>
            ) : (
              <>
                <div className="seat-map-form-grid-modern">
                  {seatLayoutFields.map(([key, label]) => (
                    <label key={key}>
                      <span>{label}</span>
                      <input
                        type="number"
                        value={seatLayoutInputs[key] ?? ""}
                        min={key === "paddingX" || key === "paddingY" ? 0 : 1}
                        onChange={onSeatLayoutInputChange(selectedShape.id, key)}
                        onBlur={() => onSeatLayoutInputBlur(selectedShape.id, key)}
                      />
                    </label>
                  ))}
                </div>
                <div className="seat-map-action-grid seat-map-generation-actions">
                  <button type="button" className="seat-map-editor-button secondary compact" onClick={() => onRestoreHiddenSeats(selectedShape.id)}>{t("seatMap.restoreHidden")}</button>
                  <button type="button" className="seat-map-editor-button danger compact" onClick={() => onClearSeats(selectedShape.id)}>{t("seatMap.clearSeats")}</button>
                  <button type="button" className="seat-map-editor-button primary compact" onClick={() => onGenerateSeats(selectedShape.id)}>{t("seatMap.generateSeats")}</button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </section>

      {assignmentEnabled ? <section className="seat-map-selected-seat-panel-frame">
        <div className="seat-map-selected-seat-panel-title">
          <span>
            <MousePointer2 size={16} />
            <span>{t("seatMap.selectedSeat")}</span>
          </span>
          <button type="button" onClick={() => setSelectedSeatOpen((current) => !current)} aria-label={t("seatMap.toggleSelectedSeat")}>
            <ChevronDown size={16} className={selectedSeatOpen ? "is-open" : ""} />
          </button>
        </div>

        {selectedSeatOpen ? (
          <div className="seat-map-selected-seat-panel-body">
            {!selectedShape ? (
              <p className="seat-map-editor-empty">{t("seatMap.selectSectorOrSeat")}</p>
            ) : selectedShape.sectorType === "STANDING" ? (
              <div className="seat-map-seat-panel">
                <label><span>Sector</span><input value={selectedShape.name} readOnly /></label>
                <div className="seat-map-ticket-type-field">
                  <span>{t("seatMap.standingTicketTypes")}</span>
                  <TicketTypeMultiDropdown
                    disabled={!selectedSectorTicketTypes.length}
                    emptyLabel={t("seatMap.chooseTicketType")}
                    noOptionsLabel={t("seatMap.noValidTicketType")}
                    onChange={(nextIds) => onShapeMetaChange(selectedShape.id, { ticketTypeIds: nextIds })}
                    onToggle={() =>
                      setOpenTicketTypeDropdown((current) => current === "standing" ? null : "standing")
                    }
                    open={openTicketTypeDropdown === "standing"}
                    options={selectedSectorTicketTypes}
                    selectedCountLabel={(count) => t("seatMap.ticketTypeCount", { count })}
                    valueIds={[...getStandingTicketTypeIds(selectedShape)]}
                  />
                </div>
                {!selectedSectorTicketTypes.length && otherSectorTicketTypes.length ? (
                  <div className="seat-map-ticket-type-other-list">
                    <span>{t("seatMap.otherSectorTicketTypes")}</span>
                    {otherSectorTicketTypes.map((ticketType) => (
                      <small key={ticketType.id}>{ticketType.name}</small>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : !selectedSeat ? (
              <p className="seat-map-editor-empty">{t("seatMap.selectSeat")}</p>
            ) : (
              <div className="seat-map-seat-panel">
                <label><span>Sector</span><input value={selectedShape.name} readOnly /></label>
                <label>
                  <span>Row</span>
                  <select value={selectedSeat.rowName || ""} onChange={(event) => onUpdateSeat(selectedShape.id, selectedSeat.id, { rowName: event.target.value })}>
                    <option value="" disabled>--Select Row--</option>
                    {seatDropdownOptions.rows.map((row) => <option key={row.value} value={row.value}>{row.value}{row.hidden ? " - hide" : ""}</option>)}
                  </select>
                </label>
                <label>
                  <span>Seat No</span>
                  <select value={selectedSeat.seatNumber || ""} onChange={(event) => onUpdateSeat(selectedShape.id, selectedSeat.id, { seatNumber: event.target.value })}>
                    <option value="" disabled>--Select No--</option>
                    {seatDropdownOptions.seatNumbers.map((seatNumber) => <option key={seatNumber.value} value={seatNumber.value}>{seatNumber.value}{seatNumber.hidden ? " - hide" : ""}</option>)}
                  </select>
                </label>
                <label><span>{t("seatMap.selectedSeats")}</span><input value={t("seatMap.seatCount", { count: selectedSeats.length })} readOnly /></label>
                <div className="seat-map-ticket-type-field">
                  <span>{t("ticketsPage.ticketType")}</span>
                  <TicketTypeSingleDropdown
                    disabled={!selectedSeatAssignableTicketTypes.length}
                    emptyLabel={t("seatMap.chooseTicketType")}
                    noOptionsLabel={t("seatMap.noValidTicketType")}
                    onChange={(ticketTypeId) => {
                      const ticketType = ticketTypes.find((item) => item.id === ticketTypeId);
                      const targetSeatIds = selectedSeats.length ? selectedSeats.map((seat) => seat.id) : [selectedSeat.id];

                      setOpenTicketTypeDropdown(null);
                      if (targetSeatIds.length > 1 && ticketTypeId) {
                        onAssignTicketTypeToSeats(selectedShape.id, "selected", targetSeatIds.join(","), ticketTypeId);
                        return;
                      }

                      onUpdateSeat(selectedShape.id, selectedSeat.id, {
                        ticketTypeId: ticketTypeId || undefined,
                        colorCode: ticketTypeId ? getTicketTypeColor(ticketType) : undefined,
                      });
                    }}
                    onToggle={() =>
                      setOpenTicketTypeDropdown((current) => current === "seat" ? null : "seat")
                    }
                    open={openTicketTypeDropdown === "seat"}
                    options={selectedSeatAssignableTicketTypes}
                    value={selectedSeat.ticketTypeId || ""}
                  />
                </div>

                <div className="seat-map-ticket-type-field">
                  <span>{t("seatMap.assignWholeSector")}</span>
                  <TicketTypeSingleDropdown
                    disabled={!selectedSeatAssignableTicketTypes.length}
                    emptyLabel={t("seatMap.chooseTicketType")}
                    noOptionsLabel={t("seatMap.noValidTicketType")}
                    onChange={(ticketTypeId) => {
                      setOpenTicketTypeDropdown(null);
                      if (ticketTypeId) {
                        onAssignTicketTypeToSeats(selectedShape.id, "all", "", ticketTypeId);
                      }
                    }}
                    onToggle={() =>
                      setOpenTicketTypeDropdown((current) => current === "all" ? null : "all")
                    }
                    open={openTicketTypeDropdown === "all"}
                    options={selectedSeatAssignableTicketTypes}
                    value=""
                  />
                </div>

                <div className="seat-map-action-grid">
                  <button
                    type="button"
                    className="seat-map-editor-button danger compact"
                    onClick={() => {
                      const targetSeatIds = selectedSeats.length ? selectedSeats.map((seat) => seat.id) : [selectedSeat.id];
                      if (targetSeatIds.length > 1) {
                        onHideSelectedSeats(selectedShape.id, targetSeatIds);
                      } else {
                        onHideSeat(selectedShape.id, selectedSeat.id);
                      }
                    }}
                  >
                    <EyeOff size={15} />{t("seatMap.hideSeat")}
                  </button>
                  <button
                    type="button"
                    className="seat-map-editor-button secondary compact"
                    onClick={() => {
                      const targetSeatIds = selectedSeats.length ? selectedSeats.map((seat) => seat.id) : [selectedSeat.id];
                      if (targetSeatIds.length > 1) {
                        onRestoreSelectedSeats(selectedShape.id, targetSeatIds);
                      } else {
                        onRestoreSeat(selectedShape.id, selectedSeat.id);
                      }
                    }}
                  >
                    <Eye size={15} />{t("seatMap.showSeat")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </section> : null}

      <div className="seat-map-action-grid seat-map-publish-actions">
        <button
          type="button"
          className="seat-map-editor-button danger compact"
          onClick={onClearDraft}
          disabled={!canClearDraft}
        >
          {t("seatMap.restore")}
        </button>
      </div>
    </aside>
  );
}
