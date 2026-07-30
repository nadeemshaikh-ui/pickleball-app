'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft, RefreshCw, Eye, Search, Filter } from 'lucide-react';
import { isSuperAdmin } from '@/lib/clubs';
import { fetchSuperAdminActivityLogs, type ActivityLogRow } from '@/lib/activityLogger';

export default function SuperAdminActivityLogPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await fetchSuperAdminActivityLogs(200);
      setLogs(data);
    } catch {
      // Ignore load error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await isSuperAdmin();
      setAllowed(ok);
      if (ok) {
        await loadLogs();
      } else {
        setLoading(false);
      }
    })();
  }, []);

  if (allowed === false) {
    return (
      <main className="container" style={{ paddingTop: 40, textAlign: 'center' }}>
        <h1 style={{ color: 'var(--danger)' }}>Access Denied</h1>
        <p>You do not have Super Admin privileges to view user access logs.</p>
        <Link href="/" className="btn btn-secondary" style={{ marginTop: 16 }}>
          Return Home
        </Link>
      </main>
    );
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      search.trim() === '' ||
      (log.user_name && log.user_name.toLowerCase().includes(search.toLowerCase())) ||
      (log.user_email && log.user_email.toLowerCase().includes(search.toLowerCase())) ||
      log.path.toLowerCase().includes(search.toLowerCase());

    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesAction;
  });

  return (
    <main className="container" style={{ paddingBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Link href="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--muted)', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Back to Super Admin
        </Link>
        <button
          onClick={loadLogs}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Logs
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Shield size={26} style={{ color: '#eab308' }} />
        <h1 style={{ margin: 0 }}>App Access & User Activity Audit Log</h1>
      </div>
      <p style={{ color: 'var(--muted)', marginTop: 4, marginBottom: 20 }}>
        Real-time audit trail of who accessed the app, which screens were opened, and user actions performed.
      </p>

      {/* Filter & Search Controls */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Search by User Name, Email, or Page URL..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 34 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={16} style={{ color: 'var(--muted)' }} />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--card-bg)', color: '#fff', border: '1px solid var(--border)', fontSize: 13 }}
          >
            <option value="all">All Actions</option>
            <option value="page_view">Page View</option>
            <option value="score_submit">Score Submit</option>
            <option value="abandon_session">Abandon Session</option>
            <option value="club_switch">Club Switch</option>
          </select>
        </div>
      </div>

      {/* Activity Log Table */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          Loading user activity logs...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
          No activity logs match your search filter.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5, color: 'var(--muted)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Time</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>User / Member</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Screen / Page Opened</th>
                <th style={{ padding: '12px 14px', textAlign: 'left' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    <div style={{ fontSize: 10, opacity: 0.7 }}>{new Date(log.created_at).toLocaleDateString()}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: '#fff' }}>{log.user_name || 'Anonymous Guest'}</div>
                    {log.user_email && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{log.user_email}</div>}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <a
                      href={log.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Eye size={13} /> {log.path}
                    </a>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: log.action === 'page_view' ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)',
                        color: log.action === 'page_view' ? '#60a5fa' : '#eab308',
                        border: `1px solid ${log.action === 'page_view' ? 'rgba(59,130,246,0.3)' : 'rgba(234,179,8,0.3)'}`,
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
