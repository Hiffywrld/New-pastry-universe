-- Kitchen tools: the delivery calendar, rider links and customer notes.

-- One row per day the kitchen has changed from the usual: closed for the
-- day, or a different number of orders it can take.
CREATE TABLE calendar_days (
    day        DATE PRIMARY KEY,
    closed     BOOLEAN     NOT NULL DEFAULT FALSE,
    max_orders INT CHECK (max_orders >= 0),
    note       VARCHAR(160),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Private links riders open on their phone to see the day's deliveries.
CREATE TABLE riders (
    id           BIGSERIAL PRIMARY KEY,
    token        VARCHAR(48) NOT NULL UNIQUE,
    name         VARCHAR(80) NOT NULL,
    phone        VARCHAR(20),
    active       BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ
);

ALTER TABLE orders ADD COLUMN rider_id BIGINT REFERENCES riders (id);
CREATE INDEX idx_orders_customer ON orders (customer_id);

-- Staff notes and tags on customers (e.g. "Corporate", "Loves raisins").
ALTER TABLE customers ADD COLUMN notes VARCHAR(2000);
ALTER TABLE customers ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb;
