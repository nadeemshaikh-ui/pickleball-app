import type { Format } from './db';

export function formatLabel(format: Format): string {
  switch (format) {
    case 'scramble':
      return 'Scramble';
    case 'squad_rivalry':
      return 'Squad Rivalry';
    case 'court_blocks':
      return 'Court Swap';
    case 'fixed_partners':
      return 'Fixed Partners';
    case 'king_of_court':
      return 'King of the Court';
    case 'team_championship':
      return 'Team Championship';
  }
}
