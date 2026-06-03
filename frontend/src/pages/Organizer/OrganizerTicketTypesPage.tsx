import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Copy, Edit, Search, Ticket, Trash2, X } from "lucide-react";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerWorkspaceService,
  OrganizerSeatMap,
  OrganizerTicketType,
  OrganizerTicketTypePayload,
} from "../../services/organizerWorkspaceService";
import {
  formatDateTime,
  formatMoney,
  getTicketTypeStatusMeta,
  toDateTimeLocal,
  toIsoString,
} from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";
import {
  dispatchOrganizerWorkflowDirty,
  dispatchOrganizerWorkflowSaveResult,
} from "./organizerWorkflowEvents";

type TicketTypeFormState = {
  name: string;
  description: string;
  price: string;
  originalPrice: string;
  quantityTotal: string;
  maxPerOrder: string;
  saleStartDatetime: string;
  saleEndDatetime: string;
  seatSelectionEnabled: boolean;
  colorCode: string;
  displayOrder: string;
  eventSectorId: string;
  isVisible: boolean;
};

const defaultFormState: TicketTypeFormState = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  quantityTotal: "",
  maxPerOrder: "10",
  saleStartDatetime: "",
  saleEndDatetime: "",
  seatSelectionEnabled: false,
  colorCode: "#16a34a",
  displayOrder: "0",
  eventSectorId: "",
  isVisible: true,
};

function RequiredFieldLabel({ children }: { children: string }) {
  return (
    <span>
      <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>
      {children}
    </span>
  );
}

function buildFormState(ticketType: OrganizerTicketType): TicketTypeFormState {
  return {
    name: ticketType.name || "",
    description: ticketType.description || "",
    price: String(ticketType.price ?? ""),
    originalPrice: String(ticketType.originalPrice ?? ""),
    quantityTotal: String(ticketType.quantityTotal ?? ""),
    maxPerOrder: String(ticketType.maxPerOrder ?? 10),
    saleStartDatetime: toDateTimeLocal(ticketType.saleStartDatetime),
    saleEndDatetime: toDateTimeLocal(ticketType.saleEndDatetime),
    seatSelectionEnabled: Boolean(ticketType.seatSelectionEnabled),
    colorCode: ticketType.colorCode || "#16a34a",
    displayOrder: String(ticketType.displayOrder ?? 0),
    eventSectorId: ticketType.eventSectorId || "",
    isVisible: Boolean(ticketType.isVisible),
  };
}

function toPayload(
  formState: TicketTypeFormState,
  quantityTotalOverride?: number,
  forceSeatSelectionEnabled?: boolean,
  useSeatMap?: boolean,
): OrganizerTicketTypePayload | null {
  const price = Number(formState.price);
  const quantityTotal = quantityTotalOverride ?? Number(formState.quantityTotal);

  if (
    !formState.name.trim() ||
    Number.isNaN(price) ||
    Number.isNaN(quantityTotal)
  ) {
    return null;
  }

  return {
    name: formState.name.trim(),
    description: formState.description.trim() || undefined,
    price,
    originalPrice: formState.originalPrice
      ? Number(formState.originalPrice)
      : undefined,
    quantityTotal,
    maxPerOrder: formState.maxPerOrder
      ? Number(formState.maxPerOrder)
      : undefined,
    saleStartDatetime: toIsoString(formState.saleStartDatetime),
    saleEndDatetime: toIsoString(formState.saleEndDatetime),
    seatSelectionEnabled: forceSeatSelectionEnabled ?? formState.seatSelectionEnabled,
    colorCode: formState.colorCode || undefined,
    displayOrder: formState.displayOrder
      ? Number(formState.displayOrder)
      : undefined,
    eventSectorId: useSeatMap ? formState.eventSectorId.trim() || undefined : undefined,
    isVisible: formState.isVisible,
  };
}

