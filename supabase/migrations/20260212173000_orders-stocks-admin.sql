alter table public.products
  add column if not exists stock integer not null default 12;

update public.products
set stock = 12
where stock is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_stock_nonnegative'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_stock_nonnegative check (stock >= 0);
  end if;
end $$;

alter table public.orders
  add column if not exists user_email text;

update public.orders o
set user_email = lower(u.email)
from auth.users u
where o.user_id = u.id
  and (o.user_email is null or o.user_email = '');

alter table public.orders
  alter column user_email set default '';

update public.orders
set user_email = ''
where user_email is null;

alter table public.orders
  alter column user_email set not null;

alter table public.orders
  add column if not exists shipping_status text not null default 'awaiting_confirmation',
  add column if not exists confirmed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists timeline jsonb not null default '[]'::jsonb;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select coalesce(
    lower(auth.jwt() ->> 'email') in (
      'admin@pixora.com',
      'admin@pixora.store',
      'jonathanpalomar85@gmail.com'
    )
    or strpos(lower(auth.jwt() ->> 'email'), 'admin') > 0,
    false
  );
$$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='products'
      and policyname='Admins can insert products'
  ) then
    create policy "Admins can insert products"
      on public.products for insert
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='products'
      and policyname='Admins can update products'
  ) then
    create policy "Admins can update products"
      on public.products for update
      using (public.is_admin_user())
      with check (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='products'
      and policyname='Admins can delete products'
  ) then
    create policy "Admins can delete products"
      on public.products for delete
      using (public.is_admin_user());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='orders'
      and policyname='Admins can view all orders'
  ) then
    create policy "Admins can view all orders"
      on public.orders for select
      using (public.is_admin_user());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='orders'
      and policyname='Admins can update all orders'
  ) then
    create policy "Admins can update all orders"
      on public.orders for update
      using (public.is_admin_user())
      with check (public.is_admin_user());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='order_items'
      and policyname='Admins can view all order items'
  ) then
    create policy "Admins can view all order items"
      on public.order_items for select
      using (public.is_admin_user());
  end if;
end $$;
