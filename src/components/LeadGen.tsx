"use client";

import React, { useState } from 'react';
import { useAllLeads } from '@/hooks/useAllLeads';
import { usePreviewBatch } from '@/hooks/usePreviewBatch';
import { useHotLeads } from '@/hooks/useHotLeads';
import { useLeadPipelineStats } from '@/hooks/useLeadPipelineStats';
import { useGeoSettings } from '@/hooks/useSettings';
import { useSourceToggles, SOURCE_LABELS, SOURCE_KEYS } from '@/hooks/useSourceToggles';
import { useTriggerRun } from '@/hooks/useTriggerRun';
import LeadDetailModal from './LeadDetailModal';
import type { TriggerTask } from '@/hooks/useTriggerRun';
import type { AllLead } from '@/hooks/useAllLeads';
import type { SourceKey } from '@/hooks/useSourceToggles';

// ── Shared helpers ────────────────────────────────────────────────────────────

const DEMO_LABELS: Record<string, string> = {
  COMPOUND: 'Compound', REDESIGN: 'Redesign', WIDGET: 'Widget', EMAIL_ONLY: 'Email Only',
};
const DEMO_COLORS: Record<string, string> = {
  COMPOUND: 'bg-purple-500/30 text-purple-200',
  REDESIGN: 'bg-blue-500/20 text-blue-300',
  WIDGET: 'bg-teal-500/20 text-teal-300',
  EMAIL_ONLY: 'bg-white/10 text-white/50',
};

function accentClass(score: number, demoType?: string | null) {
  if (score >= 5 || demoType === 'COMPOUND') return 'accent-hot';
  if (score >= 2) return 'accent-standard';
  return 'accent-cold';
}

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.round((score / 7) * 100);
  const dash = `${(pct / 100) * circ} ${circ}`;
  const color = score >= 5 ? '#7b39fc' : score >= 2 ? '#a48ed7' : 'rgba(255,255,255,0.25)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={dash} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2 + 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="600">{score}</text>
    </svg>
  );
}

function RunBtn({ label, state, onClick }: { label: string; state: 'idle' | 'loading' | 'success' | 'error'; onClick: () => void }) {
  const styles = { idle: 'bg-purple-primary hover:bg-purple-primary/90 text-white', loading: 'bg-purple-primary/40 text-white/60 cursor-not-allowed', success: 'bg-green-500/80 text-white', error: 'bg-red-500/80 text-white' };
  const labels = { idle: label, loading: 'Triggering…', success: 'Triggered ✓', error: 'Failed' };
  return (
    <button onClick={onClick} disabled={state === 'loading'}
      className={`px-3 py-1.5 rounded-button text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${styles[state]}`}>
      {state === 'loading' && <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
      {labels[state]}
    </button>
  );
}

// ── Lead card (Preview + Hot Leads tabs) ─────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: AllLead; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`liquid-glass rounded-card p-4 text-left w-full transition-all duration-200 hover:bg-white/8 ${accentClass(lead.value_add_score, lead.demo_type)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{lead.company_name}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {lead.niche && <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/8 text-white/50">{lead.niche}</span>}
            {lead.city && <span className="text-xs text-white/30">{lead.city}</span>}
          </div>
        </div>
        <ScoreRing score={lead.value_add_score} size={38} />
      </div>
      {lead.demo_type && (
        <div className="mt-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/50'}`}>
            {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
          </span>
        </div>
      )}
      {lead.dm_email && <p className="text-xs text-purple-300/70 mt-2 truncate font-mono">{lead.dm_email}</p>}
      {(lead.applicable_services?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {lead.applicable_services.slice(0, 3).map(s => (
            <span key={s} className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300/60">{s.replace(/_/g, ' ')}</span>
          ))}
          {lead.applicable_services.length > 3 && <span className="text-xs text-white/30">+{lead.applicable_services.length - 3}</span>}
        </div>
      )}
      {lead.icebreaker && <p className="text-xs text-white/40 mt-2 line-clamp-2 italic">"{lead.icebreaker}"</p>}
    </button>
  );
}

// ── All Leads row ─────────────────────────────────────────────────────────────

