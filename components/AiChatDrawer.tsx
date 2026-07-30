'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, MessageSquare, Zap } from 'lucide-react';
import { processAiQuery, type AiChatMessage } from '@/lib/aiAssistant';
import { useCurrentClub } from '@/lib/useCurrentClub';

export default function AiChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentClubId } = useCurrentClub();
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: "👋 Hi! I'm your Atelier Pickleball AI. Ask me about live scores, leaderboards, rules, or WhatsApp recaps!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || thinking) return;

    const userMsg: AiChatMessage = {
      id: Math.random().toString(36).slice(2),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setThinking(true);

    try {
      const responseText = await processAiQuery(text, currentClubId);
      const aiMsg: AiChatMessage = {
        id: Math.random().toString(36).slice(2),
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          sender: 'ai',
          text: 'Sorry, I ran into an error. Please try again!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  const quickPills = [
    '🟢 Active Session?',
    '🏆 Top Players',
    '🏓 Kitchen Rules',
    '📝 WhatsApp Recap',
  ];

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open AI Assistant"
        style={{
          position: 'fixed',
          bottom: 74,
          right: 20,
          zIndex: 9999,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: '#ffffff',
          border: 'none',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
        }}
      >
        {isOpen ? <X size={24} /> : <Bot size={26} />}
      </button>

      {/* AI Chat Drawer Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 136,
            right: 16,
            width: 'calc(100vw - 32px)',
            maxWidth: 380,
            height: 480,
            maxHeight: 'calc(100vh - 160px)',
            background: 'var(--card-bg, #0f172a)',
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Bot size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>Atelier Pickleball AI</h4>
                <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={10} style={{ color: '#eab308' }} /> Intelligent App Companion
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.sender === 'user' ? '#2563eb' : 'rgba(255,255,255,0.06)',
                  color: m.sender === 'user' ? '#fff' : 'var(--foreground)',
                  padding: '10px 14px',
                  borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  fontSize: 13,
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.text}
                <div style={{ fontSize: 9, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>{m.timestamp}</div>
              </div>
            ))}
            {thinking && (
              <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.06)', padding: '8px 12px', borderRadius: 12, fontSize: 12, color: 'var(--muted)' }}>
                AI is thinking…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Pills */}
          <div style={{ padding: '6px 12px', display: 'flex', gap: 6, overflowX: 'auto', background: 'rgba(0,0,0,0.2)' }}>
            {quickPills.map(p => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--muted)',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Row */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 8 }}
          >
            <input
              type="text"
              placeholder="Ask AI anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0 14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
