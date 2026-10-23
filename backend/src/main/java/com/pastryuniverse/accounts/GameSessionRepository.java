package com.pastryuniverse.accounts;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GameSessionRepository extends JpaRepository<GameSession, String> {

    Optional<GameSession> findByAccountId(Long accountId);
}
