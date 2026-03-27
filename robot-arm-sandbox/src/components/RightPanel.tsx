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
        <input type="number" value={Number(dv.toFixed(isDeg ? 1 : 3))} step={isDeg ? 1 : step}
          onChange={e => { const r = parseFloat(e.target.value); if (!isNaN(r)) onChange(isDeg ? r * RAD : r); }} />
        <span style={{ fontSize: 10, color: 'var(--text-faint)', width: 12, fontFamily: 'var(--font-mono)' }}>{unit}</span>
      </div>
    </div>
  );
}

function NumField({ label, value, step, onChange }: {
  label: string; value: number; step: number; onChange: (v: number) => void;
}) {
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
    <div className="inspector-section">
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: 0,
        paddingBottom: 4,
        background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
        letterSpacing: '0.04em', cursor: 'pointer', marginBottom: 6, height: 'auto',
      }}>
        <IconChevron
          size={8}
          color="var(--text-faint)"
          className={`panel-section-chevron ${open ? 'open' : ''}`}
        />
        {title}
        {badge && <span className="panel-section-badge">{badge}</span>}
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
      <div style={{ display: 'flex', gap: 4 }}>
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
      <Section title="Geometry">
        <SliderField
          label="Column height"
          value={j.d}
          min={0}
          max={3}
          step={0.01}
          unit="m"
          onChange={v => u({ d: v })}
        />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -4, lineHeight: 1.35 }}>
          Length along the rotation axis (straight segment). Rotation is only around Y (turntable); it does not tilt this segment.
        </div>
      </Section>
      <Section title="Advanced DH" defaultOpen={false}>
        <SliderField
          label="Lateral offset (a)"
          value={j.a}
          min={0}
          max={3}
          step={0.01}
          unit="m"
          onChange={v => u({ a: v })}
        />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: -4, lineHeight: 1.35 }}>
          Non-zero shifts the link sideways in X/Z and breaks a vertical column—use only for angled mounts.
        </div>
        <SliderField label="Min angle" value={j.thetaMin} min={-Math.PI} max={0} step={0.01} unit="°" onChange={v => u({ thetaMin: v })} />
        <SliderField label="Max angle" value={j.thetaMax} min={0} max={Math.PI} step={0.01} unit="°" onChange={v => u({ thetaMax: v })} />
        <SliderField label="Twist (α)" value={j.alpha} min={-Math.PI} max={Math.PI} step={0.01} unit="°" onChange={v => u({ alpha: v })} />
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
    <div style={{
      padding: '4px 0', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)',
    }}>
      World: {pos.x.toFixed(3)}, {pos.y.toFixed(3)}, {pos.z.toFixed(3)}
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
    <div className="inspector-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div className="inspector-section-title" style={{ marginBottom: 0 }}>End Effector</div>
        <span className={`stat-badge ${dist < 0.01 ? 'stat-badge--emerald' : dist < 0.1 ? 'stat-badge--amber' : 'stat-badge--rose'}`}>
          {dist.toFixed(3)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
        <span>X {p.x.toFixed(3)}</span>
        <span>Y {p.y.toFixed(3)}</span>
        <span>Z {p.z.toFixed(3)}</span>
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
    <div className="inspector-section">
      <div className="inspector-section-title">Target</div>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
        fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer',
      }}>
        <input type="checkbox" checked={autoIK} onChange={e => setAutoIK(e.target.checked)} />
        Auto-solve on move
      </label>
      <div style={{ display: 'flex', gap: 4 }}>
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
    <div className="inspector-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div className="inspector-section-title" style={{ marginBottom: 0 }}>Waypoints</div>
        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>Shift+click</span>
      </div>

      <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
        <button onClick={() => addWaypoint(ikTarget.clone())} className="btn-sm" style={{ flex: 1 }}>
          + Add at Target
        </button>
        {waypoints.length > 0 && (
          <button onClick={clearWaypoints} className="btn-sm btn-danger">Clear</button>
        )}
      </div>

      {waypoints.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', padding: '2px 0' }}>
          No waypoints
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 100, overflowY: 'auto' }}>
          {waypoints.map((wp, i) => (
            <div key={wp.id} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 4px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-hover)',
              height: 22,
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-mono)', minWidth: 14 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                ({wp.position.x.toFixed(2)}, {wp.position.y.toFixed(2)}, {wp.position.z.toFixed(2)})
              </span>
              <button
                onClick={() => removeWaypoint(wp.id)}
                className="btn-ghost btn-xs"
                style={{ padding: 0, opacity: 0.4, height: 'auto', minWidth: 0 }}
              >
                &#10005;
              </button>
            </div>
          ))}
        </div>
      )}

      {waypointPoses && waypointPoses.length >= 2 && (
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>Scrub</span>
          <input
            type="range"
            min={0}
            max={waypointPoses.length - 1}
            step={0.01}
            value={pathAnimProgress}
            disabled={pathAnimState === 'playing'}
            onChange={e => setPathProgress(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 24 }}>
            {pathAnimProgress.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

function JointAnalyticsTable() {
  const getAnalytics = useSandboxStore(s => s.getAnalytics);
  const joints = useSandboxStore(s => s.joints);
  const basePosition = useSandboxStore(s => s.basePosition);
  const ikTarget = useSandboxStore(s => s.ikTarget);

  const data = getAnalytics();
  const eePos = getEEPosition(joints, basePosition);
  const distToTarget = eePos.distanceTo(ikTarget);

  return (
    <div className="inspector-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div className="inspector-section-title" style={{ marginBottom: 0 }}>Joint Analytics</div>
        <span className={distToTarget < 0.01 ? 'text-emerald' : distToTarget < 0.1 ? 'text-amber' : 'text-rose'}
          style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>
          EE→T: {distToTarget.toFixed(3)}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {data.map(d => (
          <div key={d.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '2px 0',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: 10,
          }}>
            <span style={{
              color: JOINT_COLORS[d.type as keyof typeof JOINT_COLORS] || '#888',
              fontWeight: 500, minWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {d.name}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: 44 }}>
              {d.type === 'revolute' || d.type === 'elbow'
                ? `${(d.theta * DEG).toFixed(1)}°`
                : d.type === 'prismatic'
                ? `d=${d.d?.toFixed(3)}`
                : '—'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontSize: 9, flex: 1 }}>
              ({d.worldPos[0].toFixed(2)}, {d.worldPos[1].toFixed(2)}, {d.worldPos[2].toFixed(2)})
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', fontSize: 9, minWidth: 30, textAlign: 'right' }}>
              {d.distToNext > 0 ? d.distToNext.toFixed(3) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildInspector() {
  const joints = useSandboxStore(s => s.joints);
  const selectedId = useSandboxStore(s => s.selectedJointId);
  const updateJoint = useSandboxStore(s => s.updateJoint);
  const removeJoint = useSandboxStore(s => s.removeJoint);
  const reorderJoint = useSandboxStore(s => s.reorderJoint);

  const selected = joints.find(j => j.id === selectedId);
  const idx = selected ? joints.indexOf(selected) : -1;
  const color = selected ? JOINT_COLORS[selected.type] : '#666';
  const u = (patch: Partial<Joint>) => { if (selectedId) updateJoint(selectedId, patch); };

  if (!selected) {
    return (
      <div style={{ color: 'var(--text-faint)', fontSize: 11, textAlign: 'center', marginTop: 24 }}>
        Select a joint to inspect
      </div>
    );
  }

  return (
    <>
      <div className="inspector-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-raised)', border: '1px solid var(--border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {(() => { const I = JOINT_TYPE_ICONS[selected.type]; return I ? <I size={11} color={color} /> : null; })()}
          </div>
          <input type="text" value={selected.name} onChange={e => u({ name: e.target.value })}
            style={{
              flex: 1, fontWeight: 500, fontSize: 12, background: 'transparent',
              border: 'none', borderBottom: '1px solid var(--border-default)',
              borderRadius: 0, padding: '1px 0', height: 'auto',
            }} />
        </div>

        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span className="tag">{FRIENDLY_NAMES[selected.type]}</span>
          <span className="tag" style={{ color: 'var(--text-faint)' }}>#{idx}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
            <button className="btn-icon btn-xs" onClick={() => reorderJoint(selected.id, 'up')} disabled={idx <= 1}>&#8593;</button>
            <button className="btn-icon btn-xs" onClick={() => reorderJoint(selected.id, 'down')} disabled={idx >= joints.length - 1}>&#8595;</button>
            {selected.type !== 'base' && <button className="btn-icon btn-xs btn-danger" onClick={() => removeJoint(selected.id)}>&#10005;</button>}
          </div>
        </div>
      </div>

      {selected.type === 'base' && <BasePanel />}
      {selected.type === 'revolute' && <RevolutePanel j={selected} u={u} />}
      {selected.type === 'prismatic' && <PrismaticPanel j={selected} u={u} />}
      {selected.type === 'elbow' && <ElbowPanel j={selected} u={u} />}
      {selected.type === 'end-effector' && (
        <div className="inspector-section">
          <div style={{ color: 'var(--text-faint)', fontSize: 11, padding: '4px 0' }}>No editable parameters.</div>
        </div>
      )}
      {selected.type !== 'base' && <WorldPos index={idx} />}
    </>
  );
}

function AnimateInspector() {
  return (
    <>
      <EEReadout />
      <TargetInput />
      <WaypointSection />
    </>
  );
}

function AnalyzeInspector() {
  return (
    <>
      <EEReadout />
      <TargetInput />
      <JointAnalyticsTable />
    </>
  );
}

export function RightPanel() {
  const mode = useSandboxStore(s => s.mode);

  return (
    <div className="panel panel-right">
      <div className="panel-header">
        Inspector
        <span style={{
          marginLeft: 'auto', fontSize: 10, color: 'var(--text-faint)',
          textTransform: 'none', letterSpacing: 0, fontWeight: 400,
          fontFamily: 'var(--font-mono)',
        }}>
          {mode}
        </span>
      </div>
      <div className="panel-body">
        {mode === 'build' && (
          <>
            <BuildInspector />
            <EEReadout />
            <TargetInput />
          </>
        )}
        {mode === 'animate' && <AnimateInspector />}
        {mode === 'analyze' && <AnalyzeInspector />}
      </div>
    </div>
  );
}
