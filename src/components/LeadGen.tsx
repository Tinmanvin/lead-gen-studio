"use client";

import React, { useState } from 'react';
import { useAllLeads } from '@/hooks/useAllLeads';
import { usePreviewBatch } from '@/hooks/usePreviewBatch';
import { useHotLeads } from '@/hooks/useHotLeads';
import { useLeadPipelineStats } from '@/hooks/useLeadPipelineStats';
import { useGeoSettings } from '@/hooks/useSettings';
import { useSourceToggles, SOURCE_LABELS } from '@/hooks/useSourceToggles';
import { useTriggerRun } from '@/hooks/useTriggerRun';
import LeadDetailModal from './LeadDetailModal';
import type { TriggerTask } from '@/hooks/useTriggerRun';
import type { AllLead } from '@/hooks/useAllLeads';
import type { SourceKey } from '@/hooks/useSourceToggles';

// ── CSS content guard ─────────────────────────────────────────────────────────

function isCssContent(text?: string | null): boolean {
  if (!text || text.length < 80) return false;
  return (text.includes('{') && text.includes(':') && text.includes('}')) ||
    text.includes('overflow:') || text.includes('-webkit-') || text.includes('display:flex');
}

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

function ScoreRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(score / 7, 1)) * circ;
  const color = score >= 5 ? '#7b39fc' : score >= 2 ? '#a48ed7' : 'rgba(255,255,255,0.2)';
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={9} fontWeight="700" className="rotate-90 origin-center"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  );
}

