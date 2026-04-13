import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type TriggerTask =
  | 'main-full-run'
  | 'indeed-full-run'
  | 'indeed-send'
  | 'main-scrape'
  | 'main-enrich'
  | 'indeed-scrape'
  | 'indeed-enrich';

type RunState = 'idle' | 'loading' | 'success' | 'error';

interface TriggerRunState {
  state: RunState;
  error: string | null;
}

export function useTriggerRun() {
  const [runs, setRuns] = useState<Partial<Record<TriggerTask, TriggerRunState>>>({});

  const trigger = useCallback(async (task: TriggerTask) => {
    setRuns((prev) => ({
      ...prev,
      [task]: { state: 'loading', error: null },
    }));

    try {
      const { data, error } = await supabase.functions.invoke('trigger-run', {
        body: { task },
      });

      if (error || !data?.success) {
        const msg = error?.message ?? data?.error ?? 'Unknown error';
        setRuns((prev) => ({
          ...prev,
          [task]: { state: 'error', error: msg },
        }));
        // Reset to idle after 4s
        setTimeout(() => {
          setRuns((prev) => ({ ...prev, [task]: { state: 'idle', error: null } }));
        }, 4000);
        return;
      }

      setRuns((prev) => ({
        ...prev,
        [task]: { state: 'success', error: null },
      }));

      // Reset to idle after 3s
      setTimeout(() => {
        setRuns((prev) => ({ ...prev, [task]: { state: 'idle', error: null } }));
      }, 3000);
    } catch (err) {
      setRuns((prev) => ({
        ...prev,
        [task]: { state: 'error', error: String(err) },
      }));
      setTimeout(() => {
        setRuns((prev) => ({ ...prev, [task]: { state: 'idle', error: null } }));
      }, 4000);
    }
  }, []);

  const getState = useCallback(
    (task: TriggerTask): RunState => runs[task]?.state ?? 'idle',
    [runs]
  );

  const getError = useCallback(
    (task: TriggerTask): string | null => runs[task]?.error ?? null,
    [runs]
  );

  return { trigger, getState, getError };
}
