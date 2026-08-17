'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Sparkles, CheckCircle, AlertCircle, Play, X } from 'lucide-react';
import { createSession, type Format } from '@/lib/db';
import { useCurrentClub } from '@/lib/useCurrentClub';

interface AiScheduleImporterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AiScheduleImporter({ isOpen, onClose }: AiScheduleImporterProps) {
  const router = useRouter();
  const { currentClubId } = useCurrentClub();

  const [file, setFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);

  if (!isOpen) return null;

  async function handleParse() {
    if (!file && !promptText.trim()) {
      setError('Please select an image/PDF file or type/paste tournament schedule & rules.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (promptText.trim()) formData.append('prompt', promptText.trim());

      const res = await fetch('/api/ai/parse-schedule', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data) {
        setParsedData(json.data);
      } else {
        setError(json.error || 'Failed to parse schedule.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while parsing.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSession() {
    if (!parsedData) return;
    setCreatingSession(true);
    try {
      const sessionId = await createSession({
        clubId: currentClubId || 'fccd4a42-f3c7-4d93-9493-1e91828e66e2',
        format: (parsedData.format as Format) || 'scramble',
        players: parsedData.players || ['Nadeem', 'Viki', 'Amresh', 'Sid', 'Sumeet', 'Vinit', 'Karan', 'Gopal'],
        absentPlayers: [],
        squads: null,
        courtLabels: parsedData.courtLabels || ['1', '2'],
        roundCount: parsedData.roundCount || 12,
        roundDurationMinutes: 15,
        roundsPerBlock: null,
        groupName: parsedData.groupName || 'AI Scheduled Event',
        logoUrl1: null,
        logoUrl2: null,
        startTime: null,
        eventDate: null,
        courtCost: null,
        ballCost: 0,
        isLadder: false,
        kingOfCourtFixedPairs: null,
        venue: null,
        storylines: [],
        bookerUpiVpa: null,
      });

      onClose();
      router.push(`/session/${sessionId}/play`);
    } catch (err: any) {
      alert('Failed to launch session: ' + err.message);
    } finally {
      setCreatingSession(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 560, border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', color: '#0f172a' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ background: '#2563eb', color: '#ffffff', padding: 6, borderRadius: 8 }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>AI Schedule & Rules Scanner</h3>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Upload external tournament schedule image/PDF or paste rules</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {!parsedData ? (
            <>
              {/* File Upload Zone */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>
                  1. Upload Schedule File (Image / PDF)
                </label>
                <div
                  style={{
                    border: '2px dashed #cbd5e1',
                    borderRadius: 12,
                    padding: 20,
                    textAlign: 'center',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => document.getElementById('ai-file-input')?.click()}
                >
                  <Upload size={28} style={{ color: '#2563eb', margin: '0 auto 8px' }} />
                  <p style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    {file ? file.name : 'Click to upload tournament image or PDF schedule'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Supports PNG, JPG, PDF documents</p>
                  <input
                    id="ai-file-input"
                    type="file"
                    accept="image/*,.pdf"
                    style={{ display: 'none' }}
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {/* Text Prompt Zone */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>
                  2. Or Paste Tournament Schedule & Rules
                </label>
                <textarea
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  placeholder="Paste schedule details or custom tournament rules (e.g. 5 rounds, 8 players: Nadeem, Viki, Amresh... games to 15 points, win by 2)..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: 10, borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <button
                onClick={handleParse}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 14,
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'AI Parsing Schedule & Rules…' : '✨ Scan & Parse with AI'}
              </button>
            </>
          ) : (
            <>
              {/* Parsed Preview */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
                  <CheckCircle size={18} /> Schedule Successfully Parsed!
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                  {parsedData.summary}
                </p>

                <div style={{ background: '#ffffff', borderRadius: 8, padding: 12, border: '1px solid #dcfce7', fontSize: 12 }}>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 800, color: '#0f172a' }}>
                    Event Title: <span style={{ color: '#2563eb' }}>{parsedData.groupName}</span>
                  </p>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 700, color: '#475569' }}>
                    Format: <span style={{ textTransform: 'capitalize', color: '#0f172a' }}>{parsedData.format}</span> · Rounds: {parsedData.roundCount}
                  </p>
                  <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>
                    Detected Players ({parsedData.players?.length || 0}): {parsedData.players?.join(', ')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setParsedData(null)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 10,
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 800,
                    fontSize: 13,
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Back / Re-scan
                </button>

                <button
                  onClick={handleCreateSession}
                  disabled={creatingSession}
                  style={{
                    flex: 2,
                    padding: '12px',
                    borderRadius: 10,
                    background: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 14,
                    border: 'none',
                    cursor: creatingSession ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6
                  }}
                >
                  <Play size={16} /> {creatingSession ? 'Launching Session…' : 'Launch Live Session Now'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
