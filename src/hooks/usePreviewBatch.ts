/**
 * usePreviewBatch — persisted 12-card preview batch shared between
 * LeadGen "Preview" tab and Outreach "Mass Email" tab.
 * Cards survive browser refresh; only reshuffle on request or new scrape.
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AllLead } from './useAllLeads';

const BATCH_SIZE = 12;

// Use wildcard — avoids PostgREST 400 if any optional column hasn't been migrated yet
const LEAD_SELECT = '*';

function mapRow(row: any): AllLead {
  return {
    ...row,
    value_add_score: row.value_add_score ?? 0,
    composite_score: row.composite_score ?? 0,
    touchpoint_tier: row.touchpoint_tier ?? 'D',
    applicable_services: row.applicable_services ?? [],
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
    .in('id', ids)
    .neq('status', 'outreached'); // hide sent leads immediately

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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return { leads, loading, shuffling, reshuffle, updateLead, refetch: load };
}
