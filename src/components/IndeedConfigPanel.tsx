import { useState, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useIndeedTemplates, useIndeedSettings, useEmailAccounts } from '@/hooks/useIndeedConfig';
import type { IndeedTemplate } from '@/hooks/useIndeedConfig';

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

const INDEED_TOKENS: { token: string; example: string }[] = [
  { token: '{{iceBreaker}}',    example: 'Saw you\'ve been looking for a Receptionist for a few weeks — thought this might help.' },
  { token: '{{firstName}}',     example: 'there  (always "there" — job listings rarely name the hiring manager)' },
  { token: '{{company}}',       example: 'Smith Dental Practice' },
  { token: '{{job_title}}',     example: 'Receptionist' },
  { token: '{{niche}}',         example: 'dental  (inferred from company name + job title)' },
  { token: '{{salary}}',        example: '£28k–£35k/yr  (normalised to annual; "a competitive salary" if not listed)' },
  { token: '{{pricing_note}}',  example: '£495/mo  (from the AU/UK pricing fields above)' },
];

const BLANK_NEW = { name: '', subject_template: '', body_prompt: '', price_au: '', price_uk: '' };

function SortableTemplateCard({ t, children }: { t: IndeedTemplate; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="liquid-glass rounded-card overflow-hidden flex">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center px-2 cursor-grab active:cursor-grabbing text-white/20 hover:text-white/50 transition-colors flex-shrink-0 touch-none"
        >
          <GripVertical size={16} />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const { templates, loading, saving, removing, save, toggleActive, remove, create, reorder } = useIndeedTemplates();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    reorder(arrayMove(templates, oldIndex, newIndex));
  }
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Partial<{ name: string; subject_template: string; body_prompt: string; price_au: string; price_uk: string }>>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState({ ...BLANK_NEW });
  const [newSaving, setNewSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const newBodyRef = useRef<HTMLTextAreaElement>(null);

  function insertNewToken(token: string) {
    const ta = newBodyRef.current;
    if (!ta) {
      setNewDraft((prev) => ({ ...prev, body_prompt: prev.body_prompt + token }));
      return;
    }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const newBody = newDraft.body_prompt.slice(0, s) + token + newDraft.body_prompt.slice(e);
    setNewDraft((prev) => ({ ...prev, body_prompt: newBody }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + token.length, s + token.length);
    }, 0);
  }

  function insertToken(id: string, currentBody: string, token: string) {
    const ta = bodyRef.current;
    const current = drafts[id]?.body_prompt ?? currentBody;
    if (!ta) {
      setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], body_prompt: current + token } }));
      return;
    }
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const newBody = current.slice(0, s) + token + current.slice(e);
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], body_prompt: newBody } }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(s + token.length, s + token.length);
    }, 0);
  }

  if (loading) return <div className="py-12 text-center text-white/30 text-sm">Loading templates…</div>;

  return (
    <div className="space-y-3">
      {/* New Template */}
      <div className="flex justify-end">
        <button
          onClick={() => { setCreating((v) => !v); setNewDraft({ ...BLANK_NEW }); }}
          className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors font-medium"
        >
          {creating ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      {creating && (
        <div className="liquid-glass rounded-card px-4 pb-5 pt-4 space-y-4">
          <h4 className="text-sm font-semibold text-white/80">New Template</h4>

          <div>
            <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">Template Name</label>
            <input
              placeholder="e.g. SDR — Salary Hook"
              value={newDraft.name}
              onChange={(e) => setNewDraft((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">Subject Template</label>
            <input
              placeholder="e.g. I saw you're hiring a {{job_title}}?"
              value={newDraft.subject_template}
              onChange={(e) => setNewDraft((prev) => ({ ...prev, subject_template: e.target.value }))}
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase tracking-wider text-white/35">Email Template</label>
              <span className="text-[10px] text-white/25">Click token to insert at cursor</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {INDEED_TOKENS.map(({ token, example }) => (
                <div key={token} className="relative group/tok">
                  <button
                    type="button"
                    onClick={() => insertNewToken(token)}
                    className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80 cursor-pointer hover:bg-purple-primary/20 transition-colors font-mono"
                  >{token}</button>
                  <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/tok:block z-20 w-64 bg-[#1a1a2e] border border-white/[0.08] text-white/60 text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl">
                    <span className="text-white/30 uppercase tracking-wider text-[9px] block mb-0.5">e.g.</span>
                    {example}
                  </div>
                </div>
              ))}
            </div>
            <textarea
              ref={newBodyRef}
              placeholder="Write your email body here. Use tokens above to insert dynamic values."
              value={newDraft.body_prompt}
              onChange={(e) => setNewDraft((prev) => ({ ...prev, body_prompt: e.target.value }))}
              className="w-full h-44 bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/70 font-mono resize-none focus:outline-none focus:border-purple-primary/50 leading-relaxed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase tracking-wider text-white/35">Pricing</label>
              <span className="text-[10px] text-white/25">Leave blank → no price mentioned</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/25 block mb-1.5">🇦🇺 AU</label>
                <input
                  placeholder="Optional"
                  value={newDraft.price_au}
                  onChange={(e) => setNewDraft((prev) => ({ ...prev, price_au: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-white/25 block mb-1.5">🇬🇧 UK</label>
                <input
                  placeholder="Optional"
                  value={newDraft.price_uk}
                  onChange={(e) => setNewDraft((prev) => ({ ...prev, price_uk: e.target.value }))}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              disabled={newSaving || !newDraft.name || !newDraft.subject_template || !newDraft.body_prompt}
              onClick={async () => {
                setNewSaving(true);
                const ok = await create(newDraft);
                setNewSaving(false);
                if (ok) {
                  setCreating(false);
                  setNewDraft({ ...BLANK_NEW });
                }
              }}
              className="px-5 py-2 rounded-button bg-purple-primary text-white text-sm font-semibold hover:bg-purple-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {newSaving ? 'Saving…' : 'Create Template'}
            </button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={templates.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      {templates.map((t) => {
        const isOpen = expanded === t.id;
        const draft = drafts[t.id] ?? {};
        const isDeleting = deletingId === t.id;
        const isRemoving = removing === t.id;
        return (
          <SortableTemplateCard key={t.id} t={t}>
            <div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Toggle on={t.active} onChange={(v) => toggleActive(t.id, v)} />
                <div className="min-w-0">
                  <h4 className={`font-semibold text-sm ${t.active ? 'text-white' : 'text-white/40'}`}>{draft.name ?? t.name}</h4>
                  <p className="text-xs text-white/30 mt-0.5 truncate">{(draft.subject_template ?? t.subject_template).replace('{{company}}', '[Company]').replace('{{job_title}}', '[Role]')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                {isDeleting ? (
                  <>
                    <span className="text-xs text-white/40">Delete?</span>
                    <button onClick={() => remove(t.id)} disabled={isRemoving} className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40">{isRemoving ? '…' : 'Yes'}</button>
                    <button onClick={() => setDeletingId(null)} className="text-xs text-white/40 hover:text-white/60 transition-colors">No</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setDeletingId(t.id)} className="text-xs text-white/25 hover:text-red-400 transition-colors">Delete</button>
                    <button onClick={() => setExpanded(isOpen ? null : t.id)} className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors">{isOpen ? 'Close' : 'Edit'}</button>
                  </>
                )}
              </div>
            </div>

            {isOpen && (
              <div className="px-4 pb-5 pt-0 border-t border-white/[0.06] space-y-4">
                {/* Name */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">Template Name</label>
                  <input
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                    value={draft.name ?? t.name}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], name: e.target.value } }))}
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-white/35 block mb-1.5">Subject Template</label>
                  <input
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                    value={draft.subject_template ?? t.subject_template}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], subject_template: e.target.value } }))}
                  />
                  <p className="text-xs text-white/25 mt-1">Tokens: <code className="text-purple-primary/60">{'{{company}}'}</code> <code className="text-purple-primary/60">{'{{job_title}}'}</code></p>
                </div>

                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs uppercase tracking-wider text-white/35">Email Template</label>
                    <span className="text-[10px] text-white/25">Click token to insert at cursor</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {INDEED_TOKENS.map(({ token, example }) => (
                      <div key={token} className="relative group/tok">
                        <button
                          type="button"
                          onClick={() => insertToken(t.id, t.body_prompt, token)}
                          className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80 cursor-pointer hover:bg-purple-primary/20 transition-colors font-mono"
                        >{token}</button>
                        <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden group-hover/tok:block z-20 w-64 bg-[#1a1a2e] border border-white/[0.08] text-white/60 text-[10px] px-2.5 py-1.5 rounded-lg shadow-xl">
                          <span className="text-white/30 uppercase tracking-wider text-[9px] block mb-0.5">e.g.</span>
                          {example}
                        </div>
                      </div>
                    ))}
                  </div>
                  <textarea
                    ref={bodyRef}
                    className="w-full h-44 bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/70 font-mono resize-none focus:outline-none focus:border-purple-primary/50 leading-relaxed"
                    value={draft.body_prompt ?? t.body_prompt}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], body_prompt: e.target.value } }))}
                  />
                  <p className="text-[10px] text-white/25 mt-1"><code className="text-purple-primary/50">{'{{iceBreaker}}'}</code> is AI-generated per lead. All other tokens are substituted directly.</p>
                </div>

                {/* Pricing */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs uppercase tracking-wider text-white/35">Pricing</label>
                    <span className="text-[10px] text-white/25">Leave blank → no price mentioned</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/25 block mb-1.5">🇦🇺 AU</label>
                      <input
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                        value={draft.price_au ?? t.price_au}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], price_au: e.target.value } }))}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/25 block mb-1.5">🇬🇧 UK</label>
                      <input
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                        value={draft.price_uk ?? t.price_uk}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [t.id]: { ...prev[t.id], price_uk: e.target.value } }))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    disabled={saving === t.category}
                    onClick={async () => {
                      const patch = drafts[t.id];
                      if (!patch || Object.keys(patch).length === 0) return;
                      const ok = await save(t.id, t.category, patch);
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
          </SortableTemplateCard>
        );
      })}
        </SortableContext>
      </DndContext>
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
                await addAccount(newEmail, newLabel, newEmail.toLowerCase().endsWith('@gmail.com') ? 'gmail' : 'domain');
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
