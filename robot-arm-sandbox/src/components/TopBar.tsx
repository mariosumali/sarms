import { useSandboxStore, PRESET_NAMES } from '../lib/store';
import { exportDHJSON, exportURDFStub, downloadFile } from '../lib/exporters';
import { useState, useRef, useEffect } from 'react';
import { LogoMark, IconSidebar, IconInspector, IconTimeline, IconExport } from './Icons';

function PresetDropdown() {
  const loadPreset = useSandboxStore(s => s.loadPreset);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: open ? 'var(--bg-raised)' : undefined,
          borderColor: open ? 'var(--border-strong)' : undefined,
        }}
      >
        Presets
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.4 }}>
          <path d="M2 3L4 5.5L6 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 2px)',
          left: 0,
          background: 'var(--bg-raised)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          zIndex: 50,
          minWidth: 150,
          padding: 2,
        }}>
          {PRESET_NAMES.map(name => (
            <button
              key={name}
              onClick={() => { loadPreset(name); setOpen(false); }}
              style={{
                display: 'flex',
                width: '100%',
                textAlign: 'left',
                padding: '4px 8px',
                fontSize: 11,
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-secondary)',
                height: 'auto',
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const MODES = ['build', 'animate', 'analyze'] as const;

export function TopBar() {
  const joints = useSandboxStore(s => s.joints);
  const mode = useSandboxStore(s => s.mode);
  const setMode = useSandboxStore(s => s.setMode);
  const leftOpen = useSandboxStore(s => s.leftPanelOpen);
  const rightOpen = useSandboxStore(s => s.rightPanelOpen);
  const bottomOpen = useSandboxStore(s => s.bottomPanelOpen);
  const toggleLeft = useSandboxStore(s => s.toggleLeftPanel);
  const toggleRight = useSandboxStore(s => s.toggleRightPanel);
  const toggleBottom = useSandboxStore(s => s.toggleBottomPanel);

  const jointCount = joints.filter(j => j.type !== 'base').length;
  const dofCount = joints.reduce((n, j) => {
    if (j.type === 'revolute' || j.type === 'prismatic') return n + 1;
    if (j.type === 'elbow') return n + 2;
    return n;
  }, 0);

  const handleExportDH = () => downloadFile(exportDHJSON(joints), 'dh-parameters.json', 'application/json');
  const handleExportURDF = () => downloadFile(exportURDFStub(joints), 'robot_arm.urdf', 'application/xml');

  return (
    <div className="topbar">
      <div className="topbar-title">
        <LogoMark size={16} />
        Robot Arm Sandbox
      </div>

      <div className="mode-tabs">
        {MODES.map(m => (
          <button
            key={m}
            className={`mode-tab ${mode === m ? 'active' : ''}`}
            onClick={() => setMode(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="topbar-divider" />

      <PresetDropdown />

      <span className="topbar-meta">
        {jointCount}J &middot; {dofCount}DOF
      </span>

      <div className="topbar-spacer" />

      <div className="topbar-group">
        <button
          className={leftOpen ? 'btn-sm' : 'btn-sm btn-ghost'}
          onClick={toggleLeft}
          title="Toggle Parts panel"
          style={{ gap: 3 }}
        >
          <IconSidebar size={11} />
          Parts
        </button>
        <button
          className={rightOpen ? 'btn-sm' : 'btn-sm btn-ghost'}
          onClick={toggleRight}
          title="Toggle Inspector panel"
          style={{ gap: 3 }}
        >
          <IconInspector size={11} />
          Inspector
        </button>
        <button
          className={bottomOpen ? 'btn-sm' : 'btn-sm btn-ghost'}
          onClick={toggleBottom}
          title="Toggle Timeline panel"
          style={{ gap: 3 }}
        >
          <IconTimeline size={11} />
          Timeline
        </button>
      </div>

      <div className="topbar-divider" />

      <div className="topbar-group">
        <button onClick={handleExportDH} className="btn-ghost btn-sm" style={{ gap: 3 }}>
          <IconExport size={10} />
          JSON
        </button>
        <button onClick={handleExportURDF} className="btn-ghost btn-sm" style={{ gap: 3 }}>
          <IconExport size={10} />
          URDF
        </button>
      </div>
    </div>
  );
}
