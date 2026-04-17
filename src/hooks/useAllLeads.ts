/**
 * useAllLeads — paginated list of all enriched leads (dm_email IS NOT NULL, not outreached).
 * Used in the LeadGen "All Leads" tab.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Lead } from './useLeads';

export interface AllLead extends Lead {
  value_add_score: number;
  composite_score: number;
  touchpoint_tier: string;
  applicable_services: string[];
}

const PAGE_SIZE = 50;

const LEAD_SELECT = `
  id, company_name, website, city, niche, status, country,
  dm_name, dm_title, dm_email, dm_linkedin_url, dm_facebook_url, dm_whatsapp,
  icebreaker, email_subject, email_body,
  linkedin_msg, whatsapp_msg, facebook_msg,
  copy_locked, demo_type, signals, tech_stack, has_chatbot, has_ssl,
  created_at
`;

function mapRow(row: any): AllLead {
  return {
    ...row,
    value_add_score: row.value_add_score ?? 0,
    composite_score: row.composite_score ?? 0,
    touchpoint_tier: row.touchpoint_tier ?? 'D',
    applicable_services: row.applicable_services ?? [],
  };
}

export function useAllLeads() {
  const [leads, setLeads] = useState<AllLead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearchState] = useState('');

  const fetchPage = useCallback(async (pageNum: number, searchTerm: string, replace: boolean) => {
    setLoading(true);
    try {
      let q = supabase
        .from('leads')
        .select(LEAD_SELECT, { count: 'exact' })
        .not('dm_email', 'is', null)
        .neq('status', 'outreached')
        .order('company_name', { ascending: true })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      if (searchTerm.trim()) {
        q = q.ilike('company_name', `%${searchTerm.trim()}%`);
      }

      const { data, count, error } = await q;
      if (error) throw error;

      const mapped = (data ?? []).map(mapRow);
      setTotal(count ?? 0);
      setHasMore((pageNum + 1) * PAGE_SIZE < (count ?? 0));
      setLeads(prev => (replace ? mapped : [...prev, ...mapped]));
    } catch (err) {
      console.error('useAllLeads fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPage(0);
    setLeads([]);
    fetchPage(0, search, true);
  }, [search, fetchPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, search, false);
  };

  const setSearch = (val: string) => {
    setSearchState(val);
  };

  const updateLead = (id: string, patch: Partial<AllLead>) => {
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  const refetch = () => {
    setPage(0);
    fetchPage(0, search, true);
  };

  return { leads, total, loading, hasMore, search, setSearch, loadMore, updateLead, refetch };
}
