-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  avatar_url text,
  email text,
  updated_at timestamp with time zone,
  constraint username_length check (char_length(full_name) >= 3)
);

-- ORGANIZATIONS
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  logo_url text,
  description text,
  website text,
  email text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORGANIZATION MEMBERS
create table public.organization_members (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text check (role in ('owner', 'admin', 'member', 'viewer')) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(organization_id, user_id)
);

-- EVENTS
create table public.events (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  title text not null,
  description text,
  date timestamp with time zone not null,
  location text,
  status text check (status in ('draft', 'published', 'ended', 'cancelled')) default 'draft',
  image_url text,
  total_tickets int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- TICKETS (Sales)
create table public.tickets (
  id uuid default uuid_generate_v4() primary key,
  event_id uuid references public.events on delete cascade not null,
  customer_name text not null,
  customer_email text not null,
  type text not null,
  price decimal(10,2) not null,
  status text check (status in ('pending', 'paid', 'refunded', 'cancelled')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- FORMS
create table public.forms (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations on delete cascade not null,
  title text not null,
  status text check (status in ('active', 'draft', 'closed')) default 'draft',
  fields jsonb default '[]'::jsonb,
  views int default 0,
  responses_count int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.events enable row level security;
alter table public.tickets enable row level security;
alter table public.forms enable row level security;

-- POLICIES

-- Profiles: Users can read/update their own profile
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Organizations: Visible to members
create policy "Members can view their organizations" on public.organizations for select using (
  exists (
    select 1 from public.organization_members
    where organization_id = organizations.id and user_id = auth.uid()
  )
);

-- Events: Public read for published, Members read all
create policy "Public can view published events" on public.events for select using (status = 'published');
create policy "Members can view all organization events" on public.events for select using (
  exists (
    select 1 from public.organization_members
    where organization_id = events.organization_id and user_id = auth.uid()
  )
);

-- Trigger to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
