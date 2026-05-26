import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CircleAlert, UsersRound } from "lucide-react";
import { BsFillBuildingsFill } from "react-icons/bs";
import { FaMapSigns } from "react-icons/fa";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { venueService } from "../../services/venueService";
import { Venue } from "../../types/api";

const fallbackImage =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80";

export default function VenuesPage() {
  const { data, isLoading, isError, error } = useQuery<Venue[], Error>({
    queryKey: ["venues"],
    queryFn: venueService.getVenues,
  });

  const venues = data ?? [];

  const uniqueCities = useMemo(
    () =>
      Array.from(
        new Set(venues.map((venue: Venue) => venue.city).filter(Boolean)),
      ),
    [venues],
  );

  return (
    <OrganizerLayout
      title="Địa điểm"
      description="Theo dõi danh sách địa điểm và sức chứa."
      requireOrganizer={false}
    >
      <section className="organizer-events-stat-grid">
        <article className="organizer-events-stat-card">
          <BsFillBuildingsFill className="organizer-events-stat-icon-total" size={30} />
          <div className="organizer-events-stat-copy">
            <span>Tổng venue</span>
            <strong>{venues.length.toLocaleString("vi-VN")}</strong>
          </div>
        </article>
        <article className="organizer-events-stat-card">
          <FaMapSigns className="organizer-events-stat-icon-published" size={30} />
          <div className="organizer-events-stat-copy">
            <span>Thành phố</span>
            <strong>{uniqueCities.length.toLocaleString("vi-VN")}</strong>
          </div>
        </article>
        <article className="organizer-events-stat-card">
          <UsersRound className="organizer-events-stat-icon-tickets" size={30} />
          <div className="organizer-events-stat-copy">
            <span>Tổng sức chứa</span>
            <strong>
              {venues
                .reduce((sum, venue) => sum + Number(venue.totalCapacity ?? 0), 0)
                .toLocaleString("vi-VN")}
            </strong>
          </div>
        </article>
      </section>

      <section className="organizer-panel">
        {isLoading ? (
          <div className="organizer-empty-state">
            <div className="loading-spinner" />
            <p>Đang tải danh sách địa điểm.</p>
          </div>
        ) : isError ? (
          <div className="organizer-empty-state organizer-empty-state-error">
            <CircleAlert size={32} />
            <p>{error?.message || "Yêu cầu GET /api/venues không thành công."}</p>
          </div>
        ) : venues.length === 0 ? (
          <div className="organizer-empty-state">
            <Building2 size={32} />
            <p>Chưa có địa điểm nào.</p>
          </div>
        ) : (
          <div className="organizer-media-table-wrap organizer-event-table-wrap organizer-venues-table-wrap">
            <table className="organizer-event-table organizer-media-event-table organizer-events-page-table organizer-venues-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Ảnh</th>
                  <th>Tên địa điểm</th>
                  <th>Thành phố</th>
                  <th>Địa chỉ</th>
                  <th>Sức chứa</th>
                  <th>Tiện ích</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((venue: Venue, index) => {
                  const coverImage = venue.imageUrls?.[0] || fallbackImage;
                  const fullAddress = [venue.address, venue.district, venue.city]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr key={venue.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="organizer-media-thumb organizer-venue-thumb">
                          <img src={coverImage} alt={venue.name} />
                        </div>
                      </td>
                      <td className="organizer-event-title-cell" title={venue.name}>
                        {venue.name}
                        {venue.slug ? <small>/{venue.slug}</small> : null}
                      </td>
                      <td>{venue.city || "Chưa cập nhật"}</td>
                      <td className="organizer-event-location-cell" title={fullAddress}>
                        <span className="venues-admin-address">
                          {fullAddress || "Chưa cập nhật địa chỉ"}
                        </span>
                      </td>
                      <td>
                        {venue.totalCapacity
                          ? `${venue.totalCapacity.toLocaleString("vi-VN")} chỗ`
                          : "Chưa cập nhật"}
                      </td>
                      <td className="organizer-event-ticket-types-cell">
                        {venue.facilities && venue.facilities.length > 0
                          ? venue.facilities.join(", ")
                          : "Chưa cấu hình"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </OrganizerLayout>
  );
}
