import { useState } from 'react';
import { useIndeedJobs } from '@/hooks/useIndeedJobs';
import { useTriggerRun } from '@/hooks/useTriggerRun';

const SOURCE_LABELS: Record<string, string> = {
  indeed: 'Indeed',
  seek: 'Seek',
  reed: 'Reed',
  totaljobs: 'Totaljobs',
};

const SOURCE_COLORS: Record<string, string> = {
  indeed: 'bg-blue-500/20 text-blue-300',
  seek: 'bg-green-500/20 text-green-300',
  reed: 'bg-orange-500/20 text-orange-300',
  totaljobs: 'bg-purple-primary/20 text-purple-primary',
};

const statusColor = (s: string) => {
  switch (s) {
    case 'queued': return 'text-white/40';
    case 'sent': return 'text-white/70';
    case 'opened': return 'text-purple-primary';
    case 'replied': return 'text-purple-primary font-bold';
    case 'skipped': return 'text-white/20';
    default: return 'text-white/40';
  }
};

function RunBtn({
  label,
  state,
  onClick,
}: {
  label: string;
  state: 'idle' | 'loading' | 'success' | 'error';
  onClick: () => void;
}) {
  const styles = {
    idle: 'bg-purple-primary hover:bg-purple-primary/90 text-white',
    loading: 'bg-purple-primary/40 text-white/60 cursor-not-allowed',
    success: 'bg-green-500/80 text-white',
    error: 'bg-red-500/80 text-white',
  };
  const labels = {
    idle: label,
    loading: 'Triggering…',
    success: 'Triggered ✓',
    error: 'Failed',
  };
  return (
    <button
      onClick={onClick}
      disabled={state === 'loading'}
      className={`px-3 py-1.5 rounded-button text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${styles[state]}`}
    >
      {state === 'loading' ? (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : state === 'success' ? (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
        </svg>
      )}
      {labels[state]}
    </button>
  );
}

export default function IndeedScreen() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { jobs, stats, loading } = useIndeedJobs(50);
  const { trigger, getState } = useTriggerRun();

  const sentTotal = stats.sent;
  const cap = stats.cap;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Progress bar + controls */}
      <div className="liquid-glass rounded-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-white/65">
            {loading ? '—' : `${sentTotal} / ${cap} sent today`}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/35">
              {loading ? '' : `${stats.processing} processing · ${stats.ready} ready`}
            </span>
            <RunBtn
              label="Run Hijacker"
              state={getState('indeed-full-run')}
              onClick={() => trigger('indeed-full-run')}
            />
          </div>
        </div>
        <div className="w-full h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-primary transition-all"
            style={{ width: `${Math.min((sentTotal / cap) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Job rows */}
      {loading ? (
        <div className="py-12 text-center text-white/30 text-sm">Loading today's jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="liquid-glass rounded-card p-10 text-center space-y-2">
          <p className="text-white/50 text-sm font-medium">No jobs scraped yet today</p>
          <p className="text-white/25 text-xs">
            The Indeed Hijacker scraper runs daily. Once deployed it will scan Indeed, Seek, Reed, and Totaljobs automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="liquid-glass rounded-card overflow-hidden">
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
                onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm text-white">{job.company_name}</h4>
                      {job.repost_count > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 uppercase tracking-wide flex-shrink-0">
                          Reposted ×{job.repost_count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.06] text-white/50">
                        {job.job_title}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-tag ${SOURCE_COLORS[job.source] ?? SOURCE_COLORS.indeed}`}>
                        {SOURCE_LABELS[job.source] ?? job.source}
                      </span>
                      {job.location && (
                        <span className="text-xs text-white/30">{job.location}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-5 text-xs flex-shrink-0 ml-4">
                  {job.salary && (
                    <span className="text-white/40 hidden xl:block">{job.salary}</span>
                  )}
                  <span className="text-white/50">
                    Email: {job.email_found
                      ? <span className="text-green-400">✓</span>
                      : <span className="text-white/20">✗</span>}
                  </span>
                  {job.template_used && (
                    <span className="text-white/35 hidden lg:block">{job.template_used}</span>
                  )}
                  <span className={statusColor(job.status)}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                  {job.hours_since_posted != null && (
                    <span className="text-white/25">{job.hours_since_posted}h ago</span>
                  )}
                </div>
              </div>

              {expandedId === job.id && (
                <div className="px-4 pb-4 pt-0 border-t border-white/[0.06] space-y-3">
                  {job.email_body ? (
                    <>
                      {job.email_subject && (
                        <div className="mt-3">
                          <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Subject</p>
                          <p className="text-sm text-white/80 font-medium">{job.email_subject}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Email</p>
                        <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{job.email_body}</p>
                      </div>
                      {job.status === 'found' || job.status === 'queued' ? (
                        <div className="flex gap-2 mt-2">
                          <button className="px-4 py-1.5 rounded-button bg-purple-primary text-white text-xs font-semibold hover:bg-purple-primary/90 transition-colors">
                            Queue in Instantly
                          </button>
                          <button className="px-4 py-1.5 rounded-button border border-white/[0.08] text-white/40 text-xs hover:text-white/70 transition-colors">
                            Skip
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-white/30 mt-3 italic">No email generated — contact not found.</p>
                  )}
                  {job.company_website && (
                    <a
                      href={job.company_website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-purple-primary/70 hover:text-purple-primary transition-colors"
                    >
                      {job.company_website} ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
