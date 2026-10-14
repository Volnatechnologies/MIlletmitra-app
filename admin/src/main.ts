import { createClient, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { CampaignRow, Database, Json, OrderItemRow, OrderRow, ProductRow } from '../../lib/database.types';
import './admin.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function getRoot(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>('#app');
  if (!element) throw new Error('Admin application root element was not found.');
  return element;
}
const root: HTMLDivElement = getRoot();

const isSupabaseConfigured = Boolean(
  supabaseUrl
  && supabaseKey
  && !supabaseUrl.includes('your-project-ref')
  && !supabaseKey.includes('replace_me'),
);
const app: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

type Tab = 'products' | 'campaigns' | 'participants' | 'orders';
type ParticipantRow = { id: string; campaign_id: string; user_id: string; started_at: string };
type DayLogRow = { participant_id: string; logged_on: string };
type CampaignFormValue = Omit<CampaignRow, 'id' | 'created_at' | 'updated_at' | 'created_by'>;
type ProductFormValue = Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>;

let currentUser: User | null = null;
let activeTab: Tab = 'products';
let notice = '';
let noticeIsError = false;
let busy = false;
let authCheckId = 0;
let products: ProductRow[] = [];
let campaigns: CampaignRow[] = [];
let participants: ParticipantRow[] = [];
let dayLogs: DayLogRow[] = [];
let orders: OrderRow[] = [];
let orderItems: OrderItemRow[] = [];

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function formatMoney(minor: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(minor / 100);
}

function productImageUrl(imagePath: string): string {
  return imagePath.startsWith('http')
    ? imagePath
    : `https://images.unsplash.com/${encodeURIComponent(imagePath)}?auto=format&fit=crop&w=120&q=75`;
}

function setNotice(message: string, isError = false): void {
  notice = message;
  noticeIsError = isError;
  noticeIsError = isError;
}

function showNotice(): string {
  return notice ? `<div class="notice${noticeIsError ? ' error' : ''}" role="${noticeIsError ? 'alert' : 'status'}">${escapeHtml(notice)}</div>` : '';
}

function renderLoading(message: string): void {
  root.innerHTML = `<div class="loading">${escapeHtml(message)}</div>`;
}

function renderLogin(message = ''): void {
  root.innerHTML = `
    <main class="login-page">
      <form class="login-card" id="login-form">
        <div class="brand"><div class="brand-icon" aria-hidden="true">✿</div><div><div class="brand-name">MilletBloom</div><div class="brand-caption">Store administration</div></div></div>
        <h1>Admin sign in</h1>
        <p>Use your approved MilletBloom administrator account. Customer accounts cannot access this dashboard.</p>
        ${message ? `<div class="notice error" role="alert">${escapeHtml(message)}</div>` : ''}
        <div class="field"><label for="login-email">Email address</label><input id="login-email" name="email" type="email" autocomplete="username" required /></div>
        <div class="field"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" required /></div>
        <button class="button" type="submit" style="width:100%">Sign in</button>
      </form>
    </main>`;
}

function renderForbidden(): void {
  root.innerHTML = `
    <main class="login-page">
      <section class="login-card">
        <div class="brand"><div class="brand-icon" aria-hidden="true">✿</div><div><div class="brand-name">MilletBloom</div><div class="brand-caption">Store administration</div></div></div>
        <h1>Administrator access required</h1>
        <p>This account does not have the admin role. Contact the project owner if you believe access should be granted.</p>
        <button class="button secondary" type="button" data-action="sign-out">Sign out</button>
      </section>
    </main>`;
}

function tabButton(tab: Tab, label: string): string {
  return `<button class="tab" type="button" role="tab" aria-selected="${activeTab === tab}" data-tab="${tab}">${label}</button>`;
}

