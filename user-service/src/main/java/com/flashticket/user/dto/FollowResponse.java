package com.flashticket.user.dto;

public record FollowResponse(
        String organizerProfileId,
        String organizerName,
        boolean isFollowing,
        long followerCount
) {}
