-- WeBuyCars MZ — Web Admin + Dealer Portal extensions
-- Apply after mobile migrations 001–005. Idempotent where possible.

-- ---------------------------------------------------------------------------
-- Security helpers (SECURITY DEFINER; read minimal state under RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

create or replace function public.is_dealer_manager_for(p_dealer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.dealer_staff ds
    where ds.dealer_id = p_dealer_id
      and ds.user_id = auth.uid()
      and ds.role = 'manager'
      and ds.is_active = true
  );
$$;

-- ---------------------------------------------------------------------------
-- Auth metadata sync — allow dealer web roles in JWT metadata
-- ---------------------------------------------------------------------------
create or replace function public.sync_user_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text;
begin
  meta_role := nullif(trim(lower(coalesce(new.raw_user_meta_data->>'role', ''))), '');
  if meta_role is not null and meta_role not in (
    'buyer',
    'seller',
    'dealer',
    'admin',
    'private_seller',
    'dealer_manager',
    'dealer_staff'
  ) then
    meta_role := null;
  end if;

  insert into public.users (id, email, phone, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.phone), ''),
      nullif(trim(new.raw_user_meta_data->>'phone'), '')
    ),
    coalesce(meta_role, 'buyer')
  )
  on conflict (id) do update
    set email = excluded.email,
        phone = coalesce(excluded.phone, public.users.phone),
        role = coalesce(excluded.role, public.users.role);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- dealer_packages — allowances & support tier
-- ---------------------------------------------------------------------------
alter table public.dealer_packages
  add column if not exists featured_listing_allowance int not null default 0
    check (featured_listing_allowance >= 0);
alter table public.dealer_packages
  add column if not exists sponsored_listing_allowance int not null default 0
    check (sponsored_listing_allowance >= 0);
alter table public.dealer_packages
  add column if not exists priority_support boolean not null default false;

update public.dealer_packages set featured_listing_allowance = 1, sponsored_listing_allowance = 1 where slug = 'starter';
update public.dealer_packages set featured_listing_allowance = 5, sponsored_listing_allowance = 5 where slug = 'business';
update public.dealer_packages set featured_listing_allowance = 20, sponsored_listing_allowance = 20 where slug = 'premium';

