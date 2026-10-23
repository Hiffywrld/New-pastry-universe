-- Customer accounts (Google sign-in), the Topping Rush game and welcome rewards.

ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE customers ADD COLUMN google_sub VARCHAR(64) UNIQUE;
ALTER TABLE customers ADD COLUMN avatar_url VARCHAR(400);
ALTER TABLE customers ADD COLUMN last_login_at TIMESTAMPTZ;

ALTER TABLE orders ADD COLUMN account_id BIGINT REFERENCES customers (id);
ALTER TABLE orders ADD COLUMN discount INT NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN reward_code VARCHAR(16);
CREATE INDEX idx_orders_account ON orders (account_id);

-- One game per account. Leaving mid-game still counts as your go.
CREATE TABLE game_sessions (
    id               VARCHAR(32) PRIMARY KEY,
    account_id       BIGINT      NOT NULL UNIQUE REFERENCES customers (id),
    seed             BIGINT      NOT NULL,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at      TIMESTAMPTZ,
    orders_completed INT,
    time_left        INT,
    mistakes         INT
);

-- One welcome reward per account, usable once, on one phone number.
CREATE TABLE rewards (
    id                BIGSERIAL PRIMARY KEY,
    account_id        BIGINT      NOT NULL UNIQUE REFERENCES customers (id),
    code              VARCHAR(16) NOT NULL UNIQUE,
    percent           INT         NOT NULL CHECK (percent BETWEEN 0 AND 100),
    max_amount        INT         NOT NULL,
    expires_at        TIMESTAMPTZ NOT NULL,
    redeemed_at       TIMESTAMPTZ,
    redeemed_order_id BIGINT REFERENCES orders (id),
    redeemed_phone    VARCHAR(20),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rewards_phone ON rewards (redeemed_phone);
