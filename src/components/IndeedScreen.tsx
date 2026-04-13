"use client";

import { useState } from 'react';
import { useIndeedJobs } from '@/hooks/useIndeedJobs';
import { useIndeedSettings } from '@/hooks/useIndeedConfig';
import { useTriggerRun } from '@/hooks/useTriggerRun';
import IndeedConfigPanel from './IndeedConfigPanel';

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
    case 'approved': return 'text-green-400 font-semibold';
    case 'queued': return 'text-white/40';
    case 'sent': return 'text-white/70';
    case 'opened': return 'text-purple-primary';
    case 'replied': return 'text-purple-primary font-bold';
    case 'skipped': return 'text-white/20';
    default: return 'text-white/40';
  }
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'approved': return 'Queued ✓';
    case 'queued': return 'Ready';
    default: return s.charAt(0).toUpperCase() + s.slice(1);
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

export default function IndeedScreen({ showConfig }: { showConfig?: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { settings } = useIndeedSettings();
  const { jobs, stats, loading, clearToday, queueJob, dequeueJob, queueAll, dequeueAll } = useIndeedJobs(50, settings.daily_cap);
  const { trigger, getState, getError } = useTriggerRun();
  const [clearing, setClearing] = useState(false);

  const sentTotal = stats.sent;
  const cap = stats.cap;
  const readyCount = jobs.filter((j) => j.status === 'queued').length;
  const approvedCount = stats.approved;

  return (
    <div className="h-full overflow-hidden" style={{ perspective: '1200px' }}>
      <div
        className="h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: showConfig ? 'rotateY(180deg)' : 'rotateY(0)',
          transition: 'transform 500ms ease-in-out',
        }}
      >
        {/* Front — Jobs list */}
        <div className="p-6 space-y-4 overflow-y-auto h-full" style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}>

          {/* Progress bar + controls */}
          <div className="liquid-glass rounded-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/65">
                {loading ? '—' : `${sentTotal} / ${cap} sent today`}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/35">
                  {loading ? '' : `${stats.processing} processing · ${stats.ready} ready${approvedCount > 0 ? ` · ${approvedCount} queued` : ''}`}
                </span>

                {/* Queue All / Unqueue All toggle */}
                {(readyCount > 0 || approvedCount > 0) && (
                  readyCount > 0 ? (
                    <button
                      onClick={queueAll}
                      className="px-3 py-1.5 rounded-button text-xs font-semibold bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30 transition-all duration-200 border border-purple-primary/30"
                    >
                      Queue All ({readyCount})
                    </button>
                  ) : (
                    <button
                      onClick={dequeueAll}
                      className="px-3 py-1.5 rounded-button text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 border border-green-500/20 hover:border-red-500/20"
                    >
                      Unqueue All ({approvedCount})
                    </button>
                  )
                )}

                {/* Clear button */}
                {(jobs.length > 0 || stats.processing > 0) && (
                  <button
                    onClick={async () => {
                      setClearing(true);
                      await clearToday();
                      setClearing(false);
                    }}
                    disabled={clearing}
                    className="px-3 py-1.5 rounded-button text-xs font-medium border border-white/[0.08] text-white/30 hover:text-white/60 hover:border-white/20 transition-all duration-200 disabled:opacity-40"
                  >
                    {clearing ? 'Clearing…' : 'Clear'}
                  </button>
                )}

                {approvedCount > 0 && (
                  <RunBtn
                    label={`Send Queued (${approvedCount})`}
                    state={getState('indeed-send')}
                    onClick={() => trigger('indeed-send')}
                  />
                )}
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
            {(getError('indeed-send') || getError('indeed-full-run')) && (
              <p className="mt-2 text-xs text-red-400/80">
                Error: {getError('indeed-send') ?? getError('indeed-full-run')}
              </p>
            )}
          </div>

          {/* Job rows */}
          {loading ? (
            <div className="py-12 text-center text-white/30 text-sm">Loading today's jobs…</div>
          ) : jobs.length === 0 ? (
            <div className="liquid-glass rounded-card p-10 text-center space-y-2">
              <p className="text-white/50 text-sm font-medium">No jobs scraped yet today</p>
              <p className="text-white/25 text-xs">
                Hit Run Hijacker to start scraping, or wait for the 3am cron.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => {
                const isApproved = job.status === 'approved';
                const isExpanded = expandedId === job.id;

                return (
                  <div key={job.id} className="liquid-glass rounded-card overflow-hidden">
                    {/* Compact row */}
                    <div
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : job.id)}
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

                      <div className="flex items-center gap-3 text-xs flex-shrink-0 ml-4">
                        {job.salary && (
                          <span className="text-white/40 hidden xl:block">{job.salary}</span>
                        )}
                        <span className="text-white/50">
                          Email: {job.email_found
                            ? <span className="text-green-400">✓</span>
                            : <span className="text-white/20">✗</span>}
                        </span>
                        <span className={statusColor(job.status)}>
                          {statusLabel(job.status)}
                        </span>

                        {/* Compact Queue / Dequeue button — stop propagation so row doesn't expand */}
                        {(job.status === 'queued' || job.status === 'approved') && job.email_found && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              isApproved ? dequeueJob(job.id) : queueJob(job.id);
                            }}
                            className={`px-2.5 py-1 rounded-button text-[11px] font-semibold transition-all duration-200 flex-shrink-0 ${
                              isApproved
                                ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400 border border-green-500/20 hover:border-red-500/20'
                                : 'bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30 border border-purple-primary/30'
                            }`}
                            title={isApproved ? 'Remove from queue' : 'Add to send queue'}
                          >
                            {isApproved ? 'Queued ✓' : 'Queue'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded email preview */}
                    {isExpanded && (
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
                            {(job.status === 'queued' || job.status === 'approved') ? (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => isApproved ? dequeueJob(job.id) : queueJob(job.id)}
                                  className={`px-4 py-1.5 rounded-button text-xs font-semibold transition-colors ${
                                    isApproved
                                      ? 'bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400'
                                      : 'bg-purple-primary text-white hover:bg-purple-primary/90'
                                  }`}
                                >
                                  {isApproved ? 'Remove from Queue' : 'Queue in Instantly'}
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
                );
              })}
            </div>
          )}
        </div>

        {/* Back — Config panel */}
        <div className="h-full overflow-y-auto" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}>
          <IndeedConfigPanel />
        </div>
      </div>
    </div>
  );
}
