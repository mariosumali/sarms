import { useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { useSandboxStore, getEEPosition } from '../lib/store';
import { computeAllTransforms, positionFromMatrix } from '../lib/kinematics';
import { FRIENDLY_NAMES, JOINT_COLORS } from '../lib/jointDefaults';
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
        <input type="number" style={{ width: '60px' }} value={Number(dv.toFixed(isDeg ? 1 : 3))} step={isDeg ? 1 : step}
          onChange={e => { const r = parseFloat(e.target.value); if (!isNaN(r)) onChange(isDeg ? r * RAD : r); }} />
        <span className="mono" style={{ fontSize: '10px', color: 'var(--text-dim)', width: '14px' }}>{unit}</span>
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
    <div style={{ marginBottom: '8px' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', width: '100%', padding: '5px 0',
        background: 'none', border: 'none', borderBottom: '1px solid var(--border-panel)',
        color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', cursor: 'pointer', marginBottom: '8px',
      }}>
        <span style={{ fontSize: '8px', transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        {title}
        {badge && (
          <span style={{
            marginLeft: 'auto', fontSize: '9px', fontFamily: 'var(--font-mono)',
            background: 'rgba(0,229,255,0.1)', color: 'var(--accent)',
            padding: '1px 5px', borderRadius: '3px',
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
      <div style={{ display: 'flex', gap: '6px' }}>
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
    <div style={{ padding: '6px 0', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
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
    <div style={{ padding: '10px', background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)', borderRadius: '8px', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>End-Effector</div>
        <div style={{
          fontSize: '9px', fontFamily: 'var(--font-mono)',
          color: dist < 0.01 ? '#00ff88' : dist < 0.1 ? '#ffaa00' : '#ff6666',
        }}>
          dist: {dist.toFixed(3)}
        </div>
      </div>
      <div className="mono" style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.6' }}>
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
    <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.1)', borderRadius: '8px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#ff6666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
        Target (drag the red sphere)
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
        <input type="checkbox" checked={autoIK} onChange={e => setAutoIK(e.target.checked)} />
        Auto-solve on target move
      </label>
      <div style={{ display: 'flex', gap: '6px' }}>
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
    <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(255,170,0,0.04)', border: '1px solid rgba(255,170,0,0.1)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#ffaa00', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Waypoints
        </div>
        <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>Shift+click floor to add</span>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        <button
          onClick={() => addWaypoint(ikTarget.clone())}
          style={{
            flex: 1, padding: '4px 8px', fontSize: '10px',
            background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.25)',
            borderRadius: '4px', color: '#ffaa00', cursor: 'pointer',
          }}
        >
          + Add at Target
        </button>
        {waypoints.length > 0 && (
          <button
            onClick={clearWaypoints}
            style={{
              padding: '4px 8px', fontSize: '10px',
              background: 'rgba(255,68,68,0.06)', border: '1px solid rgba(255,68,68,0.2)',
              borderRadius: '4px', color: '#ff6666', cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {waypoints.length === 0 ? (
        <div style={{ fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', padding: '6px 0' }}>
          No waypoints yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '120px', overflowY: 'auto' }}>
          {waypoints.map((wp, i) => {
            const hue = (i * 60 + 30) % 360;
            return (
              <div key={wp.id} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '3px 6px', borderRadius: '4px',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <span style={{ color: `hsl(${hue}, 80%, 55%)`, fontSize: '10px', fontWeight: 700, minWidth: '16px' }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  ({wp.position.x.toFixed(2)}, {wp.position.y.toFixed(2)}, {wp.position.z.toFixed(2)})
                </span>
                <button
                  onClick={() => removeWaypoint(wp.id)}
                  style={{
                    padding: '0 3px', fontSize: '9px', color: 'var(--text-dim)',
                    background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {waypointPoses && waypointPoses.length >= 2 && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>Scrub</span>
            <input
              type="range"
              min={0}
              max={waypointPoses.length - 1}
              step={0.01}
              value={pathAnimProgress}
              disabled={pathAnimState === 'playing'}
              onChange={e => setPathProgress(Number(e.target.value))}
              style={{ flex: 1, height: '3px' }}
            />
            <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', minWidth: '28px' }}>
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
      <div className="panel-header">Inspector</div>
      <div className="panel-body">
        {!selected ? (
          <div style={{ color: 'var(--text-dim)', fontSize: '12px', textAlign: 'center', marginTop: '40px', lineHeight: '2' }}>
            <div style={{ fontSize: '20px', opacity: 0.3, marginBottom: '4px' }}>&#9678;</div>
            Click a joint to edit it
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px', color }}>
                {({ base: '\u2B21', revolute: '\u21BB', prismatic: '\u21D5', elbow: '\u231F', 'end-effector': '\u2295' } as Record<string, string>)[selected.type]}
              </span>
              <input type="text" value={selected.name} onChange={e => u({ name: e.target.value })}
                style={{ flex: 1, fontWeight: 600, fontSize: '13px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-panel)', borderRadius: 0, padding: '2px 0' }} />
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', background: `${color}15`, color }}>{FRIENDLY_NAMES[selected.type]}</span>
              <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)' }}>#{idx}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '3px' }}>
                <button className="btn-icon" onClick={() => reorderJoint(selected.id, 'up')} disabled={idx <= 1} style={{ padding: '2px 5px', fontSize: '10px' }}>&#8593;</button>
                <button className="btn-icon" onClick={() => reorderJoint(selected.id, 'down')} disabled={idx >= joints.length - 1} style={{ padding: '2px 5px', fontSize: '10px' }}>&#8595;</button>
                {selected.type !== 'base' && <button className="btn-icon btn-danger" onClick={() => removeJoint(selected.id)} style={{ padding: '2px 5px', fontSize: '10px' }}>&#10005;</button>}
              </div>
            </div>

            {selected.type === 'base' && <BasePanel />}
            {selected.type === 'revolute' && <RevolutePanel j={selected} u={u} />}
            {selected.type === 'prismatic' && <PrismaticPanel j={selected} u={u} />}
            {selected.type === 'elbow' && <ElbowPanel j={selected} u={u} />}
            {selected.type === 'end-effector' && <div style={{ color: 'var(--text-dim)', fontSize: '11px', padding: '8px 0' }}>The gripper has no settings.</div>}
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
