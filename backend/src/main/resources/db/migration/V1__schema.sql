-- Catalogue ------------------------------------------------------------

CREATE TABLE products (
    id          BIGSERIAL PRIMARY KEY,
    slug        VARCHAR(80)  NOT NULL UNIQUE,
    name        VARCHAR(120) NOT NULL,
    category    VARCHAR(60)  NOT NULL,
    tag         VARCHAR(40),
    description TEXT         NOT NULL DEFAULT '',
    sort_order  INT          NOT NULL DEFAULT 0,
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- One row per thing a customer can buy: a size + an option (topping/flavour).
CREATE TABLE variants (
    id           BIGSERIAL PRIMARY KEY,
    product_id   BIGINT       NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    size_key     VARCHAR(40)  NOT NULL DEFAULT 'regular',
    size_label   VARCHAR(60)  NOT NULL DEFAULT 'Regular',
    size_sort    INT          NOT NULL DEFAULT 0,
    option_label VARCHAR(120) NOT NULL DEFAULT '',
    option_sort  INT          NOT NULL DEFAULT 0,
    price        INT          NOT NULL CHECK (price >= 0),
    available    BOOLEAN      NOT NULL DEFAULT TRUE,
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_variants_product ON variants (product_id);

CREATE TABLE delivery_zones (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(160) NOT NULL,
    areas      TEXT         NOT NULL DEFAULT '',
    fee        INT          NOT NULL CHECK (fee >= 0),
    sort_order INT          NOT NULL DEFAULT 0,
    active     BOOLEAN      NOT NULL DEFAULT TRUE
);

-- Store settings live in one JSON document so new settings don't need migrations.
CREATE TABLE store_settings (
    id         INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    data       JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customers and orders --------------------------------------------------

CREATE TABLE customers (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(80) NOT NULL,
    phone      VARCHAR(20) NOT NULL UNIQUE,
    email      VARCHAR(160),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id                   BIGSERIAL PRIMARY KEY,
    code                 VARCHAR(12)  NOT NULL UNIQUE,
    tracking_token       VARCHAR(40)  NOT NULL UNIQUE,
    customer_id          BIGINT       NOT NULL REFERENCES customers (id),
    customer_name        VARCHAR(80)  NOT NULL,
    customer_phone       VARCHAR(20)  NOT NULL,
    customer_email       VARCHAR(160),
    fulfilment           VARCHAR(12)  NOT NULL,
    zone_id              BIGINT REFERENCES delivery_zones (id),
    zone_name            VARCHAR(160),
    address              TEXT,
    landmark             VARCHAR(200),
    delivery_date        DATE         NOT NULL,
    time_slot            VARCHAR(40)  NOT NULL,
    gift_recipient_name  VARCHAR(80),
    gift_recipient_phone VARCHAR(20),
    gift_note            VARCHAR(400),
    notes                VARCHAR(500),
    subtotal             INT          NOT NULL,
    delivery_fee         INT          NOT NULL DEFAULT 0,
    total                INT          NOT NULL,
    status               VARCHAR(24)  NOT NULL,
    payment_status       VARCHAR(24)  NOT NULL,
    paid_at              TIMESTAMPTZ,
    session_id           VARCHAR(64),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created ON orders (created_at);
CREATE INDEX idx_orders_delivery_date ON orders (delivery_date);
CREATE INDEX idx_orders_phone ON orders (customer_phone);

CREATE TABLE order_items (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    variant_id   BIGINT REFERENCES variants (id) ON DELETE SET NULL,
    product_id   BIGINT REFERENCES products (id) ON DELETE SET NULL,
    product_slug VARCHAR(80)  NOT NULL,
    product_name VARCHAR(120) NOT NULL,
    size_label   VARCHAR(60)  NOT NULL,
    option_label VARCHAR(120) NOT NULL DEFAULT '',
    unit_price   INT          NOT NULL,
    quantity     INT          NOT NULL CHECK (quantity > 0),
    line_total   INT          NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE order_events (
    id         BIGSERIAL PRIMARY KEY,
    order_id   BIGINT      NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    status     VARCHAR(24) NOT NULL,
    note       VARCHAR(400),
    actor      VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_events_order ON order_events (order_id);

CREATE TABLE payment_receipts (
    id            BIGSERIAL PRIMARY KEY,
    order_id      BIGINT       NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    storage_key   VARCHAR(255) NOT NULL,
    content_type  VARCHAR(80)  NOT NULL,
    size_bytes    BIGINT       NOT NULL,
    original_name VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_receipts_order ON payment_receipts (order_id);

-- Staff -------------------------------------------------------------------

CREATE TABLE admin_users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(160) NOT NULL UNIQUE,
    name          VARCHAR(80)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(16)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- Analytics -----------------------------------------------------------------

CREATE TABLE analytics_events (
    id           BIGSERIAL PRIMARY KEY,
    session_id   VARCHAR(64) NOT NULL,
    type         VARCHAR(24) NOT NULL,
    path         VARCHAR(200),
    product_slug VARCHAR(80),
    referrer     VARCHAR(300),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analytics_type_time ON analytics_events (type, created_at);
CREATE INDEX idx_analytics_time ON analytics_events (created_at);
