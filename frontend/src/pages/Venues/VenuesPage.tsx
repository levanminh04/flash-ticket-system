import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CircleAlert, Search } from "lucide-react";
import { BsFillBuildingsFill } from "react-icons/bs";
import { FaMapMarkedAlt } from "react-icons/fa";
import { FaMapSigns } from "react-icons/fa";
import { HiUserGroup } from "react-icons/hi2";
import OrganizerSidebar from "../../components/organizer/OrganizerSidebar";
import { venueService } from "../../services/venueService";
import { Venue } from "../../types/api";

const fallbackImage =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80";

export default function VenuesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, isError, error } = useQuery<Venue[], Error>({
    queryKey: ["venues"],
    queryFn: venueService.getVenues,
  });

  const venues = data ?? [];

  const filteredVenues = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return venues;

    return venues.filter((venue: Venue) =>
      [
        venue.name,
        venue.city,
        venue.district,
        venue.address,
        venue.description,
        venue.facilities?.join(" "),
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword)),
    );
  }, [searchTerm, venues]);

  const uniqueCities = useMemo(
    () =>
      Array.from(
        new Set(venues.map((venue: Venue) => venue.city).filter(Boolean)),
      ),
    [venues],
  );

  return (
    <div className="venues-page">
      <OrganizerSidebar />

      <section className="venues-hero">
        <div className="container venues-hero__content">
          <div className="venues-hero__copy">
            <span className="venues-badge">Danh sách địa điểm</span>
            <h1>Hãy cùng nhau khám phá các địa điểm thú vị</h1>
          </div>

          <div className="venues-hero__stats">
            <div className="venues-stat-card">
              <BsFillBuildingsFill size={34} />
              <div>
                <span>Tổng venue</span>
                <strong>{venues.length}</strong>
              </div>
            </div>
            <div className="venues-stat-card">
              <FaMapSigns size={34} />
              <div>
                <span>Thành phố</span>
                <strong>{uniqueCities.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="container venues-content">
        <section className="venues-toolbar">
          <label className="venues-search">
            <input
              type="text"
              placeholder="Tìm theo tên venue, thành phố, địa chỉ..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <span className="venues-search__icon">
              <Search size={18} />
            </span>
          </label>

          <div className="venues-toolbar__meta">
            <span>{isLoading ? "Đang tải..." : `${filteredVenues.length} kết quả`}</span>
          </div>
        </section>

        {isLoading ? (
          <section className="venues-state-card">
            <div className="venues-spinner" aria-hidden="true" />
            <h2>Đang tải danh sách địa điểm</h2>
            <p>Frontend đang gọi API venue và tổng hợp dữ liệu để hiển thị.</p>
          </section>
        ) : isError ? (
          <section className="venues-state-card venues-state-card--error">
            <CircleAlert size={40} />
            <h2>Không thể tải danh sách địa điểm</h2>
            <p>{error?.message || "Yêu cầu GET /api/venues không thành công."}</p>
          </section>
        ) : filteredVenues.length === 0 ? (
          <section className="venues-state-card">
            <Building2 size={40} />
            <h2>Không có địa điểm phù hợp</h2>
            <p>Thử đổi từ khóa tìm kiếm hoặc kiểm tra dữ liệu venue từ backend.</p>
          </section>
        ) : (
          <section className="venues-grid">
            {filteredVenues.map((venue: Venue) => {
              const coverImage = venue.imageUrls?.[0] || fallbackImage;
              const fullAddress = [venue.address, venue.district, venue.city]
                .filter(Boolean)
                .join(", ");

              return (
                <article className="venue-card" key={venue.id}>
                  <div className="venue-card__media">
                    <img src={coverImage} alt={venue.name} />
                    <div className="venue-card__overlay">
                      <span>{venue.city}</span>
                    </div>
                  </div>
                  <div className="venue-card__body">
                    <div className="venue-card__heading">
                      <h2>{venue.name}</h2>
                      {venue.slug ? <code>/{venue.slug}</code> : null}
                    </div>
                    <p className="venue-card__description">
                      {venue.description || "Venue chưa có mô tả chi tiết."}
                    </p>
                    <div className="venue-card__details">
                      <p>
                        <FaMapMarkedAlt size={26} />
                        <span>{fullAddress}</span>
                      </p>
                      <p>
                        <HiUserGroup size={28} />
                        <span>
                          {venue.totalCapacity
                            ? `${venue.totalCapacity.toLocaleString("vi-VN")} chỗ`
                            : "Chưa cập nhật sức chứa"}
                        </span>
                      </p>
                    </div>
                    <div className="venue-card__facilities">
                      {venue.facilities && venue.facilities.length > 0 ? (
                        venue.facilities.map((facility: string) => (
                          <span key={`${venue.id}-${facility}`}>{facility}</span>
                        ))
                      ) : (
                        <span>Chưa có tiện ích được cấu hình</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
