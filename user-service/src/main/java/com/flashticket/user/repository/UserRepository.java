package com.flashticket.user.repository;

import com.flashticket.user.model.User;
import com.flashticket.user.model.UserRole;
import com.flashticket.user.model.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {

    // ── Lookup by identifiers ─────────────────────────────────────────────────

    Optional<User> findByEmail(String email);

    Optional<User> findByKeycloakId(String keycloakId);

    boolean existsByEmail(String email);

    boolean existsByKeycloakId(String keycloakId);

    // ── Admin listing ─────────────────────────────────────────────────────────

    Page<User> findByStatusAndIsDeletedFalse(UserStatus status, Pageable pageable);

    Page<User> findByRolesContainingAndIsDeletedFalse(UserRole role, Pageable pageable);

    Page<User> findByIsDeletedFalse(Pageable pageable);
}
