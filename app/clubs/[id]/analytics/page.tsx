'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import MwMavericksAnalyticsView from '@/components/MwMavericksAnalyticsView';
import { ArrowLeft, BarChart2 } from 'lucide-react';

export default function ClubAnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubName, setClubName] = useState('Monday-Wednesday Club');

  const [clubPlayers, setClubPlayers] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Fetch club details
        const { data: club } = await supabase.from('clubs').select('*').eq('id', id).single();
        if (club) setClubName(club.name);

        // Fetch club players roster dynamically
        const { data: playersList } = await supabase.from('players').select('name').eq('club_id', id);
        if (playersList) {
          setClubPlayers(playersList.map(p => p.name));
        }

        // Fetch sessions for this club
        const { data: sessions } = await supabase.from('sessions').select('*').eq('club_id', id);
        let sessionIds = (sessions || []).map(s => s.id);

        if (id === 'd5b57890-3787-41bb-bf23-38bc95345011') {
          // Strictly load the official August 12, 2026 Tournament & Exhibition session
          sessionIds = ['mw_mavericks_season_2_2026', '1u03ob'];
        } else if (id === 'a99a150f-7bb8-4b4a-ab86-90f945dcbf36') {
          sessionIds = [...sessionIds, 'pb_sunday_2026', '57gs7a', '200tao'];
        } else if (id === 'fccd4a42-f3c7-4d93-9493-1e91828e66e2') {
          sessionIds = [...sessionIds, 'hot101', 'ea864a', 'hotshot_session_thursday'];
        } else if (id === '7465914e-261c-4ee5-b6d8-b9fe69eb4e25') {
          sessionIds = [...sessionIds, 'kot56f'];
        }

        if (sessionIds.length === 0) {
          setRounds([]);
        } else {
          const { data: dbRounds } = await supabase
            .from('rounds')
            .select('*')
            .in('session_id', Array.from(new Set(sessionIds)))
            .order('round_number', { ascending: true })
            .order('court', { ascending: true });

          setRounds(dbRounds || []);
        }
      } catch (err) {
        console.error('Error loading club analytics rounds:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  const mwRoster = [
    '12', 'AMBRESH', 'Amresh', 'AMIT', 'ANISH', 'ANKIT', 'CHIRAG', 'DD', 'GAURAV', 'GOPAL', 'HARSH', 'HEMAL',
    'HITEN', 'KARAN', 'KETAN', 'MBS', 'MRUGESH', 'NEEL', 'RAHIL', 'SAGAR', 'SAURABH', 'SMIT', 'TEJAS', 'TEJASH', 'TUSHAR', 'VICKY'
  ];

  const activeRoster = id === 'd5b57890-3787-41bb-bf23-38bc95345011' ? mwRoster : clubPlayers;

  return (
    <main className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <Link href={`/clubs/${id}`} className="text-link-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back to {clubName}
        </Link>
      </div>

      <div style={{ background: '#0f172a', color: '#ffffff', borderRadius: 20, padding: 24, marginBottom: 24, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#e5fa00', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={26} />
          </div>
          <div>
            <span style={{ fontSize: 11, fontWeight: 900, color: '#e5fa00', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              OFFICIAL CLUB ANALYTICS HUB
            </span>
            <h1 style={{ margin: '2px 0 0', fontSize: 26, fontWeight: 900 }}>{clubName} — Official Tournament Analytics</h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94a3b8', fontWeight: 600 }}>
              {id === 'd5b57890-3787-41bb-bf23-38bc95345011' 
                ? 'Displaying all 63 scored rounds from the August 12, 2026 Tournament: MW Mavericks vs SVKM Challengers'
                : `Displaying stats and analytics records compiled across all ${rounds.length} matches played in this club.`}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', fontWeight: 800, color: '#64748b' }}>
          ⚡ Loading August 12th Tournament Data & Player Analytics...
        </div>
      ) : (
        <MwMavericksAnalyticsView
          rounds={rounds}
          mwPlayers={activeRoster}
          svkmPlayers={[]}
          mwScore={35}
          svkmScore={28}
          clubId={id}
        />
      )}
    </main>
  );
}