function renderDashboard(): void {
  if (!currentUser) return renderLogin();
  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand"><div class="brand-icon" aria-hidden="true">✿</div><div><div class="brand-name">MilletBloom</div><div class="brand-caption">Store administration</div></div></div>
        <div class="top-actions"><span>${escapeHtml(currentUser.email ?? 'Administrator')}</span><button class="button secondary" type="button" data-action="sign-out">Sign out</button></div>
      </header>
      <main class="main">
        <h1 class="page-heading">Store dashboard</h1>
        <p class="page-description">Manage the catalog, offers, food-habit challenges, and order fulfilment.</p>
        <div id="notice-area">${showNotice()}</div>
        <div class="tabs" role="tablist" aria-label="Admin sections">
          ${tabButton('products', 'Products')}
          ${tabButton('campaigns', 'Offers & challenges')}
          ${tabButton('participants', 'Challenge progress')}
          ${tabButton('orders', 'Orders')}
        </div>
        ${activeTab === 'products' ? renderProducts() : ''}
        ${activeTab === 'campaigns' ? renderCampaigns() : ''}
        ${activeTab === 'participants' ? renderParticipants() : ''}
        ${activeTab === 'orders' ? renderOrders() : ''}
      </main>
    </div>`;
}

function renderProducts(): string {
  const rows = products.map((product) => `
    <tr>
      <td><img class="thumbnail" src="${escapeHtml(productImageUrl(product.image_path))}" alt="" onerror="this.style.display='none'" /></td>
      <td><strong>${escapeHtml(product.name)}</strong><br /><span>${escapeHtml(product.slug)}</span></td>
      <td>${formatMoney(product.price_minor, product.currency)}</td>
      <td>${product.stock_quantity}</td>
      <td><span class="status">${product.active ? 'Active' : 'Hidden'}</span></td>
      <td><div class="row-actions"><button class="button secondary" type="button" data-action="edit-product" data-id="${escapeHtml(product.id)}">Edit</button><button class="button danger" type="button" data-action="delete-product" data-id="${escapeHtml(product.id)}">Delete</button></div></td>
    </tr>`).join('');

  return `
    <div class="panel">
      <section class="card">
        <h2 id="product-form-heading">Add a product</h2>
        <form id="product-form">
          <input type="hidden" name="id" />
          <div class="field"><label for="product-name">Product name</label><input id="product-name" name="name" required maxlength="120" /></div>
          <div class="form-grid">
            <div class="field"><label for="product-slug">URL slug</label><input id="product-slug" name="slug" required pattern="[a-z0-9-]+" /></div>
            <div class="field"><label for="product-variety">Variety</label><input id="product-variety" name="variety" maxlength="120" /></div>
            <div class="field"><label for="product-price">Price (INR)</label><input id="product-price" name="price" type="number" min="0" step="0.01" required /></div>
            <div class="field"><label for="product-compare">Compare-at price (INR)</label><input id="product-compare" name="compare" type="number" min="0" step="0.01" /></div>
            <div class="field"><label for="product-stock">Stock quantity</label><input id="product-stock" name="stock" type="number" min="0" step="1" required value="0" /></div>
            <div class="field"><label for="product-tag">Product tag</label><input id="product-tag" name="tag" maxlength="60" /></div>
            <div class="field"><label for="product-tag-color">Tag color</label><input id="product-tag-color" name="tag_color" type="color" value="#E6F2D9" /></div>
            <div class="field"><label for="product-active">Visibility</label><select id="product-active" name="active"><option value="true">Active</option><option value="false">Hidden</option></select></div>
          </div>
          <div class="field"><label for="product-image-path">Image URL or image ID</label><input id="product-image-path" name="image_path" /></div>
          <div class="field"><label for="product-image-file">Upload product image</label><input id="product-image-file" name="image_file" type="file" accept="image/jpeg,image/png,image/webp" /><small>JPG, PNG, or WebP; maximum 5 MB. Uploaded images are public product images.</small></div>
          <div class="field"><label for="product-description">Description</label><textarea id="product-description" name="description"></textarea></div>
          <div class="field"><label for="product-packs">Pack sizes (JSON)</label><textarea id="product-packs" name="pack_sizes" required>[{"label":"500g","price_minor":24900}]</textarea><small>Each pack has a label and its own price in paise.</small></div>
          <div class="field"><label for="product-nutrients">Nutrition values (JSON)</label><textarea id="product-nutrients" name="nutrients">[]</textarea><small>Use objects with label and value properties.</small></div>
          <div class="form-actions"><button class="button" type="submit">Save product</button><button class="button secondary" type="button" data-action="reset-product">Clear</button><button class="button secondary" type="button" data-action="upload-product-image">Upload image</button></div>
        </form>
      </section>
      <section class="card">
        <h2>Catalog (${products.length})</h2>
        <div class="table-wrap">${rows ? `<table><thead><tr><th>Image</th><th>Product</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No products yet.</div>'}</div>
      </section>
    </div>`;
}

function renderCampaigns(): string {
  const rows = campaigns.map((campaign) => `
    <tr>
      <td><strong>${escapeHtml(campaign.title)}</strong><br /><span>${escapeHtml(campaign.slug)}</span></td>
      <td>${campaign.kind === 'challenge' ? 'Challenge' : 'Offer'}</td>
      <td><span class="status">${escapeHtml(campaign.status)}</span></td>
      <td>${campaign.duration_days ?? '—'}${campaign.duration_days ? ' days' : ''}</td>
      <td><div class="row-actions"><button class="button secondary" type="button" data-action="edit-campaign" data-id="${escapeHtml(campaign.id)}">Edit</button><button class="button danger" type="button" data-action="delete-campaign" data-id="${escapeHtml(campaign.id)}">Delete</button></div></td>
    </tr>`).join('');
  const goalOptions = [
    ['', 'No selected focus'],
    ['general-wellness', 'General wellness'],
    ['blood-sugar-aware', 'Blood-sugar-aware'],
    ['digestive-comfort', 'Digestive comfort'],
    ['heart-healthy', 'Heart healthy'],
    ['skin-wellness', 'Skin wellness'],
  ].map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

  return `
    <div class="panel">
      <section class="card">
        <h2 id="campaign-form-heading">Create an offer or challenge</h2>
        <form id="campaign-form">
          <input type="hidden" name="id" />
          <div class="field"><label for="campaign-title">Title</label><input id="campaign-title" name="title" required maxlength="120" /></div>
          <div class="form-grid">
            <div class="field"><label for="campaign-slug">URL slug</label><input id="campaign-slug" name="slug" required pattern="[a-z0-9-]+" /></div>
            <div class="field"><label for="campaign-kind">Type</label><select id="campaign-kind" name="kind"><option value="promotion">Offer</option><option value="challenge">Food-habit challenge</option></select></div>
            <div class="field"><label for="campaign-status">Status</label><select id="campaign-status" name="status"><option value="draft">Draft</option><option value="published">Published</option><option value="paused">Paused</option><option value="ended">Ended</option></select></div>
            <div class="field"><label for="campaign-duration">Duration (days)</label><input id="campaign-duration" name="duration_days" type="number" min="1" max="365" /></div>
            <div class="field"><label for="campaign-starts">Starts</label><input id="campaign-starts" name="starts_at" type="datetime-local" required /></div>
            <div class="field"><label for="campaign-ends">Ends (optional)</label><input id="campaign-ends" name="ends_at" type="datetime-local" /></div>
            <div class="field"><label for="campaign-goal">Wellness focus</label><select id="campaign-goal" name="wellness_goal">${goalOptions}</select></div>
            <div class="field"><label for="campaign-discount">Discount (%)</label><input id="campaign-discount" name="discount_percent" type="number" min="0" max="100" step="0.01" /></div>
          </div>
          <div class="field"><label for="campaign-description">Description</label><textarea id="campaign-description" name="description"></textarea></div>
          <div class="field"><label for="campaign-reward">Reward description</label><input id="campaign-reward" name="reward_description" /></div>
          <div class="field"><label for="campaign-image">Image URL (optional)</label><input id="campaign-image" name="image_url" type="url" /></div>
          <div class="form-actions"><button class="button" type="submit">Save campaign</button><button class="button secondary" type="button" data-action="reset-campaign">Clear</button></div>
        </form>
      </section>
      <section class="card">
        <h2>Offers & challenges (${campaigns.length})</h2>
        <div class="table-wrap">${rows ? `<table><thead><tr><th>Campaign</th><th>Type</th><th>Status</th><th>Length</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No campaigns yet.</div>'}</div>
      </section>
    </div>`;
}

function renderParticipants(): string {
  const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign.title]));
  const rows = participants.map((participant) => {
    const logs = dayLogs.filter((log) => log.participant_id === participant.id);
    const lastCheckIn = logs.map((log) => log.logged_on).sort().at(-1) ?? '—';
    return `<tr><td>${escapeHtml(campaignMap.get(participant.campaign_id) ?? participant.campaign_id)}</td><td><code>${escapeHtml(participant.user_id)}</code></td><td>${new Date(participant.started_at).toLocaleDateString()}</td><td><strong>${logs.length}</strong></td><td>${escapeHtml(lastCheckIn)}</td></tr>`;
  }).join('');
  return `
    <div class="stats">
      <div class="stat"><div class="stat-label">Food-habit challenges</div><div class="stat-value">${campaigns.filter((campaign) => campaign.kind === 'challenge').length}</div></div>
      <div class="stat"><div class="stat-label">Participants</div><div class="stat-value">${participants.length}</div></div>
      <div class="stat"><div class="stat-label">Daily check-ins</div><div class="stat-value">${dayLogs.length}</div></div>
    </div>
    <section class="card">
      <h2>Participant progress</h2>
      <div class="table-wrap">${rows ? `<table><thead><tr><th>Challenge</th><th>Account ID</th><th>Joined</th><th>Check-ins</th><th>Latest check-in</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">There are no challenge participants yet.</div>'}</div>
    </section>`;
}

function renderOrders(): string {
  const rows = orders.map((order) => {
    const items = orderItems.filter((item) => item.order_id === order.id);
    const itemSummary = items.map((item) => `${item.product_name} (${item.quantity})`).join(', ');
    const city = typeof order.shipping_address === 'object' && order.shipping_address !== null && 'city' in order.shipping_address
      ? String(order.shipping_address.city)
      : '';
    const states = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    const options = states.map((status) => `<option value="${status}"${status === order.status ? ' selected' : ''}>${status.replaceAll('_', ' ')}</option>`).join('');
    return `<tr>
      <td><strong>${escapeHtml(order.id.slice(0, 8))}</strong><br /><span>${new Date(order.created_at).toLocaleString()}</span></td>
      <td><code>${escapeHtml(order.user_id)}</code></td>
      <td>${escapeHtml(itemSummary || 'No line items')}${city ? `<br /><span>${escapeHtml(city)}</span>` : ''}</td>
      <td>${formatMoney(order.total_minor, order.currency)}</td>
      <td><select aria-label="Order status" data-order-status="${escapeHtml(order.id)}">${options}</select><button class="button secondary" type="button" data-action="save-order-status" data-id="${escapeHtml(order.id)}">Update</button></td>
    </tr>`;
  }).join('');
  return `<section class="card">
    <h2>Order fulfilment</h2>
    <p class="page-description">The current app does not create live orders or accept payments. Orders appear here only after a secure checkout/payment workflow is implemented.</p>
    <div class="table-wrap">${rows ? `<table><thead><tr><th>Order</th><th>Account ID</th><th>Items / delivery</th><th>Total</th><th>Fulfilment status</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No orders have been created.</div>'}</div>
  </section>`;
}

async function loadDashboardData(): Promise<void> {
  if (!app) throw new Error('Supabase is not configured.');
  const [productResult, campaignResult, participantResult, orderResult] = await Promise.all([
    app.from('products').select('*').order('created_at', { ascending: false }),
    app.from('campaigns').select('*').order('created_at', { ascending: false }),
    app.from('campaign_participants').select('id,campaign_id,user_id,started_at').order('started_at', { ascending: false }),
    app.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  if (productResult.error) throw productResult.error;
  if (campaignResult.error) throw campaignResult.error;
  if (participantResult.error) throw participantResult.error;
  if (orderResult.error) throw orderResult.error;
  products = productResult.data;
  campaigns = campaignResult.data;
  participants = participantResult.data;
  orders = orderResult.data;
  dayLogs = [];
  orderItems = [];
  if (participants.length) {
    const result = await app.from('campaign_day_logs').select('participant_id,logged_on').in('participant_id', participants.map((participant) => participant.id));
    if (result.error) throw result.error;
    dayLogs = result.data;
  }
  if (orders.length) {
    const result = await app.from('order_items').select('*').in('order_id', orders.map((order) => order.id));
    if (result.error) throw result.error;
    orderItems = result.data;
  }
}

async function activateSession(session: Session | null): Promise<void> {
  const requestId = ++authCheckId;
  if (!session || !app) {
    currentUser = null;
    renderLogin();
    return;
  }
  renderLoading('Checking administrator access…');
  const { data: profile, error } = await app
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  if (requestId !== authCheckId) return;
  if (error) {
    currentUser = null;
    renderLogin(error.message);
    return;
  }
  if (profile.role !== 'admin') {
    currentUser = null;
    renderForbidden();
    return;
  }
  currentUser = session.user;
  try {
    await loadDashboardData();
    if (requestId !== authCheckId) return;
    renderDashboard();
  } catch (loadError) {
    if (requestId !== authCheckId) return;
    setNotice(loadError instanceof Error ? loadError.message : 'Unable to load admin data.', true);
    renderDashboard();
  }
}

function formData(form: HTMLFormElement): FormData {
  return new FormData(form);
}

function stringField(data: FormData, name: string): string {
  return String(data.get(name) ?? '').trim();
}

function numberField(data: FormData, name: string, fallback = 0): number {
  const value = stringField(data, name);
  if (value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`The ${name.replaceAll('_', ' ')} value must be a number.`);
  return parsed;
}

function parsedJson<T extends Json>(value: string, fieldName: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${fieldName} must contain valid JSON.`);
  }
}

