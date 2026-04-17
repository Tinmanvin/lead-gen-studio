/**
 * usePreviewBatch — persisted 12-card preview batch shared between
 * LeadGen "Preview" tab and Outreach "Mass Email" tab.
 * Cards survive browser refresh; only reshuffle on request or new scrape.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AllLead } from './useAllLeads';

const BATCH_SIZE = 12;

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

async function fillBatch(): Promise<void> {
  // Fetch pool of 200 ready leads, pick 12 at random in JS
  const { data: pool } = await supabase
    .from('leads')
    .select('id')
    .not('dm_email', 'is', null)
    .not('email_body', 'is', null)
    .neq('status', 'outreached')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!pool?.length) return;

  const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, BATCH_SIZE);

  // Clear then insert — two steps because there's no upsert with positional uniqueness
  await supabase.from('preview_batch').delete().gte('id', 0);
  await supabase.from('preview_batch').insert(
    picked.map((l, i) => ({ lead_id: l.id, position: i + 1 }))
  );
}

async function loadBatchLeads(): Promise<AllLead[]> {
  const { data: batch } = await supabase
    .from('preview_batch')
    .select('lead_id, position')
    .order('position', { ascending: true });

  if (!batch?.length) return [];

  const ids = batch.map(b => b.lead_id);
  const { data: leads } = await supabase
    .from('leads')
    .select(LEAD_SELECT)
    .in('id', ids);

  const posMap = new Map(batch.map(b => [b.lead_id, b.position]));
  return (leads ?? [])
    .map(mapRow)
    .sort((a, b) => (posMap.get(a.id) ?? 0) - (posMap.get(b.id) ?? 0));
}

export function usePreviewBatch() {
  const [leads, setLeads] = useState<AllLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let result = await loadBatchLeads();
      if (!result.length) {
        await fillBatch();
        result = await loadBatchLeads();
      }
      setLeads(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const reshuffle = async () => {
    setShuffling(true);
    try {
      await fillBatch();
      const result = await loadBatchLeads();
      setLeads(result);
    } finally {
      setShuffling(false);
    }
  };

  const updateLead = (id: string, patch: Partial<AllLead>) => {
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('preview_batch_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'preview_batch' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { leads, loading, shuffling, reshuffle, updateLead, refetch: load };
}
