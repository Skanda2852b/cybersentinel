import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const NOTIFICATION_KEYS = [
  'criticalAlerts',
  'highAlerts',
  'mediumDigest',
  'incidentUpdates',
  'weeklyReports',
] as const;

export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

const defaultNotificationPrefs: Record<NotificationKey, boolean> = {
  criticalAlerts: true,
  highAlerts: true,
  mediumDigest: false,
  incidentUpdates: true,
  weeklyReports: false,
};

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  notificationPrefs: Record<NotificationKey, boolean>;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setNotificationPref: (key: NotificationKey, enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      notificationPrefs: defaultNotificationPrefs,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      setNotificationPref: (key, enabled) =>
        set((state) => ({ notificationPrefs: { ...state.notificationPrefs, [key]: enabled } })),
    }),
    { name: 'ui-store' }
  )
);