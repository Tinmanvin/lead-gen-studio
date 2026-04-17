"use client";

import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePreviewBatch } from '@/hooks/usePreviewBatch';
import { useHotLeads } from '@/hooks/useHotLeads';
import LeadDetailModal from './LeadDetailModal';
import type { AllLead } from '@/hooks/useAllLeads';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className={`text-xs px-2 py-1 rounded-button transition-colors ${copied ? 'bg-green-500/20 text-green-300' : 'bg-white/8 hover:bg-white/12 text-white/50 hover:text-white/80'}`}>
      {copied ? 'Copied!' : label}
    </button>
  );
}

// ── Mass Email preview card (selectable) ─────────────────────────────────────

function MassCard({
  lead,
  selected,
  onSelect,
  onClick,
}: {
  lead: AllLead;
  selected: boolean;
  onSelect: () => void;
  onClick: () => void;
}) {
  return (
    <div className={`liquid-glass rounded-card p-4 relative transition-all duration-200 ${accentClass(lead.value_add_score, lead.demo_type)} ${selected ? 'ring-1 ring-purple-primary/60' : ''}`}>
      {/* Checkbox */}
      <button onClick={e => { e.stopPropagation(); onSelect(); }}
        className={`absolute top-3 right-3 w-4 h-4 rounded border transition-colors flex items-center justify-center
          ${selected ? 'bg-purple-primary border-purple-primary' : 'border-white/20 bg-white/5 hover:border-white/40'}`}>
        {selected && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      </button>
      {/* Clickable area */}
      <button onClick={onClick} className="text-left w-full pr-6">
        <div className="flex items-start gap-3">
          <ScoreRing score={lead.value_add_score} size={36} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{lead.company_name}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {lead.niche && <span className="text-xs text-white/40">{lead.niche}</span>}
              {lead.city && <span className="text-xs text-white/25">· {lead.city}</span>}
            </div>
          </div>
        </div>
        {lead.demo_type && (
          <span className={`text-xs px-2 py-0.5 rounded-full mt-2 inline-block ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/50'}`}>
            {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
          </span>
        )}
        {lead.dm_email && <p className="text-xs text-purple-300/60 mt-1.5 truncate font-mono">{lead.dm_email}</p>}
        {lead.email_subject && <p className="text-xs text-white/40 mt-1 truncate">"{lead.email_subject}"</p>}
      </button>
    </div>
  );
}

// ── Hot lead card (with channel buttons) ─────────────────────────────────────

function HotLeadCard({
  lead,
  onContact,
  onClick,
}: {
  lead: AllLead;
  onContact: () => void;
  onClick: () => void;
}) {
  const [contacting, setContacting] = useState(false);

  const handleContact = async () => {
    setContacting(true);
    try {
      await supabase.from('leads').update({ status: 'outreached' }).eq('id', lead.id);
      onContact();
    } finally {
      setContacting(false);
    }
  };

  return (
    <div className={`liquid-glass rounded-card p-4 space-y-3 ${accentClass(lead.value_add_score, lead.demo_type)}`}>
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start gap-3">
          <ScoreRing score={lead.value_add_score} size={42} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{lead.company_name}</p>
            {lead.dm_name && <p className="text-xs text-white/50 mt-0.5">{lead.dm_name}{lead.dm_title ? ` · ${lead.dm_title}` : ''}</p>}
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {lead.niche && <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/8 text-white/50">{lead.niche}</span>}
              {lead.demo_type && <span className={`text-xs px-1.5 py-0.5 rounded-full ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/50'}`}>{DEMO_LABELS[lead.demo_type] ?? lead.demo_type}</span>}
            </div>
          </div>
        </div>
        {(lead.applicable_services?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {lead.applicable_services.slice(0, 4).map(s => (
              <span key={s} className="text-xs px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300/60">{s.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}
        {lead.icebreaker && <p className="text-xs text-white/40 mt-2 italic line-clamp-2">"{lead.icebreaker}"</p>}
      </button>

      {/* Channel buttons */}
      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/8">
        {lead.dm_linkedin_url && (
          <a href={lead.dm_linkedin_url} target="_blank" rel="noreferrer"
            className="text-xs px-2 py-1 rounded-button bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition-colors">
            LinkedIn ↗
          </a>
        )}
        {lead.linkedin_msg && <CopyBtn text={lead.linkedin_msg} label="Copy LI" />}
        {lead.dm_whatsapp && (
          <a href={`https://wa.me/${lead.dm_whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            className="text-xs px-2 py-1 rounded-button bg-green-500/15 text-green-300 hover:bg-green-500/25 transition-colors">
            WhatsApp ↗
          </a>
        )}
        {lead.whatsapp_msg && <CopyBtn text={lead.whatsapp_msg} label="Copy WA" />}
        {lead.dm_facebook_url && (
          <a href={lead.dm_facebook_url} target="_blank" rel="noreferrer"
            className="text-xs px-2 py-1 rounded-button bg-blue-700/15 text-blue-300/80 hover:bg-blue-700/25 transition-colors">
            FB ↗
          </a>
        )}
        {lead.facebook_msg && <CopyBtn text={lead.facebook_msg} label="Copy FB" />}
      </div>

      {lead.dm_email && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-purple-300/60 truncate max-w-[60%]">{lead.dm_email}</span>
          <button onClick={handleContact} disabled={contacting}
            className="text-xs px-2.5 py-1 rounded-button bg-white/8 hover:bg-white/14 text-white/60 transition-colors flex items-center gap-1.5">
            {contacting ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : null}
            {contacting ? 'Marking…' : 'Mark Contacted'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Engine Room ───────────────────────────────────────────────────────────────

function OutreachEngine({ onBack }: { onBack: () => void }) {
  return (
    <div className="h-full flex flex-col p-6 space-y-5 overflow-y-auto">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 transition-colors">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h3 className="text-sm font-semibold text-white/80">Outreach Engine Room</h3>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Daily Cap</p>
          <div className="liquid-glass rounded-lg p-3 text-xs text-white/50">450 emails/day · 150 per account × 3 Gmail accounts</div>
        </div>
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Send Logic</p>
          <div className="space-y-1.5 text-xs text-white/50">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-primary/60" />Mass Email excludes Hot Leads pool</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-primary/60" />Preview = 12 random sample cards</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-primary/60" />Approve Batch sends ALL eligible, not just 12</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'mass' | 'hot';

export default function Outreach({ showEngine: showEngineProp = false }: { showEngine?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>('mass');
  const [showEngine, setShowEngine] = useState(showEngineProp);

  // Sync when parent (Index.tsx top-bar button) toggles showEngine prop
  useEffect(() => {
    setShowEngine(showEngineProp);
  }, [showEngineProp]);
  const [selectedLead, setSelectedLead] = useState<AllLead | null>(null);

  const preview = usePreviewBatch();
  const hot = useHotLeads();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendState, setSendState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const sentRef = useRef(0);

  const hotLeadIds = new Set(hot.leads.map(l => l.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allSelected = preview.leads.length > 0 && preview.leads.every(l => selectedIds.has(l.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(preview.leads.map(l => l.id)));
  };

  const handleApprove = async (mode: 'batch' | 'selected') => {
    setSendState('loading');
    sentRef.current = 0;
    try {
      const excludeLeadIds = Array.from(hotLeadIds);
      const body: Record<string, unknown> = { excludeLeadIds };

      if (mode === 'selected') {
        body.leadIds = Array.from(selectedIds);
      }

      const { data, error } = await supabase.functions.invoke('send-outreach-emails', { body });

      if (error) throw error;
      sentRef.current = (data as any)?.sent ?? 0;
      setSendState('success');
      preview.refetch();
      hot.refetch();
      setTimeout(() => setSendState('idle'), 3000);
    } catch {
      setSendState('error');
      setTimeout(() => setSendState('idle'), 3000);
    }
  };

  const sendBtnLabel = () => {
    if (sendState === 'loading') return 'Sending…';
    if (sendState === 'success') return `Sent ${sentRef.current} emails ✓`;
    if (sendState === 'error') return 'Send Failed';
    return 'Approve Batch → Send via Gmail (450)';
  };

  const handleLeadSaved = (updated: AllLead) => {
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

          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-button bg-white/5 flex-shrink-0">
            {(['mass', 'hot'] as Tab[]).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex-1 text-xs font-medium py-1.5 rounded-button transition-all duration-200 ${activeTab === t ? 'bg-purple-primary text-white' : 'text-white/50 hover:text-white/80'}`}>
                {t === 'mass' ? 'Mass Email' : `Hot Leads (${hot.leads.length})`}
              </button>
            ))}
            <button onClick={() => setShowEngine(true)}
              className="px-2 py-1.5 text-white/40 hover:text-white/70 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* ── MASS EMAIL ── */}
          {activeTab === 'mass' && (
            <>
              {/* Reshuffle + select all */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={preview.reshuffle} disabled={preview.shuffling}
                  className="text-xs px-2.5 py-1 rounded-button bg-white/8 hover:bg-white/12 text-white/60 transition-colors flex items-center gap-1.5">
                  {preview.shuffling
                    ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    : <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                  Reshuffle
                </button>
                <button onClick={toggleAll} className="text-xs px-2.5 py-1 rounded-button bg-white/8 hover:bg-white/12 text-white/60 transition-colors">
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-xs text-white/30 ml-1">{selectedIds.size} selected</span>
              </div>

              {/* Preview grid */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {preview.loading
                  ? <div className="text-center py-8 text-white/30 text-sm">Loading preview…</div>
                  : <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                      {preview.leads.map(lead => (
                        <MassCard
                          key={lead.id}
                          lead={lead}
                          selected={selectedIds.has(lead.id)}
                          onSelect={() => toggleSelect(lead.id)}
                          onClick={() => setSelectedLead(lead)}
                        />
                      ))}
                    </div>}
              </div>

              {/* Approve buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/8 flex-shrink-0">
                {selectedIds.size > 0 && (
                  <button onClick={() => handleApprove('selected')} disabled={sendState === 'loading'}
                    className="px-3 py-2 rounded-button text-xs font-medium bg-white/10 hover:bg-white/15 text-white/70 transition-colors">
                    Send Selected ({selectedIds.size})
                  </button>
                )}
                <button onClick={() => handleApprove('batch')} disabled={sendState === 'loading'}
                  className={`flex-1 py-2 rounded-button text-sm font-semibold transition-all duration-200 ${
                    sendState === 'loading' ? 'bg-purple-primary/40 text-white/60 cursor-not-allowed' :
                    sendState === 'success' ? 'bg-green-500/80 text-white' :
                    sendState === 'error' ? 'bg-red-500/80 text-white' :
                    'bg-purple-primary hover:bg-purple-primary/90 text-white'
                  }`}>
                  {sendState === 'loading' && (
                    <span className="inline-flex items-center gap-2 justify-center">
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      {sendBtnLabel()}
                    </span>
                  )}
                  {sendState !== 'loading' && sendBtnLabel()}
                </button>
              </div>
            </>
          )}

          {/* ── HOT LEADS ── */}
          {activeTab === 'hot' && (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              <p className="text-xs text-white/40 flex-shrink-0">Top {hot.leads.length} leads · excluded from mass email · contact manually</p>
              {hot.loading
                ? <div className="text-center py-8 text-white/30 text-sm">Loading…</div>
                : hot.leads.length === 0
                  ? <div className="text-center py-8 text-white/30 text-sm">No hot leads yet</div>
                  : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {hot.leads.map(lead => (
                        <HotLeadCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => setSelectedLead(lead)}
                          onContact={() => hot.removeLead(lead.id)}
                        />
                      ))}
                    </div>}
            </div>
          )}
        </div>

        {/* ── BACK (Engine Room) ── */}
        <div className="h-full" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}>
          <OutreachEngine onBack={() => setShowEngine(false)} />
        </div>
      </div>

      {selectedLead && (
        <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} onSaved={handleLeadSaved} />
      )}
    </div>
  );
}
