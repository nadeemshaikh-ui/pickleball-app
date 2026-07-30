'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useCurrentClub } from '@/lib/useCurrentClub';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export default function AiChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentClubId } = useCurrentClub();
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: "👋 Hi! I'm your Atelier Pickleball AI Assistant. Ask me about live scores, leaderboards, rules, or WhatsApp recaps!",
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
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, clubId: currentClubId }),
      });
      const json = await res.json();
      const replyText = json.reply || json.error || "I couldn't process that query right now.";

      const aiMsg: AiChatMessage = {
        id: Math.random().toString(36).slice(2),
        sender: 'ai',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          sender: 'ai',
          text: 'Sorry, I ran into a network connection issue. Please try again!',
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
          zIndex: 99999,
          width: 54,
          height: 54,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: '#ffffff',
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
        }}
      >
        {isOpen ? <X size={26} /> : <Bot size={28} />}
      </button>

      {/* AI Chat Drawer Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 136,
            right: 16,
            width: 'calc(100vw - 32px)',
            maxWidth: 390,
            height: 520,
            maxHeight: 'calc(100vh - 160px)',
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 20,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              padding: '14px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.2px' }}>
                  Atelier Pickleball AI
                </h4>
                <span style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                  <Sparkles size={11} style={{ color: '#eab308' }} /> Intelligent App Companion
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Chat Messages */}
          <div
            style={{
              flex: 1,
              padding: 14,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              background: '#090d16',
            }}
          >
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: m.sender === 'user' ? '#2563eb' : '#1e293b',
                  color: '#ffffff',
                  border: m.sender === 'user' ? 'none' : '1px solid #334155',
                  padding: '10px 14px',
                  borderRadius: m.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  fontSize: 13,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                {m.text}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'right', fontWeight: 500 }}>
                  {m.timestamp}
                </div>
              </div>
            ))}
            {thinking && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: '#1e293b',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  padding: '8px 14px',
                  borderRadius: 14,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={14} style={{ color: '#eab308' }} /> Atelier AI is thinking…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick Action Pills */}
          <div
            style={{
              padding: '8px 12px',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              background: '#0f172a',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {quickPills.map(p => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                style={{
                  fontSize: 11,
                  padding: '6px 10px',
                  borderRadius: 20,
                  background: 'rgba(37,99,235,0.18)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59,130,246,0.3)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  fontWeight: 700,
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
            style={{
              padding: 12,
              background: '#1e293b',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              type="text"
              placeholder="Ask AI about scores, ranks, rules..."
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{
                flex: 1,
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: 13,
                outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '0 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || thinking ? 0.5 : 1,
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
