"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { AllLead } from '@/hooks/useAllLeads';

interface Props {
  lead: AllLead;
  onClose: () => void;
  onSaved?: (updated: AllLead) => void;
}

const DEMO_LABELS: Record<string, string> = {
  COMPOUND: 'Compound',
  REDESIGN: 'Redesign',
  WIDGET: 'Widget',
  EMAIL_ONLY: 'Email Only',
};
const DEMO_COLORS: Record<string, string> = {
  COMPOUND: 'bg-purple-500/30 text-purple-200',
  REDESIGN: 'bg-blue-500/20 text-blue-300',
  WIDGET: 'bg-teal-500/20 text-teal-300',
  EMAIL_ONLY: 'bg-white/10 text-white/50',
};

// ── Field component ────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  const base =
    'w-full bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-white/90 placeholder-white/25 focus:outline-none focus:border-purple-400/50 resize-none transition-colors leading-relaxed';
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/35 tracking-wide">{label}</label>
      {multiline ? (
        <textarea className={base} rows={rows} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className={base} value={value} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 7, 1);
  const dash = `${pct * circ} ${circ}`;
  const color = score >= 5 ? '#7b39fc' : score >= 2 ? '#a48ed7' : 'rgba(255,255,255,0.25)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={dash} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="white" fontSize="12" fontWeight="700">{score}</text>
    </svg>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export default function LeadDetailModal({ lead, onClose, onSaved }: Props) {
  const [icebreaker, setIcebreaker] = useState(lead.icebreaker ?? '');
  const [emailSubject, setEmailSubject] = useState(lead.email_subject ?? '');
  const [emailBody, setEmailBody] = useState(lead.email_body ?? '');
  const [linkedinMsg, setLinkedinMsg] = useState(lead.linkedin_msg ?? '');
  const [whatsappMsg, setWhatsappMsg] = useState(lead.whatsapp_msg ?? '');
  const [facebookMsg, setFacebookMsg] = useState(lead.facebook_msg ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const isDirty =
    icebreaker !== (lead.icebreaker ?? '') ||
    emailSubject !== (lead.email_subject ?? '') ||
    emailBody !== (lead.email_body ?? '') ||
    linkedinMsg !== (lead.linkedin_msg ?? '') ||
    whatsappMsg !== (lead.whatsapp_msg ?? '') ||
    facebookMsg !== (lead.facebook_msg ?? '');

  const handleSave = async () => {
    if (!isDirty) { onClose(); return; }
    setSaving(true);
    try {
      const patch = {
        icebreaker,
        email_subject: emailSubject,
        email_body: emailBody,
        linkedin_msg: linkedinMsg,
        whatsapp_msg: whatsappMsg,
        facebook_msg: facebookMsg,
        copy_locked: true,
      };
      await supabase.from('leads').update(patch).eq('id', lead.id);
      setSaved(true);
      onSaved?.({ ...lead, ...patch });
      setTimeout(onClose, 800);
    } finally {
      setSaving(false);
    }
  };

  const score = lead.value_add_score ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.2)' } as React.CSSProperties}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel — blurs directly against the live app background (same as cards),
          liquid-glass::before handles the gradient border ring */}
      <div
        className="liquid-glass w-full max-w-5xl rounded-2xl"
        style={{
          background: 'rgba(18, 14, 34, 0.78)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 0 100px rgba(123,57,252,0.3), 0 0 40px rgba(123,57,252,0.12), 0 32px 80px rgba(0,0,0,0.4)',
          maxHeight: '88vh',
        } as React.CSSProperties}
      >
        {/* Scrollable inner — overflow:hidden on outer clips it correctly */}
        <div className="overflow-y-auto" style={{ maxHeight: '88vh' }}>

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-4 min-w-0">
              <ScoreRing score={score} size={48} />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white leading-tight">{lead.company_name}</h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {lead.niche && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.08] text-white/60">{lead.niche}</span>
                  )}
                  {lead.city && (
                    <span className="text-xs text-white/35">{lead.city}</span>
                  )}
                  {lead.demo_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/50'}`}>
                      {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
                    </span>
                  )}
                  {lead.copy_locked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center gap-1">
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Copy locked
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-all duration-150">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Contact row ── */}
          <div className="px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {lead.dm_name && (
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm text-white/75">{lead.dm_name}</span>
                {lead.dm_title && <span className="text-xs text-white/35">· {lead.dm_title}</span>}
              </div>
            )}
            {lead.dm_email && (
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-purple-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-mono text-purple-300">{lead.dm_email}</span>
              </div>
            )}
            {lead.website && (
              <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-white/35 hover:text-white/60 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {lead.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* ── Services ── */}
          {(lead.applicable_services?.length ?? 0) > 0 && (
            <div className="px-6 py-3 flex flex-wrap gap-1.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {lead.applicable_services.map(s => (
                <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-400/20 text-purple-300">
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* ── Edit fields: 2-col ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-5 px-6 py-5">

            {/* Left: icebreaker + channel messages */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Social Copy</p>
                <div className="space-y-4">
                  <Field label="Icebreaker" value={icebreaker} onChange={setIcebreaker} multiline rows={3} />
                  <Field label="LinkedIn message" value={linkedinMsg} onChange={setLinkedinMsg} multiline rows={3} />
                  <Field label="WhatsApp message" value={whatsappMsg} onChange={setWhatsappMsg} multiline rows={3} />
                  <Field label="Facebook message" value={facebookMsg} onChange={setFacebookMsg} multiline rows={3} />
                </div>
              </div>
            </div>

            {/* Right: email copy */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Email Copy</p>
              <Field label="Email subject" value={emailSubject} onChange={setEmailSubject} />
              <Field label="Email body" value={emailBody} onChange={setEmailBody} multiline rows={14} />
            </div>
          </div>

          {/* ── Actions footer ── */}
          <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <button onClick={onClose}
              className="px-4 py-2 rounded-button text-sm text-white/45 hover:text-white/75 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-5 py-2 rounded-button text-sm font-semibold transition-all duration-200 flex items-center gap-2
                ${saved
                  ? 'bg-green-500/80 text-white'
                  : isDirty
                  ? 'bg-purple-primary hover:bg-purple-primary/90 text-white'
                  : 'bg-white/8 text-white/35 cursor-default'}`}
            >
              {saving && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saved && (
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {saved ? 'Saved + Locked' : saving ? 'Saving…' : isDirty ? 'Save + Lock Copy' : 'No Changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
