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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}>
        {label}
      </label>
      {multiline ? (
        <textarea className="modal-field" rows={rows} value={value} onChange={e => onChange(e.target.value)} />
      ) : (
        <input className="modal-field" value={value} onChange={e => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 7, 1);
  const dash = `${pct * circ} ${circ}`;
  const color = score >= 5 ? '#7b39fc' : score >= 2 ? '#a48ed7' : 'rgba(255,255,255,0.25)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={dash} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+4} textAnchor="middle" fill="white" fontSize="11" fontWeight="700">{score}</text>
    </svg>
  );
}

export default function LeadDetailModal({ lead, onClose, onSaved }: Props) {
  const [icebreaker, setIcebreaker]     = useState(lead.icebreaker ?? '');
  const [emailSubject, setEmailSubject] = useState(lead.email_subject ?? '');
  const [emailBody, setEmailBody]       = useState(lead.email_body ?? '');
  const [linkedinMsg, setLinkedinMsg]   = useState(lead.linkedin_msg ?? '');
  const [whatsappMsg, setWhatsappMsg]   = useState(lead.whatsapp_msg ?? '');
  const [facebookMsg, setFacebookMsg]   = useState(lead.facebook_msg ?? '');
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const isDirty =
    icebreaker    !== (lead.icebreaker    ?? '') ||
    emailSubject  !== (lead.email_subject ?? '') ||
    emailBody     !== (lead.email_body    ?? '') ||
    linkedinMsg   !== (lead.linkedin_msg  ?? '') ||
    whatsappMsg   !== (lead.whatsapp_msg  ?? '') ||
    facebookMsg   !== (lead.facebook_msg  ?? '');

  const handleSave = async () => {
    if (!isDirty) { onClose(); return; }
    setSaving(true);
    try {
      const patch = { icebreaker, email_subject: emailSubject, email_body: emailBody,
        linkedin_msg: linkedinMsg, whatsapp_msg: whatsappMsg, facebook_msg: facebookMsg, copy_locked: true };
      await supabase.from('leads').update(patch).eq('id', lead.id);
      setSaved(true);
      onSaved?.({ ...lead, ...patch });
      setTimeout(onClose, 800);
    } finally { setSaving(false); }
  };

  const score = lead.value_add_score ?? 0;

  return (
    /* ── Overlay ── */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(5, 2, 14, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* ── Outer wrap: clips + provides purple bg for glass to blur ── */}
      <div className="modal-wrap">

        {/* Purple gradient background layer */}
        <div className="modal-bg" />

        {/* Glass panel on top */}
        <div className="modal-glass">

          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            gap: 16, padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <ScoreRing score={score} size={46} />
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: 'white', lineHeight: 1.3, margin: 0 }}>
                  {lead.company_name}
                </h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  {lead.niche && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }}>
                      {lead.niche}
                    </span>
                  )}
                  {lead.city && (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{lead.city}</span>
                  )}
                  {lead.demo_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${DEMO_COLORS[lead.demo_type] ?? 'bg-white/10 text-white/50'}`}>
                      {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
                    </span>
                  )}
                  {lead.copy_locked && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99,
                      background: 'rgba(245,158,11,0.2)', color: 'rgb(252,211,77)',
                      display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Copy locked
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.1)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer', transition: 'all 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Contact row ── */}
          <div style={{
            padding: '10px 24px', display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', gap: '6px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            {lead.dm_name && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{lead.dm_name}</span>
                {lead.dm_title && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>· {lead.dm_title}</span>}
              </div>
            )}
            {lead.dm_email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="rgba(167,139,250,0.6)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgb(196,181,253)' }}>{lead.dm_email}</span>
              </div>
            )}
            {lead.website && (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                  color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {lead.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          {/* ── Services ── */}
          {(lead.applicable_services?.length ?? 0) > 0 && (
            <div style={{
              padding: '10px 24px', display: 'flex', flexWrap: 'wrap', gap: 6,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              {lead.applicable_services.map(s => (
                <span key={s} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 99,
                  background: 'rgba(123,57,252,0.2)', border: '1px solid rgba(123,57,252,0.35)',
                  color: 'rgb(196,181,253)',
                }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* ── Body: 2 column ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 20,
          }}>
            {/* Left — Social Copy */}
            <div className="modal-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
                Social Copy
              </p>
              <Field label="Icebreaker"       value={icebreaker}  onChange={setIcebreaker}  multiline rows={3} />
              <Field label="LinkedIn message" value={linkedinMsg} onChange={setLinkedinMsg} multiline rows={3} />
              <Field label="WhatsApp message" value={whatsappMsg} onChange={setWhatsappMsg} multiline rows={3} />
              <Field label="Facebook message" value={facebookMsg} onChange={setFacebookMsg} multiline rows={3} />
            </div>

            {/* Right — Email Copy */}
            <div className="modal-section" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.12em', textTransform: 'uppercase', margin: 0 }}>
                Email Copy
              </p>
              <Field label="Email subject" value={emailSubject} onChange={setEmailSubject} />
              <Field label="Email body"    value={emailBody}    onChange={setEmailBody}    multiline rows={18} />
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: 10, padding: '12px 20px 20px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 10, fontSize: 13,
                color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none',
                cursor: 'pointer', transition: 'color 150ms' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                cursor: isDirty ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 7, transition: 'all 200ms',
                background: saved
                  ? 'rgba(34,197,94,0.75)'
                  : isDirty
                  ? 'rgba(123,57,252,0.9)'
                  : 'rgba(255,255,255,0.07)',
                border: saved
                  ? '1.5px solid rgba(74,222,128,0.4)'
                  : isDirty
                  ? '1.5px solid rgba(167,139,250,0.5)'
                  : '1.5px solid rgba(255,255,255,0.12)',
                color: isDirty || saved ? 'white' : 'rgba(255,255,255,0.35)',
              }}
            >
              {saving && (
                <svg className="animate-spin" width="13" height="13" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {saved && (
                <svg width="13" height="13" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {saved ? 'Saved + Locked' : saving ? 'Saving…' : isDirty ? 'Save + Lock Copy' : 'No Changes'}
            </button>
          </div>

        </div>{/* end .modal-glass */}
      </div>{/* end .modal-wrap */}
    </div>
  );
}
