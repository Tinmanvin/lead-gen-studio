import { useState } from 'react';
import { massEmailLeads, hotLeads } from '@/data/mockData';

export default function Outreach() {
  const [activeTab, setActiveTab] = useState<'mass' | 'hot'>('mass');

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex gap-6 border-b border-white/[0.06]">
        <button onClick={() => setActiveTab('mass')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'mass' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
          Mass Email (312)
          {activeTab === 'mass' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
        </button>
        <button onClick={() => setActiveTab('hot')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'hot' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
          Hot Leads (27)
          {activeTab === 'hot' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
        </button>
      </div>

      {activeTab === 'mass' ? (
        <>
          <div className="liquid-glass rounded-card p-5">
            <h3 className="font-semibold text-white mb-3">Batch Summary</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-bold text-white">312</p><p className="text-xs text-white/35 uppercase tracking-wider mt-1">Total in Queue</p></div>
              <div><p className="text-2xl font-bold text-white">89</p><p className="text-xs text-white/35 uppercase tracking-wider mt-1">With Demos</p></div>
              <div><p className="text-2xl font-bold text-white">42</p><p className="text-xs text-white/35 uppercase tracking-wider mt-1">Redesigns</p></div>
              <div><p className="text-2xl font-bold text-white">14.2%</p><p className="text-xs text-white/35 uppercase tracking-wider mt-1">Est. Reply Rate</p></div>
            </div>
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
            {massEmailLeads.map((lead, i) => (
              <div key={i} className={`liquid-glass rounded-card p-4 hover:-translate-y-0.5 transition-transform cursor-pointer ${lead.tier === 'hot' ? 'accent-hot' : lead.tier === 'standard' ? 'accent-standard' : 'accent-cold'}`}>
                <h4 className="font-semibold text-sm text-white">{lead.company}</h4>
                <p className="text-sm text-white/65 mt-0.5">{lead.dm}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {lead.services.map((s) => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button className="w-full py-3.5 rounded-button bg-purple-primary text-white font-semibold text-sm hover:bg-purple-primary/90 transition-colors">
            Approve Batch → Send via Instantly
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {hotLeads.map((lead, i) => (
            <div key={i} className="liquid-glass rounded-card p-5 accent-hot">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-white">{lead.company}</h4>
                  <p className="text-sm text-white/65">{lead.dm}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {lead.services.map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div className="flex gap-2">
                  {['LinkedIn', 'WhatsApp', 'Facebook', 'Email'].map((ch) => (
                    <button key={ch} className="px-3 py-1.5 rounded-button text-xs font-medium bg-purple-primary/20 text-purple-primary hover:bg-purple-primary/30 transition-colors flex items-center gap-1">
                      {ch} <span className="text-white/40">Copy</span>
                    </button>
                  ))}
                </div>
                <button className="text-xs text-white/40 hover:text-white/70 transition-colors border border-white/[0.08] px-3 py-1.5 rounded-button">Mark as Contacted</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
