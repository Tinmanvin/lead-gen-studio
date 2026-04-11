import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ── Templates ─────────────────────────────────────────────────────────────────

export interface IndeedTemplate {
  id: string;
  category: string;
  name: string;
  subject_template: string;
  body_prompt: string;
  price_au: string;
  price_uk: string;
  active: boolean;
  updated_at: string;
}

export function useIndeedTemplates() {
  const [templates, setTemplates] = useState<IndeedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // category being saved

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('indeed_templates')
        .select('*')
        .order('category');
      setTemplates(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const save = useCallback(async (id: string, patch: Partial<IndeedTemplate>) => {
    const cat = templates.find((t) => t.id === id)?.category ?? id;
    setSaving(cat);
    const { data, error } = await supabase
      .from('indeed_templates')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    setSaving(null);
    if (!error && data) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? (data as IndeedTemplate) : t)));
    }
    return !error;
  }, [templates]);

  const toggleActive = useCallback(async (id: string, active: boolean) => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, active } : t)));
    await supabase.from('indeed_templates').update({ active }).eq('id', id);
  }, []);

  return { templates, loading, saving, save, toggleActive };
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface IndeedSettingsData {
  categories_enabled: Record<string, boolean>;
  boards_enabled: Record<string, boolean>;
  daily_cap: number;
  geo: { au: boolean; uk: boolean };
}

const DEFAULT_SETTINGS: IndeedSettingsData = {
  categories_enabled: { receptionist: true, intake: true, chat: true, sdr: true, admin: true, after_hours: true, social: false },
  boards_enabled: { indeed_au: true, indeed_uk: true, seek: true, reed: true, totaljobs: true },
  daily_cap: 50,
  geo: { au: true, uk: true },
};

export function useIndeedSettings() {
  const [settings, setSettings] = useState<IndeedSettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('indeed_settings').select('key, value');
      if (data) {
        const map: Record<string, any> = {};
        data.forEach((r: any) => { map[r.key] = r.value; });
        setSettings({
          categories_enabled: map.categories_enabled ?? DEFAULT_SETTINGS.categories_enabled,
          boards_enabled: map.boards_enabled ?? DEFAULT_SETTINGS.boards_enabled,
          daily_cap: typeof map.daily_cap === 'number' ? map.daily_cap : Number(map.daily_cap ?? 50),
          geo: map.geo ?? DEFAULT_SETTINGS.geo,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  const update = useCallback(async (key: keyof IndeedSettingsData, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await supabase.from('indeed_settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  }, []);

  return { settings, loading, update };
}

// ── Email Accounts ────────────────────────────────────────────────────────────

export interface EmailAccount {
  id: string;
  email: string;
  label: string;
  provider: string;
  active: boolean;
  test_mode: boolean;
  daily_cap: number;
  sent_today: number;
}

export function useEmailAccounts() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('email_accounts').select('*').order('created_at');
      setAccounts(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const toggle = useCallback(async (id: string, field: 'active' | 'test_mode', value: boolean) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
    await supabase.from('email_accounts').update({ [field]: value }).eq('id', id);
  }, []);

  const updateCap = useCallback(async (id: string, daily_cap: number) => {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, daily_cap } : a)));
    await supabase.from('email_accounts').update({ daily_cap }).eq('id', id);
  }, []);

  const addAccount = useCallback(async (email: string, label: string, provider: string) => {
    const { data } = await supabase
      .from('email_accounts')
      .insert({ email, label, provider })
      .select()
      .single();
    if (data) setAccounts((prev) => [...prev, data as EmailAccount]);
  }, []);

  return { accounts, loading, toggle, updateCap, addAccount };
}
