import type { ThemePreset } from './types';

export const lightTheme: ThemePreset = {
  mode: 'light',
  tokens: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surface2: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryForeground: '#ffffff',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    ring: '#2563eb',
  },
};

export const darkTheme: ThemePreset = {
  mode: 'dark',
  tokens: {
    bg: '#0f172a',
    surface: '#111827',
    surface2: '#1e293b',
    border: '#334155',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    primary: '#60a5fa',
    primaryHover: '#93c5fd',
    primaryForeground: '#0f172a',
    destructive: '#dc2626',
    destructiveForeground: '#f8fafc',
    ring: '#60a5fa',
  },
};

export const defaultTheme: ThemePreset = lightTheme;
