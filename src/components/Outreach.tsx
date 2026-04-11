import { useState } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { useTriggerRun } from '@/hooks/useTriggerRun';

export default function Outreach() {
  const [activeTab, setActiveTab] = useState<'mass' | 'hot'>('mass');
  const { trigger, getState } = useTriggerRun();

  const { leads: massLeads, loading: massLoading } = useLeads(50, 'scored');
  const { leads: hotLeads, loading: hotLoading } = useLeads(30, 'enriched');

  const massCount = massLeads.length;
  const hotCount = hotLeads.filter(l => (l.score?.value_add_score ?? 0) >= 2).length;
  const topHotLeads = hotLeads.filter(l => (l.score?.value_add_score ?? 0) >= 2);

  const runState = getState('main-full-run');
  const runLabel = { idle: 'Run Now', loading: 'Triggering…', success: 'Triggered ✓', error: 'Failed — retry' }[runState];
  const runStyle = {
    idle:    'bg-purple-primary hover:bg-purple-primary/90 text-white',
    loading: 'bg-purple-primary/40 text-white/60 cursor-not-allowed',
    success: 'bg-green-500/80 text-white',
    error:   'bg-red-500/80 text-white',
  }[runState];

  const batchStats = [
    { label: 'Total in Queue', value: massLoading ? '—' : massCount.toString() },
    { label: 'With Demo Type', value: massLoading ? '—' : massLeads.filter(l => l.score?.demo_type && l.score.demo_type !== 'EMAIL_ONLY').length.toString() },
    { label: 'Email Only', value: massLoading ? '—' : massLeads.filter(l => l.score?.demo_type === 'EMAIL_ONLY').length.toString() },
    { label: 'Avg Score', value: massLoading ? '—' : massLeads.length ? Math.round(massLeads.reduce((sum, l) => sum + (l.score?.total_score ?? 0), 0) / massLeads.length).toString() : '—' },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-end justify-between border-b border-white/[0.06]">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('mass')}
            className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'mass' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}
          >
            Mass Email ({massLoading ? '…' : massCount})
            {activeTab === 'mass' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
          </button>
          <button
            onClick={() => setActiveTab('hot')}
            className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'hot' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}
          >
            Hot Leads ({hotLoading ? '…' : hotCount})
            {activeTab === 'hot' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
          </button>
        </div>
        <button
          onClick={() => trigger('main-full-run')}
          disabled={runState === 'loading'}
          className={`mb-2.5 px-4 py-1.5 rounded-button text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${runStyle}`}
        >
          {runState === 'loading' ? (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : runState === 'success' ? (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          )}
          {runLabel}
        </button>
      </div>

      {activeTab === 'mass' ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            {batchStats.map((s) => (
              <div key={s.label} className="liquid-glass rounded-card p-5 accent-hot">
                <p className="font-bold text-2xl leading-none tracking-tight text-white">{s.value}</p>
                <p className="text-xs font-medium uppercase tracking-wider text-white/35 mt-2">{s.label}</p>
              </div>
            ))}
          </div>

          {massLoading ? (
            <div className="py-12 text-center text-white/30 text-sm">Loading leads…</div>
          ) : massLeads.length === 0 ? (
            <div className="liquid-glass rounded-card p-8 text-center">
              <p className="text-white/50 text-sm">No scored leads yet.</p>
              <p className="text-white/30 text-xs mt-1">Run the scraper to populate the queue.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
              {massLeads.slice(0, 12).map((lead) => {
                const tier = (lead.score?.value_add_score ?? 0) >= 3 ? 'hot' : (lead.score?.value_add_score ?? 0) >= 1 ? 'standard' : 'cold';
                return (
                  <div
                    key={lead.id}
                    className={`liquid-glass rounded-card p-4 hover:-translate-y-0.5 transition-transform cursor-pointer ${tier === 'hot' ? 'accent-hot' : tier === 'standard' ? 'accent-standard' : 'accent-cold'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-white truncate">{lead.company_name}</h4>
                        <p className="text-sm text-white/65 mt-0.5 truncate">{lead.dm_name ?? lead.city ?? '—'}</p>
                      </div>
                      {lead.score?.total_score && (
                        <span className="text-xs font-semibold text-purple-primary bg-purple-primary/10 px-2 py-0.5 rounded-tag flex-shrink-0">
                          {lead.score.total_score}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{lead.niche}</span>
                      {lead.score?.demo_type && lead.score.demo_type !== 'EMAIL_ONLY' && (
                        <span className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50">{lead.score.demo_type}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/40">{lead.country}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button className="w-full py-3.5 rounded-button bg-purple-primary text-white font-semibold text-sm hover:bg-purple-primary/90 transition-colors disabled:opacity-40" disabled={massLeads.length === 0}>
            Approve Batch → Send via Instantly
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {hotLoading ? (
            <div className="py-12 text-center text-white/30 text-sm">Loading hot leads…</div>
          ) : topHotLeads.length === 0 ? (
            <div className="liquid-glass rounded-card p-8 text-center">
              <p className="text-white/50 text-sm">No hot leads yet.</p>
              <p className="text-white/30 text-xs mt-1">Hot leads appear once scoring and enrichment runs.</p>
            </div>
          ) : (
            topHotLeads.map((lead) => (
              <div key={lead.id} className="liquid-glass rounded-card p-5 accent-hot">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-white">{lead.company_name}</h4>
                    <p className="text-sm text-white/65">{lead.dm_name ?? lead.city ?? '—'} · {lead.country}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{lead.niche}</span>
                      {lead.score?.signals?.map((sig) => (
                        <span key={sig} className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50">{sig.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </div>
                  {lead.score?.total_score && (
                    <span className="text-lg font-bold text-purple-primary">{lead.score.total_score}</span>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2 flex-wrap">
                    {lead.dm_linkedin_url && (
                      <a href={lead.dm_linkedin_url} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-button text-xs font-medium bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30 transition-colors">
                        LinkedIn ↗
                      </a>
                    )}
                    {lead.dm_whatsapp && (
                      <a href={`https://wa.me/${lead.dm_whatsapp}`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-button text-xs font-medium bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30 transition-colors">
                        WhatsApp ↗
                      </a>
                    )}
                    {lead.dm_email && (
                      <span className="px-3 py-1.5 rounded-button text-xs font-medium bg-purple-primary/20 text-purple-primary/80">
                        {lead.dm_email}
                      </span>
                    )}
                  </div>
                  <button className="text-xs text-white/40 hover:text-white/70 transition-colors border border-white/[0.08] px-3 py-1.5 rounded-button">
                    Mark as Contacted
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
