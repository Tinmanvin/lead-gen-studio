/**
 * useHotLeads — top 10% of enriched leads ranked by value_add_score DESC
 * with demo_type as tiebreaker (COMPOUND > REDESIGN > WIDGET > EMAIL_ONLY).
 * Used in LeadGen "Hot Leads" tab and Outreach "Hot Leads" tab.
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

const LEAD_SELECT = `
  id, company_name, website, city, niche, status, country,
  dm_name, dm_title, dm_email, dm_linkedin_url, dm_facebook_url, dm_whatsapp,
  icebreaker, email_subject, email_body,
  linkedin_msg, whatsapp_msg, facebook_msg,
  copy_locked, demo_type, signals, tech_stack, has_chatbot, has_ssl,
  created_at,
  lead_scores(value_add_score, composite_score, touchpoint_tier, applicable_services)
`;

function mapRow(row: any): AllLead {
  const s = Array.isArray(row.lead_scores) ? row.lead_scores[0] : row.lead_scores;
  const { lead_scores: _, ...rest } = row;
  return {
    ...rest,
    value_add_score: s?.value_add_score ?? 0,
    composite_score: s?.composite_score ?? 0,
    touchpoint_tier: s?.touchpoint_tier ?? 'D',
    applicable_services: s?.applicable_services ?? [],
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

      // Fetch top hotLimit by value_add_score DESC (tiebreak by demo_type in JS)
      const { data, error } = await supabase
        .from('leads')
        .select(LEAD_SELECT)
        .not('dm_email', 'is', null)
        .neq('status', 'outreached')
        .not('lead_scores', 'is', null)
        .order('company_name', { ascending: true }) // secondary stable sort
        .limit(hotLimit * 2); // over-fetch to allow tiebreak sort

      if (error) throw error;

      const mapped = (data ?? []).map(mapRow);

      // Sort: value_add_score DESC, then demo_type rank DESC
      mapped.sort((a, b) => {
        const scoreDiff = b.value_add_score - a.value_add_score;
        if (scoreDiff !== 0) return scoreDiff;
        return (DEMO_RANK[b.demo_type ?? ''] ?? 0) - (DEMO_RANK[a.demo_type ?? ''] ?? 0);
      });

      setLeads(mapped.slice(0, hotLimit));
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