function productFromForm(data: FormData): ProductFormValue {
  const price = numberField(data, 'price');
  const comparePrice = numberField(data, 'compare', Number.NaN);
  const priceMinor = Math.round(price * 100);
  const compareAtPrice = Number.isNaN(comparePrice) ? null : Math.round(comparePrice * 100);
  if (compareAtPrice !== null && compareAtPrice < priceMinor) {
    throw new Error('Compare-at price must be equal to or greater than the current price.');
  }
  const packSizes = parsedJson<Json>(stringField(data, 'pack_sizes'), 'Pack sizes');
  const nutrients = parsedJson<Json>(stringField(data, 'nutrients') || '[]', 'Nutrition values');
  if (!Array.isArray(packSizes) || packSizes.length === 0) throw new Error('Add at least one pack size.');
  if (!Array.isArray(nutrients)) throw new Error('Nutrition values must be a JSON array.');
  const imagePath = stringField(data, 'image_path');
  return {
    slug: stringField(data, 'slug'),
    name: stringField(data, 'name'),
    variety: stringField(data, 'variety'),
    description: stringField(data, 'description'),
    image_path: imagePath,
    price_minor: priceMinor,
    compare_at_price_minor: compareAtPrice,
    currency: 'INR',
    pack_sizes: packSizes,
    nutrients,
    tag: stringField(data, 'tag'),
    tag_color: stringField(data, 'tag_color') || '#E6F2D9',
    rating: 0,
    review_count: 0,
    active: stringField(data, 'active') === 'true',
    stock_quantity: Math.floor(numberField(data, 'stock')),
  };
}

