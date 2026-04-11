import { useEffect, useState } from 'react';
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
  created_at: string;
}

export interface IndeedStats {
  processing: number; // status='found' — being enriched right now
  ready: number;      // status='queued' — enriched, email found, ready to send
  sent: number;
  cap: number;
}

export function useIndeedJobs(limit = 50) {
  const [jobs, setJobs] = useState<IndeedJob[]>([]);
  const [stats, setStats] = useState<IndeedStats>({ processing: 0, ready: 0, sent: 0, cap: 50 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    async function fetchInitial() {
      setLoading(true);
      try {
        const [queuedRes, processingRes, sentRes] = await Promise.all([
          // Only fetch enriched + ready jobs (status = 'queued')
          supabase
            .from('indeed_jobs')
            .select('*')
            .gte('created_at', todayISO)
            .eq('status', 'queued')
            .order('repost_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit),
          // Count jobs still being processed
          supabase
            .from('indeed_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayISO)
            .eq('status', 'found'),
          // Count sent
          supabase
            .from('indeed_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayISO)
            .in('status', ['sent', 'opened', 'replied']),
        ]);

        setJobs(queuedRes.data ?? []);
        setStats({
          processing: processingRes.count ?? 0,
          ready: queuedRes.data?.length ?? 0,
          sent: sentRes.count ?? 0,
          cap: 50,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchInitial();

    // Real-time: fires when enrichment updates a job to status='queued'
    const channel = supabase
      .channel('indeed_jobs_live')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'indeed_jobs',
          filter: `status=eq.queued`,
        },
        (payload) => {
          const updated = payload.new as IndeedJob;
          // Skip if older than today
          if (new Date(updated.created_at) < today) return;

          setJobs((prev) => {
            const exists = prev.find((j) => j.id === updated.id);
            if (exists) {
              // Update in-place
              return prev.map((j) => (j.id === updated.id ? updated : j));
            }
            // New arrival — insert sorted by repost_count
            const next = [updated, ...prev]
              .sort((a, b) => b.repost_count - a.repost_count)
              .slice(0, limit);
            return next;
          });

          setStats((prev) => ({
            ...prev,
            ready: prev.ready + 1,
            processing: Math.max(0, prev.processing - 1),
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'indeed_jobs',
        },
        (payload) => {
          const inserted = payload.new as IndeedJob;
          if (new Date(inserted.created_at) < today) return;
          // New raw job scraped — bump processing count but don't show yet
          setStats((prev) => ({ ...prev, processing: prev.processing + 1 }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return { jobs, stats, loading };
}
