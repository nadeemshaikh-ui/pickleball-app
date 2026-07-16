import { describe, it, expect } from 'vitest';
import { BADGE_CATALOG } from './badges';
import { SECTIONS } from './badgeGallerySections';

describe('Badge Gallery SECTIONS', () => {
  it('covers every badge in BADGE_CATALOG — a badge earnable but missing from every section never displays anywhere', () => {
    // Real regression this session: giant_slayer/regulars_regular were
    // added to BADGE_CATALOG but never wired into a SECTIONS group, so
    // earning them would show up nowhere in the gallery.
    const sectioned = new Set(SECTIONS.flatMap(s => s.ids));
    const missing = BADGE_CATALOG.filter(b => !sectioned.has(b.id));
    expect(missing.map(b => b.id)).toEqual([]);
  });

  it('has no duplicate badge ids across sections', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const id of SECTIONS.flatMap(s => s.ids)) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    expect(duplicates).toEqual([]);
  });

  it('includes the Crowns, Dedication & Calendar, and Trajectory sections', () => {
    // The three sections the E2E suite never exercised — this at least
    // proves their content stays valid; the Playwright spec (badge-unlock)
    // now separately confirms they render on the live gallery page.
    const titles = SECTIONS.map(s => s.title);
    expect(titles).toContain('Crowns');
    expect(titles).toContain('Dedication & Calendar');
    expect(titles).toContain('Trajectory');
  });
});
