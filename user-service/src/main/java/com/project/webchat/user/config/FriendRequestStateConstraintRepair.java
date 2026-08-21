package com.project.webchat.user.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Repairs legacy friend_requests state constraints left from older enum values.
 * Hibernate ddl-auto=update does not reliably rewrite CHECK constraints, so
 * old deployments may still reject the newer REJECTED state.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FriendRequestStateConstraintRepair implements ApplicationRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        try {
            // Drop stale CHECK constraint if present (legacy clusters often still enforce old values).
            jdbcTemplate.execute("ALTER TABLE friend_requests DROP CONSTRAINT IF EXISTS friend_requests_state_check");

            // Normalize old rows if they used the previous label.
            jdbcTemplate.execute("UPDATE friend_requests SET state = 'REJECTED' WHERE state = 'DECLINED'");

            // Recreate canonical constraint for current enum values.
            jdbcTemplate.execute(
                    "ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_state_check " +
                            "CHECK (state IN ('PENDING','ACCEPTED','REJECTED'))");

            log.info("friend_requests.state constraint repaired for values: PENDING, ACCEPTED, REJECTED");
        } catch (DataAccessException ex) {
            // Do not block service startup because some local/dev databases may not have this table yet.
            log.warn("Could not repair friend_requests.state constraint: {}", ex.getMessage());
        }
    }
}
