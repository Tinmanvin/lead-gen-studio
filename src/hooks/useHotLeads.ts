/**
 * useHotLeads — shows scored leads with value_add_score >= 2
 * regardless of whether email enrichment has run yet.
 * Used in the LeadGen pipeline view.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface HotLead {
  id: string;
  company_name: string;
  website: string | null;
  city: string | null;
  niche: string | null;
  dm_name: string | null;
  dm_email: string | null;
  dm_linkedin_url: string | null;
  demo_type: string | null;
  status: string;
  value_add_score: number;
  applicable_services: string[] | null;
  touchpoint_tier: string | null;
}

export function useHotLeads(limit = 50) {
  const [leads, setLeads] = useState<HotLead[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchLeads() {
    try {
      // Join lead_scores to get value_add_score >= 2
      const { data, error } = await supabase
        .from('lead_scores')
        .select(`
          value_add_score,
          applicable_services,
          touchpoint_tier,
          leads!inner(
            id, company_name, website, city, niche,
            dm_name, dm_email, dm_linkedin_url,
            demo_type, status
          )
        `)
        .gte('value_add_score', 2)
        .eq('leads.status', 'scored')
        .order('value_add_score', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const mapped: HotLead[] = (data ?? []).map((row: any) => ({
        ...row.leads,
        value_add_score: row.value_add_score,
        applicable_services: row.applicable_services,
        touchpoint_tier: row.touchpoint_tier,
      }));

      setLeads(mapped);
    } catch (_) {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel('hot_leads_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchLeads)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_scores' }, fetchLeads)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [limit]);

  return { leads, loading, refetch: fetchLeads };
}
