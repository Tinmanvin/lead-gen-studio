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

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 7, 1);
  const dash = `${pct * circ} ${circ}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={dash} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2+5} textAnchor="middle" fill="white" fontSize="14" fontWeight="500" fontFamily="var(--font-serif)">{score}</text>
    </svg>
  );
}

function GlassField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div className="lg-field">
      <label className="lg-field-label">{label}</label>
      {multiline ? (
        <textarea
          className="lg-field-input"
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="lg-field-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
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
    <div
      className="lg-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="lg-modal">

        {/* Close button — floating */}
        <button onClick={onClose} className="lg-close" aria-label="Close">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ── Header card ── */}
        <div className="lg-header">
          <ScoreRing score={score} size={56} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="font-serif lg-title">{lead.company_name}</h2>
            <div className="lg-meta-row">
              {lead.niche && <span className="lg-pill">{lead.niche}</span>}
              {lead.city && <span className="lg-pill">{lead.city}</span>}
              {lead.demo_type && (
                <span className="lg-pill">
                  {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
                </span>
              )}
              {lead.copy_locked && (
                <span className="lg-pill lg-pill-lock">
                  <svg width="9" height="9" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Locked
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Contact strip ── */}
        {(lead.dm_name || lead.dm_email || lead.website) && (
          <div className="lg-contact">
            {lead.dm_name && (
              <div className="lg-contact-item">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{lead.dm_name}{lead.dm_title ? ` · ${lead.dm_title}` : ''}</span>
              </div>
            )}
            {lead.dm_email && (
              <div className="lg-contact-item">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{lead.dm_email}</span>
              </div>
            )}
            {lead.website && (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank" rel="noreferrer"
                className="lg-contact-item lg-contact-link"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {lead.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="lg-body">
          {/* Social Copy */}
          <section className="lg-section">
            <h3 className="lg-section-title">Social Copy</h3>
            <GlassField label="Icebreaker"        value={icebreaker}  onChange={setIcebreaker}  multiline rows={3} />
            <GlassField label="LinkedIn Message"  value={linkedinMsg} onChange={setLinkedinMsg} multiline rows={3} />
            <GlassField label="WhatsApp Message"  value={whatsappMsg} onChange={setWhatsappMsg} multiline rows={3} />
            <GlassField label="Facebook Message"  value={facebookMsg} onChange={setFacebookMsg} multiline rows={3} />
          </section>

          {/* Email Copy */}
          <section className="lg-section">
            <h3 className="lg-section-title">Email Copy</h3>
            <GlassField label="Subject" value={emailSubject} onChange={setEmailSubject} />
            <GlassField label="Body"    value={emailBody}    onChange={setEmailBody}    multiline rows={18} />
          </section>
        </div>

        {/* ── Footer ── */}
        <div className="lg-footer">
          <button onClick={onClose} className="lg-btn-ghost">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`lg-btn-primary ${saved ? 'is-saved' : ''} ${!isDirty && !saved ? 'is-disabled' : ''}`}
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
      </div>
    </div>
  );
}
