import { useState } from 'react';
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, Bar, BarChart } from 'recharts';
import { useLeads, useLeadCounts, useLeadsPerDay } from '@/hooks/useLeads';
import { useTriggerRun } from '@/hooks/useTriggerRun';

const NICHE_COLORS: Record<string, string> = {
  dental: '#22c55e', healthcare: '#22c55e', medical: '#22c55e',
  legal: '#8b5cf6', law: '#8b5cf6',
  finance: '#3b82f6', mortgage: '#3b82f6',
  trades: '#f59e0b', plumbing: '#f59e0b', electrical: '#f59e0b',
  beauty: '#ec4899', fitness: '#f59e0b',
};

function nicheColor(niche: string) {
  const key = niche.toLowerCase();
  for (const [k, v] of Object.entries(NICHE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#7b39fc';
}

const ScoreRing = ({ score, size = 36 }: { score: number; size?: number }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#7b39fc" strokeWidth="3" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={size * 0.3} fontWeight="700" className="transform rotate-90 origin-center">{score}</text>
    </svg>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="liquid-glass rounded-[12px] p-3 text-xs">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.stroke }} className="opacity-90">{p.name}: {p.value}{p.name === 'Reply Rate' ? '%' : ''}</p>
      ))}
    </div>
  );
};

type RunState = 'idle' | 'loading' | 'success' | 'error';

