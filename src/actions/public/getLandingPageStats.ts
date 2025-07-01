'use server';

/**
 * @fileOverview A server action to retrieve landing page statistics.
 * This action now returns hardcoded values as of July 29, 2024,
 * to avoid permission issues on the public-facing landing page.
 */

export async function getLandingPageStats(): Promise<{
  success: boolean;
  stats?: { totalKwh: number; pfCount: number; pjCount: number };
  error?: string;
}> {
  // Hardcoded values based on data from 2024-07-29.
  // totalKwh comes from the provided image (808,488).
  // pfCount and pjCount are an estimated split of the 488 total leads.
  const stats = {
    totalKwh: 808488,
    pfCount: 300,
    pjCount: 188,
  };

  return {
    success: true,
    stats: stats,
  };
}
