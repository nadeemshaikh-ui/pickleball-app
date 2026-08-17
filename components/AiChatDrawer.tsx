'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Play, Trophy } from 'lucide-react';
import { useCurrentClub } from '@/lib/useCurrentClub';

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  action?: {
    type: string;
    url: string;
    groupName?: string;
  };
}

export default function AiChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentClubId } = useCurrentClub();
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: '1',
      sender: 'ai',
      text: "Hi! I'm DinkBot 3000, your live assistant. I can set up sessions, create tournaments, or check player stats! Try typing: *'Set up an 8-round Scramble session on 2 courts'*",
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
      const replyText = json.reply || json.error || "I couldn't process that request right now.";

      const aiMsg: AiChatMessage = {
        id: Math.random().toString(36).slice(2),
        sender: 'ai',
        text: replyText,
        action: json.action,
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
    'Create 8-Round Session',
    'Create Tournament',
    'Active Session Status',
    'Club Leaders',
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
          background: '#2563eb',
          color: '#ffffff',
          border: '3px solid #ffffff',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
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
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.12)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              background: '#ffffff',
              padding: '14px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={22} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                  DinkBot 3000
                </h4>
                <span style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  <Sparkles size={11} style={{ color: '#d97706' }} /> AI Pickleball Co-Pilot
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
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
              background: '#f8fafc',
            }}
          >
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '88%',
                  background: m.sender === 'user' ? '#2563eb' : '#ffffff',
                  color: m.sender === 'user' ? '#ffffff' : '#0f172a',
                  border: m.sender === 'user' ? 'none' : '1px solid #e2e8f0',
                  padding: '12px 14px',
                  borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  boxShadow: m.sender === 'user' ? '0 2px 8px rgba(37,99,235,0.2)' : '0 2px 6px rgba(0,0,0,0.03)',
                }}
              >
                <div>{m.text}</div>

                {/* Interactive Action Cards */}
                {m.action && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                    {m.action.type === 'session_created' && (
                      <a
                        href={m.action.url}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 12,
                          padding: '8px 14px',
                          borderRadius: 8,
                          textDecoration: 'none',
                        }}
                      >
                        <Play size={14} /> Launch Live Scorekeeper
                      </a>
                    )}
                    {m.action.type === 'tournament_setup' && (
                      <a
                        href={m.action.url}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: '#0f172a',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 12,
                          padding: '8px 14px',
                          borderRadius: 8,
                          textDecoration: 'none',
                        }}
                      >
                        <Trophy size={14} /> Open Tournament Builder
                      </a>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 10, color: m.sender === 'user' ? 'rgba(255,255,255,0.7)' : '#94a3b8', marginTop: 4, textAlign: 'right', fontWeight: 600 }}>
                  {m.timestamp}
                </div>
              </div>
            ))}

            {thinking && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  padding: '8px 14px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={14} style={{ color: '#d97706' }} /> Atelier AI is processing...
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
              background: '#ffffff',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            {quickPills.map(p => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                style={{
                  fontSize: 11,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: '1px solid #e2e8f0',
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
              background: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: 8,
            }}
          >
            <input
              type="text"
              placeholder="Type a command e.g. 'Create session'..."
              value={input}
              onChange={e => setInput(e.target.value)}
              style={{
                flex: 1,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#0f172a',
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
                borderRadius: 8,
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
