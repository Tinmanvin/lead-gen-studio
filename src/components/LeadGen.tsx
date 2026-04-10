import { useState } from 'react';
import { geographySettings } from '@/data/mockData';
import { useLeads, useLeadCounts } from '@/hooks/useLeads';

const ScoreRing = ({ score, size = 32 }: { score: number; size?: number }) => {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#7b39fc" strokeWidth="2.5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={9} fontWeight="700" className="transform rotate-90 origin-center">{score}</text>
    </svg>
  );
};

const EngineRoom = () => (
  <div className="p-6 space-y-5">
    <div className="liquid-glass rounded-card p-5">
      <h3 className="font-semibold text-[16px] text-white mb-4">Geography</h3>
      {geographySettings.map((g, i) => (
        <div key={g.country} className="flex items-center justify-between py-3" style={{ borderBottom: i < geographySettings.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <span className="text-sm text-white">{g.flag} {g.country}</span>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Scrape</span>
              <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${g.scrape ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${g.scrape ? 'right-0.5' : 'left-0.5'}`} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50">Outreach</span>
              <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${g.outreach ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${g.outreach ? 'right-0.5' : 'left-0.5'}`} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="liquid-glass rounded-card p-5">
      <h3 className="font-semibold text-[16px] text-white mb-4">Data Sources</h3>
      {['Google Maps AU/UK', 'AHPRA', 'HiPages', 'FCA Register', 'Yell', 'Checkatrade', 'Trustpilot', 'OpenCorporates'].map((s, i, arr) => (
        <div key={s} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
          <span className="text-sm text-white">{s}</span>
          <div className="w-10 h-5 rounded-full bg-purple-primary relative cursor-pointer">
            <div className="w-4 h-4 rounded-full bg-white absolute top-0.5 right-0.5 transition-all" />
          </div>
        </div>
      ))}
    </div>
    <div className="liquid-glass rounded-card p-5">
      <h3 className="font-semibold text-[16px] text-white mb-4">Scrape Schedule</h3>
      <p className="text-sm text-white/65">Daily at <span className="text-white font-semibold">2:00 AM UTC</span> · Enrichment at <span className="text-white font-semibold">6:00 AM UTC</span></p>
    </div>
  </div>
);

export default function LeadGen({ showEngine, onToggleEngine }: { showEngine?: boolean; onToggleEngine?: () => void }) {
  const [activeTab, setActiveTab] = useState<'mass' | 'hot'>('mass');
  const [expandedHot, setExpandedHot] = useState<string | null>(null);

  const { leads: allLeads, loading: leadsLoading } = useLeads(100);
  const { counts } = useLeadCounts();

  const massLeads = allLeads.filter(l => !l.score || l.score.value_add_score < 2);
  const hotLeads = allLeads.filter(l => l.score && l.score.value_add_score >= 2);

  const summaryStats = [
    { label: 'Total Queue', value: leadsLoading ? '—' : counts.total.toLocaleString() },
    { label: 'Hot Leads', value: leadsLoading ? '—' : counts.hot.toLocaleString() },
    { label: 'Scored', value: leadsLoading ? '—' : counts.scored.toLocaleString() },
    { label: 'With Email', value: leadsLoading ? '—' : allLeads.filter(l => l.dm_email).length.toString() },
  ];

  return (
    <div className="h-full overflow-hidden" style={{ perspective: '1200px' }}>
      <div
        className="h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: showEngine ? 'rotateY(180deg)' : 'rotateY(0)',
          transition: 'transform 500ms ease-in-out',
        }}
      >
        {/* Front — Queue */}
        {!showEngine && (
          <div className="p-6 space-y-6 overflow-y-auto h-full" style={{ backfaceVisibility: 'hidden' }}>
            <div className="flex gap-6 border-b border-white/[0.06]">
              <button onClick={() => setActiveTab('mass')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'mass' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
                Mass Email ({leadsLoading ? '…' : massLeads.length})
                {activeTab === 'mass' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
              </button>
              <button onClick={() => setActiveTab('hot')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'hot' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
                Hot Leads ({leadsLoading ? '…' : hotLeads.length})
                {activeTab === 'hot' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
              </button>
            </div>

            {activeTab === 'mass' ? (
              <>
                <div className="grid grid-cols-4 gap-4">
                  {summaryStats.map((s) => (
                    <div key={s.label} className="liquid-glass rounded-card p-4 text-center">
                      <p className="text-2xl font-bold text-white">{s.value}</p>
                      <p className="text-xs uppercase tracking-wider text-white/35 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {leadsLoading ? (
                  <div className="text-center py-10 text-white/30 text-sm">Loading leads…</div>
                ) : massLeads.length === 0 ? (
                  <div className="liquid-glass rounded-card p-8 text-center">
                    <p className="text-white/30 text-sm">No leads yet — deploy the scraper to start filling the queue.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                    {massLeads.slice(0, 12).map((lead) => (
                      <div key={lead.id} className="liquid-glass rounded-card p-4 hover:-translate-y-0.5 transition-transform cursor-pointer accent-standard">
                        <div className="flex justify-between items-start">
                          <div className="min-w-0 flex-1 mr-2">
                            <h4 className="font-semibold text-sm text-white truncate">{lead.company_name}</h4>
                            <p className="text-sm text-white/65 mt-0.5 truncate">{lead.dm_name ?? lead.city ?? '—'}</p>
                          </div>
                          <ScoreRing score={Math.min(lead.score?.total_score ?? 0, 100)} />
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-tag liquid-glass text-xs text-white/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60" />
                            {lead.niche}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {lead.score?.demo_type && (
                            <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{lead.score.demo_type}</span>
                          )}
                          {lead.dm_email && (
                            <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/20 text-purple-primary font-medium">Email Found</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <button className="w-full py-3.5 rounded-button bg-purple-primary text-white font-semibold text-sm hover:bg-purple-primary/90 transition-colors">
                  Approve Batch → Send via Instantly
                </button>
              </>
            ) : (
              <div className="space-y-4">
                {leadsLoading ? (
                  <div className="text-center py-10 text-white/30 text-sm">Loading hot leads…</div>
                ) : hotLeads.length === 0 ? (
                  <div className="liquid-glass rounded-card p-8 text-center">
                    <p className="text-white/30 text-sm">No hot leads yet — enrichment + scoring needs to run first.</p>
                  </div>
                ) : hotLeads.map((lead) => (
                  <div key={lead.id} className="liquid-glass rounded-card p-5 accent-hot cursor-pointer hover:-translate-y-0.5 transition-transform" onClick={() => setExpandedHot(expandedHot === lead.id ? null : lead.id)}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-white">{lead.company_name}</h4>
                        <p className="text-sm text-white/65 mt-0.5">{lead.dm_name ?? '—'}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-tag liquid-glass text-xs text-white/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/60" />
                            {lead.niche}
                          </span>
                          {lead.score?.demo_type && (
                            <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{lead.score.demo_type}</span>
                          )}
                        </div>
                      </div>
                      <ScoreRing score={Math.min(lead.score?.total_score ?? 0, 100)} size={40} />
                    </div>
                    {expandedHot === lead.id && (
                      <div className="mt-4 pt-4 border-t border-white/[0.06]">
                        <p className="text-xs uppercase tracking-wider text-white/35 mb-3">Contact channels</p>
                        <div className="flex gap-2">
                          {(['email', 'linkedin', 'whatsapp'] as const).map((ch) => {
                            const available = ch === 'email' ? !!lead.dm_email : ch === 'linkedin' ? !!lead.dm_linkedin_url : !!lead.dm_whatsapp;
                            return (
                              <button key={ch} className={`px-3 py-1.5 rounded-button text-xs font-medium transition-colors ${available ? 'bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30' : 'bg-white/[0.04] text-white/20 cursor-not-allowed'}`}>
                                {ch.charAt(0).toUpperCase() + ch.slice(1)} {available ? '✓' : '✗'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Back — Engine Room */}
        {showEngine && (
          <div className="h-full overflow-y-auto" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <EngineRoom />
          </div>
        )}
      </div>
    </div>
  );
}