function validateTicketTypePayload(
  payload: OrganizerTicketTypePayload,
  isAssignedSeatTicket: boolean,
  t: (key: string) => string,
) {
  const originalPrice = payload.originalPrice;
  if (!Number.isFinite(payload.price) || payload.price < 0) return t("organizerTicketTypes.validation.priceNegative");
  if (originalPrice !== undefined && originalPrice !== null && (!Number.isFinite(originalPrice) || originalPrice < 0)) return t("organizerTicketTypes.validation.originalPriceNegative");
  if (originalPrice !== undefined && originalPrice !== null && originalPrice > 0 && originalPrice < payload.price) return t("organizerTicketTypes.validation.originalPriceLessThanPrice");
  if (!isAssignedSeatTicket && (!Number.isFinite(payload.quantityTotal) || payload.quantityTotal < 1)) return t("organizerTicketTypes.validation.quantityMin");
  if (payload.maxPerOrder !== undefined && (!Number.isFinite(payload.maxPerOrder) || payload.maxPerOrder < 1 || payload.maxPerOrder > 20)) return t("organizerTicketTypes.validation.maxPerOrderRange");
  if (payload.displayOrder !== undefined && (!Number.isFinite(payload.displayOrder) || payload.displayOrder < 0)) return t("organizerTicketTypes.validation.displayOrderNegative");
  return null;
}

