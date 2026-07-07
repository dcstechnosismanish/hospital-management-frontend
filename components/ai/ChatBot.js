import { useState } from 'react';
import api from '../../utils/api';

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Hello! I\'m your MediCare Assistant 👋 How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { from: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { message: input });
      setMessages(prev => [...prev, { from: 'bot', text: res.data.message }]);
    } catch {
      setMessages(prev => [...prev, { from: 'bot', text: 'Sorry, I could not process that. Please try again.' }]);
    } finally { setLoading(false); }
  };

  return (
    <>
      <button className="chatbot-toggle" onClick={() => setOpen(!open)}>
        <i className={`fa-solid ${open ? 'fa-times' : 'fa-comment-medical'}`} />
      </button>

      {open && (
        <div className="chatbot-window anim-fade-up">
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
            }}>🤖</div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>MediCare Assistant</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>● Online</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '80%', padding: '9px 13px', borderRadius: 12, fontSize: 13,
                  background: m.from === 'user'
                    ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                    : 'var(--hover-bg)',
                  color: m.from === 'user' ? 'white' : 'var(--text-primary)',
                  borderBottomRightRadius: m.from === 'user' ? 4 : 12,
                  borderBottomLeftRadius: m.from === 'bot' ? 4 : 12
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: 'var(--hover-bg)', borderRadius: 12, padding: '9px 14px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>···</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Replies */}
          <div style={{ padding: '0 14px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['OPD timings', 'Emergency', 'Parking'].map(q => (
              <button key={q} onClick={() => { setInput(q); }}
                style={{
                  background: 'var(--hover-bg)', border: '1px solid var(--border-color)',
                  borderRadius: 20, padding: '4px 10px', fontSize: 11,
                  color: 'var(--primary)', cursor: 'pointer'
                }}>
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 14px', borderTop: '1px solid var(--border-color)',
            display: 'flex', gap: 8
          }}>
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask me anything..."
              className="form-control" style={{ fontSize: 13, flex: 1 }} />
            <button onClick={sendMessage} style={{
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              border: 'none', borderRadius: 8, padding: '0 14px', color: 'white',
              cursor: 'pointer', fontSize: 14
            }}>
              <i className="fa-solid fa-paper-plane" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}