function RunBtn({ label, state, onClick }: { label: string; state: 'idle' | 'loading' | 'success' | 'error'; onClick: () => void }) {
  const styles = {
    idle: 'bg-purple-primary hover:bg-purple-primary/90 text-white',
    loading: 'bg-purple-primary/40 text-white/60 cursor-not-allowed',
    success: 'bg-green-500/80 text-white',
    error: 'bg-red-500/80 text-white',
  };
  return (
    <button onClick={onClick} disabled={state === 'loading'}
      className={`px-3 py-1.5 rounded-button text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${styles[state]}`}>
      {state === 'loading' && <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
      {state === 'idle' ? label : state === 'loading' ? 'Triggering…' : state === 'success' ? 'Triggered ✓' : 'Failed'}
    </button>
  );
}

// ── Lead card (Preview + Hot tabs) ───────────────────────────────────────────
// Fixed consistent height via flex-col + flex-1 on icebreaker section

function LeadCard({ lead, onClick }: { lead: AllLead; onClick: () => void }) {
  const safeIcebreaker = !isCssContent(lead.icebreaker) ? lead.icebreaker : null;
  return (
    <button onClick={onClick}
      className="liquid-glass rounded-card p-4 text-left w-full hover:-translate-y-0.5 transition-all duration-200 flex flex-col accent-hot">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white line-clamp-1">{lead.company_name}</p>
          <p className="text-xs text-white/50 mt-0.5 line-clamp-1">{lead.dm_name ?? lead.city ?? '—'}</p>
        </div>
        <ScoreRing score={lead.value_add_score} size={32} />
      </div>

      {/* Badges — fixed-height row */}
      <div className="flex items-center gap-1.5 mt-2.5 min-h-[20px] flex-wrap">
        {lead.niche && (
          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-tag liquid-glass text-white/75">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 flex-shrink-0" />
            {lead.niche}
          </span>
        )}
        {lead.demo_type && (
          <span className={`text-xs px-2 py-0.5 rounded-tag ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/50'}`}>
            {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
          </span>
        )}
      </div>

      {/* Email — fixed height */}
      <p className="text-xs font-mono mt-2 truncate h-4">
        {lead.dm_email
          ? <span className="text-purple-300/70">{lead.dm_email}</span>
          : <span className="text-white/20">no email found</span>}
      </p>

      {/* Icebreaker — flex-1 ensures all cards stretch to same height */}
      <p className="text-xs text-white/35 mt-2 italic line-clamp-2 flex-1 min-h-[2.5rem]">
        {safeIcebreaker ? `"${safeIcebreaker}"` : ''}
      </p>
    </button>
  );
}

// ── All Leads row (IndeedScreen-style expand on click) ────────────────────────

function LeadRow({ lead, isExpanded, onToggle, onEdit }: {
  lead: AllLead;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const safeEmailBody = !isCssContent(lead.email_body) ? lead.email_body : null;
  const safeIcebreaker = !isCssContent(lead.icebreaker) ? lead.icebreaker : null;

  return (
    <div className="liquid-glass rounded-card overflow-hidden">
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm text-white">{lead.company_name}</h4>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {lead.niche && <span className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50">{lead.niche}</span>}
              {lead.demo_type && (
                <span className={`text-xs px-2 py-0.5 rounded-tag ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/40'}`}>
                  {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
                </span>
              )}
              {lead.city && <span className="text-xs text-white/30">{lead.city}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs flex-shrink-0 ml-4">
          {lead.copy_locked && (
            <svg className="w-3.5 h-3.5 text-amber-400/60" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          )}
          <svg className={`w-3.5 h-3.5 text-white/25 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-white/[0.06] space-y-2">
          {safeEmailBody ? (
            <>
              {lead.email_subject && (
                <div className="mt-3">
                  <p className="text-xs text-white/35 mb-1">Subject</p>
                  <p className="text-sm text-white/80 font-medium">{lead.email_subject}</p>
                </div>
              )}
              {safeIcebreaker && (
                <div>
                  <p className="text-xs text-white/35 mb-1">Icebreaker</p>
                  <p className="text-sm text-white/60 italic">"{safeIcebreaker}"</p>
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); onEdit(); }}
                className="mt-1 px-3 py-1.5 rounded-button text-xs font-semibold bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30 border border-purple-primary/30 transition-colors"
              >
                Edit Copy
              </button>
            </>
          ) : (
            <p className="text-sm text-white/30 mt-3 italic">No copy generated yet — run enrichment.</p>
          )}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, dim = false }: { label: string; value: number; dim?: boolean }) {
  return (
    <div className="liquid-glass rounded-card p-4 text-center">
      <p className={`text-2xl font-bold ${dim ? 'text-white/40' : 'text-white'}`}>{value.toLocaleString()}</p>
      <p className="text-xs uppercase tracking-wider text-white/35 mt-1">{label}</p>
    </div>
  );
}

// ── Engine Room toggles (original style restored) ─────────────────────────────

function ToggleRow({ label, enabled, onToggle, isLast = false }: {
  label: string; enabled: boolean; onToggle: () => void; isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-3 cursor-pointer"
      style={{ borderBottom: !isLast ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
      onClick={onToggle}
    >
      <span className="text-sm text-white">{label}</span>
      <div className={`w-10 h-5 rounded-full relative transition-colors flex-shrink-0 ${enabled ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}>
        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${enabled ? 'right-0.5' : 'left-0.5'}`} />
      </div>
    </div>
  );
}

// ── Engine Room (original liquid-glass card sections) ─────────────────────────

const AU_SOURCES: SourceKey[] = [
  'source_google_maps_au', 'source_ahpra', 'source_mfaa',
  'source_law_society_au', 'source_hipages', 'source_reia',
];
const UK_SOURCES: SourceKey[] = [
  'source_google_maps_uk', 'source_companies_house', 'source_fca_register',
  'source_law_society_uk', 'source_yell', 'source_checkatrade',
  'source_trustpilot', 'source_opencorporates',
];

function EngineRoom({ onBack }: { onBack: () => void }) {
  const geo = useGeoSettings();
  const sources = useSourceToggles();

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h3 className="text-sm font-semibold text-white/80">Engine Room</h3>
      </div>

      {/* Geography */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[16px] text-white mb-1">Geography</h3>
        {geo.loading ? (
          <p className="text-sm text-white/30 py-3">Loading…</p>
        ) : (
          <>
            <ToggleRow label="🇦🇺 Australia" enabled={geo.geoAU} onToggle={() => geo.toggle('geo_au_scrape', !geo.geoAU)} />
            <ToggleRow label="🇬🇧 United Kingdom" enabled={geo.geoUK} onToggle={() => geo.toggle('geo_uk_scrape', !geo.geoUK)} isLast />
          </>
        )}
      </div>

      {/* AU Sources */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[16px] text-white mb-1">AU Data Sources</h3>
        {sources.loading ? (
          <p className="text-sm text-white/30 py-3">Loading…</p>
        ) : AU_SOURCES.map((key, i) => (
          <ToggleRow key={key} label={SOURCE_LABELS[key]} enabled={sources.toggles[key] ?? true}
            onToggle={() => sources.toggle(key)} isLast={i === AU_SOURCES.length - 1} />
        ))}
      </div>

      {/* UK Sources */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[16px] text-white mb-1">UK Data Sources</h3>
        {sources.loading ? (
          <p className="text-sm text-white/30 py-3">Loading…</p>
        ) : UK_SOURCES.map((key, i) => (
          <ToggleRow key={key} label={SOURCE_LABELS[key]} enabled={sources.toggles[key] ?? true}
            onToggle={() => sources.toggle(key)} isLast={i === UK_SOURCES.length - 1} />
        ))}
      </div>

      {/* Schedule */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[16px] text-white mb-2">Scrape Schedule</h3>
        <p className="text-sm text-white/65">
          Daily at <span className="text-white font-semibold">2:00 AM UTC</span> · Enrichment at <span className="text-white font-semibold">6:00 AM UTC</span>
        </p>
      </div>

      {/* Pipeline */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[16px] text-white mb-3">Pipeline</h3>
        {['Google Maps AU + UK', 'Website scraping → signal detection', 'Exa owner + email enrichment', 'Scoring → icebreaker + copy gen'].map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2.5 text-sm text-white/65 py-2.5"
            style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 flex-shrink-0" />
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'all' | 'preview' | 'hot';

export default function LeadGen({ showEngine, onToggleEngine }: { showEngine: boolean; onToggleEngine: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [selectedLead, setSelectedLead] = useState<AllLead | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

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
        transition: 'transform 500ms ease-in-out',
        position: 'relative', height: '100%',
      }}>

        {/* ── FRONT ── */}
        <div className="flex flex-col h-full p-6 space-y-4 overflow-hidden"
          style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 flex-shrink-0">
            <StatTile label="Found" value={stats.new} dim={stats.new === 0} />
            <StatTile label="Enriched" value={stats.enriched} dim={stats.enriched === 0} />
            <StatTile label="Scored" value={stats.scored} />
            <StatTile label="Outreached" value={stats.outreached} dim={stats.outreached === 0} />
          </div>

          {/* 3-pill nav */}
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

            {/* ── ALL ── */}
            {activeTab === 'all' && (
              <div className="space-y-2">
                <div className="relative mb-3">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={allLeads.search} onChange={e => allLeads.setSearch(e.target.value)}
                    placeholder="Search companies…"
                    className="w-full pl-9 pr-4 py-2 rounded-button bg-white/5 border border-white/10 text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-purple-400/40" />
                </div>
                {allLeads.loading && allLeads.leads.length === 0 ? (
                  <div className="py-10 text-center text-white/30 text-sm">Loading…</div>
                ) : allLeads.leads.length === 0 ? (
                  <div className="liquid-glass rounded-card p-8 text-center">
                    <p className="text-white/30 text-sm">No enriched leads yet.</p>
                  </div>
                ) : (
                  <>
                    {allLeads.leads.map(lead => (
                      <LeadRow
                        key={lead.id}
                        lead={lead}
                        isExpanded={expandedRowId === lead.id}
                        onToggle={() => setExpandedRowId(expandedRowId === lead.id ? null : lead.id)}
                        onEdit={() => setSelectedLead(lead)}
                      />
                    ))}
                    {allLeads.hasMore && (
                      <button onClick={allLeads.loadMore} disabled={allLeads.loading}
                        className="w-full py-2.5 rounded-card text-xs text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/8 transition-colors">
                        {allLeads.loading ? 'Loading…' : `Load more (${(allLeads.total - allLeads.leads.length).toLocaleString()} remaining)`}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── PREVIEW ── */}
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
                  : <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                      {(preview.leads.length > 0 ? preview.leads : MOCK_PREVIEW_LEADS).map(lead => (
                        <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                      ))}
                    </div>}
              </div>
            )}

            {/* ── HOT ── */}
            {activeTab === 'hot' && (
              <div className="space-y-3">
                <p className="text-xs text-white/40">Top {hot.leads.length} of {hot.totalEnriched.toLocaleString()} enriched · click to edit copy</p>
                {hot.loading
                  ? <div className="text-center py-8 text-white/30 text-sm">Loading…</div>
                  : <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
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
