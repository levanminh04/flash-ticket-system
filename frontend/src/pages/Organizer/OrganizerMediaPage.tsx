import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Eye,
  ImagePlus,
  LoaderCircle,
  Edit,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { FaEdit } from "react-icons/fa";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useDropzone } from "react-dropzone";
import Swal from "sweetalert2";
import AppPagination from "../../components/common/AppPagination";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import {
  organizerService,
  OrganizerEventImage,
  OrganizerImageType,
} from "../../services/organizerService";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
} from "../../services/organizerWorkspaceService";
import { confirmDestructiveAction } from "../../lib/swal";
import { useOrganizerGate } from "./useOrganizerGate";

const imageTypes: OrganizerImageType[] = [
  "BANNER",
  "POSTER",
  "THUMBNAIL",
  "GALLERY",
  "SEAT_MAP",
];
const ORGANIZER_EVENTS_FETCH_SIZE = 50;
const IMAGES_PER_PAGE = 6;
const EVENTS_PER_PAGE = 10;
type MediaEventFilter = "all" | "active" | "draft";
const mediaEventFilters: Array<{ value: MediaEventFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
];
const numberFormat = new Intl.NumberFormat("vi-VN");

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(dateTime?: string | null) {
  if (!dateTime) return "-";
  const parsedDate = new Date(dateTime);
  if (Number.isNaN(parsedDate.getTime())) return dateTime;
  return parsedDate.toLocaleString("vi-VN", { hour12: false });
}

function formatEventTableDateTime(dateTime?: string | null) {
  if (!dateTime) return "-";
  const parsedDate = new Date(dateTime);
  if (Number.isNaN(parsedDate.getTime())) return dateTime;

  return parsedDate.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isOrganizerImageType(value: string): value is OrganizerImageType {
  return imageTypes.includes(value as OrganizerImageType);
}

function resolveBannerUrl(event: OrganizerEventDetail) {
  return (
    event.images?.find((image) => image.type === "BANNER")?.url ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url
  );
}

function formatEventLocation(event: OrganizerEventDetail) {
  const parts = [event.venue?.name, event.venue?.city]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .map((part) => part.trim());

  return Array.from(new Set(parts)).join(", ") || "Chưa cập nhật địa điểm";
}

function formatEventTicketTypes(event: OrganizerEventDetail) {
  if (!event.ticketTypes || event.ticketTypes.length === 0) {
    return "Chưa có loại vé";
  }

  return event.ticketTypes.map((ticketType) => ticketType.name).join(", ");
}

async function getAllOrganizerEvents(): Promise<OrganizerEventDetail[]> {
  const firstPage = await organizerWorkspaceService.getMyEvents(
    0,
    ORGANIZER_EVENTS_FETCH_SIZE,
  );
  const firstPageEvents = firstPage.content ?? [];

  if (firstPage.totalPages <= 1) {
    return firstPageEvents;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      organizerWorkspaceService.getMyEvents(
        index + 1,
        ORGANIZER_EVENTS_FETCH_SIZE,
      ),
    ),
  );

  return [
    ...firstPageEvents,
    ...remainingPages.flatMap((page) => page.content ?? []),
  ];
}

