create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name varchar(70) not null,
  url varchar(500) not null,
  type text not null check (type in ('site', 'experimento', 'rascunho')),
  description varchar(180) not null default '',
  date text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists projects_user_created_idx
  on public.projects (user_id, created_at desc);

alter table public.projects enable row level security;

revoke all on table public.projects from anon, authenticated;
grant select, insert, update, delete on table public.projects to authenticated;

drop policy if exists "Users manage their own projects" on public.projects;
create policy "Users manage their own projects"
  on public.projects
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.login_handles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_]{3,24}$'),
  email text not null unique
);

alter table public.login_handles enable row level security;
revoke all on table public.login_handles from public, anon, authenticated;
grant select on table public.login_handles to service_role;

create or replace function public.sync_auth_login_handle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    normalized_username := 'user_' || replace(substr(new.id::text, 1, 13), '-', '');
  end if;

  insert into public.login_handles (user_id, username, email)
  values (new.id, normalized_username, lower(new.email))
  on conflict (user_id) do update
    set email = excluded.email;

  return new;
end;
$$;

revoke all on function public.sync_auth_login_handle() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_login_handle on auth.users;
create trigger on_auth_user_created_login_handle
  after insert on auth.users
  for each row execute function public.sync_auth_login_handle();

drop trigger if exists on_auth_user_email_updated_login_handle on auth.users;
create trigger on_auth_user_email_updated_login_handle
  after update of email on auth.users
  for each row execute function public.sync_auth_login_handle();

do $$
declare
  account record;
  base_username text;
  candidate_username text;
  suffix integer;
begin
  for account in
    select id, email, raw_user_meta_data
    from auth.users
    where email is not null
    order by created_at, id
  loop
    base_username := lower(btrim(coalesce(account.raw_user_meta_data ->> 'username', '')));
    if base_username !~ '^[a-z0-9_]{3,24}$' then
      base_username := regexp_replace(lower(split_part(account.email, '@', 1)), '[^a-z0-9_]', '_', 'g');
    end if;
    if length(base_username) < 3 then
      base_username := 'user_' || replace(substr(account.id::text, 1, 13), '-', '');
    end if;

    base_username := left(base_username, 24);
    candidate_username := base_username;
    suffix := 1;
    while exists (
      select 1 from public.login_handles
      where username = candidate_username and user_id <> account.id
    ) loop
      suffix := suffix + 1;
      candidate_username := left(base_username, 23 - length(suffix::text)) || '_' || suffix::text;
    end loop;

    insert into public.login_handles (user_id, username, email)
    values (account.id, candidate_username, lower(account.email))
    on conflict (user_id) do update
      set email = excluded.email;
  end loop;
end;
$$;