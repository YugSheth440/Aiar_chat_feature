import { db } from './client';
import { hazardTaxonomy } from './schema';

export interface HazardTaxonomyRow {
  id: number;
  label: string;
  category: string | null;
  description: string | null;
  icon: string | null;
  default_guidance: string | null;
}

export const fetchLocalTaxonomy = async (): Promise<HazardTaxonomyRow[]> => {
  return await db.select().from(hazardTaxonomy);
};

export const syncTaxonomyData = async (remoteData: HazardTaxonomyRow[]) => {
  try {
    // In a real app, this might use upserts, but for now we'll do a simple clear-and-fill strategy
    await db.delete(hazardTaxonomy);
    if (remoteData.length > 0) {
      await db.insert(hazardTaxonomy).values(remoteData);
    }
  } catch (error) {
    console.error("Failed to sync offline taxonomy", error);
  }
};
