import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
const SafeEditorContent = EditorContent as any;
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
} from "lucide-react";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
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

const eventDescriptionTemplate = `<h2>Giới thiệu sự kiện:</h2>
<p>[Tóm tắt ngắn gọn về sự kiện: Nội dung chính của sự kiện, điểm đặc sắc nhất và lý do khiến người tham gia không nên bỏ lỡ]</p>
<h2>Chi tiết sự kiện:</h2>
<p><strong>Chương trình chính:</strong> [Liệt kê những hoạt động nổi bật trong sự kiện: các phần trình diễn, khách mời đặc biệt, lịch trình các tiết mục cụ thể nếu có.]</p>
<p><strong>Khách mời:</strong> [Thông tin về các khách mời đặc biệt, nghệ sĩ, diễn giả sẽ tham gia sự kiện. Có thể bao gồm phần mô tả ngắn gọn về họ và những gì họ sẽ mang lại cho sự kiện.]</p>
<p><strong>Trải nghiệm đặc biệt:</strong> [Nếu có các hoạt động đặc biệt khác như workshop, khu trải nghiệm, photo booth, khu vực check-in hay các phần quà/ưu đãi dành riêng cho người tham dự.]</p>
<h2>Điều khoản và điều kiện:</h2>
<ul>
  <li>[TnC] sự kiện</li>
  <li>Lưu ý về điều khoản trẻ em</li>
  <li>Lưu ý về điều khoản VAT</li>
</ul>`;

