begin;

create table public.diaries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    diary_date date not null,
    content text not null check (char_length(btrim(content)) between 1 and 20000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index diaries_user_date_idx
    on public.diaries (user_id, diary_date desc, created_at desc, id desc);

alter table public.diaries enable row level security;

revoke all privileges on table public.diaries
    from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.diaries to service_role;

commit;