import React, { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useOutreachLeads } from '@/hooks/useOutreachLeads';
import type { EnrichedLead } from '@/hooks/useLeads';

// ─── Score ring ───────────────────────────────────────────────────────────────
const ScoreRing = ({ score, max = 7, size = 40 }: { score: number; max?: number; size?: number }) => {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / max, 1);
  const offset = circ - pct * circ;
  const color = score >= 5 ? '#a855f7' : score >= 3 ? '#7b39fc' : 'rgba(255,255,255,0.25)';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill="white" fontSize={11} fontWeight="700"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}>
        {score}
      </text>
    </svg>
  );
};

// ─── Demo type constants ──────────────────────────────────────────────────────
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

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // silently fail
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`px-2.5 py-1 rounded-button text-[11px] font-medium transition-all duration-200 ${
        copied
          ? 'bg-green-500/20 text-green-400 border border-green-500/20'
          : 'bg-white/[0.06] text-white/50 hover:text-white/80 border border-white/[0.06] hover:border-white/20'
      }`}
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

// ─── Hot lead card (multi-touch channels) ────────────────────────────────────
function HotLeadCard({ lead, onContacted }: { lead: EnrichedLead; onContacted: (id: string) => void }) {
  const [marking, setMarking] = useState(false);
  const score = lead.score?.value_add_score ?? 0;
  const services = lead.score?.applicable_services ?? [];
  const demoType = (lead.demo_type ?? 'email_only').toLowerCase();

  const handleMarkContacted = async () => {
    setMarking(true);
    await supabase.from('leads').update({ status: 'outreached' }).eq('id', lead.id);
    onContacted(lead.id);
    setMarking(false);
  };

  const accentColor = score >= 5
    ? '2px solid rgba(168,85,247,0.5)'
    : score >= 3
    ? '2px solid rgba(123,57,252,0.35)'
    : '2px solid rgba(255,255,255,0.08)';

  return (
    <div className="liquid-glass rounded-card p-5" style={{ borderTop: accentColor }}>
      {/* Header */}
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-white">{lead.company_name}</h4>
          <p className="text-sm text-white/60 mt-0.5">
            {lead.dm_name ?? '—'}
            {lead.dm_title ? ` · ${lead.dm_title}` : ''}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag liquid-glass text-xs text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 flex-shrink-0" />
              {lead.niche}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-tag font-medium ${DEMO_COLORS[demoType] ?? DEMO_COLORS.email_only}`}>
              {DEMO_LABELS[demoType] ?? demoType}
            </span>
          </div>
        </div>
        <ScoreRing score={score} max={7} size={40} />
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {services.map((s) => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40">
              {s.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Channels */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
        {/* LinkedIn */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-white/25 w-16 flex-shrink-0">LinkedIn</span>
          {lead.dm_linkedin_url ? (
            <>
              <a
                href={lead.dm_linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-button text-[11px] font-medium bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 transition-colors border border-blue-500/20"
              >
                Open ↗
              </a>
              {lead.linkedin_msg && <CopyBtn text={lead.linkedin_msg} label="Copy msg" />}
            </>
          ) : (
            <span className="text-[11px] text-white/20">No profile found</span>
          )}
        </div>

        {/* WhatsApp */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-white/25 w-16 flex-shrink-0">WhatsApp</span>
          {lead.dm_whatsapp ? (
            <>
              <a
                href={`https://wa.me/${lead.dm_whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-button text-[11px] font-medium bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors border border-emerald-500/20"
              >
                Open ↗
              </a>
              {lead.whatsapp_msg && <CopyBtn text={lead.whatsapp_msg} label="Copy msg" />}
            </>
          ) : (
            <span className="text-[11px] text-white/20">No number found</span>
          )}
        </div>

        {/* Facebook */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-white/25 w-16 flex-shrink-0">Facebook</span>
          {lead.dm_facebook_url ? (
            <>
              <a
                href={lead.dm_facebook_url}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded-button text-[11px] font-medium bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition-colors border border-indigo-500/20"
              >
                Open ↗
              </a>
              {lead.facebook_msg && <CopyBtn text={lead.facebook_msg} label="Copy msg" />}
            </>
          ) : (
            <span className="text-[11px] text-white/20">No profile found</span>
          )}
        </div>

        {/* Email */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-white/25 w-16 flex-shrink-0">Email</span>
          {lead.dm_email ? (
            <span className="text-[11px] font-medium px-2.5 py-1 rounded-button bg-purple-primary/15 text-purple-primary/80 border border-purple-primary/20">
              ✓ Queued in Gmail
            </span>
          ) : (
            <span className="text-[11px] text-white/20">No email found</span>
          )}
        </div>
      </div>

      {/* Mark contacted */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={handleMarkContacted}
          disabled={marking}
          className="px-3 py-1.5 rounded-button text-xs font-medium border border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20 transition-all disabled:opacity-40"
        >
          {marking ? 'Marking…' : 'Mark as Contacted'}
        </button>
      </div>
    </div>
  );
}

// ─── Engine Room (back face) ──────────────────────────────────────────────────
function OutreachEngine() {
  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[16px] text-white mb-1">Gmail Rotation</h3>
        <p className="text-sm text-white/50 mb-4">3 accounts in rotation — daily cap per account is set in Settings → Email Accounts.</p>
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center justify-between py-2.5" style={{ borderBottom: n < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span className="text-sm text-white">Gmail Account {n}</span>
              <span className="text-xs font-medium text-purple-primary/70 bg-purple-primary/10 px-2 py-0.5 rounded-tag">Active</span>
            </div>
          ))}
        </div>
      </div>

      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[15px] text-white mb-3">Send Logic</h3>
        <div className="space-y-2 text-sm text-white/55">
          <p>• Queries leads with <code className="text-white/70 text-[11px] bg-white/[0.06] px-1 rounded">status = scored</code> + email found</p>
          <p>• Rotates across 3 Gmail accounts, respects daily cap</p>
          <p>• Sets <code className="text-white/70 text-[11px] bg-white/[0.06] px-1 rounded">status → outreached</code> on success</p>
          <p>• Records <code className="text-white/70 text-[11px] bg-white/[0.06] px-1 rounded">sent_at</code> and <code className="text-white/70 text-[11px] bg-white/[0.06] px-1 rounded">sent_via</code> per lead</p>
        </div>
      </div>

      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[15px] text-white mb-3">Templates</h3>
        <p className="text-sm text-white/50">5 templates — one per demo type. Edit in <span className="text-white/70">Settings → Outreach</span>.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['Email Only', 'Widget', 'Redesign', 'New Site', 'Compound'].map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Outreach({ showEngine }: { showEngine?: boolean }) {
  const [activeTab, setActiveTab] = useState<'mass' | 'hot'>('mass');
  const [sendState, setSendState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sentCount, setSentCount] = useState(0);

  const { leads, massLeads, hotLeads, stats, loading, refetch } = useOutreachLeads(100);

  // Remove contacted leads locally (real-time subscription handles it too)
  const handleContacted = (_id: string) => {
    // useOutreachLeads real-time subscription will remove the lead from the list
    // when status flips to outreached — no extra local state needed
  };

  const statsTiles = [
    { label: 'Plain Email', value: loading ? '—' : stats.email_only.toLocaleString() },
    { label: 'Widget Demo', value: loading ? '—' : stats.widget.toLocaleString() },
    { label: 'Redesign', value: loading ? '—' : stats.redesign.toLocaleString() },
    { label: 'New Site', value: loading ? '—' : stats.new_site.toLocaleString() },
  ];

  const handleSendBatch = async () => {
    if (massLeads.length === 0) return;
    setSendState('loading');

    const { data, error } = await supabase.functions.invoke('send-outreach-emails');

    if (error || !data?.success) {
      setSendState('error');
      setTimeout(() => setSendState('idle'), 4000);
      return;
    }

    if (data.sent > 0) {
      setSentCount(data.sent);
      setSendState('success');
      refetch();
      setTimeout(() => setSendState('idle'), 5000);
      return;
    }

    // Poll DB for confirmation (handles async send delays)
    const startLen = massLeads.length;
    const start = Date.now();
    const poll = setInterval(async () => {
      await refetch();
      if (massLeads.length < startLen) {
        setSendState('success');
        clearInterval(poll);
        setTimeout(() => setSendState('idle'), 4000);
      } else if (Date.now() - start > 30000) {
        setSendState('error');
        clearInterval(poll);
        setTimeout(() => setSendState('idle'), 4000);
      }
    }, 3000);
  };

  const sendBtnStyle = {
    idle: 'bg-purple-primary hover:bg-purple-primary/90 text-white',
    loading: 'bg-purple-primary/40 text-white/60 cursor-not-allowed',
    success: 'bg-green-500/80 text-white',
    error: 'bg-red-500/80 text-white',
  };

  const sendBtnLabel = {
    idle: `Approve Batch → Send via Gmail (${massLeads.length})`,
    loading: 'Sending…',
    success: sentCount > 0 ? `Sent ${sentCount} emails ✓` : 'Sent ✓',
    error: 'Send failed — retry',
  };

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
        {/* ── Front face ── */}
        <div
          className="h-full overflow-y-auto"
          style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
        >
          <div className="p-6 space-y-5 min-h-full flex flex-col">

            {/* Tabs */}
            <div className="flex gap-6 border-b border-white/[0.06]">
              <button
                onClick={() => setActiveTab('mass')}
                className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'mass' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}
              >
                Mass Email ({loading ? '…' : massLeads.length})
                {activeTab === 'mass' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
              </button>
              <button
                onClick={() => setActiveTab('hot')}
                className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'hot' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}
              >
                Hot Leads ({loading ? '…' : hotLeads.length})
                {activeTab === 'hot' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
              </button>
            </div>

            {activeTab === 'mass' ? (
              <>
                {/* Stats strip */}
                <div className="grid grid-cols-4 gap-3">
                  {statsTiles.map((tile) => (
                    <div key={tile.label} className="liquid-glass rounded-card p-4 text-center">
                      <p className="text-2xl font-bold text-white leading-none">{tile.value}</p>
                      <p className="text-xs font-semibold text-white/60 mt-1.5">{tile.label}</p>
                    </div>
                  ))}
                </div>

                {/* Lead cards */}
                {loading ? (
                  <div className="py-10 text-center text-white/30 text-sm">Loading leads…</div>
                ) : massLeads.length === 0 ? (
                  <div className="liquid-glass rounded-card p-8 text-center flex-1">
                    <p className="text-white/40 text-sm font-medium">No scored leads with email</p>
                    <p className="text-white/25 text-xs mt-1">Run scraper + enrichment to fill the queue</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 flex-1">
                    {massLeads.slice(0, 12).map((lead) => {
                      const score = lead.score?.value_add_score ?? 0;
                      const demoType = (lead.demo_type ?? 'email_only').toLowerCase();
                      const services = lead.score?.applicable_services ?? [];
                      const accentColor = score >= 5
                        ? '2px solid rgba(168,85,247,0.5)'
                        : score >= 3
                        ? '2px solid rgba(123,57,252,0.35)'
                        : '2px solid rgba(255,255,255,0.08)';

                      return (
                        <div
                          key={lead.id}
                          className="liquid-glass rounded-card p-4 hover:-translate-y-0.5 transition-transform"
                          style={{ borderTop: accentColor }}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-sm text-white truncate">{lead.company_name}</h4>
                              <p className="text-xs text-white/55 mt-0.5 truncate">{lead.dm_name ?? lead.city ?? '—'}</p>
                            </div>
                            <ScoreRing score={score} max={7} size={32} />
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-tag liquid-glass text-xs text-white/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60 flex-shrink-0" />
                              {lead.niche}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-tag font-medium ${DEMO_COLORS[demoType] ?? DEMO_COLORS.email_only}`}>
                              {DEMO_LABELS[demoType] ?? demoType}
                            </span>
                          </div>

                          {services.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {services.slice(0, 3).map((s) => (
                                <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/35">
                                  {s.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {services.length > 3 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/25">
                                  +{services.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Send button */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={handleSendBatch}
                    disabled={sendState === 'loading' || massLeads.length === 0}
                    className={`w-full py-3.5 rounded-button font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${sendBtnStyle[sendState]}`}
                  >
                    {sendState === 'loading' && (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {sendBtnLabel[sendState]}
                  </button>
                  {massLeads.length > 12 && sendState === 'idle' && (
                    <p className="text-xs text-white/25 text-center mt-1.5">
                      Showing 12 of {massLeads.length} — all {massLeads.length} will be sent
                    </p>
                  )}
                </div>
              </>
            ) : (
              /* Hot leads tab */
              <div className="space-y-4 flex-1">
                {loading ? (
                  <div className="py-10 text-center text-white/30 text-sm">Loading hot leads…</div>
                ) : hotLeads.length === 0 ? (
                  <div className="liquid-glass rounded-card p-8 text-center">
                    <p className="text-white/40 text-sm font-medium">No hot leads yet</p>
                    <p className="text-white/25 text-xs mt-1">Hot leads have value_add_score ≥ 2 — run enrichment to score leads</p>
                  </div>
                ) : (
                  hotLeads.map((lead) => (
                    <HotLeadCard key={lead.id} lead={lead} onContacted={handleContacted} />
                  ))
                )}
              </div>
            )}
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
          <OutreachEngine />
        </div>
      </div>
    </div>
  );
}
