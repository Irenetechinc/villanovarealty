create table if not exists adroom_cache (
  id uuid default gen_random_uuid() primary key,
  analysis text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null
);

-- Index for faster cleanup/lookup
create index if not exists idx_adroom_cache_expires_at on adroom_cache(expires_at);
