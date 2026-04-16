import React, { useState } from 'react';
import { useLeadPipelineStats } from '@/hooks/useLeadPipelineStats';
import { useOutreachLeads } from '@/hooks/useOutreachLeads';
import { useGeoSettings } from '@/hooks/useSettings';
import { useSourceToggles, SOURCE_KEYS, SOURCE_LABELS } from '@/hooks/useSourceToggles';
import { useTriggerRun } from '@/hooks/useTriggerRun';

// ─── Score ring (0–max arc) ──────────────────────────────────────────────────
const ScoreRing = ({
  score,
  max = 7,
  size = 36,
}: {
  score: number;
  max?: number;
  size?: number;
}) => {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / max, 1);
  const offset = circ - pct * circ;
  const color = score >= 5 ? '#a855f7' : score >= 3 ? '#7b39fc' : 'rgba(255,255,255,0.25)';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={size <= 36 ? 9 : 11} fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}>
        {score}
      </text>
    </svg>
  );
};

// ─── RunBtn (mirrored from IndeedScreen) ─────────────────────────────────────
function RunBtn({
  label,
  state,
  onClick,
}: {
  label: string;
  state: 'idle' | 'loading' | 'success' | 'error';
  onClick: () => void;
}) {
  const styles = {
    idle: 'bg-purple-primary hover:bg-purple-primary/90 text-white',
    loading: 'bg-purple-primary/40 text-white/60 cursor-not-allowed',
    success: 'bg-green-500/80 text-white',
    error: 'bg-red-500/80 text-white',
  };
  const labels = {
    idle: label,
    loading: 'Triggering…',
    success: 'Triggered ✓',
    error: 'Failed',
  };
  return (
    <button
      onClick={onClick}
      disabled={state === 'loading'}
      className={`px-4 py-2 rounded-button text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${styles[state]}`}
    >
      {state === 'loading' ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : state === 'success' ? (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
      )}
      {labels[state]}
    </button>
  );
}

// ─── Demo type badge ──────────────────────────────────────────────────────────
const DEMO_LABELS: Record<string, string> = {
  email_only: 'Email Only',
  widget: 'Widget Ready',
  redesign: 'Redesign',
  new_site: 'New Site',
  compound: 'Compound',
};

const DEMO_COLORS: Record<string, string> = {
  email_only: 'bg-white/[0.06] text-white/50',
  widget: 'bg-blue-500/15 text-blue-300',
  redesign: 'bg-amber-500/15 text-amber-300',
  new_site: 'bg-emerald-500/15 text-emerald-300',
  compound: 'bg-purple-primary/20 text-purple-primary',
};

