import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface OutreachTemplate {
  id: string;
  demo_type: string; // 'email_only'|'widget'|'redesign'|'new_site'|'compound'
  name: string;
  subject_template: string;
  body_prompt: string;
  active: boolean;
  updated_at: string;
}

export function useOutreachTemplates() {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // demo_type being saved
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('outreach_templates')
        .select('*')
        .order('demo_type');
      setTemplates(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const save = useCallback(async (id: string, demoType: string, patch: Partial<OutreachTemplate>) => {
    setSaving(demoType);
    const { data, error } = await supabase
      .from('outreach_templates')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    setSaving(null);
    if (!error && data) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? (data as OutreachTemplate) : t)));
    }
    return !error;
  }, []);

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, active } : t)));
    const { error } = await supabase.from('outreach_templates').update({ active }).eq('id', id);
    if (error) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, active: !active } : t)));
    }
  }, []);

  const create = useCallback(async (fields: { name: string; demo_type: string; subject_template: string; body_prompt: string }) => {
    setCreating(true);
    const { data, error } = await supabase
      .from('outreach_templates')
      .insert({ ...fields, active: true, updated_at: new Date().toISOString() })
      .select()
      .single();
    setCreating(false);
    if (!error && data) {
      setTemplates((prev) => [...prev, data as OutreachTemplate]);
    }
    return !error;
  }, []);

  const remove = useCallback(async (id: string) => {
    setRemoving(id);
    const { error } = await supabase.from('outreach_templates').delete().eq('id', id);
    setRemoving(null);
    if (!error) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
    return !error;
  }, []);

  return { templates, loading, saving, creating, removing, save, create, remove, toggleActive };
}
