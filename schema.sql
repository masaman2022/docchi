-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: ideas
create table public.ideas (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  option_a text not null,
  option_b text not null,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  feedback_summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: videos
create table public.videos (
  id uuid default uuid_generate_v4() primary key,
  idea_id uuid references public.ideas(id),
  file_path text,
  youtube_url text,
  tiktok_url text,
  instagram_url text,
  status text check (status in ('rendering', 'done', 'error', 'posted')) default 'rendering',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: feedback
create table public.feedback (
  id uuid default uuid_generate_v4() primary key,
  video_id uuid references public.videos(id),
  content text not null,
  platform text,
  raw_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
