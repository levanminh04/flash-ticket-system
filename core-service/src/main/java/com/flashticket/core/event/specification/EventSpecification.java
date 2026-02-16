package com.flashticket.core.event.specification;

import com.flashticket.core.event.entity.Category;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.TicketType;
import com.flashticket.core.event.entity.Venue;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;


public class EventSpecification {

    /**
     * Chỉ lấy events PUBLISHED và chưa bị xóa
     */
    public static Specification<Event> isPublished() {
        return (root, query, builder) -> builder.and(
            builder.equal(root.get("status"), Event.EventStatus.PUBLISHED),
            builder.equal(root.get("isDeleted"), false)
        );
    }

    /**
     * Search theo title, Từ khóa tìm kiếm
     */
    public static Specification<Event> hasSearch(String search) {
        return (root, query, builder) -> {
            if (search == null || search.isBlank()) {
                return builder.conjunction(); // WHERE 1=1 (always true)
            }
            String pattern = "%" + search.toLowerCase() + "%";
            return builder.like(builder.lower(root.get("title")), pattern); // LIKE trong postgres KHÔNG phân biệt chữ hoa chữ thường
        };
    }


    public static Specification<Event> hasCity(String city) {
        return (root, query, builder) -> {
            if (city == null || city.isBlank()) {
                return builder.conjunction();
            }
            // Join với venue để lấy city, thứ tự truyền vào Join<,> phải đúng 
            // tạo thêm một mệnh đề LEFT JOIN venue v ON e.venue_id = v.id vào trong câu lệnh SQL tổng thể.
            Join<Event, Venue> venue = root.join("venue", JoinType.LEFT);
            return builder.equal(venue.get("city"), city); // WHERE v.city = ?
        };
    }

    /**
     * 
     * BEST PRACTICE IMPLEMENTATION:
     * - Database: event_schema.event_categories (junction table) với composite PK (event_id, category_id)
     * - Entity: Event có @ManyToMany với Category qua field "categories"
     * - Approach: Join trực tiếp vào categories collection, JPA tự động map tới junction table
     * 
     * SELECT DISTINCT e.* 
     * FROM event_schema.events e
     * INNER JOIN event_schema.event_categories ec ON e.id = ec.event_id
     * INNER JOIN event_schema.categories c ON ec.category_id = c.id
     * WHERE c.slug = ? AND c.is_deleted = false
     * 
     * Performance Notes:
     * - Index được sử dụng: idx_event_categories_category, idx_categories_slug
     * - DISTINCT cần thiết vì 1 event có thể có nhiều categories
     * - Nếu chỉ filter 1 category thì không cần DISTINCT, nhưng để đảm bảo tính tổng quát
     */
    public static Specification<Event> hasCategory(String categorySlug) {
        return (root, query, builder) -> {
            if (categorySlug == null || categorySlug.isBlank()) {
                return builder.conjunction(); // WHERE 1=1 
            }
            
            // Join vào categories collection (JPA tự động map tới event_categories junction table)
            // Event -> event_categories -> Category
            Join<Event, Category> categoryJoin = root.join("categories", JoinType.INNER);
            
            // Apply DISTINCT để tránh duplicate khi event có nhiều categories
            if (query.getResultType() != null && query.getResultType().equals(Event.class)) {
                query.distinct(true);
            }
            
            return builder.and(
                builder.equal(categoryJoin.get("slug"), categorySlug),
                builder.equal(categoryJoin.get("isDeleted"), false)
            );
        };
    }



    public static Specification<Event> hasDateRange(LocalDate startDate, LocalDate endDate) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            // Predicate (mệnh đề điều kiện WHERE), một Predicate đại diện cho một điều kiện lọc
            // status = 'PUBLISHED' là 1 Predicate. price > 100 là 1 Predicate.

            if (startDate != null) { // chuyển đổi ngày (LocalDate) thành một mốc thời gian tuyệt đối (Instant) dựa trên múi giờ Việt Nam. 
                Instant startInstant = startDate
                    .atStartOfDay(ZoneId.of("Asia/Ho_Chi_Minh"))
                    .toInstant(); // Nếu không có múi giờ, máy tính sẽ không biết "00:00" này là của Hà Nội hay của London.
                predicates.add(builder.greaterThanOrEqualTo(root.get("startDatetime"), startInstant));
            }
            
            if (endDate != null) {
                // Convert LocalDate sang Instant (end of day)
                Instant endInstant = endDate
                    .atTime(23, 59, 59)
                    .atZone(ZoneId.of("Asia/Ho_Chi_Minh"))
                    .toInstant();
                predicates.add(builder.lessThanOrEqualTo(root.get("startDatetime"), endInstant));
            }
            
            if (predicates.isEmpty()) {
                return builder.conjunction();
            }
            
            return builder.and(predicates.toArray(new Predicate[0])); // builder.and() của JPA Criteria API yêu cầu đầu vào là một mảng (Array)
            // Số 0 ở đây không có nghĩa là mảng rỗng, mà là một để Java biết kiểu dữ liệu cần chuyển đổi là Predicate. Java sẽ tự động tạo một mảng có kích thước vừa đủ với số lượng phần tử có trong List.
        };
    }



    public static Specification<Event> hasPriceRange(BigDecimal minPrice, BigDecimal maxPrice) {
        return (root, query, builder) -> {
            if (minPrice == null && maxPrice == null) {
                return builder.conjunction();
            }
            
            // Subquery: Tìm events có ít nhất 1 ticket type trong khoảng giá
            Subquery<UUID> subquery = query.subquery(UUID.class); // Xác định kiểu dữ liệu mà Subquery sẽ trả về
            Root<TicketType> ticketTypeRoot = subquery.from(TicketType.class); // Đại diện cho Entity TicketType, Xác định bảng mà Subquery sẽ quét dữ liệu.
            
            List<Predicate> predicates = new ArrayList<>();
            
            // Join ticket type với event
            predicates.add(builder.equal(ticketTypeRoot.get("event").get("id"), root.get("id")));
            
            // Price range conditions
            if (minPrice != null) {
                predicates.add(builder.greaterThanOrEqualTo(ticketTypeRoot.get("price"), minPrice));
            }
            if (maxPrice != null) {
                predicates.add(builder.lessThanOrEqualTo(ticketTypeRoot.get("price"), maxPrice));
            }
            
            subquery.select(ticketTypeRoot.get("event").get("id"))
                    .where(predicates.toArray(new Predicate[0]));
            
            return builder.in(root.get("id")).value(subquery); // .value(subquery): " lấy toàn bộ danh sách ID trả về từ câu truy vấn con 
        };
    }

    /**
     * Filter theo featured status
     * @param featured true = chỉ featured events, false = chỉ non-featured, null = tất cả
     */
    public static Specification<Event> isFeatured(Boolean featured) {
        return (root, query, builder) -> {
            if (featured == null) {
                return builder.conjunction();
            }
            return builder.equal(root.get("isFeatured"), featured);
        };
    }
}