function LeadRow({ lead, onClick }: { lead: AllLead; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors text-left group border-b border-white/5 last:border-0">
      <ScoreRing score={lead.value_add_score} size={32} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors truncate">{lead.company_name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {lead.niche && <span className="text-xs text-white/40">{lead.niche}</span>}
          {lead.city && <span className="text-xs text-white/25">· {lead.city}</span>}
        </div>
      </div>
      {lead.demo_type && (
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/40'}`}>
          {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
        </span>
      )}
      {lead.dm_email ? (
        <span className="text-xs font-mono text-purple-300/60 flex-shrink-0 hidden md:inline max-w-[160px] truncate">{lead.dm_email}</span>
      ) : (
        <span className="text-xs text-white/20 flex-shrink-0 hidden md:inline">no email</span>
      )}
      {lead.copy_locked && (
        <svg className="w-3.5 h-3.5 text-amber-400/60 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      )}
      <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function StatTile({ label, value, dim = false }: { label: string; value: number; dim?: boolean }) {
  return (
    <div className="liquid-glass rounded-card p-3 text-center">
      <p className={`text-2xl font-bold ${dim ? 'text-white/40' : 'text-white'}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-white/40 mt-0.5">{label}</p>
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({ label, enabled, onToggle }: { label: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-white/60">{label}</span>
      <button onClick={onToggle}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${enabled ? 'bg-purple-primary' : 'bg-white/20'}`}>
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
          style={{ transform: enabled ? 'translateX(16px)' : 'translateX(0px)' }}
        />
      </button>
    </div>
  );
}

// ── Engine Room (with geo + source toggles) ───────────────────────────────────

const AU_SOURCES: SourceKey[] = [
  'source_google_maps_au',
  'source_ahpra',
  'source_mfaa',
  'source_law_society_au',
  'source_hipages',
  'source_reia',
];

const UK_SOURCES: SourceKey[] = [
  'source_google_maps_uk',
  'source_companies_house',
  'source_fca_register',
  'source_law_society_uk',
  'source_yell',
  'source_checkatrade',
  'source_trustpilot',
  'source_opencorporates',
];

function EngineRoom({ onBack }: { onBack: () => void }) {
  const geo = useGeoSettings();
  const sources = useSourceToggles();

  return (
    <div className="h-full flex flex-col p-6 space-y-5 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h3 className="text-sm font-semibold text-white/80">Engine Room</h3>
      </div>

      {/* Geography */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Geography</p>
        <div className="liquid-glass rounded-lg px-3 py-1">
          {geo.loading ? (
            <p className="text-xs text-white/30 py-2">Loading…</p>
          ) : (
            <>
              <ToggleRow label="Australia (AU)" enabled={geo.geoAU} onToggle={() => geo.toggle('geo_au_scrape', !geo.geoAU)} />
              <ToggleRow label="United Kingdom (UK)" enabled={geo.geoUK} onToggle={() => geo.toggle('geo_uk_scrape', !geo.geoUK)} />
            </>
          )}
        </div>
      </div>

      {/* AU Sources */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2">AU Data Sources</p>
        <div className="liquid-glass rounded-lg px-3 py-1">
          {sources.loading ? (
            <p className="text-xs text-white/30 py-2">Loading…</p>
          ) : AU_SOURCES.map(key => (
            <ToggleRow
              key={key}
              label={SOURCE_LABELS[key]}
              enabled={sources.toggles[key] ?? true}
              onToggle={() => sources.toggle(key)}
            />
          ))}
        </div>
      </div>

      {/* UK Sources */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2">UK Data Sources</p>
        <div className="liquid-glass rounded-lg px-3 py-1">
          {sources.loading ? (
            <p className="text-xs text-white/30 py-2">Loading…</p>
          ) : UK_SOURCES.map(key => (
            <ToggleRow
              key={key}
              label={SOURCE_LABELS[key]}
              enabled={sources.toggles[key] ?? true}
              onToggle={() => sources.toggle(key)}
            />
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Schedule</p>
        <div className="liquid-glass rounded-lg p-3 text-xs text-white/50">
          Daily scrape runs at 2am UTC · Enrichment follows automatically
        </div>
      </div>

      {/* Pipeline */}
      <div>
        <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Pipeline</p>
        <div className="space-y-1.5 text-xs text-white/50">
          {['Google Maps AU + UK', 'Website scraping → signal detection', 'Exa owner + email enrichment', 'Scoring → icebreaker + copy gen'].map(s => (
            <div key={s} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-primary/60 flex-shrink-0" />
              {s}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'all' | 'preview' | 'hot';

export default function LeadGen({ showEngine, onToggleEngine }: { showEngine: boolean; onToggleEngine: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [selectedLead, setSelectedLead] = useState<AllLead | null>(null);

  const { stats } = useLeadPipelineStats();
  const { trigger, getState } = useTriggerRun();

  const allLeads = useAllLeads();
  const preview = usePreviewBatch();
  const hot = useHotLeads();

  const scraperState = getState('main-full-run');
  const enrichState = getState('main-enrich');

  const handleTrigger = async (task: TriggerTask) => {
    await trigger(task);
    if (task === 'main-full-run') setTimeout(() => preview.reshuffle(), 3000);
  };

  const handleLeadSaved = (updated: AllLead) => {
    allLeads.updateLead(updated.id, updated);
    preview.updateLead(updated.id, updated);
    hot.updateLead(updated.id, updated);
    setSelectedLead(null);
  };

  return (
    <div className="h-full" style={{ perspective: '1000px' }}>
      <div style={{
        transformStyle: 'preserve-3d',
        transform: showEngine ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition: 'transform 0.6s ease',
        position: 'relative', height: '100%',
      }}>

        {/* ── FRONT ── */}
        <div className="flex flex-col h-full p-6 space-y-4 overflow-hidden"
          style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 flex-shrink-0">
            <StatTile label="Found" value={stats.new} dim={stats.new === 0} />
            <StatTile label="Enriched" value={stats.enriched} dim={stats.enriched === 0} />
            <StatTile label="Scored" value={stats.scored} />
            <StatTile label="Outreached" value={stats.outreached} dim={stats.outreached === 0} />
          </div>

          {/* Tab pills */}
          <div className="flex items-center gap-1 p-1 rounded-button bg-white/5 flex-shrink-0">
            {(['all', 'preview', 'hot'] as Tab[]).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-button transition-all duration-200 ${activeTab === t ? 'bg-purple-primary text-white' : 'text-white/50 hover:text-white/80'}`}>
                {t === 'all' ? `All (${allLeads.total.toLocaleString()})` : t === 'preview' ? 'Preview' : `Hot (${hot.leads.length})`}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {activeTab === 'all' && (
              <div className="space-y-3">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={allLeads.search} onChange={e => allLeads.setSearch(e.target.value)}
                    placeholder="Search companies…"
                    className="w-full pl-9 pr-4 py-2 rounded-button bg-white/5 border border-white/10 text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-purple-400/40" />
                </div>
                <div className="liquid-glass rounded-card divide-y divide-white/5">
                  {allLeads.loading && allLeads.leads.length === 0 ? (
                    <div className="p-6 text-center text-white/30 text-sm">Loading…</div>
                  ) : allLeads.leads.length === 0 ? (
                    <div className="p-6 text-center text-white/30 text-sm">No enriched leads yet</div>
                  ) : allLeads.leads.map(lead => (
                    <LeadRow key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                  ))}
                </div>
                {allLeads.hasMore && (
                  <button onClick={allLeads.loadMore} disabled={allLeads.loading}
                    className="w-full py-2 rounded-button text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/8 transition-colors">
                    {allLeads.loading ? 'Loading…' : `Load more (${(allLeads.total - allLeads.leads.length).toLocaleString()} remaining)`}
                  </button>
                )}
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">12 persisted cards · same batch as Outreach</p>
                  <button onClick={preview.reshuffle} disabled={preview.shuffling}
                    className="text-xs px-2.5 py-1 rounded-button bg-white/8 hover:bg-white/12 text-white/60 transition-colors flex items-center gap-1.5">
                    {preview.shuffling
                      ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                    Reshuffle
                  </button>
                </div>
                {preview.loading
                  ? <div className="text-center py-8 text-white/30 text-sm">Loading preview…</div>
                  : <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                      {preview.leads.map(lead => <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />)}
                    </div>}
              </div>
            )}

            {activeTab === 'hot' && (
              <div className="space-y-3">
                <p className="text-xs text-white/40">Top {hot.leads.length} of {hot.totalEnriched.toLocaleString()} enriched · click to edit copy</p>
                {hot.loading
                  ? <div className="text-center py-8 text-white/30 text-sm">Loading…</div>
                  : <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                      {hot.leads.map(lead => <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />)}
                    </div>}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/8 flex-shrink-0">
            <RunBtn label="Run Scraper" state={scraperState} onClick={() => handleTrigger('main-full-run')} />
            <RunBtn label="Run Enrichment" state={enrichState} onClick={() => handleTrigger('main-enrich')} />
            <div className="flex-1" />
            <button onClick={onToggleEngine}
              className="text-xs px-3 py-1.5 rounded-button bg-white/8 hover:bg-white/12 text-white/60 transition-colors flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Engine Room
            </button>
          </div>
        </div>

        {/* ── BACK (Engine Room) ── */}
        <div className="h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}>
          <EngineRoom onBack={onToggleEngine} />
        </div>
      </div>

      {selectedLead && (
        <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} onSaved={handleLeadSaved} />
      )}
    </div>
  );
}