function campaignFromForm(data: FormData): CampaignFormValue {
  const kind = stringField(data, 'kind');
  const durationValue = stringField(data, 'duration_days');
  const endValue = stringField(data, 'ends_at');
  const discountValue = stringField(data, 'discount_percent');
  const duration = durationValue ? Math.floor(Number(durationValue)) : null;
  if (kind === 'challenge' && (!duration || duration < 1 || duration > 365)) {
    throw new Error('Challenges need a duration from 1 to 365 days.');
  }
  if (kind === 'promotion' && duration !== null) {
    throw new Error('Only food-habit challenges have a duration.');
  }
  const startDate = new Date(stringField(data, 'starts_at'));
  if (Number.isNaN(startDate.getTime())) throw new Error('Choose a valid campaign start time.');
  const endDate = endValue ? new Date(endValue) : null;
  if (endDate && (Number.isNaN(endDate.getTime()) || endDate <= startDate)) {
    throw new Error('Campaign end time must be later than its start time.');
  }
  return {
    slug: stringField(data, 'slug'),
    kind: kind as CampaignRow['kind'],
    title: stringField(data, 'title'),
    description: stringField(data, 'description'),
    image_url: stringField(data, 'image_url'),
    status: stringField(data, 'status') as CampaignRow['status'],
    starts_at: startDate.toISOString(),
    ends_at: endDate?.toISOString() ?? null,
    duration_days: duration,
    wellness_goal: stringField(data, 'wellness_goal') || null,
    reward_description: stringField(data, 'reward_description'),
    discount_percent: discountValue ? Number(discountValue) : null,
  };
}

