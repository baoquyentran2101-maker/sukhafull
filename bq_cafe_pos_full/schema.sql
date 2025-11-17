create extension if not exists "pgcrypto";

-- XÓA BẢNG CŨ (NẾU CÓ)
drop table if exists payments cascade;
drop table if exists order_items cascade;
drop table if exists orders cascade;
drop table if exists menu_items cascade;
drop table if exists menu_groups cascade;
drop table if exists cafe_tables cascade;
drop table if exists areas cascade;

-- KHU VỰC
create table areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int default 0
);

-- BÀN
create table cafe_tables (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id) on delete cascade,
  name text not null,
  status text not null default 'empty', -- empty | in_use
  unique (area_id, name)
);

-- NHÓM MÓN
create table menu_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int default 0
);

-- MÓN
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references menu_groups(id) on delete cascade,
  name text not null,
  price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  sort int default 0
);

-- ĐƠN HÀNG
create table orders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid references cafe_tables(id),
  table_name text,
  status text not null default 'open', -- open | paid | cancelled
  created_at timestamptz default now()
);

-- MÓN TRONG ĐƠN
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_name text not null,
  price numeric(12,2) not null,
  qty int not null check (qty > 0),
  amount numeric(12,2) generated always as (price * qty) stored,
  created_at timestamptz default now()
);

-- THANH TOÁN
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  method text not null,
  paid_amount numeric(12,2) not null,
  paid_at timestamptz default now()
);

create index on payments (paid_at);
create index on orders (created_at);
create index on orders (table_id, status);

-- SEED DATA CƠ BẢN
insert into areas (name, sort) values
  ('Khu A', 1),
  ('Khu B', 2),
  ('Khu C', 3),
  ('Khu D', 4),
  ('Mang về', 5);

-- Tạo 8 bàn cho Khu A-D
do $$
declare a record;
declare i int;
declare prefix text;
begin
  for a in select id, name from areas where name in ('Khu A','Khu B','Khu C','Khu D') loop
    prefix := substring(a.name from 5 for 1); -- ký tự A/B/C/D
    for i in 1..8 loop
      insert into cafe_tables(area_id, name, status)
      values (a.id, prefix || i::text, 'empty')
      on conflict (area_id, name) do nothing;
    end loop;
  end loop;

  -- Khu mang về: 4 quầy MV1-MV4
  for a in select id from areas where name = 'Mang về' loop
    for i in 1..4 loop
      insert into cafe_tables(area_id, name, status)
      values (a.id, 'MV' || i::text, 'empty')
      on conflict (area_id, name) do nothing;
    end loop;
  end loop;
end $$;

-- Nhóm & món mẫu
insert into menu_groups (name, sort) values
  ('Cà phê', 1),
  ('Trà', 2),
  ('Bánh', 3)
on conflict (name) do nothing;

insert into menu_items (group_id, name, price, sort)
select g.id, v.name, v.price, v.sort
from (values
  ('Cà phê', 'Americano', 30000, 1),
  ('Cà phê', 'Cà phê sữa', 35000, 2),
  ('Cà phê', 'Latte', 40000, 3),
  ('Trà',    'Trà đào', 35000, 1),
  ('Trà',    'Trà lài', 25000, 2),
  ('Bánh',   'Croissant', 25000, 1)
) as v(group_name, name, price, sort)
join menu_groups g on g.name = v.group_name
on conflict do nothing;
