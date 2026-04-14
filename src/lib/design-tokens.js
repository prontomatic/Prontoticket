/**
 * Design Tokens — ProntoTicket
 * Sistema visual basado en el branding de Prontomatic.
 * Referenciar estos valores desde cualquier pantalla para mantener consistencia.
 */

// Paleta de colores
export const colors = {
  // Azul institucional Prontomatic
  primary: '#003F8A',
  primaryDark: '#002F6C',
  primaryLight: '#1557B8',
  primarySoft: '#E8F0FB',

  // Amarillo Prontomatic (acento — usar con intención, no saturar)
  accent: '#FFD500',
  accentSoft: '#FFF9D6',
  accentDark: '#B39700',

  // Grises (sistema de capas para dar profundidad)
  bg: '#F6F8FB',        // Fondo general
  bgSubtle: '#EEF2F7',  // Fondo de elementos secundarios
  surface: '#FFFFFF',   // Tarjetas y superficies elevadas
  surfaceAlt: '#F8FAFC',// Hover states, headers sutiles

  // Texto
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textPlaceholder: '#94A3B8',

  // Bordes
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  borderStrong: '#CBD5E1',

  // Estados
  success: '#22C55E',
  successSoft: '#DCFCE7',
  successBorder: '#BBF7D0',
  warning: '#EAB308',
  warningSoft: '#FEF9C3',
  warningBorder: '#FDE68A',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  dangerBorder: '#FECACA',
  info: '#3B82F6',
  infoSoft: '#DBEAFE',
  infoBorder: '#BFDBFE',

  // Estados específicos de tickets
  statusAbierto: { dot: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', headerTint: '#F5F9FF' },
  statusEnProceso: { dot: '#EAB308', bg: '#FEFCE8', border: '#FDE68A', text: '#854D0E', headerTint: '#FFFEF5' },
  statusEnEspera: { dot: '#F97316', bg: '#FFF7ED', border: '#FED7AA', text: '#9A3412', headerTint: '#FFFBF5' },
  statusCerrado: { dot: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0', text: '#166534', headerTint: '#F7FEF9' },
};

// Sombras (con ligero tinte azul en vez de negro puro, para sensación más "elevada")
export const shadows = {
  xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
  sm: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
  md: '0 4px 12px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
  lg: '0 10px 30px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)',
  xl: '0 20px 50px rgba(15, 23, 42, 0.1)',
  // Sombras con tinte azul institucional (para hover de tarjetas)
  primaryHover: '0 8px 24px rgba(0, 63, 138, 0.12), 0 2px 6px rgba(0, 63, 138, 0.08)',
  primarySoft: '0 4px 16px rgba(0, 63, 138, 0.08)',
  // Sombra con tinte amarillo (para destacar CTAs)
  accentHover: '0 6px 20px rgba(255, 213, 0, 0.3)',
};

// Radios de borde
export const radius = {
  xs: '6px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  pill: '999px',
};

// Transiciones
export const transitions = {
  fast: 'all 0.15s ease',
  base: 'all 0.2s ease',
  smooth: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
};

// Tipografía (pesos y tamaños)
export const typography = {
  // Pesos
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  // Tracking (letter-spacing) para títulos
  trackingTight: '-0.02em',
  trackingTighter: '-0.03em',
  trackingWide: '0.05em',
};

// Configuración de roles (label legible + color)
export const roleConfig = {
  AGENTE: { label: 'Agente', color: '#003F8A', bg: '#E8F0FB' },
  SUPERVISOR: { label: 'Supervisor', color: '#854D0E', bg: '#FEF9C3' },
  ADMINISTRADOR: { label: 'Administrador', color: '#166534', bg: '#DCFCE7' },
};

// Helper para generar color consistente a partir de un string (para avatares)
export function stringToColor(str) {
  if (!str) return colors.primary;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = [
    '#003F8A', '#1557B8', '#059669', '#7C3AED',
    '#DC2626', '#EA580C', '#CA8A04', '#0891B2',
  ];
  return palette[Math.abs(hash) % palette.length];
}
