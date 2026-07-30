'use client';

import { useState } from 'react';
import { UploadCloud, FileImage, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';

interface ScheduleImageUploaderProps {
  onParsed: (parsedData: {
    format: string;
    groupName: string;
    players: string[];
    courtLabels: string[];
    roundCount: number;
  }) => void;
}

export default function ScheduleImageUploader({ onParsed }: ScheduleImageUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    await uploadAndParse(file);
  }

  async function uploadAndParse(file?: File) {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (file) formData.append('file', file);
      if (prompt) formData.append('prompt', prompt);

      const res = await fetch('/api/ai/parse-schedule', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to parse schedule image.');
      }

      onParsed(json.data);
    } catch (err: any) {
      setError(err.message || 'Error processing file.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(124, 58, 237, 0.08) 100%)',
        border: '1.5px dashed rgba(37, 99, 235, 0.3)',
        borderRadius: 16,
        padding: '20px 16px',
        marginBottom: 20,
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#3b82f6', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>
        <Sparkles size={16} /> Vision AI Schedule & Tournament Auto-Parser
      </div>

      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 14px 0' }}>
        Upload a photo or PDF of your tournament schedule / fixture sheet, and AI will host the session automatically!
      </p>

      {preview && (
        <div style={{ marginBottom: 12 }}>
          <img src={preview} alt="Schedule Preview" style={{ maxHeight: 140, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)' }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <label
          className="btn btn-secondary btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            padding: '10px 18px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <UploadCloud size={18} style={{ color: '#2563eb' }} />
          {loading ? 'AI Parsing Image/PDF...' : 'Select Schedule Photo or PDF'}
          <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} disabled={loading} />
        </label>

        <div style={{ display: 'flex', width: '100%', maxWidth: 360, gap: 6, marginTop: 4 }}>
          <input
            type="text"
            placeholder="Or describe constraints (e.g. Nadeem & Viki 2 games)..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--card-bg, rgba(255,255,255,0.05))',
              fontSize: 12,
            }}
          />
          <button
            onClick={() => uploadAndParse()}
            disabled={loading || !prompt.trim()}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 12, fontWeight: 700 }}
          >
            Apply
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 10, color: '#ef4444', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  );
}
