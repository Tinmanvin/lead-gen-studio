import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { dashboardStats, briefingItems, performanceBlocks, chartData, topLeads } from '@/data/mockData';

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

export default function Dashboard({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const [timeRange, setTimeRange] = useState('7D');

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Row 1 — Stats */}
      <div className="grid grid-cols-5 gap-4">
        {dashboardStats.map((stat) => (
          <div key={stat.label} className="liquid-glass rounded-card p-5 accent-hot">
            <p className="font-bold text-[clamp(1.75rem,2.5vw,2.5rem)] leading-none tracking-tight text-white">{stat.value}</p>
            <p className="text-xs font-medium uppercase tracking-wider text-white/35 mt-2">{stat.label}</p>
            <span className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-tag bg-purple-primary/20 text-purple-primary">{stat.trend}</span>
          </div>
        ))}
      </div>

      {/* Row 2 — Briefing (1/3) + Chart (2/3) */}
      <div className="grid grid-cols-3 gap-4">
        {/* Today's Briefing — compact */}
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

        {/* 7-Day Performance Chart */}
        <div className="liquid-glass rounded-card p-5 col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-[16px] text-white">7-Day Performance</h3>
            <div className="flex gap-1 liquid-glass rounded-button p-1">
              {['7D', '14D', '30D'].map((r) => (
                <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1 rounded-tag text-xs font-medium transition-colors ${timeRange === r ? 'bg-purple-primary text-white' : 'text-white/40 hover:text-white/70'}`}>{r}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7b39fc" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#7b39fc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="replyRate" name="Reply Rate" stroke="#7b39fc" strokeWidth={2} fill="url(#purpleGrad)" />
              <Line type="monotone" dataKey="demoClicks" name="Demo Clicks" stroke="rgba(164,132,215,0.7)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="emailsSent" name="Emails Sent" stroke="rgba(255,255,255,0.25)" strokeWidth={1} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 5 — Top Leads */}
      <div className="liquid-glass rounded-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-semibold text-[16px] text-white">Top Performing Leads</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50">This Week</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-white/35 border-b border-white/[0.06]">
                <th className="text-left py-3 font-medium">Company</th>
                <th className="text-left py-3 font-medium">Niche</th>
                <th className="text-left py-3 font-medium">Services Flagged</th>
                <th className="text-center py-3 font-medium">Score</th>
                <th className="text-right py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {topLeads.map((lead) => (
                <tr key={lead.company} className="border-b border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors">
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-primary/30 flex items-center justify-center text-xs font-semibold text-purple-primary">{lead.initials}</div>
                      <span className="font-semibold text-sm text-white">{lead.company}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-tag liquid-glass text-xs text-white/80">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lead.nicheColor }} />
                      {lead.niche}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-1.5">
                      {lead.services.map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 text-center"><ScoreRing score={lead.score} /></td>
                  <td className="py-3 text-right">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-tag ${lead.status === 'Booked' ? 'bg-purple-primary/30 text-purple-primary' : lead.status === 'Replied' ? 'bg-purple-primary/15 text-purple-primary/80' : 'bg-white/[0.06] text-white/50'}`}>{lead.status}</span>
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
