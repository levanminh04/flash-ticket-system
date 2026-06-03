import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CircleAlert, UsersRound } from "lucide-react";
import { BsFillBuildingsFill } from "react-icons/bs";
import { FaMapSigns } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { venueService } from "../../services/venueService";
import { Venue } from "../../types/api";

const fallbackImage =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80";

export default function VenuesPage() {
  const { i18n, t } = useTranslation();
  const { data, isLoading, isError, error } = useQuery<Venue[], Error>({
    queryKey: ["venues"],
    queryFn: venueService.getVenues,
  });
  const language = i18n.resolvedLanguage || "vi";

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
      title={t("venues.title")}
      description={t("venues.description")}
      requireOrganizer={false}
    >
      <section className="organizer-events-stat-grid">
        <article className="organizer-events-stat-card">
          <BsFillBuildingsFill className="organizer-events-stat-icon-total" size={30} />
          <div className="organizer-events-stat-copy">
            <span>{t("venues.totalVenue")}</span>
            <strong>{venues.length.toLocaleString(language === "en" ? "en-US" : "vi-VN")}</strong>
          </div>
        </article>
        <article className="organizer-events-stat-card">
          <FaMapSigns className="organizer-events-stat-icon-published" size={30} />
          <div className="organizer-events-stat-copy">
            <span>{t("venues.city")}</span>
            <strong>{uniqueCities.length.toLocaleString(language === "en" ? "en-US" : "vi-VN")}</strong>
          </div>
        </article>
        <article className="organizer-events-stat-card">
          <UsersRound className="organizer-events-stat-icon-tickets" size={30} />
          <div className="organizer-events-stat-copy">
            <span>{t("venues.totalCapacity")}</span>
            <strong>
              {venues
                .reduce((sum, venue) => sum + Number(venue.totalCapacity ?? 0), 0)
                .toLocaleString(language === "en" ? "en-US" : "vi-VN")}
            </strong>
          </div>
        </article>
      </section>

      <section className="organizer-panel">
        {isLoading ? (
          <div className="organizer-empty-state">
            <div className="loading-spinner" />
            <p>{t("venues.loading")}</p>
          </div>
        ) : isError ? (
          <div className="organizer-empty-state organizer-empty-state-error">
            <CircleAlert size={32} />
            <p>{error?.message || t("venues.loadFailed")}</p>
          </div>
        ) : venues.length === 0 ? (
          <div className="organizer-empty-state">
            <Building2 size={32} />
            <p>{t("venues.empty")}</p>
          </div>
        ) : (
          <div className="organizer-media-table-wrap organizer-event-table-wrap organizer-venues-table-wrap">
            <table className="organizer-event-table organizer-media-event-table organizer-events-page-table organizer-venues-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>{t("venues.image")}</th>
                  <th>{t("venues.name")}</th>
                  <th>{t("venues.city")}</th>
                  <th>{t("venues.address")}</th>
                  <th>{t("venues.capacity")}</th>
                  <th>{t("venues.facilities")}</th>
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
                      <td>{venue.city || t("venues.missing")}</td>
                      <td className="organizer-event-location-cell" title={fullAddress}>
                        <span className="venues-admin-address">
                          {fullAddress || t("venues.missingAddress")}
                        </span>
                      </td>
                      <td>
                        {venue.totalCapacity
                          ? `${venue.totalCapacity.toLocaleString(language === "en" ? "en-US" : "vi-VN")} ${t("venues.capacityUnit")}`
                          : t("venues.missing")}
                      </td>
                      <td className="organizer-event-ticket-types-cell">
                        {venue.facilities && venue.facilities.length > 0
                          ? venue.facilities.join(", ")
                          : t("venues.configuredMissing")}
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
