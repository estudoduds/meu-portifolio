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