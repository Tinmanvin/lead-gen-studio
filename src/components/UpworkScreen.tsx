import { useState } from 'react';
import { upworkGigs } from '@/data/mockData';

const ScoreRing = ({ score, size = 40 }: { score: number; size?: number }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#7b39fc" strokeWidth="3" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12} fontWeight="700" className="transform rotate-90 origin-center">{score}</text>
    </svg>
  );
};

export default function UpworkScreen() {
  const [selectedGig, setSelectedGig] = useState<number | null>(null);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="grid grid-cols-3 gap-4">
        {upworkGigs.map((gig, i) => (
          <div key={i} onClick={() => setSelectedGig(i)} className={`liquid-glass rounded-card p-5 cursor-pointer hover:-translate-y-0.5 transition-all ${gig.score >= 90 ? 'accent-hot' : gig.score >= 80 ? 'accent-standard' : 'accent-cold'}`}>
            <div className="flex justify-between items-start">
              <h4 className="font-semibold text-base text-white pr-3 leading-tight">{gig.title}</h4>
              <ScoreRing score={gig.score} />
            </div>
            <p className="text-lg font-bold text-purple-primary mt-2">{gig.budget}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
              <span>{gig.posted}</span>
              <span>{gig.proposals} proposals</span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-xs px-2 py-0.5 rounded-tag font-medium ${gig.type === 'SOLO' ? 'bg-purple-primary/20 text-purple-primary' : 'bg-white/[0.06] text-white/50'}`}>{gig.type}</span>
              {gig.skills.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-tag bg-white/[0.04] text-white/40">{s}</span>
              ))}
            </div>
            <p className="text-xs text-white/50 mt-3 line-clamp-2">{gig.description}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedGig !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedGig(null)}>
          <div className="liquid-glass rounded-modal w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8 mx-4" onClick={(e) => e.stopPropagation()} style={{ background: 'rgba(15, 12, 25, 0.9)' }}>
            <div className="flex justify-between items-start mb-4">
              <h2 className="font-semibold text-xl text-white pr-4">{upworkGigs[selectedGig].title}</h2>
              <button onClick={() => setSelectedGig(null)} className="text-white/40 hover:text-white text-xl transition-colors">✕</button>
            </div>
            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="font-bold text-purple-primary text-lg">{upworkGigs[selectedGig].budget}</span>
              <span className="text-white/50">{upworkGigs[selectedGig].posted}</span>
              <span className="text-white/50">{upworkGigs[selectedGig].proposals} proposals</span>
            </div>
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-wider text-white/35 mb-2">Job Description</h3>
              <p className="text-sm text-white/70 leading-relaxed">{upworkGigs[selectedGig].description}</p>
            </div>
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-wider text-white/35 mb-2">How we'd build it</h3>
              <p className="text-sm text-white/70 leading-relaxed">{upworkGigs[selectedGig].approach}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-white/50">Est: {upworkGigs[selectedGig].timeEstimate}</span>
                <span className={`text-xs px-2 py-0.5 rounded-tag font-medium ${upworkGigs[selectedGig].type === 'SOLO' ? 'bg-purple-primary/20 text-purple-primary' : 'bg-white/[0.06] text-white/50'}`}>{upworkGigs[selectedGig].type}</span>
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-4 mb-6">
              <h3 className="text-xs uppercase tracking-wider text-white/35 mb-2">Application</h3>
              <textarea className="w-full h-32 bg-white/[0.02] border border-white/[0.08] rounded-input p-4 text-sm text-white/80 resize-none focus:outline-none focus:border-purple-primary/50" defaultValue={`Hi there,\n\nI'd love to help with "${upworkGigs[selectedGig].title}". ${upworkGigs[selectedGig].approach}\n\nEstimated timeline: ${upworkGigs[selectedGig].timeEstimate}.\n\nLet me know if you'd like to discuss further.\n\nBest,\nFabio`} />
            </div>
            <div className="flex justify-between">
              <button onClick={() => setSelectedGig(null)} className="px-4 py-2 rounded-button text-sm text-white/40 hover:text-white/70 border border-white/[0.08] transition-colors">Dismiss</button>
              <button className="px-6 py-2.5 rounded-button bg-purple-primary text-white font-semibold text-sm hover:bg-purple-primary/90 transition-colors">Apply on Upwork ↗</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
