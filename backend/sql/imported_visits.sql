begin;

create table public.imported_visits (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    latitude double precision not null check (latitude between -90 and 90),
    longitude double precision not null check (longitude between -180 and 180),
    source_place_name text,
    started_at timestamptz not null,
    ended_at timestamptz not null,
    created_at timestamptz not null default now(),
    check (ended_at >= started_at),
    unique (user_id, latitude, longitude, started_at, ended_at)
);

create index imported_visits_user_started_at_idx
    on public.imported_visits (user_id, started_at);

alter table public.imported_visits enable row level security;

revoke all privileges on table public.imported_visits
    from public, anon, authenticated, service_role;

grant select, insert, update on table public.imported_visits to service_role;

commit;
