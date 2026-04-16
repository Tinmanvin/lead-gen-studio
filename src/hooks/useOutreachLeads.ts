import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { EnrichedLead } from './useLeads';

export interface OutreachStats {
  total: number;
  email_only: number;
  widget: number;
  redesign: number;
  new_site: number;
  compound: number;
  hot: number; // value_add_score >= 2
}

export function useOutreachLeads(limit = 100) {
  const [leads, setLeads] = useState<EnrichedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OutreachStats>({
    total: 0, email_only: 0, widget: 0, redesign: 0, new_site: 0, compound: 0, hot: 0,
  });

  async function fetchLeads() {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, lead_scores(*)')
        .eq('status', 'scored')
        .not('dm_email', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const enriched: EnrichedLead[] = (data ?? []).map((row: any) => ({
        ...row,
        score: row.lead_scores?.[0] ?? undefined,
      }));

      setLeads(enriched);

      // Compute stats
      const s: OutreachStats = { total: enriched.length, email_only: 0, widget: 0, redesign: 0, new_site: 0, compound: 0, hot: 0 };
      enriched.forEach((l) => {
        const dt = (l.demo_type ?? 'EMAIL_ONLY').toLowerCase();
        if (dt === 'email_only') s.email_only++;
        else if (dt === 'widget') s.widget++;
        else if (dt === 'redesign') s.redesign++;
        else if (dt === 'new_site') s.new_site++;
        else if (dt === 'compound') s.compound++;
        if ((l.score?.value_add_score ?? 0) >= 2) s.hot++;
      });
      setStats(s);
    } catch (_) {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel('outreach_leads_live')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          const updated = payload.new as { status: string; id: string };
          // Remove lead from list if it's been sent (status changed to outreached)
          if (updated.status === 'outreached') {
            setLeads((prev) => {
              const next = prev.filter((l) => l.id !== updated.id);
              // Recompute stats
              const s: OutreachStats = { total: next.length, email_only: 0, widget: 0, redesign: 0, new_site: 0, compound: 0, hot: 0 };
              next.forEach((l) => {
                const dt = (l.demo_type ?? 'EMAIL_ONLY').toLowerCase();
                if (dt === 'email_only') s.email_only++;
                else if (dt === 'widget') s.widget++;
                else if (dt === 'redesign') s.redesign++;
                else if (dt === 'new_site') s.new_site++;
                else if (dt === 'compound') s.compound++;
                if ((l.score?.value_add_score ?? 0) >= 2) s.hot++;
              });
              setStats(s);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  const massLeads = leads;
  const hotLeads = leads.filter((l) => (l.score?.value_add_score ?? 0) >= 2);

  return { leads, massLeads, hotLeads, stats, loading, refetch: fetchLeads };
}
