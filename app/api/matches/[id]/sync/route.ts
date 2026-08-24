import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { data: match, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !match) {
      return new NextResponse('Match not found', { status: 404 });
    }

    const start = new Date(match.scheduled_time);
    const end = new Date(start.getTime() + 60 * 90 * 1000); // Default: 90 mins duration

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const summary = `${match.format.toUpperCase()} Match @ ${match.venue_details?.name || 'Pickleball'}`;
    const description = `DUPR Range: ${match.dupr_min || 'Any'} - ${match.dupr_max || 'Any'}. Cost Policy: ${match.cost_split_policy}. Total Court Cost: INR ${match.total_cost}`;
    const location = `${match.venue_details?.name || ''}, Court: ${match.venue_details?.court_number || ''}`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Antigravity//Pickleball App//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${match.id}`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="match_${match.id}.ics"`,
      },
    });
  } catch (err: any) {
    return new NextResponse(err.message || 'Internal Server Error', { status: 500 });
  }
}
