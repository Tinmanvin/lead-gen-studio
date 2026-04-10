import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useGeoSettings() {
  const [geoAU, setGeoAU] = useState(true);
  const [geoUK, setGeoUK] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['geo_au_scrape', 'geo_uk_scrape']);

      if (data) {
        const map = Object.fromEntries(data.map((r: any) => [r.key, r.value]));
        if ('geo_au_scrape' in map) setGeoAU(map['geo_au_scrape']);
        if ('geo_uk_scrape' in map) setGeoUK(map['geo_uk_scrape']);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function toggle(key: 'geo_au_scrape' | 'geo_uk_scrape', value: boolean) {
    if (key === 'geo_au_scrape') setGeoAU(value);
    else setGeoUK(value);

    await supabase.from('settings').upsert(
      { key, value },
      { onConflict: 'key' }
    );
  }

  return { geoAU, geoUK, loading, toggle };
}
