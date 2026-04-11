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
  scanned: number;
  queued: number;
  sent: number;
  cap: number;
}

export function useIndeedJobs(limit = 50) {
  const [jobs, setJobs] = useState<IndeedJob[]>([]);
  const [stats, setStats] = useState<IndeedStats>({ scanned: 0, queued: 0, sent: 0, cap: 50 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [jobsRes, queuedRes, sentRes] = await Promise.all([
          supabase
            .from('indeed_jobs')
            .select('*')
            .gte('created_at', today.toISOString())
            .order('repost_count', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit),
          supabase
            .from('indeed_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', today.toISOString())
            .eq('status', 'queued'),
          supabase
            .from('indeed_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', today.toISOString())
            .in('status', ['sent', 'opened', 'replied']),
        ]);

        setJobs(jobsRes.data ?? []);
        setStats({
          scanned: jobsRes.data?.length ?? 0,
          queued: queuedRes.count ?? 0,
          sent: sentRes.count ?? 0,
          cap: 50,
        });
      } catch (_) {
        // fall back to empty
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [limit]);

  return { jobs, stats, loading };
}
