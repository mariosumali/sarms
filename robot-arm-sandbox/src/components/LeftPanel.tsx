import { useState } from 'react';
import { useSandboxStore } from '../lib/store';
import { FRIENDLY_NAMES, FRIENDLY_DESC, JOINT_COLORS } from '../lib/jointDefaults';
import { JOINT_TYPE_ICONS, IconChevron } from './Icons';
import type { Joint } from '../lib/kinematics';

const DEG = 180 / Math.PI;
const DRAGGABLE_TYPES: Joint['type'][] = ['revolute', 'prismatic', 'elbow', 'end-effector'];

function Section({ title, badge, defaultOpen = true, children }: {
  title: string; badge?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel-section">
      <div className="panel-section-header" onClick={() => setOpen(!open)}>
        <IconChevron
          size={9}
          color="var(--text-faint)"
          className={`panel-section-chevron ${open ? 'open' : ''}`}
        />
        {title}
        {badge && <span className="panel-section-badge">{badge}</span>}
      </div>
      {open && <div className="panel-section-body">{children}</div>}
    </div>
  );
}

function getInlineValue(j: Joint): string {
  if (j.type === 'revolute') return `${(j.theta * DEG).toFixed(1)}°`;
  if (j.type === 'prismatic') return `${j.d.toFixed(3)}m`;
  if (j.type === 'elbow') return `${(j.theta * DEG).toFixed(1)}°`;
  return '';
}

function TreeItem({ joint, index }: { joint: Joint; index: number }) {
  const selectedId = useSandboxStore(s => s.selectedJointId);
  const selectJoint = useSandboxStore(s => s.selectJoint);
  const color = JOINT_COLORS[joint.type];
  const Icon = JOINT_TYPE_ICONS[joint.type];
  const isSelected = joint.id === selectedId;
  const value = getInlineValue(joint);

  return (
    <div
      className={`tree-item ${isSelected ? 'selected' : ''}`}
      style={{ paddingLeft: `${6 + Math.min(index, 4) * 8}px` }}
      onClick={() => selectJoint(joint.id)}
    >
      <div className="tree-item-icon">
        {Icon && <Icon size={11} color={isSelected ? 'var(--accent-text)' : color} />}
      </div>
      <span className="tree-item-name">{joint.name}</span>
      {value && <span className="tree-item-value">{value}</span>}
    </div>
  );
}

function ChainHierarchy() {
  const joints = useSandboxStore(s => s.joints);

  if (joints.length <= 1) {
    return (
      <div style={{
        fontSize: 11,
        color: 'var(--text-faint)',
        textAlign: 'center',
        padding: '8px 0',
      }}>
        Load a preset or add parts below
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {joints.map((j, i) => (
        <TreeItem key={j.id} joint={j} index={i} />
      ))}
    </div>
  );
}

export function LeftPanel() {
  const addJoint = useSandboxStore(s => s.addJoint);
  const joints = useSandboxStore(s => s.joints);

  return (
    <div className="panel panel-left">
      <Section title="Chain" badge={`${joints.length}`}>
        <ChainHierarchy />
      </Section>

      <Section title="Add Part">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {DRAGGABLE_TYPES.map(type => {
            const color = JOINT_COLORS[type];
            const Icon = JOINT_TYPE_ICONS[type];
            return (
              <div
                key={type}
                className="joint-card"
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/joint-type', type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addJoint(type)}
              >
                <div className="joint-card-icon">
                  {Icon && <Icon size={12} color={color} />}
                </div>
                <div className="joint-card-info">
                  <div className="joint-card-name">{FRIENDLY_NAMES[type]}</div>
                  <div className="joint-card-desc">{FRIENDLY_DESC[type]}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div style={{
        marginTop: 'auto',
        padding: '6px 8px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.6 }}>
          <div style={{
            color: 'var(--text-muted)',
            fontWeight: 500,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 2,
          }}>
            Shortcuts
          </div>
          <div><Kbd>Del</Kbd> Remove selected</div>
          <div><Kbd>⌘Z</Kbd> Undo</div>
          <div><Kbd>Shift+click</Kbd> Add waypoint</div>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      display: 'inline-block',
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      background: 'var(--bg-raised)',
      border: '1px solid var(--border-default)',
      borderRadius: 2,
      padding: '0 3px',
      marginRight: 3,
      lineHeight: '14px',
      verticalAlign: 'middle',
      color: 'var(--text-muted)',
    }}>
      {children}
    </kbd>
  );
}
