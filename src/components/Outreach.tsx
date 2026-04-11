import { useState } from 'react';
import { useLeads } from '@/hooks/useLeads';

export default function Outreach() {
  const [activeTab, setActiveTab] = useState<'mass' | 'hot'>('mass');

  // Mass email queue: all scored leads
  const { leads: massLeads, loading: massLoading } = useLeads(50, 'scored');
  // Hot leads: enriched leads (scored with value_add_score >= 2)
  const { leads: hotLeads, loading: hotLoading } = useLeads(30, 'enriched');

  const massCount = massLeads.length;
  const hotCount = hotLeads.filter(l => (l.score?.value_add_score ?? 0) >= 2).length;
  const topHotLeads = hotLeads.filter(l => (l.score?.value_add_score ?? 0) >= 2);

  const batchStats = [
    { label: 'Total in Queue', value: massLoading ? '—' : massCount.toString() },
    { label: 'With Demo Type', value: massLoading ? '—' : massLeads.filter(l => l.score?.demo_type && l.score.demo_type !== 'EMAIL_ONLY').length.toString() },
    { label: 'Email Only', value: massLoading ? '—' : massLeads.filter(l => l.score?.demo_type === 'EMAIL_ONLY').length.toString() },
    { label: 'Avg Score', value: massLoading ? '—' : massLeads.length ? Math.round(massLeads.reduce((sum, l) => sum + (l.score?.total_score ?? 0), 0) / massLeads.length).toString() : '—' },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex gap-6 border-b border-white/[0.06]">
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
