package com.flashticket.user.repository;

import com.flashticket.user.model.UserFollow;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserFollowRepository extends MongoRepository<UserFollow, String> {

    // Buyer đang follow những Organizer nào? (hiển thị trang profile buyer)
    Page<UserFollow> findByFollowerId(String followerId, Pageable pageable);

    // Lấy tất cả follower của 1 Organizer (để gửi thông báo khi có event mới)
    Page<UserFollow> findByOrganizerProfileId(String organizerProfileId, Pageable pageable);

    // Đếm số follower của Organizer (cho statistics)
    long countByOrganizerProfileId(String organizerProfileId);

    // Check xem Buyer đã follow Organizer này chưa (để hiển thị đúng button UI)
    Optional<UserFollow> findByFollowerIdAndOrganizerProfileId(
            String followerId, String organizerProfileId);

    boolean existsByFollowerIdAndOrganizerProfileId(
            String followerId, String organizerProfileId);

    // Unfollow: xóa relationship
    void deleteByFollowerIdAndOrganizerProfileId(
            String followerId, String organizerProfileId);
}
