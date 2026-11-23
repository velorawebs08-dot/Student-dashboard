import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginView } from './components/LoginView';
import { ParentDashboard } from './components/ParentDashboard';
import { SplashScreen } from './components/SplashScreen';
import { ToastProvider, useToast } from './components/Toast';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';

type RouteState = 'loading' | 'login' | 'parent' | 'admin';

function syncBrowserPath(route: RouteState) {
  if (route === 'loading') return;
  const target = `/${route}`;
  if (window.location.pathname !== target) {
    window.history.replaceState(null, '', target);
  }
}

function AppContent() {
  const { showToast } = useToast();
  const [route, setRoute] = useState<RouteState>('loading');
  const [adminName, setAdminName] = useState<string>('Teacher');
  const isOnline = useOnlineStatus();

  useEffect(() => {
    let active = true;

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('patil_otp_lockout_')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore storage errors
    }

    async function resolveSessionRole(): Promise<{
      role: 'admin' | 'parent' | null;
      displayName?: string;
    }> {
      if (!isSupabaseConfigured) {
        return { role: null };
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          return { role: null };
        }

        const { data: role, error } = await supabase.rpc('link_my_account');
        if (error || (role !== 'admin' && role !== 'parent')) {
          await supabase.auth.signOut();
          return { role: null };
        }

        let displayName = session.user.email || 'Teacher';
        if (role === 'admin') {
          const { data: adminRow } = await supabase
            .from('admins')
            .select('name')
            .maybeSingle();
          if (adminRow?.name) {
            displayName = String(adminRow.name);
          }
        }

        return { role, displayName };
      } catch {
        return { role: null };
      }
    }

    async function bootstrap() {
      const minSplashDelay = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 2000);
      });

      const [, resolved] = await Promise.all([
        minSplashDelay,
        resolveSessionRole(),
      ]);

      if (!active) return;

      if (resolved.role === 'admin') {
        if (resolved.displayName) setAdminName(resolved.displayName);
        setRoute('admin');
        syncBrowserPath('admin');
      } else if (resolved.role === 'parent') {
        setRoute('parent');
        syncBrowserPath('parent');
      } else {
        setRoute('login');
        syncBrowserPath('login');
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session) {
        setRoute((prev) => {
          if (prev === 'loading') return prev;
          syncBrowserPath('login');
          return 'login';
        });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Guard URL paths so parents never reach /admin and admins never reach /parent
  useEffect(() => {
    function handlePopState() {
      if (route === 'loading') return;
      const expected = `/${route}`;
      if (window.location.pathname !== expected) {
        window.history.replaceState(null, '', expected);
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [route]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch {
      showToast('Signed out locally.', 'info');
    }
    setRoute('login');
    syncBrowserPath('login');
  }

  function handleLoginSuccess(role: 'admin' | 'parent', displayName: string) {
    if (role === 'admin') {
      setAdminName(displayName || 'Teacher');
    }
    setRoute(role);
    syncBrowserPath(role);
  }

  return (
    <>
      <AnimatePresence mode="wait">
        {route === 'loading' && <SplashScreen key="splash" />}
      </AnimatePresence>

      {route === 'login' && <LoginView onSuccess={handleLoginSuccess} />}
      {route === 'parent' && <ParentDashboard onLogout={() => void handleLogout()} />}
      {route === 'admin' && (
        <AdminDashboard
          adminName={adminName}
          onLogout={() => void handleLogout()}
        />
      )}

      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-20 left-4 z-50 rounded-xl bg-[#0F2A4A] text-white border border-[#F5A623]/40 px-3.5 py-2 text-xs font-medium shadow-lg"
        >
          Offline — viewing cached application data
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
