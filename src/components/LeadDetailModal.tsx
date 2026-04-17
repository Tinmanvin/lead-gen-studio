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
  locked = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  locked?: boolean;
}) {
  const base =
    'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 placeholder-white/30 focus:outline-none focus:border-purple-400/50 resize-none transition-colors';
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/40 uppercase tracking-wider">{label}</label>
      {multiline ? (
        <textarea
          className={base}
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={locked}
        />
      ) : (
        <input
          className={base}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={locked}
        />
      )}
    </div>
  );
}

export default function LeadDetailModal({ lead, onClose, onSaved }: Props) {
  const [icebreaker, setIcebreaker] = useState(lead.icebreaker ?? '');
  const [emailSubject, setEmailSubject] = useState(lead.email_subject ?? '');
  const [emailBody, setEmailBody] = useState(lead.email_body ?? '');
  const [linkedinMsg, setLinkedinMsg] = useState(lead.linkedin_msg ?? '');
  const [whatsappMsg, setWhatsappMsg] = useState(lead.whatsapp_msg ?? '');
  const [facebookMsg, setFacebookMsg] = useState(lead.facebook_msg ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Close on Escape
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
      const updated = { ...lead, ...patch };
      onSaved?.(updated);
      setTimeout(onClose, 800);
    } finally {
      setSaving(false);
    }
  };

  const score = lead.value_add_score ?? 0;
  const ringPct = Math.round((score / 7) * 100);
  const circumference = 2 * Math.PI * 18;
  const strokeDash = `${(ringPct / 100) * circumference} ${circumference}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="liquid-glass w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-5"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Score ring */}
            <div className="relative flex-shrink-0">
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                <circle
                  cx="22" cy="22" r="18" fill="none"
                  stroke={score >= 5 ? '#7b39fc' : score >= 2 ? '#a48ed7' : 'rgba(255,255,255,0.25)'}
                  strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={strokeDash}
                  transform="rotate(-90 22 22)"
                />
                <text x="22" y="27" textAnchor="middle" fill="white" fontSize="11" fontWeight="600">{score}</text>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white leading-tight">{lead.company_name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {lead.niche && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">{lead.niche}</span>}
                {lead.city && <span className="text-xs text-white/40">{lead.city}</span>}
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
                    Locked
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* DM + services row */}
        <div className="flex flex-wrap gap-3 pb-4 border-b border-white/8">
          {lead.dm_name && (
            <div className="text-sm">
              <span className="text-white/40 text-xs">Contact </span>
              <span className="text-white/80">{lead.dm_name}</span>
              {lead.dm_title && <span className="text-white/40"> · {lead.dm_title}</span>}
            </div>
          )}
          {lead.dm_email && (
            <div className="text-sm font-mono text-purple-300">{lead.dm_email}</div>
          )}
          {lead.website && (
            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
              target="_blank" rel="noreferrer"
              className="text-sm text-white/40 hover:text-white/70 transition-colors underline underline-offset-2">
              {lead.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
        {(lead.applicable_services?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lead.applicable_services.map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300">{s.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}

        {/* Editable copy fields */}
        <div className="space-y-4 pt-1">
          <Field label="Icebreaker" value={icebreaker} onChange={setIcebreaker} multiline rows={2} />
          <Field label="Email Subject" value={emailSubject} onChange={setEmailSubject} />
          <Field label="Email Body" value={emailBody} onChange={setEmailBody} multiline rows={6} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="LinkedIn Message" value={linkedinMsg} onChange={setLinkedinMsg} multiline rows={3} />
            <Field label="WhatsApp Message" value={whatsappMsg} onChange={setWhatsappMsg} multiline rows={3} />
            <Field label="Facebook Message" value={facebookMsg} onChange={setFacebookMsg} multiline rows={3} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-button text-sm text-white/50 hover:text-white/80 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-button text-sm font-semibold transition-all duration-200 flex items-center gap-2
              ${saved ? 'bg-green-500/80 text-white' : isDirty ? 'bg-purple-primary hover:bg-purple-primary/90 text-white' : 'bg-white/10 text-white/50 cursor-default'}`}
          >
            {saving ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : saved ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : null}
            {saved ? 'Saved + Locked' : saving ? 'Saving…' : isDirty ? 'Save + Lock Copy' : 'No Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
