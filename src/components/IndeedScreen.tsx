import { useState } from 'react';
import { indeedJobs } from '@/data/mockData';

export default function IndeedScreen() {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const sent = 28;
  const cap = 50;

  const statusColor = (s: string) => {
    switch (s) {
      case 'Queued': return 'text-white/40';
      case 'Sent': return 'text-white/70';
      case 'Opened': return 'text-purple-primary';
      case 'Replied': return 'text-purple-primary font-bold';
      default: return 'text-white/40';
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Progress bar */}
      <div className="liquid-glass rounded-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/65">{sent} / {cap} sent today</span>
          <span className="text-xs text-white/35">34 auto-fired today</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-purple-primary transition-all" style={{ width: `${(sent / cap) * 100}%` }} />
        </div>
      </div>

      {/* Job rows */}
      <div className="space-y-3">
        {indeedJobs.map((job, i) => (
          <div key={i} className="liquid-glass rounded-card overflow-hidden">
            <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors" onClick={() => setExpandedRow(expandedRow === i ? null : i)}>
              <div className="flex items-center gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-white">{job.company}</h4>
                  <span className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50 mt-1 inline-block">{job.jobTitle}</span>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs">
                <span className="text-white/50">Email: {job.emailFound ? <span className="text-green-400">✓</span> : <span className="text-white/20">✗</span>}</span>
                <span className="text-white/50">Template: {job.template}</span>
                <span className={statusColor(job.status)}>{job.status}</span>
                <span className="text-white/35">{job.time}</span>
              </div>
            </div>
            {expandedRow === i && job.email && (
              <div className="px-4 pb-4 pt-0 border-t border-white/[0.06]">
                <p className="text-xs uppercase tracking-wider text-white/35 mb-2 mt-3">Email Sent</p>
                <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{job.email}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
