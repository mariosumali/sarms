interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function IconRevolute({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5a9.5 9.5 0 0 1 6.7 2.8" />
      <path d="M21.5 12a9.5 9.5 0 0 1-2.8 6.7" />
      <polyline points="19.5,4 18.7,5.3 17.2,4.8" />
      <polyline points="20,19.5 18.7,18.7 19.2,17.2" />
    </svg>
  );
}

export function IconPrismatic({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="4" width="8" height="16" rx="2" />
      <line x1="12" y1="1" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <polyline points="10,2.5 12,1 14,2.5" />
      <polyline points="10,21.5 12,23 14,21.5" />
      <line x1="10" y1="10" x2="14" y2="10" />
      <line x1="10" y1="14" x2="14" y2="14" />
    </svg>
  );
}

export function IconElbow({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20 L12 12 L20 4" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="5.5" cy="18.5" r="1.5" fill={color} fillOpacity="0.3" />
      <circle cx="18.5" cy="5.5" r="1.5" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

export function IconGripper({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="14" x2="12" y2="22" />
      <path d="M7 3 L7 10 Q7 14 12 14 Q17 14 17 10 L17 3" />
      <line x1="7" y1="3" x2="7" y2="1.5" />
      <line x1="17" y1="3" x2="17" y2="1.5" />
      <circle cx="12" cy="18" r="0" />
    </svg>
  );
}

export function IconBase({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 18 L12 22 L20 18" />
      <path d="M4 14 L12 18 L20 14" />
      <rect x="9" y="6" width="6" height="8" rx="1" />
      <circle cx="12" cy="4" r="1.5" fill={color} fillOpacity="0.4" />
    </svg>
  );
}

export function IconChevron({ size = 12, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M4.5 2.5L8 6L4.5 9.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconExport({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8" />
      <polyline points="4.5,5.5 8,2 11.5,5.5" />
      <path d="M3 10v3h10v-3" />
    </svg>
  );
}

export function IconSidebar({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" />
    </svg>
  );
}

export function IconInspector({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <line x1="10" y1="2.5" x2="10" y2="13.5" />
    </svg>
  );
}

export function IconTimeline({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
      <line x1="1.5" y1="10" x2="14.5" y2="10" />
    </svg>
  );
}

export function IconPlus({ size = 12, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <line x1="6" y1="2" x2="6" y2="10" />
      <line x1="2" y1="6" x2="10" y2="6" />
    </svg>
  );
}

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 260" fill="none">
      <g stroke="currentColor" strokeWidth="24" strokeLinecap="round">
        <line x1="130" y1="35" x2="130" y2="80" />
        <line x1="90" y1="50" x2="90" y2="120" />
        <line x1="170" y1="65" x2="170" y2="120" />
        <path d="M 50 85 L 50 160 A 60 60 0 0 0 170 160 A 40 40 0 0 0 90 160 A 20 20 0 0 0 130 160" />
      </g>
    </svg>
  );
}

export const JOINT_TYPE_ICONS: Record<string, (props: IconProps) => React.ReactNode> = {
  base: IconBase,
  revolute: IconRevolute,
  prismatic: IconPrismatic,
  elbow: IconElbow,
  'end-effector': IconGripper,
};
