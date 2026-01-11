-- AdRoom Settings (Facebook Config)
create table if not exists adroom_settings (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users not null unique,
  facebook_page_id text,
  facebook_access_token text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- AdRoom Strategies
create table if not exists adroom_strategies (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users not null,
  type text check (type in ('paid', 'free')) not null,
  content jsonb not null, -- Stores the strategy details (messaging, schedule, etc.)
  expected_outcome text,
  status text check (status in ('proposed', 'active', 'completed', 'rejected', 'pending_approval')) default 'proposed',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- AdRoom Posts (Execution Queue)
create table if not exists adroom_posts (
  id uuid default gen_random_uuid() primary key,
  strategy_id uuid references adroom_strategies not null,
  content text not null,
  image_url text,
  scheduled_time timestamp with time zone not null,
  posted_time timestamp with time zone,
  status text check (status in ('pending', 'posted', 'failed')) default 'pending',
  facebook_post_id text,
  metrics jsonb default '{"reach": 0, "engagement": 0}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- AdRoom Reports
create table if not exists adroom_reports (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references auth.users not null,
  type text check (type in ('daily', 'weekly', 'monthly')) not null,
  content jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table adroom_settings enable row level security;
alter table adroom_strategies enable row level security;
alter table adroom_posts enable row level security;
alter table adroom_reports enable row level security;

create policy "Admins can manage their own settings" on adroom_settings
  for all using (auth.uid() = admin_id);

create policy "Admins can manage their strategies" on adroom_strategies
  for all using (auth.uid() = admin_id);

create policy "Admins can view posts for their strategies" on adroom_posts
  for all using (
    exists (
      select 1 from adroom_strategies 
      where adroom_strategies.id = adroom_posts.strategy_id 
      and adroom_strategies.admin_id = auth.uid()
    )
  );

create policy "Admins can view their reports" on adroom_reports
  for all using (auth.uid() = admin_id);
