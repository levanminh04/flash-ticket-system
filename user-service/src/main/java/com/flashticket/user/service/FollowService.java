package com.flashticket.user.service;

import com.flashticket.user.common.exception.ConflictException;
import com.flashticket.user.common.exception.InvalidRequestException;
import com.flashticket.user.common.exception.ResourceNotFoundException;
import com.flashticket.user.dto.FollowResponse;
import com.flashticket.user.model.OrganizerProfile;
import com.flashticket.user.model.UserFollow;
import com.flashticket.user.repository.OrganizerProfileRepository;
import com.flashticket.user.repository.UserFollowRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

/**
 * Service handling Follower logic.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FollowService {

    private final UserFollowRepository userFollowRepository;
    private final OrganizerProfileRepository organizerProfileRepository;
    private final MongoTemplate mongoTemplate;

    /**
     * Follow an organizer
     */
    public FollowResponse followOrganizer(String userId, String organizerProfileId) {
        log.info("User {} following organizer {}", userId, organizerProfileId);

        OrganizerProfile profile = organizerProfileRepository.findById(organizerProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "id", organizerProfileId));

        if (profile.getStatus() != OrganizerProfile.OrganizerStatus.ACTIVE) {
            throw new InvalidRequestException("Cannot follow an inactive organizer");
        }

        if (userFollowRepository.existsByFollowerIdAndOrganizerProfileId(userId, organizerProfileId)) {
            throw new ConflictException("You are already following this organizer");
        }

        UserFollow userFollow = UserFollow.builder()
                .followerId(userId)
                .organizerProfileId(organizerProfileId)
                .build();
        
        userFollowRepository.save(userFollow);

        // Atomic increment followerCount
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(organizerProfileId)),
                new Update().inc("statistics.followerCount", 1),
                OrganizerProfile.class
        );

        // Refresh profile to get updated followerCount
        profile = organizerProfileRepository.findById(organizerProfileId).orElse(profile);

        return new FollowResponse(
                profile.getId(),
                profile.getOrganizerName(),
                true,
                profile.getStatistics().getFollowerCount() != null ? profile.getStatistics().getFollowerCount() : 0
        );
    }

    /**
     * Unfollow an organizer
     */
    public FollowResponse unfollowOrganizer(String userId, String organizerProfileId) {
        log.info("User {} unfollowing organizer {}", userId, organizerProfileId);

        OrganizerProfile profile = organizerProfileRepository.findById(organizerProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "id", organizerProfileId));

        UserFollow userFollow = userFollowRepository.findByFollowerIdAndOrganizerProfileId(userId, organizerProfileId)
                .orElseThrow(() -> new InvalidRequestException("You are not following this organizer"));

        userFollowRepository.delete(userFollow);

        // Atomic decrement followerCount
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("_id").is(organizerProfileId)),
                new Update().inc("statistics.followerCount", -1),
                OrganizerProfile.class
        );

        // Refresh profile to get updated followerCount
        profile = organizerProfileRepository.findById(organizerProfileId).orElse(profile);

        return new FollowResponse(
                profile.getId(),
                profile.getOrganizerName(),
                false,
                profile.getStatistics().getFollowerCount() != null ? profile.getStatistics().getFollowerCount() : 0
        );
    }

    /**
     * Check follow status
     */
    public boolean checkFollowStatus(String userId, String organizerProfileId) {
        return userFollowRepository.existsByFollowerIdAndOrganizerProfileId(userId, organizerProfileId);
    }
}
