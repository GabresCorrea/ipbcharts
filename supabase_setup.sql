-- ============================================================
-- IPBCharts — Configuração do banco de dados (Supabase)
-- Cole TUDO isto no SQL Editor do Supabase e clique em "Run".
-- ============================================================

-- 1) Tabela que guarda as cifras
create table if not exists public.songs (
  id text primary key,
  data jsonb not null,
  updated_by text,
  updated_at timestamptz default now()
);

-- 2) Atualiza o campo updated_at automaticamente a cada alteração
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_songs_updated on public.songs;
create trigger trg_songs_updated
  before update on public.songs
  for each row execute function public.set_updated_at();

-- 3) Liga a segurança por linha (RLS)
alter table public.songs enable row level security;

-- 4) Permissões: qualquer MEMBRO LOGADO pode ver, criar, editar e excluir.
--    Quem não está logado não acessa nada.
drop policy if exists "membros_leem" on public.songs;
create policy "membros_leem" on public.songs
  for select to authenticated using (true);

drop policy if exists "membros_inserem" on public.songs;
create policy "membros_inserem" on public.songs
  for insert to authenticated with check (true);

drop policy if exists "membros_editam" on public.songs;
create policy "membros_editam" on public.songs
  for update to authenticated using (true);

drop policy if exists "membros_excluem" on public.songs;
create policy "membros_excluem" on public.songs
  for delete to authenticated using (true);

-- 5) Habilita o tempo real (atualização ao vivo entre os membros)
alter publication supabase_realtime add table public.songs;
