import { useState } from 'react';
import { useIndeedTemplates, useIndeedSettings, useEmailAccounts } from '@/hooks/useIndeedConfig';

const CATEGORY_LABELS: Record<string, string> = {
  receptionist: 'AI Receptionist',
  intake: 'Intake Coordinator',
  chat: 'Website Chat',
  sdr: 'SDR / Lead Follow-up',
  admin: 'General Admin',
  after_hours: 'After Hours Cover',
  social: 'Social Media Manager',
};

const BOARD_LABELS: Record<string, string> = {
  indeed_au: 'Indeed AU',
  indeed_uk: 'Indeed UK',
  seek: 'Seek',
  reed: 'Reed',
  totaljobs: 'Totaljobs',
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors flex-shrink-0 ${on ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}
      onClick={() => onChange(!on)}
    >
      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${on ? 'right-0.5' : 'left-0.5'}`} />
    </div>
  );
}

function TemplatesTab() {
  const { templates, loading, saving, save, toggleActive } = useIndeedTemplates();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<{ subject_template: string; body_prompt: string; price_au: string; price_uk: string }>>>({});

  if (loading) return <div className="py-12 text-center text-white/30 text-sm">Loading templates…</div>;

  return (
    <div className="space-y-3">
      {templates.map((t) => {
        const isOpen = expanded === t.id;
        const draft = drafts[t.id] ?? {};
        return (
          <div key={t.id} className="liquid-glass rounded-card overflow-hidden">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Toggle on={t.active} onChange={(v) => toggleActive(t.id, v)} />
                <div className="min-w-0">
                  <h4 className={`font-semibold text-sm ${t.active ? 'text-white' : 'text-white/40'}`}>{t.name}</h4>
                  <p className="text-xs text-white/30 mt-0.5 truncate">{t.subject_template.replace('{{company}}', '[Company]').replace('{{job_title}}', '[Role]')}</p>
                </div>
              </div>
              <button
                onClick={() => setExpanded(isOpen ? null : t.id)}
                className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors ml-4 flex-shrink-0"
              >
                {isOpen ? 'Close' : 'Edit'}
              </button>
            </div>

            {isOpen && (
              <div className="px-4 pb-5 pt-0 border-t border-white/[0.06] space-y-4">
                {/* Subject */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">Subject Line Template</label>
                  <input
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                    defaultValue={t.subject_template}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], subject_template: e.target.value } }))}
                  />
                  <p className="text-xs text-white/25 mt-1">Variables: <code className="text-purple-primary/60">{'{{company}}'}</code> <code className="text-purple-primary/60">{'{{job_title}}'}</code></p>
                </div>

                {/* Body prompt */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">Email Prompt (sent to Claude)</label>
                  <textarea
                    className="w-full h-44 bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/70 font-mono resize-none focus:outline-none focus:border-purple-primary/50 leading-relaxed"
                    defaultValue={t.body_prompt}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], body_prompt: e.target.value } }))}
                  />
                  <p className="text-xs text-white/25 mt-1">Variables: <code className="text-purple-primary/60">{'{{job_title}}'}</code> <code className="text-purple-primary/60">{'{{pricing_note}}'}</code></p>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">🇦🇺 AU Pricing</label>
                    <input
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                      defaultValue={t.price_au}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], price_au: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">🇬🇧 UK Pricing</label>
                    <input
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                      defaultValue={t.price_uk}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], price_uk: e.target.value } }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    disabled={saving === t.category}
                    onClick={async () => {
                      const patch = drafts[t.id];
                      if (!patch || Object.keys(patch).length === 0) return;
                      const ok = await save(t.id, patch);
                      if (ok) {
                        setDrafts((prev) => { const n = { ...prev }; delete n[t.id]; return n; });
                        setExpanded(null);
                      }
                    }}
                    className="px-5 py-2 rounded-button bg-purple-primary text-white text-sm font-semibold hover:bg-purple-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving === t.category ? 'Saving…' : 'Save Template'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SettingsTab() {
  const { settings, loading: settingsLoading, update } = useIndeedSettings();
  const { accounts, loading: accsLoading, toggle, updateCap, addAccount } = useEmailAccounts();
  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  if (settingsLoading) return <div className="py-12 text-center text-white/30 text-sm">Loading settings…</div>;

  return (
    <div className="space-y-5">
      {/* Job Categories */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[15px] text-white mb-4">Job Categories</h3>
        <div className="space-y-0">
          {Object.entries(CATEGORY_LABELS).map(([key, label], i, arr) => (
            <div key={key} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span className="text-sm text-white/80">{label}</span>
              <Toggle
                on={settings.categories_enabled[key] ?? false}
                onChange={(v) => update('categories_enabled', { ...settings.categories_enabled, [key]: v })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Job Boards */}
      <div className="liquid-glass rounded-card p-5">
        <h3 className="font-semibold text-[15px] text-white mb-4">Job Boards</h3>
        <div className="space-y-0">
          {Object.entries(BOARD_LABELS).map(([key, label], i, arr) => (
            <div key={key} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span className="text-sm text-white/80">{label}</span>
              <Toggle
                on={settings.boards_enabled[key] ?? false}
                onChange={(v) => update('boards_enabled', { ...settings.boards_enabled, [key]: v })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Geography + Cap */}
      <div className="grid grid-cols-2 gap-4">
        <div className="liquid-glass rounded-card p-5">
          <h3 className="font-semibold text-[15px] text-white mb-4">Geography</h3>
          <div className="space-y-3">
            {[{ key: 'au', flag: '🇦🇺', label: 'Australia' }, { key: 'uk', flag: '🇬🇧', label: 'UK' }].map((g) => (
              <div key={g.key} className="flex items-center justify-between">
                <span className="text-sm text-white/80">{g.flag} {g.label}</span>
                <Toggle
                  on={settings.geo[g.key as 'au' | 'uk']}
                  onChange={(v) => update('geo', { ...settings.geo, [g.key]: v })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="liquid-glass rounded-card p-5">
          <h3 className="font-semibold text-[15px] text-white mb-4">Daily Send Cap</h3>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={500}
              value={settings.daily_cap}
              onChange={(e) => update('daily_cap', Number(e.target.value))}
              className="w-24 bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-primary/50 text-center"
            />
            <span className="text-sm text-white/50">emails / day</span>
          </div>
          <p className="text-xs text-white/25 mt-3">Spread across active email accounts. Resets at midnight UTC.</p>
        </div>
      </div>

      {/* Email Accounts */}
      <div className="liquid-glass rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[15px] text-white">Email Accounts</h3>
          <button
            onClick={() => setAddingAccount(!addingAccount)}
            className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors"
          >
            {addingAccount ? 'Cancel' : '+ Add Account'}
          </button>
        </div>

        {addingAccount && (
          <div className="mb-4 p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-3">
            <input
              placeholder="email@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
            />
            <input
              placeholder="Label (e.g. Gmail — Outreach)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
            />
            <button
              disabled={!newEmail || !newLabel}
              onClick={async () => {
                await addAccount(newEmail, newLabel, newEmail.includes('@gmail') ? 'gmail' : 'domain');
                setNewEmail('');
                setNewLabel('');
                setAddingAccount(false);
              }}
              className="px-4 py-1.5 rounded-button bg-purple-primary text-white text-xs font-semibold hover:bg-purple-primary/90 transition-colors disabled:opacity-40"
            >
              Add
            </button>
          </div>
        )}

        {accsLoading ? (
          <p className="text-white/30 text-sm">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-white/30 text-sm">No email accounts configured.</p>
        ) : (
          <div className="space-y-0">
            {accounts.map((acc, i) => (
              <div key={acc.id} className="py-3 flex items-center gap-4" style={{ borderBottom: i < accounts.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{acc.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-white/35">{acc.label}</span>
                    <span className="text-xs text-white/20">·</span>
                    <span className="text-xs text-white/35">{acc.sent_today}/{acc.daily_cap} today</span>
                    {acc.test_mode && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium uppercase tracking-wide">Test</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/35">Test</span>
                    <Toggle on={acc.test_mode} onChange={(v) => toggle(acc.id, 'test_mode', v)} />
                  </div>
                  <Toggle on={acc.active} onChange={(v) => toggle(acc.id, 'active', v)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IndeedConfigPanel() {
  const [activeTab, setActiveTab] = useState<'templates' | 'settings'>('templates');

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Tab bar */}
      <div className="flex gap-1 liquid-glass rounded-button p-1 w-fit">
        {(['templates', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-tag text-sm font-medium transition-colors capitalize ${activeTab === tab ? 'bg-purple-primary text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            {tab === 'templates' ? 'Templates' : 'Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'templates' ? <TemplatesTab /> : <SettingsTab />}
    </div>
  );
}
