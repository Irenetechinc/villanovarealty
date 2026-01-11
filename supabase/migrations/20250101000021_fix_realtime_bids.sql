
-- Enable Realtime for bids table
alter publication supabase_realtime add table bids;

-- Ensure bids are publicly viewable (or at least viewable by authenticated users)
-- First, drop existing policy if it exists to avoid conflicts (optional, but safer to just create if not exists)
drop policy if exists "Bids are viewable by everyone" on bids;
create policy "Bids are viewable by everyone"
on bids for select
using ( true );

-- Ensure inserts are allowed for authenticated users
drop policy if exists "Users can insert their own bids" on bids;
create policy "Users can insert their own bids"
on bids for insert
with check ( auth.uid() = user_id );
