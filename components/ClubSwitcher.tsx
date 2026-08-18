'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCurrentClub } from '@/lib/useCurrentClub';
import ClubSwitchModal from './ClubSwitchModal';
import { supabase } from '@/lib/supabase';
import { Building2, ChevronDown } from 'lucide-react';

export default function ClubSwitcher() {
  const pathname = usePathname();
  const { currentClub, loading } = useCurrentClub();
  const [modalOpen, setModalOpen] = useState(false);
  const [routeClubName, setRouteClubName] = useState<string | null>(null);

  // Extract club ID from URL if present (e.g. /clubs/[id] or /clubs/[id]/analytics)
  const clubIdMatch = pathname ? pathname.match(/^\/clubs\/([a-zA-Z0-9-]+)/) : null;
  const routeClubId = clubIdMatch ? clubIdMatch[1] : null;

  useEffect(() => {
    if (!routeClubId) {
      setRouteClubName(null);
      return;
    }
    
    // Fetch club name dynamically from DB for the route to guarantee correct header info
    async function fetchRouteClub() {
      try {
        const { data } = await supabase
          .from('clubs')
          .select('name')
          .eq('id', routeClubId)
          .single();
        if (data) {
          setRouteClubName(data.name);
        }
      } catch (err) {
        console.error('Error fetching route club info:', err);
      }
    }
    fetchRouteClub();
  }, [routeClubId]);

  if (loading) return null;

  // Decide what club title to display at the top
  const activeTitle = routeClubName || (currentClub ? currentClub.name : 'Guest Play Mode');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px 4px' }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: -0.5,
            color: 'var(--foreground, #0f172a)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {activeTitle}
        </div>
      </div>

      <ClubSwitchModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
