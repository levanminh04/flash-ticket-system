package com.flashticket.user.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * UserFollow Entity — Follow relationship giữa Buyer và OrganizerProfile.
 *
 * Collection: user_follows
 *
 * Tại sao không embed danh sách follow vào User document?
 *   - Một Organizer nổi tiếng có thể có hàng triệu followers → document vượt giới hạn 16MB của MongoDB.
 *   - Truy vấn "Lấy tất cả follower của Organizer A" cần scan toàn bộ collection users nếu embed.
 *   - Collection riêng biệt + Compound Unique Index = O(1) lookup, scale tốt.
 *
 * Index strategy:
 *   - (followerId) → "Tôi đang follow những ai?" (User profile page)
 *   - (organizerProfileId) → "Organizer này có bao nhiêu follower? Lấy danh sách để send email" (Core Service event publish)
 *   - (followerId, organizerProfileId) UNIQUE → Không follow 2 lần
 */
@Document(collection = "user_follows")
@CompoundIndex(
        name = "idx_unique_user_follow",
        def = "{'followerId': 1, 'organizerProfileId': 1}",
        unique = true
) // đánh Index dựa trên nhiều trường (fields) cùng một lúc. đảm bảo chỉ có 1 unique followerId-organizerProfileId
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserFollow {

    @Id
    private String id;

    @Indexed
    private String followerId;          // users._id của Buyer

    @Indexed
    private String organizerProfileId;  // organizer_profiles._id

    @CreatedDate
    private Instant createdAt;
}




