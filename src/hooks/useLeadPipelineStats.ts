import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PipelineStats {
  new: number;
  enriched: number;
  scored: number;
  outreached: number;
  total: number;
}

export function useLeadPipelineStats() {
  const [stats, setStats] = useState<PipelineStats>({ new: 0, enriched: 0, scored: 0, outreached: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  async function fetchStats() {
    try {
      const [total, newLeads, enriched, scored, outreached] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'enriched'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'scored'),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'outreached'),
      ]);
      setStats({
        total: total.count ?? 0,
        new: newLeads.count ?? 0,
        enriched: enriched.count ?? 0,
        scored: scored.count ?? 0,
        outreached: outreached.count ?? 0,
      });
    } catch (_) {
      // fall back to zeros
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel('pipeline_stats_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { stats, loading };
}
