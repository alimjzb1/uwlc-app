
-- Create product_images table for multi-image support
create table if not exists product_images (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references products_inventory(id) on delete cascade,
  url text not null,
  position int default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table product_images enable row level security;

-- Policies (Adjust based on your auth model, here we allow public read, auth write)
DROP POLICY IF EXISTS "Public view" ON product_images;
create policy "Public view" on product_images for select using (true);

DROP POLICY IF EXISTS "Authenticated insert" ON product_images;
create policy "Authenticated insert" on product_images for insert with check (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated update" ON product_images;
create policy "Authenticated update" on product_images for update using (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete" ON product_images;
create policy "Authenticated delete" on product_images for delete using (auth.role() = 'authenticated');

-- Optional: Add stats columns to customers if missing
-- alter table customers add column if not exists total_orders int default 0;
-- alter table customers add column if not exists total_spent decimal(10,2) default 0.00;
