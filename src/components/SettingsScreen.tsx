import { useState } from 'react';
import { settingsTemplates } from '@/data/mockData';
import { useGeoSettings } from '@/hooks/useSettings';
import { useOutreachTemplates, type OutreachTemplate } from '@/hooks/useOutreachTemplates';

const DEMO_TYPES = ['email_only', 'widget', 'redesign', 'new_site', 'compound'] as const;
const STOCK_VARS = ['{{company}}', '{{dm_name}}', '{{icebreaker}}', '{{demo_url}}'];

const emptyNew = { name: '', demo_type: 'email_only', subject_template: '', body_prompt: '' };

export default function SettingsScreen() {
  const [activeSection, setActiveSection] = useState('Templates');
  const [editingTemplate, setEditingTemplate] = useState<number | string | null>(null);
  const [templateCat, setTemplateCat] = useState('Indeed Hijacker');
  const { geoAU, geoUK, toggle } = useGeoSettings();
  const { templates: outreachTemplates, loading: outreachLoading, saving: outreachSaving, creating: outreachCreating, removing: outreachRemoving, save: saveOutreach, create: createOutreach, remove: removeOutreach } = useOutreachTemplates();
  const [outreachEdits, setOutreachEdits] = useState<Record<string, Partial<OutreachTemplate>>>({});
  const [addingNew, setAddingNew] = useState(false);
  const [newTemplate, setNewTemplate] = useState(emptyNew);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [customVar, setCustomVar] = useState('');

  function insertVar(id: string, currentBody: string, variable: string) {
    setOutreachEdits((prev) => ({ ...prev, [id]: { ...prev[id], body_prompt: (prev[id]?.body_prompt ?? currentBody) + ` ${variable}` } }));
  }

  async function handleCreate() {
    if (!newTemplate.name || !newTemplate.body_prompt) return;
    const ok = await createOutreach(newTemplate);
    if (ok) { setAddingNew(false); setNewTemplate(emptyNew); }
  }

  async function handleDelete(id: string) {
    await removeOutreach(id);
    setDeletingId(null);
    if (editingTemplate === id) setEditingTemplate(null);
    setOutreachEdits((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  const sections = ['Templates', 'Geography', 'Email & Domains', 'API Keys', 'Brand Voice', 'LinkedIn Budget', 'Demo Hosting'];

  return (
    <div className="flex h-full">
      {/* Sub-nav */}
      <div className="w-52 border-r border-white/[0.06] p-4 space-y-1">
        {sections.map((s) => (
          <button key={s} onClick={() => setActiveSection(s)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s ? 'bg-purple-primary/15 text-purple-primary font-medium' : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'}`}>{s}</button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeSection === 'Templates' && (
          <div className="space-y-6">
            <div className="flex gap-2">
              {['Indeed Hijacker', 'Outreach', 'Email Sequences'].map((cat) => (
                <button key={cat} onClick={() => setTemplateCat(cat)} className={`px-4 py-2 rounded-button text-sm font-medium transition-colors ${templateCat === cat ? 'bg-purple-primary text-white' : 'bg-white/[0.06] text-white/50 hover:text-white/70'}`}>{cat}</button>
              ))}
            </div>
            {templateCat === 'Outreach' && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={() => { setAddingNew(true); setEditingTemplate(null); }}
                    disabled={addingNew}
                    className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors disabled:opacity-40"
                  >
                    + New Template
                  </button>
                </div>

                {addingNew && (
                  <div className="liquid-glass rounded-card p-4 border border-purple-primary/20 space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Name</p>
                        <input
                          type="text"
                          placeholder="e.g. Follow-up Pitch"
                          className="w-full bg-white/[0.02] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Type</p>
                        <select
                          className="bg-white/[0.02] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                          value={newTemplate.demo_type}
                          onChange={(e) => setNewTemplate((p) => ({ ...p, demo_type: e.target.value }))}
                        >
                          {DEMO_TYPES.map((d) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Subject</p>
                      <input
                        type="text"
                        placeholder="e.g. Quick question about {{company}}"
                        className="w-full bg-white/[0.02] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                        value={newTemplate.subject_template}
                        onChange={(e) => setNewTemplate((p) => ({ ...p, subject_template: e.target.value }))}
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Body Prompt</p>
                      <textarea
                        className="w-full h-36 bg-white/[0.02] border border-white/[0.08] rounded-input p-3 text-sm text-white/80 resize-none focus:outline-none focus:border-purple-primary/50 font-mono"
                        placeholder="Write instructions for Claude on how to generate this email…"
                        value={newTemplate.body_prompt}
                        onChange={(e) => setNewTemplate((p) => ({ ...p, body_prompt: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {STOCK_VARS.map((v) => (
                        <span
                          key={v}
                          onClick={() => setNewTemplate((p) => ({ ...p, body_prompt: p.body_prompt + ` ${v}` }))}
                          className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80 cursor-pointer hover:bg-purple-primary/20 transition-colors"
                        >{v}</span>
                      ))}
                      <input
                        type="text"
                        placeholder="custom"
                        value={customVar}
                        onChange={(e) => setCustomVar(e.target.value.replace(/[{}]/g, ''))}
                        className="text-xs bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white/60 w-20 focus:outline-none"
                      />
                      <button
                        onClick={() => { if (customVar) { setNewTemplate((p) => ({ ...p, body_prompt: p.body_prompt + ` {{${customVar}}}` })); setCustomVar(''); } }}
                        className="text-xs text-purple-primary/70 hover:text-purple-primary transition-colors"
                      >+</button>
                      <div className="ml-auto flex gap-2">
                        <button onClick={() => { setAddingNew(false); setNewTemplate(emptyNew); }} className="px-3 py-2 rounded-button bg-white/[0.06] text-white/50 text-sm hover:text-white/70 transition-colors">Cancel</button>
                        <button
                          onClick={handleCreate}
                          disabled={outreachCreating || !newTemplate.name || !newTemplate.body_prompt}
                          className="px-4 py-2 rounded-button bg-purple-primary text-white text-sm font-semibold hover:bg-purple-primary/90 transition-colors disabled:opacity-40"
                        >
                          {outreachCreating ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {outreachLoading ? (
                  <div className="text-sm text-white/30 py-6 text-center">Loading templates…</div>
                ) : outreachTemplates.map((t) => {
                  const isEditing = editingTemplate === t.id;
                  const edits = outreachEdits[t.id] ?? {};
                  const isDeleting = deletingId === t.id;
                  const isRemoving = outreachRemoving === t.id;
                  return (
                    <div key={t.id} className="liquid-glass rounded-card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-sm text-white">{t.name}</h4>
                          <span className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5 block">{t.demo_type.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {isDeleting ? (
                            <>
                              <span className="text-xs text-white/40">Delete?</span>
                              <button onClick={() => handleDelete(t.id)} disabled={isRemoving} className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40">{isRemoving ? '…' : 'Yes'}</button>
                              <button onClick={() => setDeletingId(null)} className="text-xs text-white/40 hover:text-white/60 transition-colors">No</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setDeletingId(t.id)} className="text-xs text-white/25 hover:text-red-400 transition-colors">Delete</button>
                              <button onClick={() => setEditingTemplate(isEditing ? null : t.id)} className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors">{isEditing ? 'Close' : 'Edit'}</button>
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Subject</p>
                            <input
                              type="text"
                              className="w-full bg-white/[0.02] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                              value={outreachEdits[t.id]?.subject_template ?? t.subject_template}
                              onChange={(e) => setOutreachEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], subject_template: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Body Prompt</p>
                            <textarea
                              className="w-full h-36 bg-white/[0.02] border border-white/[0.08] rounded-input p-3 text-sm text-white/80 resize-none focus:outline-none focus:border-purple-primary/50 font-mono"
                              value={outreachEdits[t.id]?.body_prompt ?? t.body_prompt}
                              onChange={(e) => setOutreachEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], body_prompt: e.target.value } }))}
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {STOCK_VARS.map((v) => (
                              <span
                                key={v}
                                onClick={() => insertVar(t.id, t.body_prompt, v)}
                                className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80 cursor-pointer hover:bg-purple-primary/20 transition-colors"
                              >{v}</span>
                            ))}
                            <input
                              type="text"
                              placeholder="custom"
                              value={customVar}
                              onChange={(e) => setCustomVar(e.target.value.replace(/[{}]/g, ''))}
                              className="text-xs bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-white/60 w-20 focus:outline-none"
                            />
                            <button
                              onClick={() => { if (customVar) { insertVar(t.id, t.body_prompt, `{{${customVar}}}`); setCustomVar(''); } }}
                              className="text-xs text-purple-primary/70 hover:text-purple-primary transition-colors"
                            >+</button>
                            <button
                              onClick={() => saveOutreach(t.id, t.demo_type, edits)}
                              disabled={outreachSaving === t.demo_type || Object.keys(edits).length === 0}
                              className="ml-auto px-4 py-2 rounded-button bg-purple-primary text-white text-sm font-semibold hover:bg-purple-primary/90 transition-colors disabled:opacity-40"
                            >
                              {outreachSaving === t.demo_type ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {templateCat !== 'Outreach' && (
            <div className="space-y-3">
              {settingsTemplates.filter(t => t.category === templateCat).map((t) => (
                <div key={t.id} className="liquid-glass rounded-card p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-white">{t.name}</h4>
                    <button onClick={() => setEditingTemplate(editingTemplate === t.id ? null : t.id)} className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors">{editingTemplate === t.id ? 'Close' : 'Edit'}</button>
                  </div>
                  {editingTemplate === t.id && (
                    <div className="mt-4">
                      <textarea className="w-full h-40 bg-white/[0.02] border border-white/[0.08] rounded-input p-4 text-sm text-white/80 resize-none focus:outline-none focus:border-purple-primary/50 font-mono" defaultValue={t.content} />
                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{'{{name}}'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{'{{company}}'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{'{{job_title}}'}</span>
                        <button className="ml-auto px-4 py-2 rounded-button bg-purple-primary text-white text-sm font-semibold hover:bg-purple-primary/90 transition-colors">Save</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {activeSection === 'Geography' && (
          <div className="space-y-4">
            {[
              { flag: '🇦🇺', country: 'Australia', key: 'geo_au_scrape' as const, enabled: geoAU },
              { flag: '🇬🇧', country: 'United Kingdom', key: 'geo_uk_scrape' as const, enabled: geoUK },
            ].map((g) => (
              <div key={g.country} className="liquid-glass rounded-card p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{g.flag}</span>
                  <span className="font-semibold text-white">{g.country}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">Scrape</span>
                  <div
                    className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${g.enabled ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}
                    onClick={() => toggle(g.key, !g.enabled)}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${g.enabled ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                  {!g.enabled && <span className="text-xs text-white/30 ml-1">OFF</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {!['Templates', 'Geography'].includes(activeSection) && (
          <div className="liquid-glass rounded-card p-8 text-center">
            <p className="text-white/35 text-sm">{activeSection} settings — coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