export default function OrganizerTicketTypesPage() {
  const { t } = useTranslation();
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const { ready } = useOrganizerGate();
  const [ticketTypes, setTicketTypes] = useState<OrganizerTicketType[]>([]);
  const [seatMap, setSeatMap] = useState<OrganizerSeatMap | null>(null);
  const [setupMode, setSetupMode] = useState<"QUANTITY" | "SEAT_MAP" | null>(null);
  const [formState, setFormState] =
    useState<TicketTypeFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [ticketSearch, setTicketSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const setupStorageKey = eventId
    ? `organizer-ticket-setup-mode:${eventId}`
    : "";
  const requestedSetupMode = searchParams.get("mode");
  const requestedSectorId = searchParams.get("sectorId");
  const shouldOpenCreateForm = searchParams.get("create") === "1";

  useEffect(() => {
    if (!ready || !eventId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextTicketTypes, nextSeatMap] = await Promise.all([
          organizerWorkspaceService.getTicketTypes(eventId),
          organizerWorkspaceService.getSeatMap(eventId),
        ]);

        if (cancelled) {
          return;
        }

        setTicketTypes(nextTicketTypes);
        setSeatMap(nextSeatMap);
        if (nextTicketTypes.length > 0) {
          dispatchOrganizerWorkflowSaveResult(true);
        }

        if (requestedSetupMode === "SEAT_MAP") {
          setSetupMode("SEAT_MAP");
          if (setupStorageKey) {
            sessionStorage.setItem(setupStorageKey, "SEAT_MAP");
          }
          if (shouldOpenCreateForm) {
            setEditingId(null);
            setFormState({
              ...defaultFormState,
              eventSectorId: requestedSectorId || "",
            });
            setIsCreateFormOpen(true);
          }
          return;
        }

        const storedSetupMode = setupStorageKey
          ? sessionStorage.getItem(setupStorageKey)
          : null;
        setSetupMode(
          storedSetupMode === "QUANTITY" || storedSetupMode === "SEAT_MAP"
            ? storedSetupMode
            : null,
        );
      } catch {
        if (!cancelled) {
          toast.error(t("organizerTicketTypes.loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    eventId,
    ready,
    requestedSectorId,
    requestedSetupMode,
    setupStorageKey,
    shouldOpenCreateForm,
    t,
  ]);

  const handleChange = <K extends keyof TicketTypeFormState>(
    key: K,
    value: TicketTypeFormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingId(null);
    setIsCreateFormOpen(false);
  };

  const handleCreateClick = () => {
    setEditingId(null);
    setFormState(defaultFormState);
    setIsCreateFormOpen(true);
  };

  const handleChooseQuantityMode = () => {
    setSetupMode("QUANTITY");
    if (setupStorageKey) {
      sessionStorage.setItem(setupStorageKey, "QUANTITY");
    }
    setEditingId(null);
    setFormState(defaultFormState);
    setIsCreateFormOpen(true);
  };

  const handleChooseSeatMapMode = () => {
    setSetupMode("SEAT_MAP");
    if (setupStorageKey) {
      sessionStorage.setItem(setupStorageKey, "SEAT_MAP");
    }
    resetForm();
  };

  const activeSectors = (seatMap?.sectors ?? []).filter(
    (sector) => sector.mapData?.visible !== false,
  );
  const eventUsesSeatMap = setupMode === "SEAT_MAP" && activeSectors.length > 0;
  const selectedSector = activeSectors.find(
    (sector) => sector.id === formState.eventSectorId,
  );
  const requestedSectorExists = requestedSectorId
    ? activeSectors.some((sector) => sector.id === requestedSectorId)
    : true;
  const selectedSectorType = selectedSector?.sectorType === "SEATED" ? "SEATED" : "STANDING";
  const isAssignedSeatTicket = eventUsesSeatMap && selectedSectorType === "SEATED";

  const invalidateSeatMapPublishedState = () => {
    if (!eventId || setupMode !== "SEAT_MAP") {
      return;
    }

    sessionStorage.removeItem(`organizer-seat-map-published:${eventId}`);
    document.dispatchEvent(
      new CustomEvent("organizer-seat-map-published-updated", {
        detail: { eventId, published: false },
      }),
    );
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!eventId) {
      return;
    }

    if (eventUsesSeatMap && !formState.eventSectorId.trim()) {
      toast.error(t("organizerTicketTypes.chooseSectorRequired"));
      return;
    }

    if (eventUsesSeatMap && !selectedSector) {
      toast.error(t("organizerTicketTypes.sectorNotPublished"));
      return;
    }

    const payload = toPayload(
      formState,
      isAssignedSeatTicket ? 0 : undefined,
      isAssignedSeatTicket,
      eventUsesSeatMap,
    );
    if (!payload) {
      toast.error(
        isAssignedSeatTicket
          ? t("organizerTicketTypes.assignedSeatMissingFields")
          : t("organizerTicketTypes.quantityMissingFields"),
      );
      return;
    }

    const validationMessage = validateTicketTypePayload(payload, isAssignedSeatTicket, t);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    if (
      payload.saleStartDatetime &&
      payload.saleEndDatetime &&
      new Date(payload.saleEndDatetime) <= new Date(payload.saleStartDatetime)
    ) {
      toast.error(t("organizerTicketTypes.saleEndAfterStart"));
      return;
    }

    setSaving(true);
    try {
      const isEditing = Boolean(editingId);
      const nextTicketType = editingId
        ? await organizerWorkspaceService.updateTicketType(
            eventId,
            editingId,
            payload,
          )
        : await organizerWorkspaceService.createTicketType(eventId, payload);

      setTicketTypes((current) => {
        if (editingId) {
          return current.map((ticketType) =>
            ticketType.id === editingId ? nextTicketType : ticketType,
          );
        }

        return [nextTicketType, ...current];
      });

      invalidateSeatMapPublishedState();
      dispatchOrganizerWorkflowDirty();
      resetForm();
      toast.success(
        isEditing ? t("organizerTicketTypes.updateSuccess") : t("organizerTicketTypes.createSuccess"),
      );
    } catch {
      toast.error(
        editingId ? t("organizerTicketTypes.updateFailed") : t("organizerTicketTypes.createFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleSave = () => {
      if (ticketTypes.length === 0) {
        dispatchOrganizerWorkflowSaveResult(false);
        toast.error(t("organizerTicketTypes.createAtLeastOne"));
        return;
      }
      dispatchOrganizerWorkflowSaveResult(true);
      toast.success(t("organizerTicketTypes.saveSuccess"));
    };
    document.addEventListener("organizer-save-event", handleSave);
    return () => {
      document.removeEventListener("organizer-save-event", handleSave);
    };
  }, [ticketTypes.length, t]);

  const handleEdit = (ticketType: OrganizerTicketType) => {
    setEditingId(ticketType.id);
    setFormState(buildFormState(ticketType));
    setIsCreateFormOpen(true);
  };

  const handleDelete = async (ticketType: OrganizerTicketType) => {
    if (!eventId) {
      return;
    }

    const confirmed = await confirmDestructiveAction({
      title: t("organizerTicketTypes.deleteTitle"),
      text: t("organizerTicketTypes.deleteText"),
      confirmButtonText: t("organizerTicketTypes.deleteConfirm"),
      cancelButtonText: t("organizerTicketTypes.deleteCancel"),
    });

    if (!confirmed) {
      return;
    }

    setDeletingId(ticketType.id);
    try {
      await organizerWorkspaceService.deleteTicketType(eventId, ticketType.id);
      setTicketTypes((current) =>
        current.filter((item) => item.id !== ticketType.id),
      );
      invalidateSeatMapPublishedState();
      dispatchOrganizerWorkflowDirty();
      if (editingId === ticketType.id) {
        resetForm();
      }
      toast.success(t("organizerTicketTypes.deleteSuccess"));
    } catch {
      toast.error(t("organizerTicketTypes.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTicketTypes = ticketTypes.filter((ticketType) => {
    const keyword = ticketSearch.trim().toLowerCase();
    if (!keyword) return true;

    return [
      ticketType.name,
      ticketType.description,
      ticketType.colorCode,
      ticketType.status,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });

  return (
    <OrganizerLayout
      title={t("organizerTicketTypes.title")}
      description={t("organizerTicketTypes.description")}
      hideTopBar
      showWorkflowNav={Boolean(eventId)}
      eventId={eventId}
      className="organizer-ticket-types-page"
    >
      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>{t("organizerTicketTypes.loading")}</p>
        </section>
      ) : (
        <>
          {requestedSetupMode === "SEAT_MAP" && !requestedSectorExists ? (
            <section className="organizer-panel organizer-empty-state compact">
              <p>{t("organizerTicketTypes.requestedSectorNotPublished")}</p>
            </section>
          ) : null}
          {setupMode === null ? (
              <section
                className="organizer-panel organizer-ticket-setup-panel"
                aria-labelledby="organizer-ticket-setup-title"
              >
                <div className="organizer-panel-heading">
                  <h2 id="organizer-ticket-setup-title">
                    {t("organizerTicketTypes.setupTitle")}
                  </h2>
                </div>
                <div className="organizer-ticket-setup-actions">
                  <button
                    type="button"
                    className="organizer-ticket-setup-option"
                    onClick={handleChooseQuantityMode}
                  >
                    <span aria-hidden="true">○</span>
                    <div>
                      <strong>{t("organizerTicketTypes.noSeatMap")}</strong>
                      <p>{t("organizerTicketTypes.noSeatMapDescription")}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="organizer-ticket-setup-option"
                    onClick={handleChooseSeatMapMode}
                  >
                    <span aria-hidden="true">○</span>
                    <div>
                      <strong>{t("organizerTicketTypes.useSeatMap")}</strong>
                      <p>
                        {t("organizerTicketTypes.useSeatMapDescription")}
                      </p>
                    </div>
                  </button>
                </div>
              </section>
          ) : null}
          {isCreateFormOpen ? (
            <div className="organizer-media-modal-backdrop" role="presentation">
              <section
                className="organizer-ticket-form-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="organizer-ticket-form-title"
              >
                <div className="organizer-media-modal-header">
                  <h2 id="organizer-ticket-form-title">
                    {editingId ? t("organizerTicketTypes.updateModalTitle") : t("organizerTicketTypes.createModalTitle")}
                  </h2>
                  <button
                    type="button"
                    className="organizer-media-modal-close"
                    aria-label={t("organizerTicketTypes.closeModal")}
                    onClick={resetForm}
                  >
                    <X size={20} />
                  </button>
                </div>
                <form
                  className="organizer-media-modal-body organizer-event-form organizer-ticket-form-body"
                  onSubmit={handleSubmit}
                >
              <div className="organizer-form-grid">
                <label className="organizer-field organizer-form-span-2">
                  <RequiredFieldLabel>{t("organizerTicketTypes.ticketName")}</RequiredFieldLabel>
                  <input
                    className="organizer-input"
                    value={formState.name}
                    onChange={(event) =>
                      handleChange("name", event.target.value)
                    }
                    placeholder={t("organizerTicketTypes.ticketNamePlaceholder")}
                  />
                </label>

                <label className="organizer-field organizer-form-span-2">
                  <RequiredFieldLabel>{t("organizerTicketTypes.ticketDescription")}</RequiredFieldLabel>
                  <textarea
                    className="organizer-input organizer-textarea organizer-textarea-sm"
                    value={formState.description}
                    onChange={(event) =>
                      handleChange("description", event.target.value)
                    }
                    placeholder={t("organizerTicketTypes.ticketDescriptionPlaceholder")}
                  />
                </label>

                <label className="organizer-field">
                  <RequiredFieldLabel>{t("organizerTicketTypes.price")}</RequiredFieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="organizer-input"
                    value={formState.price}
                    onChange={(event) =>
                      handleChange("price", event.target.value)
                    }
                    placeholder={t("organizerTicketTypes.pricePlaceholder")}
                  />
                </label>

                <label className="organizer-field">
                  <RequiredFieldLabel>{t("organizerTicketTypes.originalPrice")}</RequiredFieldLabel>
                  <input
                    type="number"
                    min={0}
                    className="organizer-input"
                    value={formState.originalPrice}
                    onChange={(event) =>
                      handleChange("originalPrice", event.target.value)
                    }
                    placeholder={t("organizerTicketTypes.originalPricePlaceholder")}
                  />
                </label>

                <label className="organizer-field">
                  <RequiredFieldLabel>{t("organizerTicketTypes.quantity")}</RequiredFieldLabel>
                  <input
                    type="number"
                    min={isAssignedSeatTicket ? 0 : 1}
                    className="organizer-input"
                    value={isAssignedSeatTicket ? "0" : formState.quantityTotal}
                    readOnly={isAssignedSeatTicket}
                    onChange={(event) =>
                      handleChange("quantityTotal", event.target.value)
                    }
                    placeholder={
                      isAssignedSeatTicket
                        ? t("organizerTicketTypes.assignedSeatQuantityPlaceholder")
                        : t("organizerTicketTypes.quantityPlaceholder")
                    }
                  />
                  {isAssignedSeatTicket ? (
                    <small className="organizer-inline-help">
                      {t("organizerTicketTypes.assignedSeatQuantityHelp")}
                    </small>
                  ) : null}
                </label>

                <label className="organizer-field">
                  <RequiredFieldLabel>{t("organizerTicketTypes.maxPerOrder")}</RequiredFieldLabel>
                  <input
                    type="number"
                    min={1}
                    className="organizer-input"
                    value={formState.maxPerOrder}
                    onChange={(event) =>
                      handleChange("maxPerOrder", event.target.value)
                    }
                  />
                </label>


                <label className="organizer-field">
                  <RequiredFieldLabel>{t("organizerTicketTypes.saleStart")}</RequiredFieldLabel>
                  <input
                    type="datetime-local"
                    className="organizer-input"
                    value={formState.saleStartDatetime}
                    onChange={(event) =>
                      handleChange("saleStartDatetime", event.target.value)
                    }
                  />
                </label>

                <label className="organizer-field">
                  <RequiredFieldLabel>{t("organizerTicketTypes.saleEnd")}</RequiredFieldLabel>
                  <input
                    type="datetime-local"
                    className="organizer-input"
                    value={formState.saleEndDatetime}
                    onChange={(event) =>
                      handleChange("saleEndDatetime", event.target.value)
                    }
                  />
                </label>

                <label className="organizer-field">
                  <span>{t("organizerTicketTypes.ticketColor")}</span>
                  <div className="organizer-ticket-color-control">
                    <div className="organizer-ticket-color-value">
                      <input
                        type="color"
                        className="organizer-ticket-color-input"
                        value={formState.colorCode}
                        onChange={(event) =>
                          handleChange("colorCode", event.target.value)
                        }
                        title={t("organizerTicketTypes.chooseColor")}
                      />
                      <span
                        className="organizer-ticket-color-swatch"
                        style={{ backgroundColor: formState.colorCode }}
                        aria-hidden="true"
                      />
                      <span className="organizer-ticket-color-prefix">#</span>
                      <strong>{formState.colorCode.replace("#", "").toUpperCase()}</strong>
                    </div>
                    <button
                      type="button"
                      className="organizer-ticket-color-copy"
                      aria-label={t("organizerTicketTypes.copyColor")}
                      onClick={() => {
                        void navigator.clipboard?.writeText(formState.colorCode.toUpperCase());
                      }}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </label>

                {eventUsesSeatMap ? (
                  <label className="organizer-field">
                    <RequiredFieldLabel>{t("organizerTicketTypes.appliedSector")}</RequiredFieldLabel>
                    <select
                      className="organizer-input"
                      value={formState.eventSectorId}
                      onChange={(event) =>
                        handleChange("eventSectorId", event.target.value)
                      }
                    >
                      <option value="">{t("organizerTicketTypes.chooseSector")}</option>
                      {activeSectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name} - {sector.sectorType === "SEATED" ? t("organizerTicketTypes.seatedSector") : t("organizerTicketTypes.standingSector")}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                <div className="organizer-checkbox-grid organizer-form-span-2">
                  <label className="organizer-checkbox-card">
                    <input
                      type="checkbox"
                      checked={formState.isVisible}
                      onChange={(event) =>
                        handleChange("isVisible", event.target.checked)
                      }
                    />
                    <div>
                      <strong>{t("organizerTicketTypes.publicVisible")}</strong>
                      <p>
                        {t("organizerTicketTypes.publicVisibleDescription")}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="organizer-form-actions organizer-ticket-modal-actions">
                <button
                  type="submit"
                  className="btn btn-primary organizer-action-button"
                  disabled={saving}
                  style={{ flex: 1, margin: 0 }}
                >
                  {saving
                    ? t("organizerTicketTypes.saving")
                    : editingId
                      ? t("organizerTicketTypes.updateTicketType")
                      : t("organizerTicketTypes.createTicketType")}
                </button>
              </div>
                </form>
              </section>
            </div>
          ) : null}

          {setupMode !== null ? (
            <section className="organizer-panel">
            <div className="organizer-panel-heading-row organizer-ticket-header-row">
              <div className="organizer-ticket-header-actions">
                <label className="organizer-events-list-search organizer-ticket-search">
                  <input
                    value={ticketSearch}
                    onChange={(event) => setTicketSearch(event.target.value)}
                    className="organizer-events-list-search-input"
                    placeholder={t("organizerTicketTypes.searchPlaceholder")}
                  />
                  <span
                    className="organizer-events-list-search-button organizer-ticket-search-icon"
                    aria-hidden="true"
                  >
                    <Search size={14} />
                  </span>
                </label>
                <button
                  type="button"
                  className="organizer-events-add-button organizer-ticket-create-button"
                  onClick={handleCreateClick}
                >
                  {t("organizerTicketTypes.createEventTicket")}
                </button>
              </div>
            </div>
            {ticketTypes.length === 0 ? (
              <div className="organizer-empty-state compact" style={{ background: "transparent", border: "none", boxShadow: "none" }}>
                <Ticket size={48} style={{ color: "#16a34a", marginBottom: "12px" }} />
                <p>{t("organizerTicketTypes.empty")}</p>
              </div>
            ) : filteredTicketTypes.length === 0 ? (
              <div className="organizer-empty-state compact" style={{ background: "transparent", border: "none", boxShadow: "none" }}>
                <Search size={48} style={{ color: "#16a34a", marginBottom: "12px" }} />
                <p>{t("organizerTicketTypes.filterEmpty")}</p>
              </div>
            ) : (
              <div className="organizer-ticket-table-wrap">
                <table className="organizer-ticket-table">
                  <thead>
                    <tr>
                      <th>{t("organizerTicketTypes.index")}</th>
                      <th>{t("organizerTicketTypes.ticketName")}</th>
                      <th>{t("organizerTicketTypes.ticketColor")}</th>
                      <th>{t("organizerTicketTypes.price")}</th>
                      <th>{t("organizerTicketTypes.originalPrice")}</th>
                      <th>{t("organizerTicketTypes.quantity")}</th>
                      <th>{t("organizerTicketTypes.remaining")}</th>
                      <th>{t("organizerTicketTypes.saleStart")}</th>
                      <th>{t("organizerTicketTypes.saleEnd")}</th>
                      <th>{t("organizerTicketTypes.status")}</th>
                      <th>{t("organizerTicketTypes.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTicketTypes.map((ticketType, index) => {
                      const statusMeta = getTicketTypeStatusMeta(
                        ticketType.status,
                      );

                      return (
                        <tr key={ticketType.id}>
                          <td>{index + 1}</td>
                          <td className="organizer-ticket-name-cell">
                            <strong>{ticketType.name}</strong>
                            <span>
                              {ticketType.description || t("organizerTicketTypes.noDescription")}
                            </span>
                          </td>
                          <td className="organizer-ticket-color-cell">
                            <span
                              className="organizer-ticket-color-dot"
                              style={{
                                backgroundColor: ticketType.colorCode || "#16a34a",
                              }}
                            />
                            <span>
                              {(ticketType.colorCode || "#16a34a").toUpperCase()}
                            </span>
                          </td>
                          <td>{formatMoney(ticketType.price)}</td>
                          <td>
                            {ticketType.originalPrice
                              ? formatMoney(ticketType.originalPrice)
                              : "-"}
                          </td>
                          <td>{ticketType.quantityTotal ?? 0}</td>
                          <td>{ticketType.quantityAvailable ?? 0}</td>
                          <td>
                            {formatDateTime(ticketType.saleStartDatetime)}
                          </td>
                          <td>{formatDateTime(ticketType.saleEndDatetime)}</td>
                          <td>
                            <span
                              className={`organizer-status-badge ${statusMeta.className}`}
                            >
                              {t(`organizerTicketTypes.statuses.${ticketType.status ?? "UNKNOWN"}`, { defaultValue: statusMeta.label })}
                            </span>
                          </td>
                          <td>
                            <div className="organizer-ticket-table-actions">
                              <button
                                type="button"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  boxShadow: "none",
                                  padding: "8px",
                                  cursor: "pointer",
                                  color: "#19454F"
                                }}
                                title={t("organizerTicketTypes.edit")}
                                onClick={() => handleEdit(ticketType)}
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                type="button"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  boxShadow: "none",
                                  padding: "8px",
                                  cursor: "pointer",
                                  color: "#ef4444",
                                  opacity: deletingId === ticketType.id ? 0.5 : 1
                                }}
                                title={t("organizerTicketTypes.delete")}
                                onClick={() => handleDelete(ticketType)}
                                disabled={deletingId === ticketType.id}
                              >
                                {deletingId === ticketType.id ? (
                                  <span className="loading-spinner" style={{ width: 16, height: 16 }} />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </section>
          ) : null}
        </>
      )}
    </OrganizerLayout>
  );
}

