'use client';

import { useMemo } from 'react';
import { Users, Layers, Swords, Award, Zap } from 'lucide-react';
import type { StageType, StageConfig, TournamentStageRow } from '@/lib/tournamentStages';
import type { TournamentTeamRow } from '@/lib/tournamentTeams';
import { generateLeagueFixtures, generateGroupFixtures } from '@/lib/tournamentFixtures';
import { assignTeamsToGroups } from '@/lib/tournamentRoundRobin';
import { computeBracketSize } from '@/lib/tournamentBracket';

const FORMAT_CARDS: { type: StageType; label: string; description: string; icon: typeof Users }[] = [
  { type: 'league', label: 'League', description: 'Round robin — every team plays every other team once.', icon: Users },
  { type: 'group', label: 'Groups', description: 'Split into groups, round robin within each, then advance top teams.', icon: Layers },
  { type: 'knockout', label: 'Knockout', description: 'Single-elimination bracket — lose once, you’re out.', icon: Swords },
  { type: 'page_playoff', label: 'Page Playoff', description: 'Top-4 format that gives 1st/2nd a second chance at the final.', icon: Award },
  { type: 'simple_semifinal', label: 'Simple Semifinal', description: 'Top-4 straight semis into a final.', icon: Zap },
];

function Stepper({ value, onChange, min = 1, label }: { value: number; onChange: (n: number) => void; min?: number; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      {label}
      <span style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8 }}>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          style={{ minWidth: 32, minHeight: 32 }}
        >
          −
        </button>
        <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{value}</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label}`}
          style={{ minWidth: 32, minHeight: 32 }}
        >
          +
        </button>
      </span>
    </label>
  );
}

interface StageWizardProps {
  teams: TournamentTeamRow[];
  stages: TournamentStageRow[];
  stageName: string;
  onStageNameChange: (name: string) => void;
  stageType: StageType;
  onStageTypeChange: (type: StageType) => void;
  groupCount: number;
  onGroupCountChange: (n: number) => void;
  doubleHeader: boolean;
  onDoubleHeaderChange: (v: boolean) => void;
  advanceMode: 'per_group' | 'combined';
  onAdvanceModeChange: (mode: 'per_group' | 'combined') => void;
  advancePerGroup: number;
  onAdvancePerGroupChange: (n: number) => void;
  advanceCount: number;
  onAdvanceCountChange: (n: number) => void;
  busy: boolean;
  onGenerate: () => void;
}

// Pool size feeding this stage: exact for stage 1 (every tournament team),
// approximate for stage 2+ since the prior stage's advancing team IDs are
// only known once its results are frozen — surfaced as a caveat in the
// preview text rather than silently assumed exact.
function poolInfo(teams: TournamentTeamRow[], stages: TournamentStageRow[]) {
  if (stages.length === 0) return { size: teams.length, approximate: false };
  const last = stages[stages.length - 1];
  if (last.stage_type === 'league' || last.stage_type === 'group') {
    if (last.config.advanceMode === 'combined' && last.config.advanceCount) {
      return { size: last.config.advanceCount, approximate: true };
    }
    if (last.config.advancePerGroup && last.config.groupCount) {
      return { size: last.config.advancePerGroup * last.config.groupCount, approximate: true };
    }
  }
  return { size: teams.length, approximate: true };
}

export function StageWizard(props: StageWizardProps) {
  const {
    teams, stages, stageName, onStageNameChange, stageType, onStageTypeChange,
    groupCount, onGroupCountChange, doubleHeader, onDoubleHeaderChange,
    advanceMode, onAdvanceModeChange, advancePerGroup, onAdvancePerGroupChange,
    advanceCount, onAdvanceCountChange, busy, onGenerate,
  } = props;

  const { size: poolSize, approximate } = poolInfo(teams, stages);

  const previewText = useMemo(() => {
    if (poolSize < 2) return 'Not enough teams yet to preview this stage.';
    const fakeIds = Array.from({ length: poolSize }, (_, i) => `preview-${i}`);
    const fakeTeams = fakeIds.map(id => ({ id }));

    try {
      switch (stageType) {
        case 'league': {
          const fixtures = generateLeagueFixtures(fakeIds, { doubleHeader });
          return `${poolSize} teams · ${fixtures.length} match${fixtures.length === 1 ? '' : 'es'} · everyone plays everyone${doubleHeader ? ' twice' : ' once'}.`;
        }
        case 'group': {
          if (groupCount > poolSize) return `Need at least ${groupCount} teams for ${groupCount} groups — only ${poolSize} in the pool.`;
          const groups = assignTeamsToGroups(fakeTeams, groupCount);
          const sizes = Object.values(groups).map(g => g.length);
          const fixtures = generateGroupFixtures(fakeTeams, { groupCount, doubleHeader });
          const advanceText = advanceMode === 'combined'
            ? `flat top ${advanceCount} across all groups advance`
            : `top ${advancePerGroup} from each group advance (${advancePerGroup * groupCount} total)`;
          return `${poolSize} teams → ${groupCount} groups (${sizes.join('/')} teams each) · ${fixtures.length} matches · ${advanceText}.`;
        }
        case 'knockout': {
          const bracketSize = computeBracketSize(poolSize);
          const byes = bracketSize - poolSize;
          const rounds = Math.log2(bracketSize);
          return `${poolSize} teams → bracket of ${bracketSize}${byes > 0 ? ` (${byes} bye${byes === 1 ? '' : 's'} to top seed${byes === 1 ? '' : 's'})` : ''} · ${rounds} round${rounds === 1 ? '' : 's'} to a champion.`;
        }
        case 'page_playoff':
          if (poolSize !== 4) return `Needs exactly 4 teams in the pool — currently ${poolSize}. Cut down to 4 with a prior stage first.`;
          return 'Top 4 seeded teams · 4 matches · 1st/2nd get a second life before the final.';
        case 'simple_semifinal':
          if (poolSize !== 4) return `Needs exactly 4 teams in the pool — currently ${poolSize}. Cut down to 4 with a prior stage first.`;
          return 'Top 4 seeded teams · 4 matches · straight semis into a final.';
        default:
          return '';
      }
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not compute a preview for this configuration.';
    }
  }, [poolSize, stageType, groupCount, doubleHeader, advanceMode, advancePerGroup, advanceCount]);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 700 }}>Generate Next Stage</div>

      <input
        type="text"
        placeholder="Stage name (e.g. 'Group Stage', 'Semifinals')"
        value={stageName}
        onChange={e => onStageNameChange(e.target.value)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {FORMAT_CARDS.map(({ type, label, description, icon: Icon }) => {
          const selected = stageType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onStageTypeChange(type)}
              aria-pressed={selected}
              style={{
                display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left',
                padding: 10, borderRadius: 10, cursor: 'pointer',
                border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: selected ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'transparent',
              }}
            >
              <Icon size={16} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>{description}</span>
            </button>
          );
        })}
      </div>

      {stageType === 'group' && (
        <>
          <Stepper label="Number of groups" value={groupCount} onChange={onGroupCountChange} min={2} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            Who advances
            <select value={advanceMode} onChange={e => onAdvanceModeChange(e.target.value as 'per_group' | 'combined')}>
              <option value="per_group">Top N from each group</option>
              <option value="combined">Flat top N across all groups combined</option>
            </select>
          </label>
          {advanceMode === 'per_group' ? (
            <Stepper label="Advance per group" value={advancePerGroup} onChange={onAdvancePerGroupChange} min={1} />
          ) : (
            <Stepper label="Total advancing" value={advanceCount} onChange={onAdvanceCountChange} min={2} />
          )}
        </>
      )}

      {(stageType === 'league' || stageType === 'group') && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={doubleHeader} onChange={e => onDoubleHeaderChange(e.target.checked)} />
          Double Header (every matchup played twice)
        </label>
      )}

      <div style={{ fontSize: 12, background: 'var(--surface-2, rgba(127,127,127,0.08))', borderRadius: 8, padding: '8px 10px', color: 'var(--muted)' }}>
        {previewText}
        {approximate && stages.length > 0 && (
          <div style={{ marginTop: 4, fontStyle: 'italic' }}>
            Approximate — final pool depends on &ldquo;{stages[stages.length - 1].name}&rdquo; results, not yet frozen.
          </div>
        )}
      </div>

      <button className="btn-primary" onClick={onGenerate} disabled={busy || !stageName.trim()}>
        Generate Stage
      </button>
    </div>
  );
}

export type { StageConfig };
