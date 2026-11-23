-- Reference Supabase Postgres Schema & Row Level Security for Patil Classes

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  standard text not null default '10th',
  joining_date date not null,
  status text not null default 'active' check (status in ('active','left')),
  created_at timestamptz default now()
);

create table if not exists parents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  phone text not null,
  whatsapp_number text,
  student_id uuid not null unique references students(id) on delete cascade,
  auth_user_id uuid unique,
  created_at timestamptz default now()
);

create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  auth_user_id uuid unique
);

create table if not exists tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null check (subject in ('Maths','Science','English','Marathi','Hindi','Social Science')),
  test_date date not null,
  total_marks numeric not null check (total_marks > 0),
  pdf_path text,
  created_at timestamptz default now()
);

create table if not exists marks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references tests(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  marks_obtained numeric not null check (marks_obtained >= 0),
  remark text,
  unique (test_id, student_id)
);

create table if not exists message_log (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  type text not null,
  status text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table students enable row level security;
alter table parents enable row level security;
alter table admins enable row level security;
alter table tests enable row level security;
alter table marks enable row level security;
alter table message_log enable row level security;

-- Helper function
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from admins where auth_user_id = auth.uid()
  );
$$;

-- Admin full access policies
create policy "Admins full access students" on students for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins full access parents" on parents for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins full access admins" on admins for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins full access tests" on tests for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins full access marks" on marks for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins full access message_log" on message_log for all using (public.is_admin()) with check (public.is_admin());

-- Parent read-only policies
create policy "Parents read own row" on parents for select using (auth_user_id = auth.uid());
create policy "Parents read own student" on students for select using (
  id = (select student_id from parents where auth_user_id = auth.uid())
);
create policy "Parents read own marks" on marks for select using (
  student_id = (select student_id from parents where auth_user_id = auth.uid())
);
create policy "Parents read own student tests" on tests for select using (
  exists (
    select 1 from marks m
    join parents p on p.student_id = m.student_id
    where m.test_id = tests.id and p.auth_user_id = auth.uid()
  )
);
