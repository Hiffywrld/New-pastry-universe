package com.pastryuniverse.accounts;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RewardRepository extends JpaRepository<Reward, Long> {

    Optional<Reward> findByAccountId(Long accountId);

    boolean existsByRedeemedPhone(String phone);

    boolean existsByCode(String code);

    Optional<Reward> findByCode(String code);
}
