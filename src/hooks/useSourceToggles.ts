import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const SOURCE_KEYS = [
  'source_google_maps_au',
  'source_google_maps_uk',
  'source_ahpra',
  'source_mfaa',
  'source_law_society_au',
  'source_hipages',
  'source_reia',
  'source_companies_house',
  'source_fca_register',
  'source_law_society_uk',
  'source_yell',
  'source_checkatrade',
  'source_trustpilot',
  'source_opencorporates',
] as const;

export type SourceKey = typeof SOURCE_KEYS[number];

export const SOURCE_LABELS: Record<SourceKey, string> = {
  source_google_maps_au:  'Google Maps AU',
  source_google_maps_uk:  'Google Maps UK',
  source_ahpra:           'AHPRA',
  source_mfaa:            'MFAA',
  source_law_society_au:  'Law Society AU',
  source_hipages:         'HiPages',
  source_reia:            'REIA',
  source_companies_house: 'Companies House',
  source_fca_register:    'FCA Register',
  source_law_society_uk:  'Law Society UK',
  source_yell:            'Yell',
  source_checkatrade:     'Checkatrade',
  source_trustpilot:      'Trustpilot',
  source_opencorporates:  'OpenCorporates',
};

export function useSourceToggles() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(SOURCE_KEYS.map((k) => [k, true]))
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchToggles() {
      try {
        const { data } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', SOURCE_KEYS as unknown as string[]);

        if (data) {
          const map: Record<string, boolean> = { ...toggles };
          data.forEach((row: { key: string; value: string }) => {
            map[row.key] = row.value !== 'false';
          });
          setToggles(map);
        }
      } catch (_) {
        // fall back to all-on defaults
      } finally {
        setLoading(false);
      }
    }
    fetchToggles();
  }, []);

  const toggle = useCallback(async (key: SourceKey) => {
    const next = !toggles[key];
    setToggles((prev) => ({ ...prev, [key]: next }));

    await supabase
      .from('settings')
      .upsert({ key, value: String(next) }, { onConflict: 'key' });
  }, [toggles]);

  return { toggles, loading, toggle };
}
