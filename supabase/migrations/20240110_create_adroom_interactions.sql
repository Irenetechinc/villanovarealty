create table if not exists adroom_interactions (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users(id),
  facebook_id text not null,
  type text check (type in ('comment', 'message')),
  content text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_adroom_interactions_facebook_id on adroom_interactions(facebook_id);