function RunButton({
  label,
  sublabel,
  state,
  onClick,
}: {
  label: string;
  sublabel: string;
  state: RunState;
  onClick: () => void;
}) {
  const isDisabled = state === 'loading';

  const buttonContent = {
    idle: (
      <span className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
        Run Now
      </span>
    ),
    loading: (
      <span className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Triggering…
      </span>
    ),
    success: (
      <span className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Triggered ✓
      </span>
    ),
    error: (
      <span className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Failed — retry
      </span>
    ),
  };

  const buttonColor = {
    idle: 'bg-purple-primary hover:bg-purple-primary/90 text-white',
    loading: 'bg-purple-primary/50 text-white/70 cursor-not-allowed',
    success: 'bg-green-500/80 text-white',
    error: 'bg-red-500/80 text-white',
  };

  return (
    <div className="bg-white/[0.04] rounded-[12px] p-4 border border-white/[0.06] flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/35 mt-0.5 truncate">{sublabel}</p>
      </div>
      <button
        onClick={onClick}
        disabled={isDisabled}
        className={`flex-shrink-0 px-4 py-2 rounded-button text-xs font-semibold transition-all duration-200 ${buttonColor[state]}`}
      >
        {buttonContent[state]}
      </button>
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const [timeRange, setTimeRange] = useState('7D');
  const { counts, loading: countsLoading } = useLeadCounts();
  const { leads: topLeads, loading: leadsLoading } = useLeads(5, 'scored');
  const days = timeRange === '7D' ? 7 : timeRange === '14D' ? 14 : 30;
  const { data: leadsPerDay, loading: chartLoading } = useLeadsPerDay(days);
  const { trigger, getState } = useTriggerRun();

  const briefingItems = [
    counts.hot > 0
      ? { color: '#ef4444', text: `${counts.hot} hot leads ready for manual outreach`, screen: 'outreach', dotOpacity: 0.7 }
      : { color: 'rgba(255,255,255,0.2)', text: 'No hot leads yet — scraper needs to run', screen: 'leadgen', dotOpacity: 1 },
    counts.scored > 0
      ? { color: '#f59e0b', text: `${counts.scored} scored leads in outreach queue`, screen: 'outreach', dotOpacity: 0.7 }
      : { color: 'rgba(255,255,255,0.2)', text: 'No scored leads yet — enrichment pending', screen: 'leadgen', dotOpacity: 1 },
    counts.total > 0
      ? { color: '#7b39fc', text: `${counts.total.toLocaleString()} total leads in system`, screen: 'leadgen', dotOpacity: 0.7 }
      : { color: 'rgba(255,255,255,0.2)', text: 'No leads scraped yet — deploy scraper to begin', screen: 'leadgen', dotOpacity: 1 },
    { color: 'rgba(255,255,255,0.2)', text: 'LinkedIn Director — scraper not built yet', screen: 'linkedin', dotOpacity: 1 },
    { color: 'rgba(255,255,255,0.2)', text: 'Indeed Hijacker — scraper not built yet', screen: 'indeed', dotOpacity: 1 },
  ];

  const stats = [
    { label: 'Total Leads', value: countsLoading ? '—' : counts.total.toLocaleString(), trend: 'Live' },
    { label: 'Scored', value: countsLoading ? '—' : counts.scored.toLocaleString(), trend: 'Live' },
    { label: 'Hot Leads', value: countsLoading ? '—' : counts.hot.toLocaleString(), trend: 'score ≥2' },
    { label: 'Reply Rate', value: '—', trend: 'soon' },
    { label: 'Pipeline', value: '—', trend: 'soon' },
  ];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Row 1 — Stats */}
      <div className="grid grid-cols-5 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="liquid-glass rounded-card p-5 accent-hot">
            <p className="font-bold text-[clamp(1.75rem,2.5vw,2.5rem)] leading-none tracking-tight text-white">{stat.value}</p>
            <p className="text-xs font-medium uppercase tracking-wider text-white/35 mt-2">{stat.label}</p>
            <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-tag bg-purple-primary/20 text-purple-primary">{stat.trend}</span>
          </div>
        ))}
      </div>

      {/* Row 2 — Briefing (1/3) + Chart (2/3) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="liquid-glass rounded-card p-5 col-span-1">
          <h3 className="font-semibold text-[16px] text-white mb-4">Today's Briefing</h3>
          <div className="space-y-1">
            {briefingItems.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-purple-primary/10 cursor-pointer transition-colors group"
                onClick={() => onNavigate?.(item.screen)}
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: item.color, opacity: item.dotOpacity }} />
                <span className="text-sm text-white/80 group-hover:text-purple-primary transition-colors leading-snug">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="liquid-glass rounded-card p-5 col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-[16px] text-white">Leads Scraped</h3>
            <div className="flex gap-1 liquid-glass rounded-button p-1">
              {['7D', '14D', '30D'].map((r) => (
                <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 rounded-tag text-xs font-medium transition-colors ${timeRange === r ? 'bg-purple-primary text-white' : 'text-white/40 hover:text-white/70'}`}>{r}</button>
              ))}
            </div>
          </div>
          {chartLoading ? (
            <div className="h-[200px] flex items-center justify-center text-white/30 text-sm">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={leadsPerDay}>
                <defs>
                  <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7b39fc" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#7b39fc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#7b39fc" strokeWidth={2} fill="url(#purpleGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Run Controls */}
      <div className="liquid-glass rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[16px] text-white">Manual Controls</h3>
            <p className="text-xs text-white/35 mt-0.5">Trigger scrapers manually for testing — scheduled runs continue automatically</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <RunButton
            label="Run Main Scraper"
            sublabel="Google Maps · AHPRA · HiPages · Yell + more"
            state={getState('main-scrape')}
            onClick={() => trigger('main-scrape')}
          />
          <RunButton
            label="Run Enrichment"
            sublabel="Signal check · scoring · email finding · icebreaker"
            state={getState('main-enrich')}
            onClick={() => trigger('main-enrich')}
          />
        </div>
      </div>

      {/* Top Leads — real data */}
      <div className="liquid-glass rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-semibold text-[16px] text-white">Top Scored Leads</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50">Live</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white/35 border-b border-white/[0.06]">
                <th className="text-left py-3 font-medium">Company</th>
                <th className="text-left py-3 font-medium">Niche</th>
                <th className="text-left py-3 font-medium">Demo Type</th>
                <th className="text-center py-3 font-medium">Score</th>
                <th className="text-right py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leadsLoading ? (
                <tr><td colSpan={5} className="py-6 text-center text-white/30 text-sm">Loading leads…</td></tr>
              ) : topLeads.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-white/30 text-sm">No scored leads yet — run the scraper first.</td></tr>
              ) : topLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-primary/30 flex items-center justify-center text-xs font-semibold text-purple-primary">
                        {lead.company_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-white">{lead.company_name}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-tag liquid-glass text-xs text-white/80">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: nicheColor(lead.niche) }} />
                      {lead.niche}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">
                      {lead.score?.demo_type ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <ScoreRing score={Math.min(lead.score?.total_score ?? 0, 100)} />
                  </td>
                  <td className="py-3 text-right">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-tag ${lead.status === 'booked' ? 'bg-purple-primary/30 text-purple-primary' : lead.status === 'replied' ? 'bg-purple-primary/15 text-purple-primary/80' : 'bg-white/[0.06] text-white/50'}`}>
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