insert into public.dealer_packages (name, slug, listing_limit, price, price_per_extra_listing, duration_days, is_active, featured_listing_allowance, sponsored_listing_allowance, priority_support)
values ('Enterprise', 'enterprise', 500, 350000.00, 350.00, 365, true, 100, 100, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- vehicle_listings — merchandising flags
-- ---------------------------------------------------------------------------
alter table public.vehicle_listings
  add column if not exists is_featured boolean not null default false;
alter table public.vehicle_listings
  add column if not exists is_sponsored boolean not null default false;
alter table public.vehicle_listings
  add column if not exists featured_until timestamptz;
alter table public.vehicle_listings
  add column if not exists sponsored_until timestamptz;

-- ---------------------------------------------------------------------------
-- dealer_staff — first-login onboarding gate (first manager only)
-- ---------------------------------------------------------------------------
alter table public.dealer_staff
  add column if not exists onboarding_required boolean not null default false;
alter table public.dealer_staff
  add column if not exists onboarding_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- payments — typed intents for admin / dealer reporting
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists payment_type text not null default 'listing';

alter table public.payments drop constraint if exists payments_payment_type_check;
alter table public.payments add constraint payments_payment_type_check check (
  payment_type in (
    'subscription',
    'listing',
    'extra_listing',
    'sponsorship',
    'feature',
    'upgrade',
    'other'
  )
);

-- ---------------------------------------------------------------------------
-- profiles — UI locale preference
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists preferred_locale text default 'pt';

-- ---------------------------------------------------------------------------
-- dealer_subscriptions — optional merchandising counters
-- ---------------------------------------------------------------------------
alter table public.dealer_subscriptions
  add column if not exists featured_used int not null default 0 check (featured_used >= 0);
alter table public.dealer_subscriptions
  add column if not exists sponsored_used int not null default 0 check (sponsored_used >= 0);

-- ---------------------------------------------------------------------------
-- RLS — admin & dealer manager write paths for web portals
-- ---------------------------------------------------------------------------

-- Dealers: admins manage all; managers update own dealer
drop policy if exists "dealers_admin_select" on public.dealers;
create policy "dealers_admin_select" on public.dealers
  for select to authenticated
  using (public.is_app_admin());

drop policy if exists "dealers_admin_insert" on public.dealers;
create policy "dealers_admin_insert" on public.dealers
  for insert to authenticated
  with check (public.is_app_admin());

drop policy if exists "dealers_admin_update" on public.dealers;
create policy "dealers_admin_update" on public.dealers
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "dealers_manager_update" on public.dealers;
create policy "dealers_manager_update" on public.dealers
  for update to authenticated
  using (public.is_dealer_manager_for(id))
  with check (public.is_dealer_manager_for(id));

-- dealer_staff: members read (existing) + admin + manager writes
drop policy if exists "dealer_staff_admin_all" on public.dealer_staff;
create policy "dealer_staff_admin_all" on public.dealer_staff
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "dealer_staff_manager_insert" on public.dealer_staff;
create policy "dealer_staff_manager_insert" on public.dealer_staff
  for insert to authenticated
  with check (
    public.is_app_admin()
    or public.is_dealer_manager_for(dealer_id)
  );

drop policy if exists "dealer_staff_manager_update" on public.dealer_staff;
create policy "dealer_staff_manager_update" on public.dealer_staff
  for update to authenticated
  using (
    public.is_app_admin()
    or public.is_dealer_manager_for(dealer_id)
  )
  with check (
    public.is_app_admin()
    or public.is_dealer_manager_for(dealer_id)
  );

-- Packages: read active stays; admin manages catalog
drop policy if exists "dealer_packages_admin_all" on public.dealer_packages;
create policy "dealer_packages_admin_all" on public.dealer_packages
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Subscriptions: admin + existing dealer member read; admin insert/update
drop policy if exists "dealer_subscriptions_admin_all" on public.dealer_subscriptions;
create policy "dealer_subscriptions_admin_all" on public.dealer_subscriptions
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "dealer_subscriptions_manager_update" on public.dealer_subscriptions;
create policy "dealer_subscriptions_manager_update" on public.dealer_subscriptions
  for update to authenticated
  using (public.is_dealer_manager_for(dealer_id))
  with check (public.is_dealer_manager_for(dealer_id));

drop policy if exists "dealer_subscriptions_manager_insert" on public.dealer_subscriptions;
create policy "dealer_subscriptions_manager_insert" on public.dealer_subscriptions
  for insert to authenticated
  with check (public.is_dealer_manager_for(dealer_id));

-- Reference data CRUD for admins (existing policies are read-only public)
drop policy if exists "provinces_admin_all" on public.provinces;
create policy "provinces_admin_all" on public.provinces
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "body_types_admin_all" on public.body_types;
create policy "body_types_admin_all" on public.body_types
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "vehicle_brands_admin_all" on public.vehicle_brands;
create policy "vehicle_brands_admin_all" on public.vehicle_brands
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

drop policy if exists "vehicle_models_admin_all" on public.vehicle_models;
create policy "vehicle_models_admin_all" on public.vehicle_models
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Moderation logs: allow admin inserts/reads from web admin
drop policy if exists "listing_moderation_admin_all" on public.listing_moderation_logs;
create policy "listing_moderation_admin_all" on public.listing_moderation_logs
  for all to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Vehicle listings: admin can update for moderation workflow
drop policy if exists "vehicle_listings_admin_update" on public.vehicle_listings;
create policy "vehicle_listings_admin_update" on public.vehicle_listings
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Payments: admin read all
drop policy if exists "payments_admin_select" on public.payments;
create policy "payments_admin_select" on public.payments
  for select to authenticated
  using (public.is_app_admin());

-- Leads: admin analytics
drop policy if exists "leads_admin_select" on public.leads;
create policy "leads_admin_select" on public.leads
  for select to authenticated
  using (public.is_app_admin());

-- Users table: admin read all (for staff management / dashboards)
drop policy if exists "users_admin_select" on public.users;
create policy "users_admin_select" on public.users
  for select to authenticated
  using (public.is_app_admin());

drop policy if exists "users_admin_update" on public.users;
create policy "users_admin_update" on public.users
  for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Profiles: admin read for support screens
drop policy if exists "profiles_admin_select" on public.profiles;
create policy "profiles_admin_select" on public.profiles
  for select to authenticated
  using (public.is_app_admin());

-- ---------------------------------------------------------------------------
-- Simulated gateway — subscription activation (MVP parity with listings)
-- ---------------------------------------------------------------------------
create or replace function public.complete_subscription_payment_simulation(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sub_id uuid;
  v_status text;
  v_gateway text;
  v_days int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select p.subscription_id, p.payment_status, p.gateway_reference
    into v_sub_id, v_status, v_gateway
  from public.payments p
  where p.id = p_payment_id
    and p.user_id = v_uid
    and coalesce(p.payment_type, 'listing') in ('subscription', 'upgrade');

  if v_sub_id is null then
    raise exception 'payment not found';
  end if;

  if v_status = 'paid' then
    return;
  end if;

  if v_status <> 'pending' then
    raise exception 'payment not pending';
  end if;

  if v_gateway is null or length(trim(v_gateway)) = 0 then
    v_gateway := 'sim_sub_' || replace(gen_random_uuid()::text, '-', '');
  end if;

  update public.payments
  set payment_status = 'paid',
      gateway_reference = v_gateway
  where id = p_payment_id
    and user_id = v_uid
    and payment_status = 'pending';

  insert into public.payment_logs (payment_id, provider_response)
  values (
    p_payment_id,
    jsonb_build_object(
      'source', 'subscription_simulation',
      'gateway_reference', v_gateway,
      'completed_at', now()
    )
  );

  select dp.duration_days
    into v_days
  from public.dealer_subscriptions ds
  join public.dealer_packages dp on dp.id = ds.package_id
  where ds.id = v_sub_id;

  update public.dealer_subscriptions ds
  set status = 'active',
      started_at = coalesce(ds.started_at, now()),
      expires_at = coalesce(
        ds.expires_at,
        now() + make_interval(days => greatest(coalesce(v_days, 30), 1))
      )
  where ds.id = v_sub_id
    and ds.status in ('pending_payment', 'suspended');
end;
$$;

grant execute on function public.complete_subscription_payment_simulation(uuid) to authenticated;
