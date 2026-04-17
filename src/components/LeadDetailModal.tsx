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
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/45">
        {label}
      </label>
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent border-0 outline-none resize-none text-[13px] text-white/90 leading-[1.65] font-sans placeholder:text-white/25"
        />
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent border-0 outline-none text-[13px] text-white/90 font-sans placeholder:text-white/25"
        />
      )}
    </div>
  );
}

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 7, 1);
  const dash = `${pct * circ} ${circ}`;
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={dash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="relative font-serif text-white text-[20px] leading-none">{score}</span>
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
      const patch = {
        icebreaker, email_subject: emailSubject, email_body: emailBody,
        linkedin_msg: linkedinMsg, whatsapp_msg: whatsappMsg, facebook_msg: facebookMsg,
        copy_locked: true,
      };
      await supabase.from('leads').update(patch).eq('id', lead.id);
      setSaved(true);
      onSaved?.({ ...lead, ...patch });
      setTimeout(onClose, 800);
    } finally { setSaving(false); }
  };

  const score = lead.value_add_score ?? 0;

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      {/* One big liquid-glass card — same class as the small cards, just bigger */}
      <div
        className="liquid-glass rounded-[24px] w-full overflow-hidden flex flex-col"
        style={{ maxWidth: '1240px', maxHeight: '88vh' }}
      >
        <div className="relative z-10 flex flex-col overflow-y-auto" style={{ maxHeight: '88vh' }}>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-8 pt-7 pb-5">
            <div className="flex items-center gap-5 min-w-0">
              <ScoreRing score={score} size={58} />
              <div className="min-w-0">
                <h2 className="font-serif text-white text-[28px] leading-tight m-0 truncate">
                  {lead.company_name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {lead.dm_name && <span className="text-[13px] text-white/70">{lead.dm_name}</span>}
                  {lead.dm_title && <span className="text-[12px] text-white/35">· {lead.dm_title}</span>}
                  {lead.niche && (
                    <span className="px-3 py-1 rounded-full text-[11px] text-white/80 bg-white/[0.04] border border-white/[0.12]">
                      {lead.niche}
                    </span>
                  )}
                  {lead.demo_type && (
                    <span className="px-3 py-1 rounded-full text-[11px] text-white/80 bg-white/[0.04] border border-white/[0.12]">
                      {DEMO_LABELS[lead.demo_type] ?? lead.demo_type}
                    </span>
                  )}
                  {lead.copy_locked && (
                    <span className="px-3 py-1 rounded-full text-[11px] text-white/70 bg-white/[0.04] border border-white/[0.12] inline-flex items-center gap-1">
                      <svg width="10" height="10" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      Locked
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors bg-white/[0.04] border border-white/[0.12]"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Contact strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-8 py-3 border-t border-b border-white/[0.06]">
            {lead.dm_email && (
              <div className="flex items-center gap-2">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-[13px] text-white/85">{lead.dm_email}</span>
              </div>
            )}
            {lead.website && (
              <a
                href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-[13px] text-white/55 hover:text-white/80 transition-colors no-underline"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {lead.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {lead.city && (
              <div className="flex items-center gap-2 text-[13px] text-white/45">
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {lead.city}
              </div>
            )}
          </div>

          {/* Services */}
          {(lead.applicable_services?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 px-8 py-3 border-b border-white/[0.06]">
              {lead.applicable_services.map(s => (
                <span key={s} className="px-3 py-1 rounded-full text-[11px] text-white/75 bg-white/[0.04] border border-white/[0.12]">
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {/* Body — 2 nested liquid-glass cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 px-8 py-6">
            {/* Social copy */}
            <div className="liquid-glass rounded-[18px] p-5 flex flex-col gap-4">
              <div className="relative z-10 flex flex-col gap-4">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/45 m-0">
                  Social Copy
                </p>
                <Field label="Icebreaker"       value={icebreaker}  onChange={setIcebreaker}  multiline rows={3} />
                <Field label="LinkedIn message" value={linkedinMsg} onChange={setLinkedinMsg} multiline rows={3} />
                <Field label="WhatsApp message" value={whatsappMsg} onChange={setWhatsappMsg} multiline rows={3} />
                <Field label="Facebook message" value={facebookMsg} onChange={setFacebookMsg} multiline rows={3} />
              </div>
            </div>

            {/* Email copy */}
            <div className="liquid-glass rounded-[18px] p-5 flex flex-col gap-4">
              <div className="relative z-10 flex flex-col gap-4">
                <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/45 m-0">
                  Email Copy
                </p>
                <Field label="Email subject" value={emailSubject} onChange={setEmailSubject} />
                <Field label="Email body"    value={emailBody}    onChange={setEmailBody}    multiline rows={18} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-white/[0.06]">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-[13px] text-white/55 hover:text-white/85 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-full text-[13px] font-medium flex items-center gap-2 text-white bg-white/[0.06] border border-white/[0.18] hover:bg-white/[0.10] transition-all"
              style={{ cursor: isDirty ? 'pointer' : 'default' }}
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
    </div>
  );
}
