-- 1. Delete duplicate orders, keeping the one with the earliest created_at (or smallest id as tiebreaker)
DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE id NOT IN (
    SELECT DISTINCT ON (shopify_order_id) id
    FROM orders
    WHERE shopify_order_id IS NOT NULL
    ORDER BY shopify_order_id, created_at ASC, id ASC
  )
  AND shopify_order_id IS NOT NULL
);

DELETE FROM orders WHERE id NOT IN (
  SELECT DISTINCT ON (shopify_order_id) id
  FROM orders
  WHERE shopify_order_id IS NOT NULL
  ORDER BY shopify_order_id, created_at ASC, id ASC
)
AND shopify_order_id IS NOT NULL;

-- 2. Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS orders_shopify_order_id_unique ON orders (shopify_order_id) WHERE shopify_order_id IS NOT NULL;

-- 3. Also add unique constraint on order_items to prevent duplicate line items
CREATE UNIQUE INDEX IF NOT EXISTS order_items_order_line_unique ON order_items (order_id, shopify_line_item_id) WHERE shopify_line_item_id IS NOT NULL;