// ─── Toggle switch ────────────────────────────────────────────────────────────
const Toggle = ({
  on,
  onClick,
}: {
  on: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-10 h-5 rounded-full relative transition-colors duration-200 flex-shrink-0 ${on ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}
  >
    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${on ? 'right-0.5' : 'left-0.5'}`} />
  </button>
);

// ─── AU source keys ───────────────────────────────────────────────────────────
const AU_SOURCES = [
  'source_google_maps_au',
  'source_ahpra',
  'source_mfaa',
  'source_law_society_au',
  'source_hipages',
  'source_reia',
] as const;

const UK_SOURCES = [
  'source_google_maps_uk',
  'source_companies_house',
  'source_fca_register',
  'source_law_society_uk',
  'source_yell',
  'source_checkatrade',
  'source_trustpilot',
  'source_opencorporates',
] as const;

// ─── Engine Room (back face) ──────────────────────────────────────────────────
function EngineRoom() {
  const { geoAU, geoUK, loading: geoLoading, toggle: toggleGeo } = useGeoSettings();
  const { toggles, loading: togglesLoading, toggle: toggleSource } = useSourceToggles();

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Geography */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[16px] text-white mb-4">Geography</h3>
        {[
          { label: '🇦🇺 Australia', key: 'geo_au_scrape' as const, on: geoAU },
          { label: '🇬🇧 United Kingdom', key: 'geo_uk_scrape' as const, on: geoUK },
        ].map((geo, i, arr) => (
          <div
            key={geo.key}
            className="flex items-center justify-between py-3"
            style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span className="text-sm text-white">{geo.label}</span>
            <Toggle
              on={geoLoading ? true : geo.on}
              onClick={() => !geoLoading && toggleGeo(geo.key, !geo.on)}
            />
          </div>
        ))}
      </div>

      {/* AU Sources */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[15px] text-white mb-1">AU Sources</h3>
        <p className="text-xs text-white/35 mb-4">Active scraper feeds for Australia</p>
        {AU_SOURCES.map((key, i) => (
          <div
            key={key}
            className="flex items-center justify-between py-2.5"
            style={{ borderBottom: i < AU_SOURCES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span className="text-sm text-white">{SOURCE_LABELS[key]}</span>
            <Toggle
              on={togglesLoading ? true : toggles[key] ?? true}
              onClick={() => !togglesLoading && toggleSource(key)}
            />
          </div>
        ))}
      </div>

      {/* UK Sources */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[15px] text-white mb-1">UK Sources</h3>
        <p className="text-xs text-white/35 mb-4">Active scraper feeds for United Kingdom</p>
        {UK_SOURCES.map((key, i) => (
          <div
            key={key}
            className="flex items-center justify-between py-2.5"
            style={{ borderBottom: i < UK_SOURCES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span className="text-sm text-white">{SOURCE_LABELS[key]}</span>
            <Toggle
              on={togglesLoading ? true : toggles[key] ?? true}
              onClick={() => !togglesLoading && toggleSource(key)}
            />
          </div>
        ))}
      </div>

      {/* Schedule */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[15px] text-white mb-3">Scrape Schedule</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/65">Daily scrape</span>
            <span className="text-sm text-white font-semibold">2:00 AM UTC</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/65">Enrichment + scoring</span>
            <span className="text-sm text-white font-semibold">6:00 AM UTC</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LeadGen({
  showEngine,
}: {
  showEngine?: boolean;
}) {
  const { stats: pipeline, loading: pipelineLoading } = useLeadPipelineStats();
  const { hotLeads, loading: leadsLoading } = useOutreachLeads(50);
  const { trigger, getState, getError } = useTriggerRun();

  const pipelineTiles = [
    { label: 'Found', value: pipelineLoading ? '—' : pipeline.new.toLocaleString(), sub: 'status: new' },
    { label: 'Enriched', value: pipelineLoading ? '—' : pipeline.enriched.toLocaleString(), sub: 'tech stack scanned' },
    { label: 'Scored', value: pipelineLoading ? '—' : pipeline.scored.toLocaleString(), sub: 'ready for outreach' },
    { label: 'Outreached', value: pipelineLoading ? '—' : pipeline.outreached.toLocaleString(), sub: 'emails sent' },
  ];

  return (
    <div className="h-full overflow-hidden" style={{ perspective: '1200px' }}>
      <div
        className="h-full relative"
        style={{
          transformStyle: 'preserve-3d',
          transform: showEngine ? 'rotateY(180deg)' : 'rotateY(0)',
          transition: 'transform 500ms ease-in-out',
        }}
      >
        {/* ── Front face — Pipeline + Hot Leads ── */}
        <div
          className="h-full overflow-y-auto"
          style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
        >
          <div className="p-6 space-y-6 min-h-full flex flex-col">

            {/* Pipeline stats strip */}
            <div className="grid grid-cols-4 gap-3">
              {pipelineTiles.map((tile, i) => (
                <div key={tile.label} className="liquid-glass rounded-card p-4 text-center">
                  <p className="text-2xl font-bold text-white leading-none">{tile.value}</p>
                  <p className="text-xs font-semibold text-white/70 mt-1.5">{tile.label}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/25 mt-0.5">{tile.sub}</p>
                </div>
              ))}
            </div>

            {/* Hot leads section */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-white">Hot Leads</h3>
                  <p className="text-xs text-white/35 mt-0.5">Score ≥ 2 · Ready for multi-touch outreach</p>
                </div>
                {!leadsLoading && hotLeads.length > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-primary/20 text-purple-primary">
                    {hotLeads.length} leads
                  </span>
                )}
              </div>

              {leadsLoading ? (
                <div className="py-10 text-center text-white/30 text-sm">Loading…</div>
              ) : hotLeads.length === 0 ? (
                <div className="liquid-glass rounded-card p-8 text-center">
                  <p className="text-white/40 text-sm font-medium">No hot leads yet</p>
                  <p className="text-white/25 text-xs mt-1">Run scraper + enrichment to start filling the pipeline</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {hotLeads.slice(0, 12).map((lead) => {
                    const score = lead.score?.value_add_score ?? 0;
                    const demoType = (lead.demo_type ?? 'email_only').toLowerCase();
                    const services = lead.score?.applicable_services ?? [];
                    const accentColor = score >= 5 ? '2px solid rgba(168,85,247,0.5)' : score >= 3 ? '2px solid rgba(123,57,252,0.35)' : '2px solid rgba(255,255,255,0.08)';

                    return (
                      <div
                        key={lead.id}
                        className="liquid-glass rounded-card p-4 hover:-translate-y-0.5 transition-transform"
                        style={{ borderTop: accentColor }}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-sm text-white truncate">{lead.company_name}</h4>
                            <p className="text-xs text-white/55 mt-0.5 truncate">
                              {lead.dm_name ?? lead.city ?? '—'}
                              {lead.dm_title ? ` · ${lead.dm_title}` : ''}
                            </p>
                          </div>
                          <ScoreRing score={score} max={7} size={36} />
                        </div>

                        {/* Niche + demo type */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag liquid-glass text-xs text-white/70">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 flex-shrink-0" />
                            {lead.niche}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-tag font-medium ${DEMO_COLORS[demoType] ?? DEMO_COLORS.email_only}`}>
                            {DEMO_LABELS[demoType] ?? demoType}
                          </span>
                        </div>

                        {/* Services */}
                        {services.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {services.slice(0, 3).map((s) => (
                              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40">
                                {s.replace(/_/g, ' ')}
                              </span>
                            ))}
                            {services.length > 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/30">
                                +{services.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Email indicator */}
                        {lead.dm_email && (
                          <p className="text-[10px] text-green-400/70 mt-2">✓ Email found</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Run buttons */}
            <div className="flex gap-3 pt-2 border-t border-white/[0.06]">
              <RunBtn
                label="Run Scraper"
                state={getState('main-full-run')}
                onClick={() => trigger('main-full-run')}
              />
              <RunBtn
                label="Run Enrichment"
                state={getState('main-enrich')}
                onClick={() => trigger('main-enrich')}
              />
              {(getError('main-full-run') || getError('main-enrich')) && (
                <p className="text-xs text-red-400/80 self-center">
                  {getError('main-full-run') ?? getError('main-enrich')}
                </p>
              )}
              <div className="ml-auto text-xs text-white/25 self-center">
                Total in DB: {pipelineLoading ? '—' : pipeline.total.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* ── Back face — Engine Room ── */}
        <div
          className="h-full"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
          }}
        >
          <EngineRoom />
        </div>
      </div>
    </div>
  );
}
