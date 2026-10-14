create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  wellness_goals text[] not null default '{}'
    check (cardinality(wellness_goals) <= 2)
    check (wellness_goals <@ array['blood-sugar-aware', 'digestive-comfort', 'heart-healthy', 'skin-wellness']::text[]),
  wellness_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wellness_goals_require_consent check (
    cardinality(wellness_goals) = 0 or wellness_consent_at is not null
  )
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, wellness_goals, wellness_consent_at) on public.profiles to authenticated;
create policy "Customers read their own profile or admins read roles"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Customers update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 1 and 120),
  variety text not null default '',
  description text not null default '',
  image_path text not null default '',
  price_minor integer not null check (price_minor >= 0),
  compare_at_price_minor integer check (compare_at_price_minor is null or compare_at_price_minor >= price_minor),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  pack_sizes jsonb not null default '[]'::jsonb check (jsonb_typeof(pack_sizes) = 'array'),
  nutrients jsonb not null default '[]'::jsonb check (jsonb_typeof(nutrients) = 'array'),
  tag text not null default '',
  tag_color text not null default '#E6F2D9',
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  active boolean not null default true,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
create policy "Visitors see active products and admins see all products"
  on public.products for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy "Admins create products"
  on public.products for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update products"
  on public.products for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete products"
  on public.products for delete to authenticated
  using ((select public.is_admin()));

insert into public.products (
  slug, name, variety, description, image_path, price_minor,
  compare_at_price_minor, pack_sizes, nutrients, tag, tag_color,
  rating, review_count, active, stock_quantity
) values
  (
    'foxtail', 'Golden Foxtail Millet', 'Stone-milled · 500g',
    'A wholesome everyday grain, stone-milled in small batches and brought to you fresh from our farming families.',
    'photo-1518843875459-f738682238a6', 24900, 29900,
    '[{"label":"500g","price_minor":24900},{"label":"1 kg","price_minor":44900},{"label":"2.5 kg","price_minor":99900}]',
    '[{"label":"Dietary fibre","value":"6.7 g"},{"label":"Plant protein","value":"12.3 g"},{"label":"Iron","value":"2.8 mg"}]',
    'WHOLE-GRAIN GOODNESS', '#E6F2D9', 4.9, 248, true, 100
  ),
  (
    'ragi', 'Sprouted Ragi Flour', 'Finger millet · 500g',
    'Patiently sprouted for 48 hours, then gently stone-ground. A deeply nourishing pantry staple for malt, dosa and everyday baking.',
    'photo-1574323347407-f5e1ad6d020b', 21900, 26000,
    '[{"label":"500g","price_minor":21900},{"label":"1 kg","price_minor":38900},{"label":"2.5 kg","price_minor":89900}]',
    '[{"label":"Calcium","value":"344 mg"},{"label":"Dietary fibre","value":"11.5 g"},{"label":"Plant protein","value":"7.3 g"}]',
    'HIGH IN CALCIUM', '#F5E8C7', 4.8, 412, true, 100
  ),
  (
    'bajra', 'Sun-Dried Bajra', 'Pearl millet · 750g',
    'Earthy, naturally resilient pearl millet harvested with care and dried in the sun. Full of goodness for your everyday table.',
    'photo-1501436513145-30f24e19fcc4', 19900, 23900,
    '[{"label":"750g","price_minor":19900},{"label":"1.5 kg","price_minor":36900},{"label":"3 kg","price_minor":69900}]',
    '[{"label":"Iron","value":"8.0 mg"},{"label":"Dietary fibre","value":"11.0 g"},{"label":"Plant protein","value":"11.6 g"}]',
    'ANCIENT SUPERFOOD', '#E7EDDA', 5.0, 189, true, 100
  ),
  (
    'muesli', 'Millet Crunch Muesli', 'Roasted · 400g',
    'A slow-morning kind of breakfast: toasted ancient grains, crunchy seeds and just a touch of forest honey.',
    'photo-1490645935967-10de6ba17061', 32900, 37900,
    '[{"label":"400g","price_minor":32900},{"label":"800g","price_minor":59900}]',
    '[{"label":"Dietary fibre","value":"8.4 g"},{"label":"Plant protein","value":"9.1 g"},{"label":"Natural sugars","value":"4.2 g"}]',
    'READY IN 5 MIN', '#E1F0DF', 4.7, 130, true, 100
  )
on conflict (slug) do nothing;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  kind text not null check (kind in ('promotion', 'challenge')),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '',
  image_url text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'ended')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  duration_days integer check (duration_days is null or duration_days between 1 and 365),
  wellness_goal text check (
    wellness_goal is null or wellness_goal in (
      'blood-sugar-aware', 'digestive-comfort', 'heart-healthy', 'skin-wellness', 'general-wellness'
    )
  ),
  reward_description text not null default '',
  discount_percent numeric(5, 2) check (discount_percent is null or discount_percent between 0 and 100),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon, authenticated;
grant select on public.campaigns to anon, authenticated;
grant insert, update, delete on public.campaigns to authenticated;
create policy "Anyone can view published campaigns in their active dates"
  on public.campaigns for select to anon, authenticated
  using (
    (status = 'published' and starts_at <= now() and (ends_at is null or ends_at > now()))
    or (select public.is_admin())
  );
create policy "Admins create campaigns"
  on public.campaigns for insert to authenticated
  with check ((select public.is_admin()) and created_by = (select auth.uid()));
create policy "Admins update campaigns"
  on public.campaigns for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins delete campaigns"
  on public.campaigns for delete to authenticated
  using ((select public.is_admin()));

create table public.campaign_participants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

