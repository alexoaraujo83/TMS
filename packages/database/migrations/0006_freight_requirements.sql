alter table freights
  add column if not exists vehicle_types text[] not null default '{}',
  add column if not exists body_types text[] not null default '{}',
  add column if not exists minimum_free_meters numeric(8,3),
  add column if not exists minimum_capacity_kg numeric(14,2);