function getForm(id: string): HTMLFormElement {
  const form = document.getElementById(id);
  if (!(form instanceof HTMLFormElement)) throw new Error(`Form ${id} was not found.`);
  return form;
}

function setFormValues(form: HTMLFormElement, values: Record<string, unknown>): void {
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) continue;
    if (field.type === 'checkbox') (field as HTMLInputElement).checked = Boolean(value);
    else field.value = value === null || value === undefined ? '' : String(value);
  }
}

function localDateTime(iso: string): string {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function editProduct(id: string): void {
  const product = products.find((entry) => entry.id === id);
  if (!product) return;
  setFormValues(getForm('product-form'), {
    ...product,
    price: (product.price_minor / 100).toFixed(2),
    compare: product.compare_at_price_minor === null ? '' : (product.compare_at_price_minor / 100).toFixed(2),
    stock: product.stock_quantity,
    pack_sizes: JSON.stringify(product.pack_sizes, null, 2),
    nutrients: JSON.stringify(product.nutrients, null, 2),
    active: String(product.active),
  });
  const heading = document.getElementById('product-form-heading');
  if (heading) heading.textContent = 'Edit product';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editCampaign(id: string): void {
  const campaign = campaigns.find((entry) => entry.id === id);
  if (!campaign) return;
  setFormValues(getForm('campaign-form'), {
    ...campaign,
    starts_at: localDateTime(campaign.starts_at),
    ends_at: campaign.ends_at ? localDateTime(campaign.ends_at) : '',
    duration_days: campaign.duration_days ?? '',
    discount_percent: campaign.discount_percent ?? '',
    wellness_goal: campaign.wellness_goal ?? '',
  });
  const heading = document.getElementById('campaign-form-heading');
  if (heading) heading.textContent = 'Edit offer or challenge';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveProduct(form: HTMLFormElement): Promise<void> {
  if (!app) return;
  const data = formData(form);
  const id = stringField(data, 'id');
  const product = productFromForm(data);
  const result = id
    ? await app.from('products').update(product).eq('id', id)
    : await app.from('products').insert(product);
  if (result.error) throw result.error;
  setNotice(id ? 'Product updated.' : 'Product added.');
  await loadDashboardData();
  renderDashboard();
}

async function saveCampaign(form: HTMLFormElement): Promise<void> {
  if (!app || !currentUser) return;
  const data = formData(form);
  const id = stringField(data, 'id');
  const campaign = campaignFromForm(data);
  const result = id
    ? await app.from('campaigns').update(campaign).eq('id', id)
    : await app.from('campaigns').insert({ ...campaign, created_by: currentUser.id });
  if (result.error) throw result.error;
  setNotice(id ? 'Campaign updated.' : 'Campaign created.');
  await loadDashboardData();
  renderDashboard();
}

async function uploadProductImage(): Promise<void> {
  if (!app) return;
  const fileInput = document.getElementById('product-image-file');
  if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
    throw new Error('Choose an image file first.');
  }
  const file = fileInput.files[0];
  if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  const extension = file.name.split('.').at(-1)?.toLowerCase() ?? 'jpg';
  const objectPath = `${crypto.randomUUID()}.${extension}`;
  const { error } = await app.storage.from('product-images').upload(objectPath, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const { data } = app.storage.from('product-images').getPublicUrl(objectPath);
  const input = document.getElementById('product-image-path');
  if (input instanceof HTMLInputElement) input.value = data.publicUrl;
  setNotice('Image uploaded. Save the product to publish its image.');
  const noticeArea = document.getElementById('notice-area');
  if (noticeArea) noticeArea.innerHTML = showNotice();
}

async function removeRecord(table: 'products' | 'campaigns', id: string): Promise<void> {
  if (!app) return;
  if (!window.confirm('Delete this record? This action cannot be undone.')) return;
  const result = await app.from(table).delete().eq('id', id);
  if (result.error) throw result.error;
  setNotice(table === 'products' ? 'Product deleted.' : 'Campaign deleted.');
  await loadDashboardData();
  renderDashboard();
}

async function updateOrderStatus(id: string): Promise<void> {
  if (!app) return;
  const select = document.querySelector<HTMLSelectElement>(`[data-order-status="${CSS.escape(id)}"]`);
  if (!select) throw new Error('Order status control was not found.');
  const status = select.value as OrderRow['status'];
  const { error } = await app.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
  setNotice('Order fulfilment status updated.');
  await loadDashboardData();
  renderDashboard();
}

async function withBusy(action: () => Promise<void>): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await action();
  } catch (error) {
    setNotice(error instanceof Error ? error.message : 'The requested action could not be completed.', true);
    if (currentUser) renderDashboard();
    else renderLogin(notice);
  } finally {
    busy = false;
  }
}

root.addEventListener('submit', (event) => {
  if (!(event.target instanceof HTMLFormElement)) return;
  event.preventDefault();
  const form = event.target;
  void withBusy(async () => {
    if (!app) throw new Error('Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the root .env file.');
    if (form.id === 'login-form') {
      const data = formData(form);
      const { error } = await app.auth.signInWithPassword({
        email: stringField(data, 'email').toLowerCase(),
        password: stringField(data, 'password'),
      });
      if (error) throw error;
      return;
    }
    if (form.id === 'product-form') return saveProduct(form);
    if (form.id === 'campaign-form') return saveCampaign(form);
  });
});

root.addEventListener('click', (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.tab) {
    activeTab = button.dataset.tab as Tab;
    notice = '';
    renderDashboard();
    return;
  }
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === 'sign-out') {
    void withBusy(async () => {
      if (!app) return;
      const { error } = await app.auth.signOut();
      if (error) throw error;
      currentUser = null;
      renderLogin();
    });
  } else if (action === 'edit-product' && id) {
    editProduct(id);
  } else if (action === 'edit-campaign' && id) {
    editCampaign(id);
  } else if (action === 'delete-product' && id) {
    void withBusy(() => removeRecord('products', id));
  } else if (action === 'delete-campaign' && id) {
    void withBusy(() => removeRecord('campaigns', id));
  } else if (action === 'reset-product') {
    renderDashboard();
  } else if (action === 'reset-campaign') {
    renderDashboard();
  } else if (action === 'upload-product-image') {
    void withBusy(uploadProductImage);
  } else if (action === 'save-order-status' && id) {
    void withBusy(() => updateOrderStatus(id));
  }
});

if (!app) {
  renderLogin('Admin dashboard setup is incomplete. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the root .env file.');
} else {
  renderLoading('Connecting to Supabase…');
  app.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') return;
    window.setTimeout(() => {
      void activateSession(session).catch((error: unknown) => {
        setNotice(error instanceof Error ? error.message : 'Could not verify admin access.', true);
        renderLogin(notice);
      });
    }, 0);
  });
}
