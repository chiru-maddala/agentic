-- Reports table
create table reports (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  content text not null,
  created_at timestamptz default now()
);

alter table reports enable row level security;
create policy "allow all" on reports for all using (true) with check (true);

-- User profiles table (approval status)
create table user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  approved boolean default false,
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;

-- Users can read their own profile (needed for middleware approval check)
create policy "users can read own profile" on user_profiles
  for select using (auth.uid() = id);

-- Users can insert their own profile on registration
create policy "users can insert own profile" on user_profiles
  for insert with check (auth.uid() = id);