alter table public.campaign_participants enable row level security;
revoke all on public.campaign_participants from anon, authenticated;
grant select, insert, delete on public.campaign_participants to authenticated;
create policy "Participants see their own enrollments and admins see campaign participation"
  on public.campaign_participants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Customers join currently published challenges"
  on public.campaign_participants for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.campaigns
      where id = campaign_id
        and kind = 'challenge'
        and status = 'published'
        and starts_at <= now()
        and (ends_at is null or ends_at > now())
    )
  );
create policy "Customers leave their own challenge"
  on public.campaign_participants for delete to authenticated
  using (user_id = (select auth.uid()));

create table public.campaign_day_logs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.campaign_participants (id) on delete cascade,
  logged_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (participant_id, logged_on)
);

alter table public.campaign_day_logs enable row level security;
revoke all on public.campaign_day_logs from anon, authenticated;
grant select, insert, delete on public.campaign_day_logs to authenticated;
create policy "Participants view their own challenge check-ins and admins see progress"
  on public.campaign_day_logs for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.campaign_participants
      where id = participant_id and user_id = (select auth.uid())
    )
  );
create policy "Participants check in once per day"
  on public.campaign_day_logs for insert to authenticated
  with check (
    logged_on = current_date
    and exists (
      select 1
      from public.campaign_participants participant
      join public.campaigns campaign on campaign.id = participant.campaign_id
      where participant.id = participant_id
        and participant.user_id = (select auth.uid())
        and campaign.kind = 'challenge'
        and campaign.status = 'published'
        and campaign.starts_at <= now()
        and (campaign.ends_at is null or campaign.ends_at > now())
        and current_date < (participant.started_at::date + campaign.duration_days)
    )
  );
create policy "Participants can remove their own same-day check-in"
  on public.campaign_day_logs for delete to authenticated
  using (
    logged_on = current_date
    and exists (
      select 1 from public.campaign_participants
      where id = participant_id and user_id = (select auth.uid())
    )
  );

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
create policy "Customers manage their own favorites"
  on public.favorites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  size_label text not null check (char_length(size_label) between 1 and 40),
  quantity integer not null check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id, size_label)
);

alter table public.cart_items enable row level security;
revoke all on public.cart_items from anon, authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
create policy "Customers manage their own cart"
  on public.cart_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.sync_my_cart(p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  cart_item jsonb;
  cart_product_id uuid;
  cart_size_label text;
  cart_quantity integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Cart data is invalid.';
  end if;

  for cart_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      cart_product_id := (cart_item ->> 'product_id')::uuid;
      cart_size_label := cart_item ->> 'size_label';
      cart_quantity := (cart_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'A cart item is invalid.';
    end;

    if cart_quantity < 1 or cart_quantity > 99 or char_length(cart_size_label) not between 1 and 40 then
      raise exception 'A cart item is invalid.';
    end if;
    if not exists (
      select 1
      from public.products product
      cross join lateral jsonb_array_elements(product.pack_sizes) pack
      where product.id = cart_product_id
        and product.active
        and pack ->> 'label' = cart_size_label
    ) then
      raise exception 'A product or pack size is no longer available.';
    end if;

    insert into public.cart_items (user_id, product_id, size_label, quantity)
    values ((select auth.uid()), cart_product_id, cart_size_label, cart_quantity)
    on conflict (user_id, product_id, size_label)
    do update set quantity = excluded.quantity, updated_at = now();
  end loop;

  delete from public.cart_items existing_item
  where existing_item.user_id = (select auth.uid())
    and not exists (
      select 1
      from jsonb_array_elements(p_items) requested_item
      where requested_item ->> 'product_id' = existing_item.product_id::text
        and requested_item ->> 'size_label' = existing_item.size_label
    );
end;
$$;

revoke all on function public.sync_my_cart(jsonb) from public, anon;
grant execute on function public.sync_my_cart(jsonb) to authenticated;

create table public.customer_addresses (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text not null check (char_length(phone) between 7 and 24),
  line1 text not null check (char_length(line1) between 1 and 240),
  line2 text not null default '' check (char_length(line2) <= 240),
  city text not null check (char_length(city) between 1 and 100),
  state text not null check (char_length(state) between 1 and 100),
  postal_code text not null check (char_length(postal_code) between 3 and 16),
  country_code text not null default 'IN' check (country_code ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customer_addresses_set_updated_at
  before update on public.customer_addresses
  for each row execute function public.set_updated_at();

alter table public.customer_addresses enable row level security;
revoke all on public.customer_addresses from anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
create policy "Customers manage their own delivery addresses"
  on public.customer_addresses for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_provider text not null default 'unconfigured',
  payment_reference text,
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null check (total_minor = subtotal_minor + shipping_minor),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  size_label text not null,
  quantity integer not null check (quantity between 1 and 99),
  unit_price_minor integer not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor = unit_price_minor * quantity)
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
grant update (status) on public.orders to authenticated;
create policy "Customers see their own orders and admins can fulfil orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Admins update order fulfilment status"
  on public.orders for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Customers see their own order items and admins can fulfil orders"
  on public.order_items for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders
      where id = order_id and user_id = (select auth.uid())
    )
  );

create index products_active_updated_at_idx on public.products (active, updated_at desc);
create index campaigns_public_dates_idx on public.campaigns (status, starts_at, ends_at);
create index campaign_participants_user_idx on public.campaign_participants (user_id, started_at desc);
create index campaign_day_logs_participant_date_idx on public.campaign_day_logs (participant_id, logged_on);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_created_idx on public.orders (status, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Visitors view product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "Admins delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
