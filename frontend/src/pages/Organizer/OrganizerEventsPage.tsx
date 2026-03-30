import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LoaderCircle, Edit, Search, Ticket, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
} from "../../services/organizerWorkspaceService";
import { SpringPage } from "../../types/api";
import { formatDateTime } from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

const PAGE_SIZE = 12;

function pickEventCover(event: OrganizerEventDetail) {
  return (
    event.images?.find((image) => image.type === "BANNER")?.url ||
    event.images?.find((image) => image.type === "POSTER")?.url ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url ||
    ""
  );
}

function filterEvents(events: OrganizerEventDetail[], keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return events;

  return events.filter((event) => {
    const values = [
      event.title,
      event.slug,
      event.shortDescription,
      event.venue?.name,
      event.venue?.city,
    ];

    return values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  });
}

function getVenueLabel(event: OrganizerEventDetail) {
  if (event.isOnline) return "Sự kiện online";
  const parts = [
    event.venue?.name,
    event.venue?.address,
    event.venue?.city,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Chưa chọn địa điểm";
}

function getTicketTypeLabel(event: OrganizerEventDetail) {
  if (!event.ticketTypes || event.ticketTypes.length === 0)
    return "Chưa có loại vé";
  return event.ticketTypes.map((ticketType) => ticketType.name).join(", ");
}

export default function OrganizerEventsPage() {
  const { ready } = useOrganizerGate();
  const [keywordInput, setKeywordInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [pageData, setPageData] =
    useState<SpringPage<OrganizerEventDetail> | null>(null);
  const [searchResults, setSearchResults] = useState<
    OrganizerEventDetail[] | null
  >(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxSlides, setLightboxSlides] = useState<
    Array<{ src: string; alt: string }>
  >([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await organizerWorkspaceService.getMyEvents(0, PAGE_SIZE);
        if (!cancelled) {
          setPageData(data);
        }
      } catch {
        if (!cancelled) {
          toast.error("Không thể tải danh sách sự kiện của organizer.");
          setPageData(null);
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
  }, [ready]);

  const filteredEvents = searchResults ?? pageData?.content ?? [];

  const handleSearch = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!ready) return;

    const nextKeyword = keywordInput.trim();
    if (!nextKeyword) {
      setSearchResults(null);
      return;
    }

    setSearching(true);
    try {
      const totalElements = Math.max(
        pageData?.totalElements ?? PAGE_SIZE,
        PAGE_SIZE,
      );
      const allEventsPage = await organizerWorkspaceService.getMyEvents(
        0,
        totalElements,
      );
      setSearchResults(filterEvents(allEventsPage.content, nextKeyword));
    } catch {
      toast.error("Không thể tìm kiếm sự kiện lúc này.");
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (event: OrganizerEventDetail) => {
    const confirmed = await confirmDestructiveAction({
      title: "Xóa sự kiện này?",
      text: "Sự kiện sẽ bị xóa khỏi workspace organizer và thao tác này không thể hoàn tác.",
      confirmButtonText: "Xóa sự kiện",
      cancelButtonText: "Giữ lại",
    });
    if (!confirmed) return;

    setDeletingId(event.id);
    try {
      await organizerWorkspaceService.deleteEvent(event.id);
      setPageData((current) => {
        if (!current) return current;
        return {
          ...current,
          content: current.content.filter((item) => item.id !== event.id),
          totalElements: Math.max((current.totalElements ?? 1) - 1, 0),
        };
      });
      setSearchResults((current) =>
        current ? current.filter((item) => item.id !== event.id) : current,
      );
      toast.success("Đã xóa sự kiện.");
    } catch {
      toast.error("Không thể xóa sự kiện lúc này.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <OrganizerLayout
      title="Quản lý sự kiện"
      description="Danh sách sự kiện của ban tổ chức, có thể tạo mới và chỉnh sửa thông tin sự kiện"
      actions={null}
    >
      <section className="organizer-panel organizer-toolbar-panel">
        <div
          className="organizer-panel-heading-row"
          style={{ alignItems: "flex-start" }}
        >
          <div style={{ flex: 1 }}>
            <p className="organizer-panel-title-pill">Event workspace</p>
            <p>
              Xem toàn bộ các sự kiện đã tạo. Dễ dàng truy cập vào từng sự kiện
              để chỉnh sửa thông tin.
            </p>
          </div>
          <div
            style={{
              width: 180,
              display: "flex",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Link
              to="/organizer/events/new"
              style={{
                color: "#19454F",
                fontWeight: 700,
                padding: "8px 0",
                whiteSpace: "nowrap",
              }}
            >
              Tạo sự kiện mới
            </Link>
          </div>
        </div>

        <form className="organizer-search-row" onSubmit={handleSearch}>
          <input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            className="organizer-input organizer-search-input"
            placeholder="Tìm theo tên sự kiện, slug hoặc venue"
          />
          <div className="organizer-header-actions">
            <button
              type="submit"
              className="btn btn-primary organizer-search-button"
              disabled={loading || searching}
            >
              <Search size={16} />
              {searching ? "Đang tìm" : "Tìm kiếm sự kiện"}
            </button>
          </div>
        </form>
      </section>

      {loading || searching ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>
            {searching ? "Đang tìm kiếm sự kiện" : "Đang tải danh sách sự kiện"}
          </p>
        </section>
      ) : filteredEvents.length === 0 ? (
        <section className="organizer-panel organizer-empty-state">
          <Ticket size={28} />
          <p>
            {pageData?.content?.length
              ? "Không có sự kiện nào khớp với điều kiện tìm kiếm hiện tại."
              : "Organizer này chưa có sự kiện nào."}
          </p>
        </section>
      ) : (
        <section className="organizer-panel">
          <div className="organizer-panel-heading-row">
            <p className="organizer-panel-title-pill">Danh sách sự kiện</p>
          </div>
          <div className="organizer-media-table-wrap organizer-event-table-wrap">
            <table className="organizer-event-table">
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
                {filteredEvents.map((event, index) => {
                  const coverUrl = pickEventCover(event);

                  return (
                    <tr key={event.id}>
                      <td>{index + 1}</td>
                      <td>
                        {coverUrl ? (
                          <button
                            type="button"
                            className="organizer-media-thumb organizer-media-thumb-trigger"
                            onClick={() => {
                              setLightboxSlides([
                                { src: coverUrl, alt: event.title },
                              ]);
                              setLightboxIndex(0);
                            }}
                            aria-label={`Xem banner của ${event.title}`}
                            title="Xem ảnh lớn"
                          >
                            <img src={coverUrl} alt={event.title} />
                          </button>
                        ) : (
                          <div className="organizer-media-thumb organizer-event-thumb-placeholder">
                            <span>Không có</span>
                          </div>
                        )}
                      </td>
                      <td
                        className="organizer-event-title-cell"
                        title={event.title}
                      >
                        {" "}
                        {event.title}
                      </td>
                      <td>{formatDateTime(event.schedule?.startDatetime)}</td>
                      <td>{formatDateTime(event.schedule?.endDatetime)}</td>
                      <td
                        className="organizer-event-location-cell"
                        title={getVenueLabel(event)}
                      >
                        {getVenueLabel(event)}
                      </td>
                      <td
                        className="organizer-event-ticket-types-cell"
                        title={getTicketTypeLabel(event)}
                      >
                        {getTicketTypeLabel(event)}
                      </td>
                      <td className="organizer-media-action-cell">
                        <div className="organizer-media-actions">
                          <Link
                            to={`/organizer/events/${event.id}/edit`}
                            className="organizer-icon-action organizer-icon-action-info"
                            aria-label={`Chỉnh sửa ${event.title}`}
                            title="Chỉnh sửa"
                          >
                            <Edit size={16} />
                          </Link>
                          <button
                            type="button"
                            className="organizer-icon-action organizer-icon-action-danger"
                            onClick={() => void handleDelete(event)}
                            disabled={deletingId === event.id}
                            aria-label={`Xóa ${event.title}`}
                            title="Xóa sự kiện"
                          >
                            {deletingId === event.id ? (
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
        </section>
      )}

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => {
          setLightboxIndex(-1);
          setLightboxSlides([]);
        }}
        index={lightboxIndex >= 0 ? lightboxIndex : 0}
        slides={lightboxSlides}
      />
    </OrganizerLayout>
  );
}
