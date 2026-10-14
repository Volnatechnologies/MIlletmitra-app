import type { CampaignRow } from './database.types';

export type Campaign = CampaignRow & {
  participantId: string | null;
  completedDays: number;
  checkedInToday: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  variety: string;
  price: number;
  oldPrice: number;
  rating: string;
  reviews: string;
  tag: string;
  tagColor: string;
  image: string;
  description: string;
  sizes: { label: string; price: number }[];
  nutrients: { label: string; value: string }[];
};
