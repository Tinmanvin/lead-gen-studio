import { useState } from 'react';
import { settingsTemplates, geographySettings } from '@/data/mockData';

export default function SettingsScreen() {
  const [activeSection, setActiveSection] = useState('Templates');
  const [editingTemplate, setEditingTemplate] = useState<number | null>(null);
  const [templateCat, setTemplateCat] = useState('Indeed Hijacker');

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
              {['Indeed Hijacker', 'Email Sequences'].map((cat) => (
                <button key={cat} onClick={() => setTemplateCat(cat)} className={`px-4 py-2 rounded-button text-sm font-medium transition-colors ${templateCat === cat ? 'bg-purple-primary text-white' : 'bg-white/[0.06] text-white/50 hover:text-white/70'}`}>{cat}</button>
              ))}
              <button className="px-4 py-2 rounded-button text-sm font-medium bg-white/[0.04] text-white/30 hover:text-white/50 transition-colors">+ Add Category</button>
            </div>
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
          </div>
        )}

        {activeSection === 'Geography' && (
          <div className="space-y-4">
            {geographySettings.map((g) => (
              <div key={g.country} className="liquid-glass rounded-card p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{g.flag}</span>
                  <span className="font-semibold text-white">{g.country}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Scrape</span>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${g.scrape ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${g.scrape ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Outreach</span>
                    <div className={`w-10 h-5 rounded-full relative cursor-pointer transition-colors ${g.outreach ? 'bg-purple-primary' : 'bg-white/[0.1]'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${g.outreach ? 'right-0.5' : 'left-0.5'}`} />
                    </div>
                    {!g.outreach && <span className="text-xs text-white/30 ml-1">DORMANT</span>}
                  </div>
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
