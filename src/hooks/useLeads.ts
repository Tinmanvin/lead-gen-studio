import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Lead {
  id: string;
  company_name: string;
  website?: string;
  niche: string;
  country: string;
  city?: string;
  dm_name?: string;
  dm_email?: string;
  dm_linkedin_url?: string;
  dm_whatsapp?: string;
  source: string;
  rating?: number;
  review_count?: number;
  status: string;
  created_at: string;
}

export interface LeadScore {
  lead_id: string;
  total_score: number;
  touchpoint_tier: string;
  demo_type: string;
  signals: string[];
  value_add_score: number;
}

export interface EnrichedLead extends Lead {
  score?: LeadScore;
}

export function useLeads(limit = 50, status?: string) {
  const [leads, setLeads] = useState<EnrichedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeads() {
      setLoading(true);
      try {
        let query = supabase
          .from('leads')
          .select('*, lead_scores(*)')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (status) query = query.eq('status', status);

        const { data, error: err } = await query;
        if (err) throw err;

        const enriched = (data ?? []).map((row: any) => ({
          ...row,
          score: row.lead_scores?.[0] ?? undefined,
        }));

        setLeads(enriched);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchLeads();

    // Real-time: fires when enrichment transitions a lead to 'scored' or 'enriched'
    // Only subscribe if we're watching a status that enrichment writes to
    if (!status || status === 'scored' || status === 'enriched') {
      const filter = status ? `status=eq.${status}` : undefined;
      const channel = supabase
        .channel(`leads_live_${status ?? 'all'}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'leads',
            ...(filter ? { filter } : {}),
          },
          async (payload) => {
            const updated = payload.new as Lead;
            // Only surface if this update matches our status filter
            if (status && updated.status !== status) return;

            // Fetch the full lead with score so we have lead_scores joined
            const { data } = await supabase
              .from('leads')
              .select('*, lead_scores(*)')
              .eq('id', updated.id)
              .single();

            if (!data) return;
            const enrichedLead: EnrichedLead = { ...data, score: data.lead_scores?.[0] ?? undefined };

            setLeads((prev) => {
              const exists = prev.find((l) => l.id === enrichedLead.id);
              if (exists) {
                return prev.map((l) => (l.id === enrichedLead.id ? enrichedLead : l));
              }
              // New arrival — prepend and cap at limit
              return [enrichedLead, ...prev].slice(0, limit);
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [limit, status]);

  return { leads, loading, error };
}

export function useLeadCounts() {
  const [counts, setCounts] = useState({
    total: 0,
    new: 0,
    enriched: 0,
    scored: 0,
    hot: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const [total, scored, hot] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'scored'),
          supabase.from('lead_scores').select('id', { count: 'exact', head: true }).gte('value_add_score', 2),
        ]);

        setCounts({
          total: total.count ?? 0,
          new: 0,
          enriched: 0,
          scored: scored.count ?? 0,
          hot: hot.count ?? 0,
        });
      } catch (_) {
        // silently fall back to zeros
      } finally {
        setLoading(false);
      }
    }

    fetchCounts();
  }, []);

  return { counts, loading };
}

export interface DailyLeadCount {
  day: string;
  leads: number;
}

export function useLeadsPerDay(days = 7) {
  const [data, setData] = useState<DailyLeadCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDaily() {
      try {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const { data: rows } = await supabase
          .from('leads')
          .select('created_at')
          .gte('created_at', since.toISOString());

        const counts: Record<string, number> = {};
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toLocaleDateString('en-US', { weekday: 'short' });
          counts[key] = 0;
        }

        (rows ?? []).forEach((row: { created_at: string }) => {
          const key = new Date(row.created_at).toLocaleDateString('en-US', { weekday: 'short' });
          if (key in counts) counts[key]++;
        });

        setData(Object.entries(counts).map(([day, leads]) => ({ day, leads })));
      } catch (_) {
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDaily();
  }, [days]);

  return { data, loading };
}
