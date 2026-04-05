import { useState } from 'react';
import { linkedinPosts, linkedinOutreach } from '@/data/mockData';

export default function LinkedInScreen() {
  const [activeTab, setActiveTab] = useState<'content' | 'outreach'>('content');
  const [selectedPost, setSelectedPost] = useState(0);
  const [selectedLead, setSelectedLead] = useState(0);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex gap-6 border-b border-white/[0.06]">
        <button onClick={() => setActiveTab('content')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'content' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
          Content Director
          {activeTab === 'content' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
        </button>
        <button onClick={() => setActiveTab('outreach')} className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'outreach' ? 'text-purple-primary' : 'text-white/40 hover:text-white/70'}`}>
          Outreach Queue
          {activeTab === 'outreach' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-primary" />}
        </button>
      </div>

      {activeTab === 'content' ? (
        <div className="flex gap-6 h-[calc(100vh-220px)]">
          {/* Calendar */}
          <div className="w-[40%] space-y-3 overflow-y-auto pr-2">
            <h3 className="font-semibold text-white text-sm mb-3">Weekly Calendar</h3>
            {linkedinPosts.map((post, i) => (
              <div key={i} onClick={() => setSelectedPost(i)} className={`liquid-glass rounded-card p-4 cursor-pointer hover:-translate-y-0.5 transition-all ${selectedPost === i ? 'accent-hot' : 'accent-cold'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-white/35">{post.day}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-tag font-medium ${post.status === 'published' ? 'bg-green-500/20 text-green-400' : post.status === 'scheduled' ? 'bg-purple-primary/20 text-purple-primary' : 'bg-white/[0.06] text-white/40'}`}>{post.status}</span>
                </div>
                <h4 className="font-semibold text-sm text-white">{post.title}</h4>
              </div>
            ))}
          </div>

          {/* Post detail */}
          <div className="flex-1 liquid-glass rounded-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-white">{linkedinPosts[selectedPost].title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-tag font-medium ${linkedinPosts[selectedPost].status === 'published' ? 'bg-green-500/20 text-green-400' : linkedinPosts[selectedPost].status === 'scheduled' ? 'bg-purple-primary/20 text-purple-primary' : 'bg-white/[0.06] text-white/40'}`}>
                {linkedinPosts[selectedPost].status}
              </span>
            </div>
            <div className="flex gap-2 mb-4">
              <button className="text-xs px-3 py-1 rounded-tag bg-purple-primary/20 text-purple-primary font-medium">Version A</button>
              <button className="text-xs px-3 py-1 rounded-tag bg-white/[0.06] text-white/40 font-medium">Version B</button>
            </div>
            <textarea className="w-full h-48 bg-white/[0.02] border border-white/[0.08] rounded-input p-4 text-sm text-white/80 resize-none focus:outline-none focus:border-purple-primary/50" defaultValue={linkedinPosts[selectedPost].content} />
            <div className="flex justify-end mt-4">
              <button className="px-6 py-2.5 rounded-button bg-purple-primary text-white font-semibold text-sm hover:bg-purple-primary/90 transition-colors">Schedule Post</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 h-[calc(100vh-220px)]">
          {/* Lead list */}
          <div className="w-[40%] space-y-2 overflow-y-auto pr-2">
            {linkedinOutreach.map((lead, i) => (
              <div key={i} onClick={() => setSelectedLead(i)} className={`liquid-glass rounded-card p-4 cursor-pointer transition-all ${selectedLead === i ? 'border-l-2 border-l-purple-primary bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-primary/30 flex items-center justify-center text-xs font-semibold text-purple-primary">{lead.name.split(' ').map(n => n[0]).join('')}</div>
                  <div>
                    <p className="font-semibold text-sm text-white">{lead.name}</p>
                    <p className="text-xs text-white/50">{lead.company}</p>
                  </div>
                </div>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-tag ${lead.queue === 'Connection Req' ? 'bg-purple-primary/15 text-purple-primary/80' : 'bg-white/[0.06] text-white/50'}`}>{lead.queue}</span>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          <div className="flex-1 liquid-glass rounded-card p-6 overflow-y-auto">
            {(() => {
              const lead = linkedinOutreach[selectedLead];
              return (
                <>
                  <h3 className="font-semibold text-xl text-white">{lead.name}</h3>
                  <p className="text-sm text-white/65 mt-1">{lead.title} · {lead.company}</p>
                  <div className="mt-4 p-4 rounded-card bg-white/[0.02] border border-white/[0.06]">
                    <p className="text-xs uppercase tracking-wider text-white/35 mb-2">Why they need AI</p>
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">Hiring signal</span>
                      <span className="text-xs px-2 py-0.5 rounded-tag bg-purple-primary/10 text-purple-primary/80">Outdated site</span>
                    </div>
                  </div>
                  {lead.note && (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-wider text-white/35 mb-2">Connection Note (300 char)</p>
                      <p className="text-sm text-white/80 leading-relaxed">{lead.note}</p>
                      <div className="flex gap-2 mt-3">
                        <button className="px-4 py-2 rounded-button bg-purple-primary text-white text-sm font-semibold hover:bg-purple-primary/90 transition-colors">Open LinkedIn ↗</button>
                        <button className="px-4 py-2 rounded-button border border-white/[0.08] text-white/60 text-sm font-medium hover:text-white/90 transition-colors">Copy Note</button>
                      </div>
                    </div>
                  )}
                  {lead.message && (
                    <div className="mt-4">
                      <p className="text-xs uppercase tracking-wider text-white/35 mb-2">Group DM Message</p>
                      <p className="text-sm text-white/80 leading-relaxed">{lead.message}</p>
                      <div className="flex gap-2 mt-3">
                        <button className="px-4 py-2 rounded-button bg-purple-primary text-white text-sm font-semibold hover:bg-purple-primary/90 transition-colors">Open LinkedIn ↗</button>
                        <button className="px-4 py-2 rounded-button border border-white/[0.08] text-white/60 text-sm font-medium hover:text-white/90 transition-colors">Copy Message</button>
                      </div>
                    </div>
                  )}
                  <div className="mt-6">
                    <p className="text-xs text-white/35 mb-2">Daily Budget</p>
                    <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-purple-primary" style={{ width: '53%' }} />
                    </div>
                    <p className="text-xs text-white/50 mt-1">8 / 15 sends remaining today</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
