import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface IndeedJob {
  id: string;
  company_name: string;
  job_title: string;
  job_category: string;
  location: string | null;
  country: string;
  source: string;
  source_url: string | null;
  salary: string | null;
  hours_since_posted: number | null;
  repost_count: number;
  company_website: string | null;
  dm_email: string | null;
  email_found: boolean;
  template_used: string | null;
  email_subject: string | null;
  email_body: string | null;
  status: string;
  sent_via: string | null;
  created_at: string;
}

export interface IndeedStats {
  processing: number; // status='found' — being enriched right now
  ready: number;      // status='queued' — enriched, ready to review
  approved: number;   // status='approved' — user queued for sending
  sent: number;
  cap: number;
}

export function useIndeedJobs(limit = 50, dailyCap = 50) {
  const [jobs, setJobs] = useState<IndeedJob[]>([]);
  const [stats, setStats] = useState<IndeedStats>({ processing: 0, ready: 0, approved: 0, sent: 0, cap: dailyCap });
  const [loading, setLoading] = useState(true);

  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  useEffect(() => {
    const today = todayStart();
    const todayISO = today.toISOString();

    async function fetchInitial() {
      setLoading(true);
      try {
        const [visibleRes, processingRes, approvedRes, sentRes] = await Promise.all([
          // Show both queued (ready to review) and approved (user queued for send)
          supabase
            .from('indeed_jobs')
            .select('*')
            .gte('created_at', todayISO)
            .in('status', ['queued', 'approved', 'sent', 'opened', 'replied'])
            .order('repost_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit),
          // Count jobs still being processed
          supabase
            .from('indeed_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayISO)
            .eq('status', 'found'),
          // Count approved
          supabase
            .from('indeed_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayISO)
            .eq('status', 'approved'),
          // Count sent
          supabase
            .from('indeed_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayISO)
            .in('status', ['sent', 'opened', 'replied']),
        ]);

        const visible = visibleRes.data ?? [];
        setJobs(visible);
        setStats({
          processing: processingRes.count ?? 0,
          ready: visible.filter((j) => j.status === 'queued').length,
          approved: approvedRes.count ?? 0,
          sent: sentRes.count ?? 0,
          cap: dailyCap,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();

    // Real-time: fires when a job changes status
    const channel = supabase
      .channel('indeed_jobs_live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'indeed_jobs' },
        (payload) => {
          const updated = payload.new as IndeedJob;
          if (new Date(updated.created_at) < today) return;

          setJobs((prev) => {
            // If newly queued/approved — insert or update
            if (updated.status === 'queued' || updated.status === 'approved') {
              const exists = prev.find((j) => j.id === updated.id);
              if (exists) {
                return prev.map((j) => (j.id === updated.id ? updated : j));
              }
              return [updated, ...prev]
                .sort((a, b) => b.repost_count - a.repost_count)
                .slice(0, limit);
            }
            // If moved to sent/skipped — update in place (keep visible, show sent_via)
            if (updated.status === 'skipped') return prev.filter((j) => j.id !== updated.id);
            return prev.map((j) => (j.id === updated.id ? updated : j));
          });

          setStats((prev) => {
            const oldStatus = (payload.old as IndeedJob)?.status;
            const newStatus = updated.status;
            const delta: Partial<IndeedStats> = {};

            if (oldStatus === 'found' && newStatus === 'queued') {
              delta.processing = Math.max(0, prev.processing - 1);
              delta.ready = prev.ready + 1;
            } else if (oldStatus === 'queued' && newStatus === 'approved') {
              delta.ready = Math.max(0, prev.ready - 1);
              delta.approved = prev.approved + 1;
            } else if (oldStatus === 'approved' && newStatus === 'queued') {
              delta.approved = Math.max(0, prev.approved - 1);
              delta.ready = prev.ready + 1;
            } else if (newStatus === 'sent' || newStatus === 'opened' || newStatus === 'replied') {
              delta.sent = prev.sent + 1;
              if (oldStatus === 'approved') delta.approved = Math.max(0, prev.approved - 1);
            }

            return { ...prev, ...delta };
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'indeed_jobs' },
        (payload) => {
          const inserted = payload.new as IndeedJob;
          if (new Date(inserted.created_at) < today) return;
          setStats((prev) => ({ ...prev, processing: prev.processing + 1 }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, dailyCap]);

  // Queue a single job for sending (queued → approved)
  const queueJob = useCallback(async (id: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'approved' } : j)));
    setStats((prev) => ({ ...prev, ready: Math.max(0, prev.ready - 1), approved: prev.approved + 1 }));
    const { error } = await supabase.from('indeed_jobs').update({ status: 'approved' }).eq('id', id);
    if (error) {
      // Rollback on failure
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'queued' } : j)));
      setStats((prev) => ({ ...prev, ready: prev.ready + 1, approved: Math.max(0, prev.approved - 1) }));
    }
  }, []);

  // Dequeue a single job (approved → queued)
  const dequeueJob = useCallback(async (id: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'queued' } : j)));
    setStats((prev) => ({ ...prev, approved: Math.max(0, prev.approved - 1), ready: prev.ready + 1 }));
    const { error } = await supabase.from('indeed_jobs').update({ status: 'queued' }).eq('id', id);
    if (error) {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'approved' } : j)));
      setStats((prev) => ({ ...prev, approved: prev.approved + 1, ready: Math.max(0, prev.ready - 1) }));
    }
  }, []);

  // Queue ALL visible ready jobs at once
  const queueAll = useCallback(async () => {
    const readyIds = jobs.filter((j) => j.status === 'queued').map((j) => j.id);
    if (readyIds.length === 0) return;

    const readyCount = readyIds.length;
    setJobs((prev) =>
      prev.map((j) => (readyIds.includes(j.id) ? { ...j, status: 'approved' } : j))
    );
    setStats((prev) => ({
      ...prev,
      ready: Math.max(0, prev.ready - readyCount),
      approved: prev.approved + readyCount,
    }));

    const { error } = await supabase
      .from('indeed_jobs')
      .update({ status: 'approved' })
      .in('id', readyIds);

    if (error) {
      setJobs((prev) =>
        prev.map((j) => (readyIds.includes(j.id) ? { ...j, status: 'queued' } : j))
      );
      setStats((prev) => ({
        ...prev,
        ready: prev.ready + readyCount,
        approved: Math.max(0, prev.approved - readyCount),
      }));
    }
  }, [jobs]);

  // Dequeue ALL approved jobs at once
  const dequeueAll = useCallback(async () => {
    const approvedIds = jobs.filter((j) => j.status === 'approved').map((j) => j.id);
    if (approvedIds.length === 0) return;

    const count = approvedIds.length;
    setJobs((prev) =>
      prev.map((j) => (approvedIds.includes(j.id) ? { ...j, status: 'queued' } : j))
    );
    setStats((prev) => ({
      ...prev,
      approved: Math.max(0, prev.approved - count),
      ready: prev.ready + count,
    }));

    const { error } = await supabase
      .from('indeed_jobs')
      .update({ status: 'queued' })
      .in('id', approvedIds);

    if (error) {
      setJobs((prev) =>
        prev.map((j) => (approvedIds.includes(j.id) ? { ...j, status: 'approved' } : j))
      );
      setStats((prev) => ({
        ...prev,
        approved: prev.approved + count,
        ready: Math.max(0, prev.ready - count),
      }));
    }
  }, [jobs]);

  async function clearToday() {
    const today = todayStart();
    await supabase
      .from('indeed_jobs')
      .delete()
      .gte('created_at', today.toISOString());
    setJobs([]);
    setStats({ processing: 0, ready: 0, approved: 0, sent: 0, cap: dailyCap });
  }

  return { jobs, stats, loading, clearToday, queueJob, dequeueJob, queueAll, dequeueAll };
}
