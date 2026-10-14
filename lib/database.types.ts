export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  full_name: string;
  role: 'customer' | 'admin';
  wellness_goals: string[];
  wellness_consent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  variety: string;
  description: string;
  image_path: string;
  price_minor: number;
  compare_at_price_minor: number | null;
  currency: string;
  pack_sizes: Json;
  nutrients: Json;
  tag: string;
  tag_color: string;
  rating: number;
  review_count: number;
  active: boolean;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
};

export type CampaignRow = {
  id: string;
  slug: string;
  kind: 'promotion' | 'challenge';
  title: string;
  description: string;
  image_url: string;
  status: 'draft' | 'published' | 'paused' | 'ended';
  starts_at: string;
  ends_at: string | null;
  duration_days: number | null;
  wellness_goal: string | null;
  reward_description: string;
  discount_percent: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRow = {
  id: string;
  user_id: string;
  status: 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment_provider: string;
  payment_reference: string | null;
  currency: string;
  subtotal_minor: number;
  shipping_minor: number;
  total_minor: number;
  shipping_address: Json;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  size_label: string;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Pick<ProfileRow, 'id'> & Partial<Pick<ProfileRow, 'full_name'>>,
        Partial<Pick<ProfileRow, 'full_name' | 'wellness_goals' | 'wellness_consent_at'>>
      >;
      products: Table<ProductRow, Omit<ProductRow, 'id' | 'created_at' | 'updated_at'>>;
      campaigns: Table<
        CampaignRow,
        Omit<CampaignRow, 'id' | 'created_at' | 'updated_at'>,
        Partial<Omit<CampaignRow, 'id' | 'created_at' | 'updated_at'>>
      >;
      campaign_participants: Table<
        { id: string; campaign_id: string; user_id: string; started_at: string },
        { campaign_id: string; user_id: string },
        never
      >;
      campaign_day_logs: Table<
        { id: string; participant_id: string; logged_on: string; created_at: string },
        { participant_id: string; logged_on?: string },
        never
      >;
      favorites: Table<
        { user_id: string; product_id: string; created_at: string },
        { user_id: string; product_id: string },
        never
      >;
      cart_items: Table<
        { user_id: string; product_id: string; size_label: string; quantity: number; updated_at: string },
        { user_id: string; product_id: string; size_label: string; quantity: number },
        { quantity: number; updated_at?: string }
      >;
      orders: Table<OrderRow, never, Pick<OrderRow, 'status'>>;
      order_items: Table<OrderItemRow, never, never>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      sync_my_cart: { Args: { p_items: Json }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
