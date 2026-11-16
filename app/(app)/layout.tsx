'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell, BookOpen, Building2, CheckCheck, ClipboardList, FileSpreadsheet, FolderOpen, GitBranch, LayoutDashboard, LogOut,
  Mail, Menu, Search, Settings2, ShieldCheck, Stamp, User, UserCog, Users, Repeat2, ListChecks, FileSignature, FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api, post } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { Avatar, UmiraLogo } from '@/components/ui';

type NavItem = { href: string; label: string; icon: any; perms?: string[]; superOnly?: boolean; count?: 'inbox' | 'sign' };
const NAV: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/requests', label: 'Request', icon: ClipboardList },
      { href: '/approvals', label: 'Inbox approval', icon: Stamp, perms: ['APPROVAL_DECIDE'], count: 'inbox' },
      { href: '/e-docs', label: 'Naskah dinas', icon: FileSignature, count: 'sign' },
      { href: '/documents', label: 'Dokumen', icon: FolderOpen },
      { href: '/delegations', label: 'Delegasi', icon: Repeat2, perms: ['DELEGATION_CREATE', 'DELEGATION_MANAGE'] },
      { href: '/reports', label: 'Laporan & ekspor', icon: FileSpreadsheet, perms: ['EXPORT'] },
    ],
  },
  {
    title: 'Administrasi',
    items: [
      { href: '/admin/approval-flows', label: 'Alur approval', icon: GitBranch, perms: ['APPROVAL_FLOW_MANAGE'] },
      { href: '/admin/request-types', label: 'Tipe request', icon: ListChecks, perms: ['REQUEST_TYPE_MANAGE'] },
      { href: '/admin/doc-templates', label: 'Template naskah', icon: FileText, perms: ['EDOC_TEMPLATE_MANAGE'] },
      { href: '/admin/users', label: 'Pengguna', icon: Users, perms: ['USER_MANAGE'] },
      { href: '/admin/roles', label: 'Role & izin', icon: UserCog, perms: ['ROLE_MANAGE'] },
      { href: '/admin/departments', label: 'Organisasi', icon: Building2, perms: ['DEPT_MANAGE'] },
      { href: '/admin/notifications', label: 'Notifikasi e-mail', icon: Mail, perms: ['NOTIF_MANAGE'] },
      { href: '/admin/audit-logs', label: 'Audit trail', icon: ShieldCheck, perms: ['AUDIT_VIEW'] },
    ],
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, loading, can, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [railOpen, setRailOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [signCount, setSignCount] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => { if (!loading && !me) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [loading, me, router, pathname]);
  useEffect(() => setRailOpen(false), [pathname]);
  useEffect(() => {
    if (!me) return;
    const load = () => api<{ count: number }>('/e-documents/to-sign/count').then((r) => setSignCount(r.data.count)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [me, pathname]);
  useEffect(() => {
    if (!me || !can('APPROVAL_DECIDE')) return;
    const load = () => api<any[]>('/approvals/inbox').then((r) => setInboxCount(r.data.length)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [me, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !me) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><div className="spinner" /></div>;
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const visible = (i: NavItem) => (i.superOnly ? me.isSuperAdmin : !i.perms || can(...i.perms));

  return (
    <div className="shell">
      <aside className={`rail ${railOpen ? 'open' : ''}`} aria-label="Navigasi utama">
        <Link href="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <UmiraLogo variant="white" height={40} />
          <div className="brand-sub">Digital Office · {me.department?.name ?? 'Ruang kerja'}</div>
        </Link>
        {NAV.map((g, gi) => {
          const items = g.items.filter(visible);
          if (!items.length) return null;
          return (
            <nav key={gi} className="nav-group">
              {g.title && <div className="nav-title">{g.title}</div>}
              {items.map((i) => (
                <Link key={i.href} href={i.href} className={`nav-link ${isActive(i.href) ? 'active' : ''}`} aria-current={isActive(i.href) ? 'page' : undefined}>
                  <i.icon />{i.label}
                  {i.count === 'inbox' && inboxCount > 0 && <span className="nav-count">{inboxCount}</span>}
                  {i.count === 'sign' && signCount > 0 && <span className="nav-count">{signCount}</span>}
                </Link>
              ))}
            </nav>
          );
        })}
        <div className="rail-foot">
          <Link href="/help" className="nav-link" style={{ padding: '6px 0' }}><BookOpen />Panduan singkat</Link>
          <div style={{ marginTop: 6 }}>v1.0 · {me.roles.join(', ') || (me.isSuperAdmin ? 'Super Admin' : '—')}</div>
        </div>
      </aside>
      {railOpen && <div className="overlay" style={{ zIndex: 65, background: 'rgba(2,40,52,.4)' }} onClick={() => setRailOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setRailOpen(true)} aria-label="Buka menu"><Menu /></button>
          <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); if (search.trim()) router.push(`/search?q=${encodeURIComponent(search.trim())}`); }}>
            <Search />
            <input className="input" placeholder="Cari request, nomor ref, atau dokumen…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Pencarian global" />
          </form>
          <div className="spacer" />
          <NotificationBell />
          <UserMenu name={me.fullName} email={me.email} photo={me.photoUrl} onLogout={logout} />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);
  return ref;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const ref = useOutside(open, () => setOpen(false));
  const load = () => api<any[]>('/notifications?perPage=8').then((r) => { setItems(r.data); setUnread(r.meta?.unread ?? 0); }).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const openItem = async (n: any) => {
    if (!n.readAt) await post(`/notifications/${n.id}/mark-read`).catch(() => {});
    setOpen(false); load();
    if (n.requestId) router.push(`/requests/${n.requestId}`);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifikasi, ${unread} belum dibaca`}>
        <Bell />{unread > 0 && <span className="dot-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="row between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-soft)' }}>
            <h3>Notifikasi</h3>
            <button className="btn ghost sm" onClick={async () => { await post('/notifications/mark-all-read'); load(); }}><CheckCheck />Tandai semua dibaca</button>
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 && <div className="small muted" style={{ padding: 18 }}>Belum ada notifikasi.</div>}
            {items.map((n) => (
              <button key={n.id} className="menu-item" style={{ alignItems: 'flex-start', borderBottom: '1px solid var(--line-soft)' }} onClick={() => openItem(n)}>
                <span style={{ width: 8, height: 8, marginTop: 7, borderRadius: 8, flex: 'none', background: n.readAt ? 'transparent' : 'var(--ion)' }} />
                <span className="grow">
                  <span style={{ color: 'var(--ink)', display: 'block' }} className="clamp2">{n.subject}</span>
                  <span className="tiny muted">{timeAgo(n.createdAt)} · e-mail {n.status === 'sent' ? 'terkirim' : n.status === 'failed' ? 'gagal' : 'antre'}</span>
                </span>
              </button>
            ))}
          </div>
          <Link href="/notifications" className="menu-item" style={{ justifyContent: 'center' }} onClick={() => setOpen(false)}>Lihat semua</Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ name, email, photo, onLogout }: { name: string; email: string; photo: string | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="row" style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }} onClick={() => setOpen((o) => !o)} aria-label="Menu akun">
        <Avatar name={name} src={photo} />
        <span className="hide-sm" style={{ textAlign: 'left' }}><span style={{ display: 'block', fontWeight: 500, fontSize: 13.5 }}>{name}</span><span className="tiny muted">{email}</span></span>
      </button>
      {open && (
        <div className="popover" style={{ width: 230 }}>
          <Link href="/profile" className="menu-item" onClick={() => setOpen(false)}><User />Profil saya</Link>
          <Link href="/notifications" className="menu-item" onClick={() => setOpen(false)}><Settings2 />Riwayat notifikasi</Link>
          <button className="menu-item" onClick={onLogout}><LogOut />Keluar</button>
        </div>
      )}
    </div>
  );
}
