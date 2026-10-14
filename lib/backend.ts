import type { User } from '@supabase/supabase-js';
import type { AuthProfile, WellnessGoal } from '../AuthFlow';
import type { CampaignRow, Json, ProductRow, ProfileRow } from './database.types';
import { supabase } from './supabase';
import type { Campaign, Product } from './backend.types';

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. Follow the backend setup in README.md.');
  return supabase;
}

function jsonArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) throw new Error('The backend returned invalid product data.');
  return value as T[];
}

export async function loadProfile(user: User): Promise<AuthProfile> {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id, full_name, role, wellness_goals, wellness_consent_at, created_at, updated_at')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  return profileFromRow(data, user.email ?? '');
}

export function profileFromRow(row: ProfileRow, email: string): AuthProfile {
  return {
    id: row.id,
    name: row.full_name,
    email,
    role: row.role,
    goals: row.wellness_goals as WellnessGoal[],
    hasWellnessConsent: row.wellness_consent_at !== null,
  };
}

export async function saveWellnessGoals(goals: WellnessGoal[]): Promise<void> {
  const client = requireClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Please sign in to save your wellness preferences.');
  const { error } = await client
    .from('profiles')
    .update({
      wellness_goals: goals,
      wellness_consent_at: goals.length ? new Date().toISOString() : null,
    })
    .eq('id', user.id);
  if (error) throw error;
}

export async function loadProducts(): Promise<Product[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('products')
    .select('id, slug, name, variety, description, image_path, price_minor, compare_at_price_minor, currency, pack_sizes, nutrients, tag, tag_color, rating, review_count, active, stock_quantity, created_at, updated_at')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return (data as ProductRow[]).map((row) => {
    const sizes = jsonArray<{ label: string; price_minor: number }>(row.pack_sizes);
    const nutrients = jsonArray<{ label: string; value: string }>(row.nutrients);
    if (sizes.length === 0) throw new Error(`Product "${row.name}" has no pack sizes configured.`);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      variety: row.variety,
      price: row.price_minor / 100,
      oldPrice: row.compare_at_price_minor === null ? row.price_minor / 100 : row.compare_at_price_minor / 100,
      rating: row.rating.toFixed(1),
      reviews: String(row.review_count),
      tag: row.tag,
      tagColor: row.tag_color,
      image: row.image_path,
      description: row.description,
      sizes: sizes.map((size) => ({ label: size.label, price: size.price_minor / 100 })),
      nutrients,
    };
  });
}

export async function loadCampaigns(): Promise<Campaign[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('campaigns')
    .select('id, slug, kind, title, description, image_url, status, starts_at, ends_at, duration_days, wellness_goal, reward_description, discount_percent, created_by, created_at, updated_at')
    .eq('status', 'published')
    .order('starts_at');
  if (error) throw error;
  return (data as CampaignRow[]).map((row) => ({
    ...row,
    participantId: null,
    completedDays: 0,
    checkedInToday: false,
  }));
}

export async function loadCampaignProgress(campaigns: Campaign[]): Promise<Campaign[]> {
  if (!campaigns.length) return campaigns;
  const client = requireClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Please sign in to load challenge progress.');

  const campaignIds = campaigns.filter((campaign) => campaign.kind === 'challenge').map((campaign) => campaign.id);
  if (!campaignIds.length) return campaigns;
  const { data: participants, error: participantsError } = await client
    .from('campaign_participants')
    .select('id, campaign_id')
    .eq('user_id', user.id)
    .in('campaign_id', campaignIds);
  if (participantsError) throw participantsError;

  const participantIds = participants.map((participant) => participant.id);
  if (!participantIds.length) return campaigns;
  const { data: logs, error: logsError } = await client
    .from('campaign_day_logs')
    .select('participant_id, logged_on')
    .in('participant_id', participantIds);
  if (logsError) throw logsError;

  const today = new Date().toISOString().slice(0, 10);
  return campaigns.map((campaign) => {
    const participant = participants.find((item) => item.campaign_id === campaign.id);
    if (!participant) return campaign;
    const participantLogs = logs.filter((log) => log.participant_id === participant.id);
    return {
      ...campaign,
      participantId: participant.id,
      completedDays: participantLogs.length,
      checkedInToday: participantLogs.some((log) => log.logged_on === today),
    };
  });
}

export async function joinCampaign(campaignId: string): Promise<void> {
  const client = requireClient();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Please sign in to join a challenge.');
  const { error } = await client
    .from('campaign_participants')
    .insert({ campaign_id: campaignId, user_id: user.id });
  if (error) throw error;
}

export async function checkInToCampaign(participantId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('campaign_day_logs')
    .insert({ participant_id: participantId });
  if (error) throw error;
}

export async function leaveCampaign(participantId: string): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('campaign_participants')
    .delete()
    .eq('id', participantId);
  if (error) throw error;
}

export async function loadFavorites(userId: string): Promise<Set<string>> {
  const client = requireClient();
  const { data, error } = await client.from('favorites').select('product_id').eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((item) => item.product_id));
}

export async function saveFavorite(userId: string, productId: string, saved: boolean): Promise<void> {
  const client = requireClient();
  if (saved) {
    const { error } = await client.from('favorites').upsert(
      { user_id: userId, product_id: productId },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
    if (error) throw error;
    return;
  }
  const { error } = await client.from('favorites').delete().eq('user_id', userId).eq('product_id', productId);
  if (error) throw error;
}

export async function loadCart(userId: string, products: Product[]): Promise<Record<string, { product: Product; size: string; price: number; quantity: number }>> {
  const client = requireClient();
  const { data, error } = await client
    .from('cart_items')
    .select('product_id, size_label, quantity')
    .eq('user_id', userId);
  if (error) throw error;
  const result: Record<string, { product: Product; size: string; price: number; quantity: number }> = {};
  for (const item of data) {
    const product = products.find((entry) => entry.id === item.product_id);
    if (!product) continue;
    const size = product.sizes.find((entry) => entry.label === item.size_label);
    if (!size) continue;
    result[`${product.id}-${size.label}`] = { product, size: size.label, price: size.price, quantity: item.quantity };
  }
  return result;
}

export async function replaceCart(userId: string, products: Product[], cart: Record<string, { product: Product; size: string; price: number; quantity: number }>): Promise<void> {
  const client = requireClient();
  const productIds = new Set(products.map((product) => product.id));
  const items: Json[] = Object.values(cart)
    .filter((line) => productIds.has(line.product.id))
    .map((line) => ({
      product_id: line.product.id,
      size_label: line.size,
      quantity: line.quantity,
    }));
  const { error } = await client.rpc('sync_my_cart', { p_items: items });
  if (error) throw error;
}
