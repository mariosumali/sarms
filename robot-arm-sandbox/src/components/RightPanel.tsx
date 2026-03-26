import { useMemo, useState } from 'react';
import { useSandboxStore, getEEPosition } from '../lib/store';
import { computeAllTransforms, positionFromMatrix } from '../lib/kinematics';
import { FRIENDLY_NAMES, JOINT_COLORS } from '../lib/jointDefaults';
import { JOINT_TYPE_ICONS, IconChevron } from './Icons';
import type { Joint } from '../lib/kinematics';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

function SliderField({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  const isDeg = unit === '°';
  const dv = isDeg ? value * DEG : value;
  const dMin = isDeg ? min * DEG : min;
  const dMax = isDeg ? max * DEG : max;
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <div className="field-row">
        <input type="range" min={dMin} max={dMax} step={isDeg ? 1 : step} value={dv}
          onChange={e => onChange(isDeg ? parseFloat(e.target.value) * RAD : parseFloat(e.target.value))} />
        <input type="number" style={{ width: '58px' }} value={Number(dv.toFixed(isDeg ? 1 : 3))} step={isDeg ? 1 : step}
          onChange={e => { const r = parseFloat(e.target.value); if (!isNaN(r)) onChange(isDeg ? r * RAD : r); }} />
        <span className="mono" style={{ fontSize: '10px', color: 'var(--text-faint)', width: '14px' }}>{unit}</span>
      </div>
    </div>
  );
}

function NumField({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="field-label">{label}</label>
      <input type="number" step={step} value={Number(value.toFixed(4))}
        onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }} />
    </div>
  );
}

function Section({ title, children, defaultOpen = true, badge }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 4 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '5px 0',
        background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', cursor: 'pointer', marginBottom: 8,
      }}>
        <IconChevron
          size={9}
          color="var(--text-faint)"
          className={`panel-section-chevron ${open ? 'open' : ''}`}
        />
        {title}
        {badge && (
          <span className="panel-section-badge" style={{
            background: 'var(--bg-raised)',
            color: 'var(--text-muted)',
          }}>{badge}</span>
        )}
      </button>
      {open && children}
    </div>
  );
}

function BasePanel() {
  const bp = useSandboxStore(s => s.basePosition);
  const setBp = useSandboxStore(s => s.setBasePosition);
  return (
    <Section title="Position">
      <div style={{ display: 'flex', gap: 6 }}>
        <NumField label="X" value={bp[0]} step={0.1} onChange={v => setBp([v, bp[1], bp[2]])} />
        <NumField label="Y" value={bp[1]} step={0.1} onChange={v => setBp([bp[0], v, bp[2]])} />
        <NumField label="Z" value={bp[2]} step={0.1} onChange={v => setBp([bp[0], bp[1], v])} />
      </div>
    </Section>
  );
}

function RevolutePanel({ j, u }: { j: Joint; u: (p: Partial<Joint>) => void }) {
  return (
    <>
      <Section title="Angle">
        <SliderField label="Rotation" value={j.theta} min={j.thetaMin} max={j.thetaMax} step={0.01} unit="°" onChange={v => u({ theta: v })} />
      </Section>
      <Section title="Size">
        <SliderField label="Arm length" value={j.a} min={0} max={3} step={0.01} unit="m" onChange={v => u({ a: v })} />
      </Section>
      <Section title="Limits & Twist" defaultOpen={false}>
        <SliderField label="Min angle" value={j.thetaMin} min={-Math.PI} max={0} step={0.01} unit="°" onChange={v => u({ thetaMin: v })} />
        <SliderField label="Max angle" value={j.thetaMax} min={0} max={Math.PI} step={0.01} unit="°" onChange={v => u({ thetaMax: v })} />
        <SliderField label="Twist" value={j.alpha} min={-Math.PI} max={Math.PI} step={0.01} unit="°" onChange={v => u({ alpha: v })} />
      </Section>
    </>
  );
}

function PrismaticPanel({ j, u }: { j: Joint; u: (p: Partial<Joint>) => void }) {
  return (
    <>
      <Section title="Extension">
        <SliderField label="Length" value={j.d} min={j.dMin} max={j.dMax} step={0.01} unit="m" onChange={v => u({ d: v })} />
      </Section>
      <Section title="Limits" defaultOpen={false}>
        <SliderField label="Min length" value={j.dMin} min={0} max={1} step={0.01} unit="m" onChange={v => u({ dMin: v })} />
        <SliderField label="Max length" value={j.dMax} min={0.1} max={3} step={0.01} unit="m" onChange={v => u({ dMax: v })} />
      </Section>
    </>
  );
}