const defaultFormState: EventFormState = {
  title: "",
  shortDescription: "",
  description: eventDescriptionTemplate,
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

type MenuBarProps = {
  editor: ReturnType<typeof useEditor>;
};

function MenuBar({ editor }: MenuBarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="tiptap-toolbar">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={editor.isActive("bold") ? "is-active" : ""}
        title="Bold"
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={editor.isActive("italic") ? "is-active" : ""}
        title="Italic"
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={editor.isActive("strike") ? "is-active" : ""}
        title="Strike"
      >
        <Strikethrough size={16} />
      </button>
      <div style={{ width: "1px", height: "20px", background: "#cbd5e1", margin: "0 4px" }} />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={editor.isActive("heading", { level: 1 }) ? "is-active" : ""}
        title="Heading 1"
      >
        <Heading1 size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
        title="Heading 2"
      >
        <Heading2 size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={editor.isActive("heading", { level: 3 }) ? "is-active" : ""}
        title="Heading 3"
      >
        <Heading3 size={16} />
      </button>
      <div style={{ width: "1px", height: "20px", background: "#cbd5e1", margin: "0 4px" }} />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive("bulletList") ? "is-active" : ""}
        title="Bullet List"
      >
        <List size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive("orderedList") ? "is-active" : ""}
        title="Ordered List"
      >
        <ListOrdered size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive("blockquote") ? "is-active" : ""}
        title="Blockquote"
      >
        <Quote size={16} />
      </button>
      <div style={{ width: "1px", height: "20px", background: "#cbd5e1", margin: "0 4px" }} />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        title="Undo"
      >
        <Undo size={16} />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        title="Redo"
      >
        <Redo size={16} />
      </button>
    </div>
  );
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
  const shortDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside, true);
    window.addEventListener("mousedown", handleClickOutside, true);
    window.addEventListener("touchstart", handleClickOutside, true);
    return () => {
      window.removeEventListener("click", handleClickOutside, true);
      window.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: formState.description,
    onUpdate: ({ editor }) => {
      handleChange("description", editor.getHTML());
    },
  });

  // Sync editor content with formState.description on load (when editor isn't focused)
  useEffect(() => {
    if (editor && !loading) {
      if (editor.getHTML() !== formState.description && !editor.isFocused) {
        editor.commands.setContent(formState.description);
      }
    }
  }, [formState.description, editor, loading]);

  useEffect(() => {
    const handleSave = (e: Event) => {
      const customEvent = e as CustomEvent<{ nextStep?: string }>;
      const nextStep = customEvent.detail?.nextStep;
      const mockEvent = { preventDefault: () => {} } as FormEvent<HTMLFormElement>;
      void handleSubmit(mockEvent, nextStep);
    };
    document.addEventListener("organizer-save-event", handleSave);
    return () => {
      document.removeEventListener("organizer-save-event", handleSave);
    };
  }, [formState, currentEvent, isCreateMode, saving, eventId]);

  useEffect(() => {
    const handleEventStatusUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<OrganizerEventDetail>;
      if (!customEvent.detail || customEvent.detail.id !== eventId) return;
      setCurrentEvent(customEvent.detail);
      setFormState(buildFormState(customEvent.detail));
    };

    document.addEventListener("organizer-event-status-updated", handleEventStatusUpdate);
    return () => {
      document.removeEventListener("organizer-event-status-updated", handleEventStatusUpdate);
    };
  }, [eventId]);

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

  const handleChange = <K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async (
    submitEvent: FormEvent<HTMLFormElement>,
    nextStep?: string,
  ) => {
    submitEvent.preventDefault();

    if (!formState.title.trim()) {
      toast.error("Tên sự kiện là bắt buộc.");
      return;
    }

    if (!formState.categoryIds.length || !formState.categoryIds[0]) {
      toast.error("Danh mục là bắt buộc.");
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
        sessionStorage.setItem(
          `organizer-workflow-step-saved:/organizer/events/${nextEvent.id}/edit`,
          "true",
        );
        if (nextStep === "media") {
          navigate(`/organizer/events/${nextEvent.id}/media`);
        } else {
          navigate(`/organizer/events/${nextEvent.id}/edit`, { replace: true });
        }
        return;
      }

      toast.success("Cập nhật sự kiện thành công.");
    } catch {
      toast.error(isCreateMode ? "Tạo sự kin thất bại." : "Cập nhật sự kin thất bại.");
    } finally {
      setSaving(false);
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
      className="organizer-event-editor-page"
      showWorkflowNav
      eventId={eventId}
    >

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
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Tên sự kiện
                </span>
                <input
                  className="organizer-input"
                  value={formState.title}
                  onChange={(event) => handleChange("title", event.target.value)}
                  placeholder="Nhập tên sự kiện"
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Mô tả ngắn
                </span>
                <textarea
                  ref={shortDescriptionRef}
                  className="organizer-input organizer-textarea organizer-textarea-sm"
                  value={formState.shortDescription}
                  onChange={(event) => handleChange("shortDescription", event.target.value)}
                  placeholder="Mô tả ngắn"
                />
              </label>

              <div className="organizer-field organizer-form-span-2">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Mô tả chi tiết
                </span>
                <div className="tiptap-editor-wrapper">
                  <MenuBar editor={editor} />
                  <SafeEditorContent editor={editor} className="tiptap-editor-container" />
                </div>
              </div>

              <label className="organizer-field organizer-form-span-2">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Tags
                </span>
                <input
                  className="organizer-input"
                  value={formState.tags}
                  onChange={(event) => handleChange("tags", event.target.value)}
                  placeholder="Nhập tag"
                />
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Bắt đầu
                </span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.startDatetime}
                  onChange={(event) => handleChange("startDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Kết thúc
                </span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.endDatetime}
                  onChange={(event) => handleChange("endDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Timezone
                </span>
                <input
                  className="organizer-input"
                  value={formState.timezone}
                  onChange={(event) => handleChange("timezone", event.target.value)}
                  placeholder="Asia/Ho_Chi_Minh"
                />
              </label>

              <label className="organizer-field organizer-switch-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Hình thức
                </span>
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
                  <span>
                    <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Địa điểm
                  </span>
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
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Bắt đầu bán
                </span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.saleStartDatetime}
                  onChange={(event) => handleChange("saleStartDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Kết thúc bán
                </span>
                <input
                  type="datetime-local"
                  className="organizer-input"
                  value={formState.saleEndDatetime}
                  onChange={(event) => handleChange("saleEndDatetime", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Mua tối thiểu
                </span>
                <input
                  type="number"
                  min={1}
                  className="organizer-input"
                  value={formState.minTicketsPerOrder}
                  onChange={(event) => handleChange("minTicketsPerOrder", event.target.value)}
                />
              </label>

              <label className="organizer-field">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Mua tối đa
                </span>
                <input
                  type="number"
                  min={1}
                  className="organizer-input"
                  value={formState.maxTicketsPerOrder}
                  onChange={(event) => handleChange("maxTicketsPerOrder", event.target.value)}
                />
              </label>

              <label className="organizer-field organizer-form-span-2">
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Hiển thị
                </span>
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

              <div className="organizer-field organizer-form-span-2" ref={categoryDropdownRef}>
                <span>
                  <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Danh mục
                </span>
                <div style={{ position: "relative" }}>
                  <div
                    className="organizer-input"
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      alignItems: "center",
                      minHeight: "44px",
                      height: "auto",
                      padding: "6px 12px",
                      cursor: "pointer",
                    }}
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                  >
                    {formState.categoryIds.length === 0 ? (
                      <span style={{ color: "#94a3b8" }}>Chọn danh mục (cho phép chọn nhiều)</span>
                    ) : (
                      formState.categoryIds.map((id) => {
                        const cat = categories.find((c) => c.id === id);
                        return (
                          <span
                            key={id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              background: "#ecfdf5",
                              border: "1px solid #bbf7d0",
                              color: "#065f46",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            {cat?.name || id}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextIds = formState.categoryIds.filter((cid) => cid !== id);
                                handleChange("categoryIds", nextIds);
                              }}
                              style={{
                                border: "none",
                                background: "none",
                                color: "#065f46",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: "10px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "14px",
                                height: "14px",
                                borderRadius: "50%",
                              }}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })
                    )}
                  </div>
                  
                  {isCategoryDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                        zIndex: 1000,
                        maxHeight: "200px",
                        overflowY: "auto",
                        padding: "4px",
                      }}
                    >
                      {categories.map((category) => {
                        const isSelected = formState.categoryIds.includes(category.id);
                        return (
                          <div
                            key={category.id}
                            onClick={() => {
                              const nextIds = isSelected
                                ? formState.categoryIds.filter((id) => id !== category.id)
                                : [...formState.categoryIds, category.id];
                              handleChange("categoryIds", nextIds);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              background: isSelected ? "#f1f5f9" : "transparent",
                              fontWeight: isSelected ? 600 : 500,
                              fontSize: "13px",
                              color: "#1e293b",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              readOnly
                              style={{ cursor: "pointer" }}
                            />
                            <span>{category.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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

          </form>
        </>
      )}
    </OrganizerLayout>
  );
}
