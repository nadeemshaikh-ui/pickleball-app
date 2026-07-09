// Reuse a group's logos across sessions without re-uploading every time.
// Upload once via Setup, grab the public URL Supabase gives back (visible in
// the browser network tab, or in the Storage dashboard under the
// "group-logos" bucket), then paste it in here keyed by the exact group
// name you'll type at Setup. Matching is case-insensitive.
export const PRESET_GROUP_LOGOS: Record<string, { logo1: string | null; logo2: string | null }> = {
  // 'Sunday Smashers': {
  //   logo1: 'https://ltbnjtgzpwxulbczmzdr.supabase.co/storage/v1/object/public/group-logos/abc123.png',
  //   logo2: 'https://ltbnjtgzpwxulbczmzdr.supabase.co/storage/v1/object/public/group-logos/def456.png',
  // },
};

export function findPresetLogos(groupName: string): { logo1: string | null; logo2: string | null } | null {
  const trimmed = groupName.trim().toLowerCase();
  if (!trimmed) return null;
  const key = Object.keys(PRESET_GROUP_LOGOS).find(k => k.toLowerCase() === trimmed);
  return key ? PRESET_GROUP_LOGOS[key] : null;
}