function ElbowPanel({ j, u }: { j: Joint; u: (p: Partial<Joint>) => void }) {
  return (
    <>
      <Section title="Rotation">
        <SliderField label="Bend 1" value={j.theta} min={j.thetaMin} max={j.thetaMax} step={0.01} unit="°" onChange={v => u({ theta: v })} />
        <SliderField label="Bend 2" value={j.theta2} min={j.theta2Min} max={j.theta2Max} step={0.01} unit="°" onChange={v => u({ theta2: v })} />
      </Section>
      <Section title="Size">
        <SliderField label="Arm length" value={j.a} min={0} max={3} step={0.01} unit="m" onChange={v => u({ a: v })} />
        <SliderField label="Offset" value={j.d} min={0} max={2} step={0.01} unit="m" onChange={v => u({ d: v })} />
      </Section>
      <Section title="Limits" defaultOpen={false}>
        <SliderField label="Bend 1 min" value={j.thetaMin} min={-Math.PI} max={0} step={0.01} unit="°" onChange={v => u({ thetaMin: v })} />
        <SliderField label="Bend 1 max" value={j.thetaMax} min={0} max={Math.PI} step={0.01} unit="°" onChange={v => u({ thetaMax: v })} />
        <SliderField label="Bend 2 min" value={j.theta2Min} min={-Math.PI} max={0} step={0.01} unit="°" onChange={v => u({ theta2Min: v })} />
        <SliderField label="Bend 2 max" value={j.theta2Max} min={0} max={Math.PI} step={0.01} unit="°" onChange={v => u({ theta2Max: v })} />
      </Section>
    </>
  );
}

function WorldPos({ index }: { index: number }) {
  const joints = useSandboxStore(s => s.joints);
  const bp = useSandboxStore(s => s.basePosition);
  const pos = useMemo(() => {
    const { transforms } = computeAllTransforms(joints, bp);
    return index < transforms.length ? positionFromMatrix(transforms[index]) : null;
  }, [joints, bp, index]);
  if (!pos) return null;
  return (
    <div style={{ padding: '4px 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
      Position: {pos.x.toFixed(2)}, {pos.y.toFixed(2)}, {pos.z.toFixed(2)}
    </div>
  );
}

function EEReadout() {
  const joints = useSandboxStore(s => s.joints);
  const bp = useSandboxStore(s => s.basePosition);
  const ikTarget = useSandboxStore(s => s.ikTarget);
  const p = getEEPosition(joints, bp);
  const dist = p.distanceTo(ikTarget);
  return (
    <div className="inspector-card" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End-Effector</div>
        <span className={`stat-badge ${dist < 0.01 ? 'stat-badge--emerald' : dist < 0.1 ? 'stat-badge--amber' : 'stat-badge--rose'}`}
          style={{ fontSize: 9 }}>
          dist: {dist.toFixed(3)}
        </span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        X: {p.x.toFixed(3)} &nbsp; Y: {p.y.toFixed(3)} &nbsp; Z: {p.z.toFixed(3)}
      </div>
    </div>
  );
}

function TargetInput() {
  const ikTarget = useSandboxStore(s => s.ikTarget);
  const setIKTarget = useSandboxStore(s => s.setIKTarget);
  const autoIK = useSandboxStore(s => s.autoIK);
  const setAutoIK = useSandboxStore(s => s.setAutoIK);
  return (
    <div className="inspector-card" style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        Target
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={autoIK} onChange={e => setAutoIK(e.target.checked)} />
        Auto-solve on target move
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['x', 'y', 'z'] as const).map(a => (
          <NumField key={a} label={a.toUpperCase()} value={ikTarget[a]} step={0.05}
            onChange={v => { const t = ikTarget.clone(); (t as any)[a] = v; setIKTarget(t); }} />
        ))}
      </div>
    </div>
  );
}

