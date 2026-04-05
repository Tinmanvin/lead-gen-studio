import { useState } from 'react';
import { massEmailLeads, hotLeads } from '@/data/mockData';

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

export default function LeadGen() {
  const [activeTab, setActiveTab] = useState<'mass' | 'hot'>('mass');
  const [showEngine, setShowEngine] = useState(false);
  const [expandedHot, setExpandedHot] = useState<number | null>(null);

  const summaryStats = [
    { label: 'Plain Email', value: 156 },
    { label: 'Widget Demos', value: 89 },
    { label: 'Redesigns', value: 42 },
    { label: 'New Sites', value: 25 },
  ];

  if (showEngine) {
    return (
      <div className="p-6 h-full" style={{ perspective: '1000px' }}>
        <div className="animate-in" style={{ animation: 'flipIn 400ms ease-in-out' }}>
          <button onClick={() => setShowEngine(false)} className="text-sm text-white/50 hover:text-white mb-6 transition-colors">← Back to Queue</button>
          <div className="grid grid-cols-2 gap-6">
            {['Geography Toggles', 'Data Source Toggles', 'Scrape Schedule', 'Signal Filters'].map((section) => (
              <div key={section} className="liquid-glass rounded-card p-6">
                <h3 className="font-semibold text-white mb-4">{section}</h3>
                <div className="space-y-3">
                  {['Setting A', 'Setting B', 'Setting C'].map((s) => (
                    <div key={s} className="flex items-center justify-between py-2">
                      <span className="text-sm text-white/65">{s}</span>
                      <div className="w-10 h-5 rounded-full bg-purple-primary/30 relative cursor-pointer">
                        <div className="w-4 h-4 rounded-full bg-purple-primary absolute top-0.5 right-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Sub-tabs */}
      <div className="flex gap-6 border-b border-white/[0.06]">
        <button onClick={() => setActiveTab('mass')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'mass' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
          Mass Email (312)
          {activeTab === 'mass' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
        </button>
        <button onClick={() => setActiveTab('hot')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'hot' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
          Hot Leads (27)
          {activeTab === 'hot' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
        </button>
      </div>

      {activeTab === 'mass' ? (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-4">
            {summaryStats.map((s) => (
              <div key={s.label} className="liquid-glass rounded-card p-4 text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs uppercase tracking-wider text-white/35 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Lead cards grid */}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {massEmailLeads.map((lead, i) => (
              <div key={i} className={`liquid-glass rounded-card p-4 hover:-translate-y-0.5 transition-transform cursor-pointer ${lead.tier === 'hot' ? 'accent-hot' : lead.tier === 'standard' ? 'accent-standard' : 'accent-cold'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-sm text-white">{lead.company}</h4>
                    <p className="text-sm text-white/65 mt-0.5">{lead.dm}</p>
                  </div>
                  <ScoreRing score={lead.score} />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-tag liquid-glass text-xs text-white/80">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lead.nicheColor }} />
                    {lead.niche}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lead.services.map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{s}</span>
                  ))}
                </div>
                {lead.hasDemoReady && (
                  <span className="inline-block mt-3 text-xs px-2 py-0.5 rounded-tag bg-purple-primary/20 text-purple-primary font-medium">Demo Ready</span>
                )}
              </div>
            ))}
          </div>

          {/* Approve button */}
          <button className="w-full py-3.5 rounded-button bg-purple-primary text-white font-semibold text-sm hover:bg-purple-primary/90 transition-colors">
            Approve Batch → Send via Instantly
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {hotLeads.map((lead, i) => (
            <div key={i} className="liquid-glass rounded-card p-5 accent-hot cursor-pointer hover:-translate-y-0.5 transition-transform" onClick={() => setExpandedHot(expandedHot === i ? null : i)}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-white">{lead.company}</h4>
                  <p className="text-sm text-white/65 mt-0.5">{lead.dm}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-tag liquid-glass text-xs text-white/80">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lead.nicheColor }} />
                      {lead.niche}
                    </span>
                    {lead.services.map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{s}</span>
                    ))}
                  </div>
                </div>
                <ScoreRing score={lead.score} size={40} />
              </div>
              {expandedHot === i && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <p className="text-xs uppercase tracking-wider text-white/35 mb-3">Multi-channel outreach</p>
                  <div className="flex gap-2">
                    {Object.entries(lead.channels).map(([ch, available]) => (
                      <button key={ch} className={`px-3 py-1.5 rounded-button text-xs font-medium transition-colors ${available ? 'bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30' : 'bg-white/[0.04] text-white/20 cursor-not-allowed'}`}>
                        {ch.charAt(0).toUpperCase() + ch.slice(1)} {available ? '✓' : '✗'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
