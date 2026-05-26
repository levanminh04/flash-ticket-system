import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import OrganizerEventWorkspaceNav from "../../components/organizer/OrganizerEventWorkspaceNav";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
  OrganizerEventPayload,
  OrganizerVenue,
  OrganizerVisibility,
} from "../../services/organizerWorkspaceService";
import { Category } from "../../types/api";
import {
  formatDateTime,
  toDateTimeLocal,
  toIsoString,
} from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

type EventFormState = {
  title: string;
  shortDescription: string;
  description: string;
  tags: string;
  startDatetime: string;
  endDatetime: string;
  timezone: string;
  venueId: string;
  isOnline: boolean;
  onlineEventUrl: string;
  categoryIds: string[];
  saleStartDatetime: string;
  saleEndDatetime: string;
  minTicketsPerOrder: string;
  maxTicketsPerOrder: string;
  visibility: OrganizerVisibility;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
};

const defaultFormState: EventFormState = {
  title: "",
  shortDescription: "",
  description: "",
  tags: "",
  startDatetime: "",
  endDatetime: "",
  timezone: "Asia/Ho_Chi_Minh",
  venueId: "",
  isOnline: false,
  onlineEventUrl: "",
  categoryIds: [],
  saleStartDatetime: "",
  saleEndDatetime: "",
  minTicketsPerOrder: "1",
  maxTicketsPerOrder: "10",
  visibility: "PUBLIC",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
};

function buildFormState(event: OrganizerEventDetail): EventFormState {
  return {
    title: event.title || "",
    shortDescription: event.shortDescription || "",
    description: event.description || "",
    tags: (event.tags || []).join(", "),
    startDatetime: toDateTimeLocal(event.schedule?.startDatetime),
    endDatetime: toDateTimeLocal(event.schedule?.endDatetime),
    timezone: event.schedule?.timezone || "Asia/Ho_Chi_Minh",
    venueId: event.venue?.id || "",
    isOnline: Boolean(event.isOnline),
    onlineEventUrl: event.onlineEventUrl || "",
    categoryIds: (event.categories || []).map((category) => category.id),
    saleStartDatetime: toDateTimeLocal(event.schedule?.saleStartDatetime),
    saleEndDatetime: toDateTimeLocal(event.schedule?.saleEndDatetime),
    minTicketsPerOrder: String(event.config?.minTicketsPerOrder ?? 1),
    maxTicketsPerOrder: String(event.config?.maxTicketsPerOrder ?? 10),
    visibility: (event.config?.visibility as OrganizerVisibility) || "PUBLIC",
    metaTitle: "",
    metaDescription: "",
    metaKeywords: "",
  };
}

function toPayload(formState: EventFormState): OrganizerEventPayload | null {
  const startDatetime = toIsoString(formState.startDatetime);
  const endDatetime = toIsoString(formState.endDatetime);
  const saleStartDatetime = toIsoString(formState.saleStartDatetime);
  const saleEndDatetime = toIsoString(formState.saleEndDatetime);

  if (!startDatetime || !endDatetime) {
    return null;
  }

  return {
    title: formState.title.trim(),
    shortDescription: formState.shortDescription.trim() || undefined,
    description: formState.description.trim() || undefined,
    tags: formState.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    startDatetime,
    endDatetime,
    timezone: formState.timezone.trim() || "Asia/Ho_Chi_Minh",
    venueId: formState.isOnline ? undefined : formState.venueId || undefined,
    isOnline: formState.isOnline,
    onlineEventUrl: formState.isOnline
      ? formState.onlineEventUrl.trim() || undefined
      : undefined,
    categoryIds: formState.categoryIds.length ? formState.categoryIds : undefined,
    saleStartDatetime,
    saleEndDatetime,
    minTicketsPerOrder: Number(formState.minTicketsPerOrder || 1),
    maxTicketsPerOrder: Number(formState.maxTicketsPerOrder || 10),
    visibility: formState.visibility,
    metaTitle: formState.metaTitle.trim() || undefined,
    metaDescription: formState.metaDescription.trim() || undefined,
    metaKeywords: formState.metaKeywords.trim() || undefined,
  };
}

