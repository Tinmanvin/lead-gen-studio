import { useState } from 'react';
import { settingsTemplates } from '@/data/mockData';
import { useGeoSettings } from '@/hooks/useSettings';
import { useOutreachTemplates, type OutreachTemplate } from '@/hooks/useOutreachTemplates';

export default function SettingsScreen() {
  const [activeSection, setActiveSection] = useState('Templates');
  const [editingTemplate, setEditingTemplate] = useState<number | string | null>(null);
  const [templateCat, setTemplateCat] = useState('Indeed Hijacker');
  const { geoAU, geoUK, toggle } = useGeoSettings();
  const { templates: outreachTemplates, loading: outreachLoading, saving: outreachSaving, save: saveOutreach } = useOutreachTemplates();
  const [outreachEdits, setOutreachEdits] = useState<Record<string, Partial<OutreachTemplate>>>({});

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
                {outreachLoading ? (
                  <div className="text-sm text-white/30 py-6 text-center">Loading templates…</div>
                ) : outreachTemplates.map((t) => {
                  const isEditing = editingTemplate === t.id;
                  const edits = outreachEdits[t.id] ?? {};
                  return (
                    <div key={t.id} className="liquid-glass rounded-card p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-sm text-white">{t.name}</h4>
                          <span className="text-[10px] uppercase tracking-wider text-white/30 mt-0.5 block">{t.demo_type.replace(/_/g, ' ')}</span>
                        </div>
                        <button
                          onClick={() => setEditingTemplate(isEditing ? null : t.id)}
                          className="text-xs text-purple-primary hover:text-purple-primary/80 transition-colors"
                        >
                          {isEditing ? 'Close' : 'Edit'}
                        </button>
                      </div>
                      {isEditing && (
                        <div className="mt-4 space-y-3">
                          <div>
                            <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Subject</p>
                            <input
                              type="text"
                              className="w-full bg-white/[0.02] border border-white/[0.08] rounded-input px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-purple-primary/50"
                              defaultValue={t.subject_template}
                              onChange={(e) => setOutreachEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], subject_template: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-white/35 mb-1">Body Prompt</p>
                            <textarea
                              className="w-full h-36 bg-white/[0.02] border border-white/[0.08] rounded-input p-3 text-sm text-white/80 resize-none focus:outline-none focus:border-purple-primary/50 font-mono"
                              defaultValue={t.body_prompt}
                              onChange={(e) => setOutreachEdits((prev) => ({ ...prev, [t.id]: { ...prev[t.id], body_prompt: e.target.value } }))}
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{'{{company}}'}</span>
                            <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{'{{dm_name}}'}</span>
                            <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{'{{icebreaker}}'}</span>
                            <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{'{{services}}'}</span>
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