function WaypointSection() {
  const waypoints = useSandboxStore(s => s.waypoints);
  const addWaypoint = useSandboxStore(s => s.addWaypoint);
  const removeWaypoint = useSandboxStore(s => s.removeWaypoint);
  const clearWaypoints = useSandboxStore(s => s.clearWaypoints);
  const ikTarget = useSandboxStore(s => s.ikTarget);
  const waypointPoses = useSandboxStore(s => s.waypointPoses);
  const pathAnimState = useSandboxStore(s => s.pathAnimState);
  const pathAnimProgress = useSandboxStore(s => s.pathAnimProgress);
  const setPathProgress = useSandboxStore(s => s.setPathProgress);

  return (
    <div className="inspector-card" style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Waypoints
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>Shift+click floor</span>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => addWaypoint(ikTarget.clone())}
          className="btn-sm"
          style={{ flex: 1 }}
        >
          + Add at Target
        </button>
        {waypoints.length > 0 && (
          <button onClick={clearWaypoints} className="btn-sm btn-danger">
            Clear
          </button>
        )}
      </div>

      {waypoints.length === 0 ? (
        <div style={{ fontSize: 10, color: 'var(--text-faint)', textAlign: 'center', padding: '4px 0' }}>
          No waypoints yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 120, overflowY: 'auto' }}>
          {waypoints.map((wp, i) => (
            <div key={wp.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 6px', borderRadius: 'var(--radius-xs)',
              background: 'var(--bg-hover)',
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)', minWidth: 16 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                ({wp.position.x.toFixed(2)}, {wp.position.y.toFixed(2)}, {wp.position.z.toFixed(2)})
              </span>
              <button
                onClick={() => removeWaypoint(wp.id)}
                className="btn-ghost btn-xs"
                style={{ padding: '0 3px', opacity: 0.5 }}
              >
                &#10005;
              </button>
            </div>
          ))}
        </div>
      )}

      {waypointPoses && waypointPoses.length >= 2 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>Scrub</span>
            <input
              type="range"
              min={0}
              max={waypointPoses.length - 1}
              step={0.01}
              value={pathAnimProgress}
              disabled={pathAnimState === 'playing'}
              onChange={e => setPathProgress(Number(e.target.value))}
              style={{ flex: 1, height: 3 }}
            />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 28 }}>
              {pathAnimProgress.toFixed(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function RightPanel() {
  const joints = useSandboxStore(s => s.joints);
  const selectedId = useSandboxStore(s => s.selectedJointId);
  const updateJoint = useSandboxStore(s => s.updateJoint);
  const removeJoint = useSandboxStore(s => s.removeJoint);
  const reorderJoint = useSandboxStore(s => s.reorderJoint);

  const selected = joints.find(j => j.id === selectedId);
  const idx = selected ? joints.indexOf(selected) : -1;
  const color = selected ? JOINT_COLORS[selected.type] : '#666';
  const u = (patch: Partial<Joint>) => { if (selectedId) updateJoint(selectedId, patch); };

  return (
    <div className="panel panel-right">
      <div className="panel-section">
        <div className="panel-section-header" style={{ cursor: 'default' }}>
          Inspector
        </div>
      </div>
      <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
        {!selected ? (
          <div style={{ color: 'var(--text-faint)', fontSize: 11, textAlign: 'center', marginTop: 36, lineHeight: 1.8, letterSpacing: '-0.005em' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1" strokeLinecap="round" style={{ opacity: 0.25, marginBottom: 6 }}>
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="3" x2="12" y2="1" />
              <line x1="12" y1="23" x2="12" y2="21" />
              <line x1="3" y1="12" x2="1" y2="12" />
              <line x1="23" y1="12" x2="21" y2="12" />
            </svg>
            <div>Select a joint to inspect</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 'var(--radius-xs)',
                background: 'var(--bg-raised)', border: '1px solid var(--border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {(() => { const I = JOINT_TYPE_ICONS[selected.type]; return I ? <I size={14} color={color} /> : null; })()}
              </div>
              <input type="text" value={selected.name} onChange={e => u({ name: e.target.value })}
                style={{ flex: 1, fontWeight: 600, fontSize: 13, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-default)', borderRadius: 0, padding: '2px 0' }} />
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <span className="tag" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>{FRIENDLY_NAMES[selected.type]}</span>
              <span className="tag" style={{ background: 'var(--bg-raised)', color: 'var(--text-faint)' }}>#{idx}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
                <button className="btn-icon btn-xs" onClick={() => reorderJoint(selected.id, 'up')} disabled={idx <= 1}>&#8593;</button>
                <button className="btn-icon btn-xs" onClick={() => reorderJoint(selected.id, 'down')} disabled={idx >= joints.length - 1}>&#8595;</button>
                {selected.type !== 'base' && <button className="btn-icon btn-xs btn-danger" onClick={() => removeJoint(selected.id)}>&#10005;</button>}
              </div>
            </div>

            {selected.type === 'base' && <BasePanel />}
            {selected.type === 'revolute' && <RevolutePanel j={selected} u={u} />}
            {selected.type === 'prismatic' && <PrismaticPanel j={selected} u={u} />}
            {selected.type === 'elbow' && <ElbowPanel j={selected} u={u} />}
            {selected.type === 'end-effector' && <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: '8px 0' }}>The gripper has no editable parameters.</div>}
            {selected.type !== 'base' && <WorldPos index={idx} />}
          </>
        )}

        <EEReadout />
        <TargetInput />
        <WaypointSection />
      </div>
    </div>
  );
}
