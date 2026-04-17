/**
 * useHotLeads — top 10% of enriched leads ranked by value_add_score DESC
 * with demo_type as tiebreaker (COMPOUND > REDESIGN > WIDGET > EMAIL_ONLY).
 * Queries FROM lead_scores joining leads!inner — the reliable pattern.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AllLead } from './useAllLeads';

export type { AllLead as HotLead };

const DEMO_RANK: Record<string, number> = {
  COMPOUND: 4,
  REDESIGN: 3,
  WIDGET: 2,
  EMAIL_ONLY: 1,
};

// Wildcard on leads side — avoids PostgREST 400 from any missing optional column
const SCORE_SELECT = `
  value_add_score, composite_score, touchpoint_tier, applicable_services,
  leads!inner(*)
`;

function mapRow(row: any): AllLead {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
  return {
    ...lead,
    value_add_score: row.value_add_score ?? 0,
    composite_score: row.composite_score ?? 0,
    touchpoint_tier: row.touchpoint_tier ?? 'D',
    applicable_services: row.applicable_services ?? [],
  };
}

export function useHotLeads(cap = 500) {
  const [leads, setLeads] = useState<AllLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEnriched, setTotalEnriched] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // Count total enriched leads to calculate 10%
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .not('dm_email', 'is', null)
        .neq('status', 'outreached');

      const total = count ?? 0;
      const hotLimit = Math.min(cap, Math.max(10, Math.ceil(total * 0.1)));
      setTotalEnriched(total);

      // Query FROM lead_scores joining leads — reliable join pattern
      const { data, error } = await supabase
        .from('lead_scores')
        .select(SCORE_SELECT)
        .not('value_add_score', 'is', null)
        .order('value_add_score', { ascending: false })
        .limit(hotLimit * 2);

      if (error) throw error;

      const mapped = (data ?? [])
        .map(mapRow)
        // filter out outreached or no-email leads after join
        .filter(l => l.dm_email && l.status !== 'outreached');

      // Sort: value_add_score DESC, then demo_type rank DESC
      mapped.sort((a, b) => {
        const scoreDiff = b.value_add_score - a.value_add_score;
        if (scoreDiff !== 0) return scoreDiff;
        return (DEMO_RANK[b.demo_type ?? ''] ?? 0) - (DEMO_RANK[a.demo_type ?? ''] ?? 0);
      });

      setLeads(mapped.slice(0, hotLimit));
    } catch (err) {
      console.error('useHotLeads fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [cap]);

  const updateLead = (id: string, patch: Partial<AllLead>) => {
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel('hot_leads_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_scores' }, fetch)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetch]);

  return { leads, loading, totalEnriched, updateLead, removeLead, refetch: fetch };
}
