import { useEffect } from 'react';
import hotkeys from 'hotkeys-js';
import { useRouter } from 'next/navigation';
import { signOut } from '@/server/auth';
import { toast } from 'sonner';

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    hotkeys.filter = function(event) {
      const target = (event.target || event.srcElement) as HTMLElement;
      const tagName = target.tagName;
      
      // Allow shortcuts in input fields for specific shortcuts only
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable) {
        return ['ctrl+k', 'cmd+k', 'ctrl+/', 'cmd+/', 'shift+ctrl+q', 'shift+cmd+q'].includes(hotkeys.getPressedKeyCodes().join('+').toLowerCase());
      }
      return true;
    };

    hotkeys('ctrl+d, cmd+d', (event) => {
      event.preventDefault();
      router.push('/dashboard');
      toast.success('Dashboard', { description: 'Navigated to dashboard' });
    });

    hotkeys('ctrl+a, cmd+a', (event) => {
      event.preventDefault();
      router.push('/dashboard/accounts');
      toast.success('Accounts', { description: 'Navigated to accounts' });
    });

    hotkeys('ctrl+s, cmd+s', (event) => {
      event.preventDefault();
      router.push('/dashboard/data');
      toast.success('Data Management', { description: 'Navigated to data page' });
    });

    hotkeys('ctrl+p, cmd+p', (event) => {
      event.preventDefault();
      router.push('/dashboard/prop-firm');
      toast.success('Prop Firm', { description: 'Navigated to prop firm dashboard' });
    });

    hotkeys('ctrl+t, cmd+t', (event) => {
      event.preventDefault();
      router.push('/dashboard/settings');
      toast.success('Settings', { description: 'Navigated to settings' });
    });

    hotkeys('ctrl+k, cmd+k, ctrl+/, cmd+/', (event) => {
      event.preventDefault();
      toast.info('Keyboard Shortcuts', {
        description: `
          ⌘+D: Dashboard
          ⌘+A: Accounts
          ⌘+S: Data Management
          ⌘+P: Prop Firm
          ⌘+T: Settings
          ⌘+R: Refresh Page
          ⇧⌘+Q: Logout
        `,
        duration: 8000,
      });
    });

    hotkeys('ctrl+r, cmd+r', (event) => {
      event.preventDefault();
      window.location.reload();
    });

    hotkeys('shift+ctrl+q, shift+cmd+q', (event) => {
      event.preventDefault();
      signOut();
      toast.success('Logged out', { description: 'You have been logged out successfully' });
    });

    return () => {
      hotkeys.unbind();
    };
  }, [router]);
} 