export default function OrganizerMediaPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { ready } = useOrganizerGate();
  const [events, setEvents] = useState<OrganizerEventDetail[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState("");
  const [resolvedEvent, setResolvedEvent] = useState<OrganizerEventDetail | null>(
    null,
  );
  const [images, setImages] = useState<OrganizerEventImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] =
    useState<OrganizerImageType>("BANNER");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [currentPage, setCurrentPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [eventFilter, setEventFilter] = useState<MediaEventFilter>("all");

  const activeEventId = eventId || resolvedEvent?.id;
  const setupMode = useMemo(() => {
    if (!activeEventId) return null;
    return sessionStorage.getItem(`organizer-ticket-setup-mode:${activeEventId}`);
  }, [activeEventId]);

  const resolvedImageTypes = useMemo(() => {
    if (setupMode === "QUANTITY") {
      return imageTypes.filter((t) => t !== "SEAT_MAP");
    }
    return imageTypes;
  }, [setupMode]);

  const setFileWithPreview = (file: File | null) => {
    setSelectedFile(file);
    if (!file) {
      setSelectedPreviewUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedPreviewUrl(
        typeof reader.result === "string" ? reader.result : null,
      );
    };
    reader.onerror = () => setSelectedPreviewUrl(null);
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      multiple: false,
      maxFiles: 1,
      accept: {
        "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      },
      onDrop: (acceptedFiles) => {
        setFileWithPreview(acceptedFiles[0] ?? null);
      },
      onDropRejected: () => {
        setFileWithPreview(null);
        toast.error("Chỉ hỗ trợ 1 ảnh định dạng PNG, JPG hoặc WEBP.");
      },
    });

  const filteredEvents = useMemo(() => {
    const keyword = eventSearch.trim().toLowerCase();
    const filteredByStatus =
      eventFilter === "all"
        ? events
        : events.filter((event) =>
            eventFilter === "active"
              ? event.status === "PUBLISHED"
              : event.status === "DRAFT",
          );
    if (!keyword) return filteredByStatus;

    return filteredByStatus.filter((event) =>
      [event.title, event.slug, event.venue?.name, event.venue?.city]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [eventFilter, eventSearch, events]);

  const eventFilterCounts = useMemo(
    () => ({
      all: events.length,
      active: events.filter((event) => event.status === "PUBLISHED").length,
      draft: events.filter((event) => event.status === "DRAFT").length,
    }),
    [events],
  );

  const eventPageCount = Math.ceil(filteredEvents.length / EVENTS_PER_PAGE);
  const paginatedEvents = filteredEvents.slice(
    eventPage * EVENTS_PER_PAGE,
    (eventPage + 1) * EVENTS_PER_PAGE,
  );

  const loadImages = async (targetEventId: string) => {
    setImagesLoading(true);
    try {
      const data = await organizerService.getEventImages(targetEventId);
      setImages(data);
      setCurrentPage(0);
    } catch {
      setImages([]);
      setCurrentPage(0);
      toast.error("Không thể tải thư viện ảnh của sự kiện.");
    } finally {
      setImagesLoading(false);
    }
  };

  const handleSelectEvent = async (event: OrganizerEventDetail) => {
    setResolvedEvent(event);
    setFileWithPreview(null);
    await loadImages(event.id);
  };

  const handleOpenEventMedia = async (event: OrganizerEventDetail) => {
    setIsMediaModalOpen(true);
    await handleSelectEvent(event);
  };

  const handleCloseEventMedia = () => {
    setIsMediaModalOpen(false);
    setLightboxIndex(-1);
  };

  // Effect for multi-event mode (without eventId)
  useEffect(() => {
    if (!ready) return;
    if (eventId) return;

    let cancelled = false;

    const loadEvents = async () => {
      setEventsLoading(true);
      try {
        const allEvents = await getAllOrganizerEvents();
        if (cancelled) return;
        setEvents(allEvents);
        setResolvedEvent(null);
        setImages([]);
      } catch {
        if (!cancelled) {
          setEvents([]);
          setResolvedEvent(null);
          setImages([]);
          toast.error("Không thể tải danh sách sự kiện của organizer.");
        }
      } finally {
        if (!cancelled) {
          setEventsLoading(false);
        }
      }
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, [eventId, ready]);

  // Effect for single-event workspace mode (with eventId)
  useEffect(() => {
    if (!ready || !eventId) return;

    let cancelled = false;

    const loadSingleEvent = async () => {
      setImagesLoading(true);
      setEventsLoading(true);
      try {
        const nextEvent = await organizerWorkspaceService.getMyEvent(eventId);
        if (cancelled) return;
        setResolvedEvent(nextEvent);

        const data = await organizerService.getEventImages(eventId);
        if (cancelled) return;
        setImages(data);
        setCurrentPage(0);
      } catch {
        if (!cancelled) {
          toast.error("Không thể tải thông tin sự kiện hoặc thư viện ảnh.");
        }
      } finally {
        if (!cancelled) {
          setImagesLoading(false);
          setEventsLoading(false);
        }
      }
    };

    void loadSingleEvent();

    return () => {
      cancelled = true;
    };
  }, [eventId, ready]);

  const handleUpload = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    const activeEventId = eventId || resolvedEvent?.id;
    if (!activeEventId) {
      toast.error("Hãy chọn sự kiện trước khi upload ảnh.");
      return;
    }
    if (!selectedFile) {
      toast.error("Chọn một ảnh trước khi tải lên.");
      return;
    }

    setUploading(true);
    try {
      await organizerService.uploadEventImage(
        activeEventId,
        selectedFile,
        selectedType,
      );
      setFileWithPreview(null);
      await loadImages(activeEventId);
      toast.success("Upload ảnh thành công.");
    } catch {
      toast.error("Upload ảnh thất bại");
    } finally {
      setUploading(false);
    }
  };

  // Custom save event listener
  useEffect(() => {
    const handleSave = () => {
      if (selectedFile) {
        const mockEvent = { preventDefault: () => {} } as FormEvent<HTMLFormElement>;
        void handleUpload(mockEvent);
      } else {
        toast.info("Ảnh sự kiện đã được đồng bộ. Hãy tiếp tục.");
      }
    };
    document.addEventListener("organizer-save-event", handleSave);
    return () => {
      document.removeEventListener("organizer-save-event", handleSave);
    };
  }, [resolvedEvent, selectedFile, selectedType, eventId]);

  const handleDelete = async (imageId: string) => {
    const activeEventId = eventId || resolvedEvent?.id;
    if (!activeEventId) return;

    const confirmed = await confirmDestructiveAction({
      title: "Xóa ảnh khỏi sự kiện?",
      text: "Ảnh sẽ bị xóa khỏi thư viện sự kiện và thao tác này không thể hoàn tác.",
      confirmButtonText: "Xóa ảnh",
      cancelButtonText: "Giữ lại",
    });
    if (!confirmed) return;

    setDeletingId(imageId);
    try {
      await organizerService.deleteEventImage(activeEventId, imageId);
      setImages((current) => current.filter((image) => image.id !== imageId));
      toast.success("Đã xóa ảnh khỏi sự kiện.");
    } catch {
      toast.error("Không thể xóa ảnh này.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewDetails = async (image: OrganizerEventImage) => {
    const details: Array<[string, string]> = [
      ["ID", image.id],
      ["Loại", image.imageType],
      ["URL", image.imageUrl],
      ["Public ID", image.publicId ?? "-"],
      ["Alt text", image.altText ?? "-"],
      [
        "Kích thước",
        image.width && image.height ? `${image.width} × ${image.height}` : "-",
      ],
      ["Dung lượng", formatBytes(image.fileSizeBytes)],
      ["Primary", image.isPrimary ? "Yes" : "No"],
      ["Display order", String(image.displayOrder ?? "-")],
      ["Created at", formatDateTime(image.createdAt)],
      ["Created by", image.createdBy ?? "-"],
      ["Deleted", image.isDeleted ? "Yes" : "No"],
    ];

    const detailsHtml = details
      .map(
        ([label, value]) =>
          `<div style="display:grid;grid-template-columns:140px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid #e2e8f0;">
            <strong style="color:#0f172a;">${escapeHtml(label)}</strong>
            <span style="color:#334155;word-break:break-word;">${escapeHtml(value)}</span>
          </div>`,
      )
      .join("");

    await Swal.fire({
      title: "Chi tiết ảnh",
      html: `<div class="organizer-image-details-scroll">${detailsHtml}</div>`,
      width: 700,
      customClass: {
        container: "organizer-media-swal-container",
      },
      showConfirmButton: false,
      showCloseButton: true,
      closeButtonAriaLabel: "Đóng",
      heightAuto: false,
    });
  };

  const handleEditMetadata = async (image: OrganizerEventImage) => {
    const activeEventId = eventId || resolvedEvent?.id;
    if (!activeEventId) return;

    const result = await Swal.fire({
      title: "Chỉnh sửa ảnh",
      width: 640,
      customClass: {
        container: "organizer-media-swal-container",
      },
      html: `
        <div class="organizer-media-editor-popup">
          <label class="organizer-media-editor-field">
            <span>Alt text</span>
            <input id="swal-image-alt" class="swal2-input organizer-media-editor-input" value="${escapeHtml(image.altText ?? "")}" placeholder="Nhập alt text cho ảnh" />
          </label>
          <label class="organizer-media-editor-field">
            <span>Display order</span>
            <input id="swal-image-order" type="number" min="0" class="swal2-input organizer-media-editor-input" value="${escapeHtml(String(image.displayOrder ?? 0))}" />
          </label>
          <label class="organizer-media-editor-field">
            <span>Loại ảnh (Image type)</span>
            <select id="swal-image-type" class="organizer-media-editor-select">
              ${resolvedImageTypes.map((type) => `<option value="${type}" ${image.imageType === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </label>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Lưu thay đổi",
      cancelButtonText: "Hủy",
      preConfirm: () => {
        const altInput = document.getElementById(
          "swal-image-alt",
        ) as HTMLInputElement | null;
        const orderInput = document.getElementById(
          "swal-image-order",
        ) as HTMLInputElement | null;
        const typeInput = document.getElementById(
          "swal-image-type",
        ) as HTMLSelectElement | null;

        const nextImageType = typeInput?.value ?? "";
        if (!isOrganizerImageType(nextImageType)) {
          Swal.showValidationMessage("Loại ảnh không hợp lệ");
          return null;
        }

        const displayOrderText = orderInput?.value?.trim() ?? "";
        if (displayOrderText && Number.isNaN(Number(displayOrderText))) {
          Swal.showValidationMessage("Display order phải là số hợp lệ.");
          return null;
        }

        return {
          altText: altInput?.value?.trim() || null,
          displayOrder: displayOrderText ? Number(displayOrderText) : 0,
          imageType: nextImageType,
        };
      },
    });

    if (!result.isConfirmed || !result.value) {
      return;
    }

    try {
      await organizerService.updateEventImage(
        activeEventId,
        image.id,
        result.value,
      );
      await loadImages(activeEventId);
      toast.success("Cập nhật metadata ảnh.");
    } catch {
      toast.error("Không thể cập nhật metadata ảnh.");
    }
  };

  const lightboxSlides = images.map((image) => ({
    src: image.imageUrl,
    alt: image.altText ?? image.imageType,
  }));
  const pageCount = Math.ceil(images.length / IMAGES_PER_PAGE);
  const paginatedImages = images.slice(
    currentPage * IMAGES_PER_PAGE,
    (currentPage + 1) * IMAGES_PER_PAGE,
  );

  useEffect(() => {
    if (currentPage > 0 && currentPage >= pageCount) {
      setCurrentPage(pageCount - 1);
    }
  }, [currentPage, pageCount]);

  useEffect(() => {
    setEventPage(0);
  }, [eventFilter, eventSearch]);

  useEffect(() => {
    if (eventPage > 0 && eventPage >= eventPageCount) {
      setEventPage(Math.max(eventPageCount - 1, 0));
    }
  }, [eventPage, eventPageCount]);

  // SINGLE EVENT WORKSPACE MODE VIEW
  if (eventId) {
    return (
      <OrganizerLayout
        title={resolvedEvent?.title || "Quản lý ảnh sự kiện"}
        description="Quản lý hình ảnh, banner, poster của sự kiện."
        hideTopBar
        showWorkflowNav
        className="organizer-media-page"
        eventId={eventId}
      >

        {eventsLoading || !resolvedEvent ? (
          <section className="organizer-panel organizer-empty-state">
            <div className="loading-spinner" />
            <p>Đang tải thư viện ảnh...</p>
          </section>
        ) : (
          <div className="organizer-media-workspace-container" style={{ marginTop: "0px" }}>
            <div className="organizer-media-stack" style={{ marginTop: "0px" }}>
              <form
                className="organizer-panel organizer-upload-form organizer-upload-form-horizontal"
                onSubmit={handleUpload}
              >
                <div className="organizer-upload-row">
                  <label className="organizer-field">
                    <span>
                      <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Loại ảnh
                    </span>
                    <select
                      className="organizer-input"
                      value={selectedType}
                      onChange={(event) =>
                        setSelectedType(event.target.value as OrganizerImageType)
                      }
                    >
                      {resolvedImageTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="organizer-field">
                    <span>Tệp hình ảnh</span>
                    <div
                      {...getRootProps({
                        className: `organizer-input organizer-dropzone${
                          isDragActive ? " is-active" : ""
                        }${isDragReject ? " is-reject" : ""}${
                          selectedFile ? " has-file" : ""
                        }`,
                      })}
                    >
                      <input
                        {...getInputProps({
                          id: "organizer-image-file",
                          name: "organizer-image-file",
                        })}
                      />
                      {isDragReject ? (
                        <p className="organizer-dropzone-text">
                          Định dạng không hợp lệ. Chỉ hỗ trợ PNG, JPG, JPEG, WEBP.
                        </p>
                      ) : selectedPreviewUrl ? (
                        <div className="organizer-dropzone-preview">
                          <img
                            src={selectedPreviewUrl}
                            alt={selectedFile?.name ?? "preview"}
                          />
                          <p className="organizer-dropzone-file-name">
                            {selectedFile?.name}
                          </p>
                        </div>
                      ) : (
                        <p className="organizer-dropzone-text">
                          {isDragActive
                            ? "Thả ảnh vào đây..."
                            : "Kéo thả ảnh vào đây hoặc bấm để chọn"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="organizer-upload-submit-row">
                  <button
                    className="btn btn-primary organizer-upload-button organizer-upload-button-rect"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                    Tải ảnh lên
                  </button>
                </div>
              </form>

              <section className="organizer-panel" style={{ marginTop: "20px" }}>
                {imagesLoading ? (
                  <div className="organizer-empty-state">
                    <div className="loading-spinner" />
                    <p>Đang tải thư viện ảnh...</p>
                  </div>
                ) : images.length === 0 ? (
                  <div className="organizer-empty-state">
                    <ImagePlus size={32} />
                    <p>Sự kiện chưa có ảnh nào trong thư viện organizer.</p>
                  </div>
                ) : (
                  <>
                    <div className="organizer-media-table-wrap">
                      <table className="organizer-media-table organizer-events-page-table">
                        <thead>
                          <tr>
                            <th>Ảnh</th>
                            <th>ID</th>
                            <th>Loại</th>
                            <th>Kích thước</th>
                            <th>Dung lượng</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedImages.map((image, index) => {
                            const imageIndex =
                              currentPage * IMAGES_PER_PAGE + index;

                            return (
                              <tr key={image.id}>
                                <td>
                                  <button
                                    className="organizer-media-thumb organizer-media-thumb-trigger"
                                    type="button"
                                    onClick={() => setLightboxIndex(imageIndex)}
                                    aria-label="Xem ảnh lớn"
                                    title="Xem ảnh lớn"
                                  >
                                    <img
                                      src={image.imageUrl}
                                      alt={image.altText ?? image.imageType}
                                    />
                                  </button>
                                </td>
                                <td className="organizer-media-id" title={image.id}>
                                  {image.id}
                                </td>
                                <td>
                                  <div className="organizer-media-type-stack">
                                    <span
                                      className={`organizer-tag organizer-tag-${image.imageType
                                        .toLowerCase()
                                        .replace("_", "-")}`}
                                    >
                                      {image.imageType}
                                    </span>
                                    {image.isPrimary ? (
                                      <span className="organizer-tag organizer-tag-primary">
                                        Primary
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td>
                                  {image.width && image.height
                                    ? `${image.width} × ${image.height}`
                                    : "-"}
                                </td>
                                <td>{formatBytes(image.fileSizeBytes)}</td>
                                <td className="organizer-media-action-cell">
                                  <div className="organizer-media-table-actions">
                                    <button
                                      type="button"
                                      className="organizer-icon-action organizer-icon-action-view"
                                      onClick={() => void handleViewDetails(image)}
                                      aria-label="Xem chi tiết thông tin ảnh"
                                      title="Xem chi tiết"
                                    >
                                      <Eye size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      className="organizer-icon-action organizer-icon-action-edit"
                                      onClick={() => void handleEditMetadata(image)}
                                      aria-label="Chỉnh sửa ảnh"
                                      title="Chỉnh sửa"
                                    >
                                      <FaEdit size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="organizer-icon-action organizer-icon-action-delete"
                                      onClick={() => void handleDelete(image.id)}
                                      disabled={deletingId === image.id}
                                      aria-label="Xóa ảnh khỏi sự kiện"
                                      title="Xóa ảnh"
                                    >
                                      {deletingId === image.id ? (
                                        <LoaderCircle size={15} className="spin" />
                                      ) : (
                                        <Trash2 size={15} />
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
                    <div style={{ marginTop: "15px" }}>
                      <AppPagination
                        currentPage={currentPage}
                        pageCount={pageCount}
                        onPageChange={setCurrentPage}
                        pageRangeDisplayed={4}
                        marginPagesDisplayed={1}
                        showPageInfo={false}
                      />
                    </div>
                  </>
                )}
              </section>
            </div>
          </div>
        )}

        <Lightbox
          open={lightboxIndex >= 0}
          close={() => setLightboxIndex(-1)}
          slides={lightboxSlides}
          index={lightboxIndex}
        />
      </OrganizerLayout>
    );
  }

  // DEFAULT MULTI-EVENT LIST MODE
  return (
    <OrganizerLayout
      title="Thư viện ảnh sự kiện"
      description="Thực hi quản lý ảnh cho các sự kiện của bạn."
      className="organizer-media-page"
    >
      <section className="organizer-panel organizer-lookup-panel">
        <div className="organizer-panel-heading">
          <div className="organizer-panel-heading-row organizer-media-event-heading">
            <div className="organizer-events-list-filter-row">
              {mediaEventFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={`organizer-events-filter-pill ${
                    eventFilter === filter.value ? "is-active" : ""
                  }`}
                  onClick={() => setEventFilter(filter.value)}
                >
                  {filter.label} {numberFormat.format(eventFilterCounts[filter.value])}
                </button>
              ))}
            </div>
            <label className="organizer-events-list-search organizer-media-event-search">
              <input
                value={eventSearch}
                onChange={(event) => setEventSearch(event.target.value)}
                className="organizer-events-list-search-input"
                placeholder="Search.."
              />
              <span
                className="organizer-events-list-search-button"
                aria-hidden="true"
              >
                <Search size={14} />
              </span>
            </label>
          </div>
        </div>

        {eventsLoading ? (
          <div className="organizer-empty-state organizer-media-events-empty">
            <div className="loading-spinner" />
            <p>Đang tải danh sách sự kiện của organizer...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="organizer-empty-state organizer-media-events-empty">
            <ImagePlus size={32} />
            <p>Không có sự kiện nào phù hợp để quản lý ảnh.</p>
          </div>
        ) : (
          <div className="organizer-media-table-wrap organizer-event-table-wrap">
            <table className="organizer-event-table organizer-media-event-table organizer-events-page-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Banner</th>
                  <th>Tên sự kiện</th>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                  <th>Địa điểm</th>
                  <th>Loại vé</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.map((event, index) => {
                  const coverUrl = resolveBannerUrl(event);

                  return (
                    <tr key={event.id} className="organizer-media-event-row">
                      <td>{eventPage * EVENTS_PER_PAGE + index + 1}</td>
                      <td>
                        {coverUrl ? (
                          <button
                            type="button"
                            className="organizer-media-thumb organizer-media-thumb-trigger"
                            onClick={() => void handleOpenEventMedia(event)}
                            aria-label={`Chọn ${event.title}`}
                            title="Chọn sự kiện"
                          >
                            <img src={coverUrl} alt={event.title} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="organizer-media-thumb organizer-event-thumb-placeholder"
                            onClick={() => void handleOpenEventMedia(event)}
                            aria-label={`Chọn ${event.title}`}
                            title="Chọn sự kiện"
                          >
                            <span>Không có</span>
                          </button>
                        )}
                      </td>
                      <td
                        className="organizer-event-title-cell"
                        title={event.title}
                      >
                        {event.title}
                      </td>
                      <td>{formatEventTableDateTime(event.schedule?.startDatetime)}</td>
                      <td>{formatEventTableDateTime(event.schedule?.endDatetime)}</td>
                      <td
                        className="organizer-event-location-cell"
                        title={formatEventLocation(event)}
                      >
                        {formatEventLocation(event)}
                      </td>
                      <td
                        className="organizer-event-ticket-types-cell"
                        title={formatEventTicketTypes(event)}
                      >
                        {formatEventTicketTypes(event)}
                      </td>
                      <td className="organizer-media-action-cell">
                        <div className="organizer-media-actions">
                          <button
                            type="button"
                            className="organizer-icon-action organizer-icon-action-edit"
                            onClick={() => void handleOpenEventMedia(event)}
                            aria-label={`Quản lý ảnh của ${event.title}`}
                            title="Quản lý ảnh"
                          >
                            <FaEdit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <AppPagination
              currentPage={eventPage}
              pageCount={eventPageCount}
              onPageChange={setEventPage}
              pageRangeDisplayed={4}
              marginPagesDisplayed={1}
              showPageInfo={false}
            />
          </div>
        )}
      </section>

      {resolvedEvent && isMediaModalOpen ? (
        <div className="organizer-media-modal-backdrop" role="presentation">
          <div
            className="organizer-media-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="organizer-media-modal-title"
          >
            <div className="organizer-media-modal-header">
              <h2 id="organizer-media-modal-title">Quản lý ảnh sự kiện</h2>
              <button
                type="button"
                className="organizer-media-modal-close"
                onClick={handleCloseEventMedia}
                aria-label="Đóng popup quản lý ảnh"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="organizer-media-modal-body">
              <section className="organizer-event-banner">
                <div className="organizer-event-copy">
                  <span className="organizer-badge">Event đã chọn</span>
                  <h2>
                    <strong>Tên sự kiện: </strong>
                    {resolvedEvent.title}
                  </h2>
                  <p>
                    <strong>Event ID: </strong>
                    {resolvedEvent.id}
                  </p>
                  <p>
                    <strong>Slug: </strong>
                    {resolvedEvent.slug}
                  </p>
                  <p>
                    <strong>BTC: </strong>
                    {resolvedEvent.organizer?.name || "Chưa cập nhật"}
                  </p>
                </div>
                <div className="organizer-event-art">
                  {resolveBannerUrl(resolvedEvent) ? (
                    <img
                      src={resolveBannerUrl(resolvedEvent)}
                      alt={resolvedEvent.title}
                    />
                  ) : (
                    <div className="organizer-event-art-placeholder">
                      <ImagePlus size={32} />
                    </div>
                  )}
                </div>
              </section>

              <div className="organizer-media-stack">
                <form
                  className="organizer-panel organizer-upload-form organizer-upload-form-horizontal"
                  onSubmit={handleUpload}
                >
                  <div className="organizer-upload-row">
                    <label className="organizer-field">
                      <span>
                        <span style={{ color: "#ef4444", marginRight: "4px" }}>*</span>Loại ảnh
                      </span>
                      <select
                        className="organizer-input"
                        value={selectedType}
                        onChange={(event) =>
                          setSelectedType(event.target.value as OrganizerImageType)
                        }
                      >
                        {resolvedImageTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="organizer-field">
                      <span>Tệp hình ảnh</span>
                      <div
                        {...getRootProps({
                          className: `organizer-input organizer-dropzone${
                            isDragActive ? " is-active" : ""
                          }${isDragReject ? " is-reject" : ""}${
                            selectedFile ? " has-file" : ""
                          }`,
                        })}
                      >
                        <input
                          {...getInputProps({
                            id: "organizer-image-file",
                            name: "organizer-image-file",
                          })}
                        />
                        {isDragReject ? (
                          <p className="organizer-dropzone-text">
                            Định dạng không hợp lệ. Chỉ hỗ trợ PNG, JPG, JPEG, WEBP.
                          </p>
                        ) : selectedPreviewUrl ? (
                          <div className="organizer-dropzone-preview">
                            <img
                              src={selectedPreviewUrl}
                              alt={selectedFile?.name ?? "preview"}
                            />
                            <p className="organizer-dropzone-file-name">
                              {selectedFile?.name}
                            </p>
                          </div>
                        ) : (
                          <p className="organizer-dropzone-text">
                            {isDragActive
                              ? "Thả ảnh vào đây..."
                              : "Kéo thả ảnh vào đây hoặc bấm để chọn"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="organizer-upload-submit-row">
                    <button
                      className="btn btn-primary organizer-upload-button organizer-upload-button-rect"
                      disabled={uploading}
                    >
                      {uploading ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <ImagePlus size={16} />
                      )}
                      Tải ảnh lên
                    </button>
                  </div>
                </form>

                <section className="organizer-panel">
                  {imagesLoading ? (
                    <div className="organizer-empty-state">
                      <div className="loading-spinner" />
                      <p>Đang tải thư viện ảnh...</p>
                    </div>
                  ) : images.length === 0 ? (
                    <div className="organizer-empty-state">
                      <ImagePlus size={32} />
                      <p>Sự kiện chưa có ảnh nào trong thư viện organizer.</p>
                    </div>
                  ) : (
                    <>
                      <div className="organizer-media-table-wrap">
                        <table className="organizer-media-table organizer-events-page-table">
                          <thead>
                            <tr>
                              <th>Ảnh</th>
                              <th>ID</th>
                              <th>Loại</th>
                              <th>Kích thước</th>
                              <th>Dung lượng</th>
                              <th>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedImages.map((image, index) => {
                              const imageIndex =
                                currentPage * IMAGES_PER_PAGE + index;

                              return (
                                <tr key={image.id}>
                                  <td>
                                    <button
                                      className="organizer-media-thumb organizer-media-thumb-trigger"
                                      type="button"
                                      onClick={() => setLightboxIndex(imageIndex)}
                                      aria-label="Xem ảnh lớn"
                                      title="Xem ảnh lớn"
                                    >
                                      <img
                                        src={image.imageUrl}
                                        alt={image.altText ?? image.imageType}
                                      />
                                    </button>
                                  </td>
                                  <td className="organizer-media-id" title={image.id}>
                                    {image.id}
                                  </td>
                                  <td>
                                    <div className="organizer-media-type-stack">
                                      <span
                                        className={`organizer-tag organizer-tag-${image.imageType
                                          .toLowerCase()
                                          .replace("_", "-")}`}
                                      >
                                        {image.imageType}
                                      </span>
                                      {image.isPrimary ? (
                                        <span className="organizer-tag organizer-tag-primary">
                                          Primary
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td>
                                    {image.width && image.height
                                      ? `${image.width} × ${image.height}`
                                      : "-"}
                                  </td>
                                  <td>{formatBytes(image.fileSizeBytes)}</td>
                                  <td className="organizer-media-action-cell">
                                    <div className="organizer-media-actions">
                                      <button
                                        className="organizer-icon-action organizer-icon-action-info"
                                        onClick={() => void handleViewDetails(image)}
                                        type="button"
                                        aria-label="Xem chi tiết ảnh"
                                        title="Xem chi tiết ảnh"
                                      >
                                        <Eye size={16} />
                                      </button>
                                      <button
                                        className="organizer-icon-action organizer-icon-action-edit"
                                        onClick={() => void handleEditMetadata(image)}
                                        type="button"
                                        aria-label="Chỉnh sửa ảnh"
                                        title="Chỉnh sửa ảnh"
                                      >
                                        <Edit size={16} />
                                      </button>
                                      <button
                                        className="organizer-icon-action organizer-icon-action-danger"
                                        onClick={() => void handleDelete(image.id)}
                                        disabled={deletingId === image.id}
                                        type="button"
                                        aria-label="Xóa ảnh"
                                        title="Xóa ảnh"
                                      >
                                        {deletingId === image.id ? (
                                          <LoaderCircle size={16} className="spin" />
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
                      <div className="organizer-media-pagination">
                        <AppPagination
                          currentPage={currentPage}
                          pageCount={pageCount}
                          onPageChange={(page) => setCurrentPage(page)}
                        />
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>

            <Lightbox
              open={lightboxIndex >= 0}
              close={() => setLightboxIndex(-1)}
              index={lightboxIndex >= 0 ? lightboxIndex : 0}
              slides={lightboxSlides}
            />
          </div>
        </div>
      ) : null}
    </OrganizerLayout>
  );
}
