import { useState, useEffect } from 'react';
import { Activity, Server, Key, List, Cpu, Settings, Zap, Menu, X, BarChart3 } from 'lucide-react';
import DashboardPage from './pages/Dashboard';
import ProvidersPage from './pages/Providers';
import LogsPage from './pages/Logs';
import ModelsPage from './pages/Models';
import KeysPage from './pages/Keys';
import UsagePage from './pages/Usage';
import SettingsPage from './pages/Settings';
import { AUTH_ERROR_EVENT } from './lib/api';

type Page = 'dashboard' | 'providers' | 'usage' | 'logs' | 'models' | 'keys' | 'settings';

const NAV = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: Activity },
  { id: 'providers' as Page, label: 'Providers', icon: Server },
  { id: 'models' as Page, label: 'Models', icon: Cpu },
  { id: 'usage' as Page, label: 'Usage', icon: BarChart3 },
  { id: 'logs' as Page, label: 'Request Logs', icon: List },
  { id: 'keys' as Page, label: 'API Keys', icon: Key },
  { id: 'settings' as Page, label: 'Settings', icon: Settings },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState('');

  function logout(message = '') {
    localStorage.removeItem('adminPassword');
    setAuthed(false);
    setSidebarOpen(false);
    setPwdInput('');
    setPwdError(message);
  }

  useEffect(() => {
    const saved = localStorage.getItem('adminPassword');
    const handleAuthError = () => {
      logout('Session expired. Enter admin password again.');
      setCheckingAuth(false);
    };

    window.addEventListener(AUTH_ERROR_EVENT, handleAuthError);

    if (!saved) {
      setCheckingAuth(false);
      return () => window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError);
    }

    fetch('/api/stats', { headers: { 'x-admin-password': saved } })
      .then(res => {
        if (res.ok) {
          setAuthed(true);
          setPwdError('');
          return;
        }
        logout('Session expired. Enter admin password again.');
      })
      .catch(() => {
        logout('Cannot reach the server.');
      })
      .finally(() => setCheckingAuth(false));

    return () => window.removeEventListener(AUTH_ERROR_EVENT, handleAuthError);
  }, []);

  async function login() {
    setLoggingIn(true);
    localStorage.setItem('adminPassword', pwdInput);
    try {
      const res = await fetch('/api/stats', { headers: { 'x-admin-password': pwdInput } });
      if (res.ok) {
        setAuthed(true);
        setPwdError('');
        return;
      }
      setPwdError('Wrong password');
      localStorage.removeItem('adminPassword');
    } catch {
      setPwdError('Cannot reach the server');
      localStorage.removeItem('adminPassword');
    } finally {
      setLoggingIn(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-900">
        <div className="card w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 text-accent">
            <Zap size={24} />
            <h1 className="text-xl font-bold">AI Gateway</h1>
          </div>
          <div className="flex items-center gap-2 text-muted">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Checking saved session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-900">
        <div className="card w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 text-accent">
            <Zap size={24} />
            <h1 className="text-xl font-bold">AI Gateway</h1>
          </div>
          <p className="text-muted text-sm">Enter admin password to continue</p>
          <input
            className="input"
            type="password"
            placeholder="Admin password"
            value={pwdInput}
            onChange={e => setPwdInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loggingIn && login()}
          />
          {pwdError && <p className="text-danger text-xs">{pwdError}</p>}
          <button className="btn-primary w-full" onClick={login} disabled={loggingIn || !pwdInput}>
            {loggingIn ? 'Checking...' : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  const PageComponent = {
    dashboard: DashboardPage,
    providers: ProvidersPage,
    logs: LogsPage,
    models: ModelsPage,
    usage: UsagePage,
    keys: KeysPage,
    settings: SettingsPage,
  }[page];

  return (
    <div className="flex h-screen overflow-hidden bg-base-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-56 bg-base-800 border-r border-base-600
        flex flex-col transition-transform duration-200
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-base-600 flex-shrink-0">
          <Zap size={18} className="text-accent" />
          <span className="font-bold text-sm">AI Gateway</span>
          <span className="ml-auto badge-blue text-xs">v1.0</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPage(id); setSidebarOpen(false); }}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left
                ${page === id
                  ? 'bg-accent/10 text-accent border-r-2 border-accent'
                  : 'text-muted hover:text-gray-200 hover:bg-base-700'}
              `}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-base-600 text-xs text-muted">
          <p>localhost:3000</p>
          <button
            className="text-danger hover:text-red-400 mt-1"
            onClick={() => logout()}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-base-800 border-b border-base-600 flex items-center px-4 gap-3 flex-shrink-0">
          <button className="lg:hidden text-muted hover:text-white" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h2 className="text-sm font-medium text-gray-200">
            {NAV.find(n => n.id === page)?.label}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted">Connected</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <PageComponent />
        </main>
      </div>
    </div>
  );
}