function buildUpdatePayload(
  formState: EventFormState,
  currentEvent: OrganizerEventDetail | null,
): Partial<OrganizerEventPayload> | null {
  const payload = toPayload(formState);
  if (!payload) {
    return null;
  }
  if (!currentEvent) {
    return payload;
  }

  const currentStart = toDateTimeLocal(currentEvent.schedule?.startDatetime);
  const currentEnd = toDateTimeLocal(currentEvent.schedule?.endDatetime);
  const nextPayload: Partial<OrganizerEventPayload> = { ...payload };

  if (formState.startDatetime === currentStart) {
    delete nextPayload.startDatetime;
  }
  if (formState.endDatetime === currentEnd) {
    delete nextPayload.endDatetime;
  }

  return nextPayload;
}

export default function OrganizerEventEditorPage() {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const isCreateMode = !eventId;
  const { ready } = useOrganizerGate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [venues, setVenues] = useState<OrganizerVenue[]>([]);
  const [currentEvent, setCurrentEvent] = useState<OrganizerEventDetail | null>(null);
  const [formState, setFormState] = useState<EventFormState>(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const shortDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextCategories, nextVenues, nextEvent] = await Promise.all([
          organizerWorkspaceService.getCategories(),
          organizerWorkspaceService.getVenues(),
          eventId
            ? organizerWorkspaceService.getMyEvent(eventId)
            : Promise.resolve<OrganizerEventDetail | null>(null),
        ]);

        if (cancelled) return;

        setCategories(nextCategories);
        setVenues(nextVenues);
        setCurrentEvent(nextEvent);
        setFormState(nextEvent ? buildFormState(nextEvent) : defaultFormState);
      } catch {
        if (!cancelled) {
          toast.error("Không thể tải dữ liệu form sự kiện.");
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
  }, [eventId, ready]);

  const autoResizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    autoResizeTextarea(shortDescriptionRef.current);
  }, [formState.shortDescription]);

  useEffect(() => {
    autoResizeTextarea(descriptionRef.current);
  }, [formState.description]);

  const handleChange = <K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleCategoryToggle = (categoryId: string) => {
    setFormState((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((item) => item !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  };

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();

    if (!formState.title.trim()) {
      toast.error("Tên sự kiện là bắt buộc.");
      return;
    }

    const fullPayload = toPayload(formState);
    if (!fullPayload) {
      toast.error("Thời gian bắt đầu và kết thúc chưa hợp lệ.");
      return;
    }

    if (new Date(fullPayload.endDatetime) <= new Date(fullPayload.startDatetime)) {
      toast.error("Thời gian kết thúc phải lớn hơn thời gian bắt đầu.");
      return;
    }

    if (!formState.isOnline && !fullPayload.venueId) {
      toast.error("Sự kiện offline cần chọn venue");
      return;
    }

    if (
      fullPayload.saleStartDatetime &&
      fullPayload.saleEndDatetime &&
      new Date(fullPayload.saleEndDatetime) <= new Date(fullPayload.saleStartDatetime)
    ) {
      toast.error("Thời gian mở bán phải nhỏ hơn thời gian kết thúc bán.");
      return;
    }

    if (fullPayload.minTicketsPerOrder && fullPayload.maxTicketsPerOrder) {
      if (fullPayload.minTicketsPerOrder > fullPayload.maxTicketsPerOrder) {
        toast.error("Giới hạn mua vé tối thiểu không được lớn hơn tối đa.");
        return;
      }
    }

    const updatePayload = buildUpdatePayload(formState, currentEvent);
    if (!isCreateMode && !updatePayload) {
      toast.error("Thời gian bắt đầu và kết thúc chưa hợp lệ.");
      return;
    }

    setSaving(true);
    try {
      const nextEvent = isCreateMode
        ? await organizerWorkspaceService.createEvent(fullPayload)
        : await organizerWorkspaceService.updateEvent(eventId, updatePayload ?? {});

      setCurrentEvent(nextEvent);
      setFormState(buildFormState(nextEvent));

      if (isCreateMode) {
        toast.success("Tạo sự kiện thành công.");
        navigate(`/organizer/events/${nextEvent.id}/edit`, { replace: true });
        return;
      }

      toast.success("Cập nhật sự kiện thành công.");
    } catch {
      toast.error(isCreateMode ? "Tạo sự kin thất bại." : "Cập nhật sự kin thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!eventId || currentEvent?.status !== "DRAFT") return;
    setPublishing(true);
    try {
      const nextEvent = await organizerWorkspaceService.publishEvent(eventId);
      setCurrentEvent(nextEvent);
      setFormState(buildFormState(nextEvent));
      toast.success("Đã publish sự kiện");
    } catch {
      toast.error("Không thể publish sự kiện.");
    } finally {
      setPublishing(false);
    }
  };

  const handleCancel = async () => {
    if (
      !eventId ||
      currentEvent?.status === "CANCELLED" ||
      currentEvent?.status === "COMPLETED"
    ) return;

    const confirmed = await confirmDestructiveAction({
      title: "Hủy sự kiện này?",
      text: "Sự kiện sẽ chuyển sang trạng thái đã hủy. Hãy chắc chắn organizer đã sẵn sàng cho thao tác này.",
      confirmButtonText: "Xác nhận hủy",
      cancelButtonText: "Giữ nguyên",
    });

    if (!confirmed) return;

    setCancelling(true);
    try {
      const nextEvent = await organizerWorkspaceService.cancelEvent(eventId);
      setCurrentEvent(nextEvent);
      setFormState(buildFormState(nextEvent));
      toast.success("Đã hủy sự kiện.");
    } catch {
      toast.error("Không thể hủy sự kiện.");
    } finally {
      setCancelling(false);
    }
  };

  const pageDescription = isCreateMode
    ? "Tạo event, gắn category, venue và cấu hình bán vé"
    : `Cập nhật gần nhất: ${formatDateTime(currentEvent?.updatedAt)}`;

  return (
    <OrganizerLayout
      title={isCreateMode ? "Tạo sự kiện mới" : currentEvent?.title || ""}
      description={pageDescription}
      actions={null}
      hideTopBar
    >
      {!isCreateMode && eventId ? <OrganizerEventWorkspaceNav eventId={eventId} /> : null}

      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Đang tải dữ liệu form sự kiện</p>
        </section>
      ) : (
        <>
          <form className="organizer-panel organizer-event-form" onSubmit={handleSubmit}>
            <div className="organizer-form-grid">
              <label className="organizer-field organizer-form-span-2">
                <span>Tên sự kiện</span>
                <input
                  className="organizer-input"
                  value={formState.title}
                  onChange={(event) => handleChange("title", event.target.value)}
                  placeholder="Nhập tên sự kiện"
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>Mô tả ngắn</span>
                <textarea
                  ref={shortDescriptionRef}
                  className="organizer-input organizer-textarea organizer-textarea-sm"
                  value={formState.shortDescription}
                  onChange={(event) => handleChange("shortDescription", event.target.value)}
                  placeholder="Mô tả ngắn"
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>Mô tả chi tiết</span>
                <textarea
                  ref={descriptionRef}
                  className="organizer-input organizer-textarea"
                  value={formState.description}
                  onChange={(event) => handleChange("description", event.target.value)}
                  placeholder="Thông tin chi tiết về sự kiện"
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>Tags</span>
                <input
                  className="organizer-input"
                  value={formState.tags}
                  onChange={(event) => handleChange("tags", event.target.value)}
                  placeholder="Nhập tag"
                />
              </label>

              <label className="organizer-field">
                <span>Bắt đầu</span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.startDatetime}
                  onChange={(event) => handleChange("startDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>Kết thúc</span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.endDatetime}
                  onChange={(event) => handleChange("endDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>Timezone</span>
                <input
                  className="organizer-input"
                  value={formState.timezone}
                  onChange={(event) => handleChange("timezone", event.target.value)}
                  placeholder="Asia/Ho_Chi_Minh"
                />
              </label>

              <label className="organizer-field organizer-switch-field">
                <span>Hình thức</span>
                <label className="organizer-checkbox-card">
                  <input
                    type="checkbox"
                    checked={formState.isOnline}
                    onChange={(event) => handleChange("isOnline", event.target.checked)}
                  />
                  <div>
                    <strong>Sự kiện online</strong>
                  </div>
                </label>
              </label>

              {formState.isOnline ? (
                <label className="organizer-field organizer-form-span-2">
                  <span>Link online</span>
                  <input
                    className="organizer-input"
                    value={formState.onlineEventUrl}
                    onChange={(event) => handleChange("onlineEventUrl", event.target.value)}
                    placeholder="Nhập link online"
                  />
                </label>
              ) : (
                <label className="organizer-field organizer-form-span-2">
                  <span>Địa điểm</span>
                  <select
                    className="organizer-input"
                    value={formState.venueId}
                    onChange={(event) => handleChange("venueId", event.target.value)}
                  >
                    <option value="">Chọn địa điểm</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name} {venue.city ? `- ${venue.city}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="organizer-field">
                <span>Bắt đầu bán</span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.saleStartDatetime}
                  onChange={(event) => handleChange("saleStartDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>Kết thúc bán</span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.saleEndDatetime}
                  onChange={(event) => handleChange("saleEndDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>Mua tối thiểu</span>
                <input
                  type="number"
                  min={1}
                  className="organizer-input"
                  value={formState.minTicketsPerOrder}
                  onChange={(event) => handleChange("minTicketsPerOrder", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>Mua tối đa</span>
                <input
                  type="number"
                  min={1}
                  className="organizer-input"
                  value={formState.maxTicketsPerOrder}
                  onChange={(event) => handleChange("maxTicketsPerOrder", event.target.value)}
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>Hiển thị</span>
                <select
                  className="organizer-input"
                  value={formState.visibility}
                  onChange={(event) =>
                    handleChange("visibility", event.target.value as OrganizerVisibility)
                  }
                >
                  <option value="PUBLIC">Public</option>
                  <option value="UNLISTED">Unlisted</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </label>

              <div className="organizer-field organizer-form-span-2">
                <span>Danh mục</span>
                <div className="organizer-checkbox-grid">
                  {categories.map((category) => (
                    <label key={category.id} className="organizer-checkbox-card">
                      <input
                        type="checkbox"
                        checked={formState.categoryIds.includes(category.id)}
                        onChange={() => handleCategoryToggle(category.id)}
                      />
                      <div>
                        <strong>{category.name}</strong>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <label className="organizer-field">
                <span>Meta title</span>
                <input
                  className="organizer-input"
                  value={formState.metaTitle}
                  onChange={(event) => handleChange("metaTitle", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>Meta keywords</span>
                <input
                  className="organizer-input"
                  value={formState.metaKeywords}
                  onChange={(event) => handleChange("metaKeywords", event.target.value)}
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>Meta description</span>
                <textarea
                  className="organizer-input organizer-textarea organizer-textarea-sm"
                  value={formState.metaDescription}
                  onChange={(event) => handleChange("metaDescription", event.target.value)}
                />
              </label>
            </div>

            <div className="organizer-form-actions">
              <button type="submit" className="btn btn-primary organizer-action-button" disabled={saving}>
                {saving ? "Đang lưu" : isCreateMode ? "Tạo sự kiện" : "Lưu thay đổi"}
              </button>
            </div>
          </form>

          {!isCreateMode ? (
            <div className="organizer-editor-secondary-actions">
              <button
                type="button"
                className="btn btn-secondary organizer-editor-secondary-button"
                onClick={handleCancel}
                disabled={
                  cancelling ||
                  currentEvent?.status === "CANCELLED" ||
                  currentEvent?.status === "COMPLETED"
                }
              >
                {cancelling ? "Đang hủy" : "Hủy sự kiện"}
              </button>
              <button
                type="button"
                className="btn btn-primary organizer-editor-secondary-button"
                onClick={handlePublish}
                disabled={publishing || currentEvent?.status !== "DRAFT"}
              >
                {publishing ? "Đang publish" : "Publish"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </OrganizerLayout>
  );
}
