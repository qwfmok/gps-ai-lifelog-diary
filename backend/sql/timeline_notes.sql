begin;

create table public.timeline_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    anchor_location_id uuid not null,
    stay_started_at timestamptz not null,
    stay_ended_at timestamptz not null,
    note text not null check (char_length(btrim(note)) between 1 and 2000),
    created_at timestamptz not null default now(),
    check (stay_ended_at >= stay_started_at)
);

alter table public.timeline_notes enable row level security;

revoke all privileges on table public.timeline_notes
    from public, anon, authenticated, service_role;

grant select, insert on table public.timeline_notes to service_role;

commit;