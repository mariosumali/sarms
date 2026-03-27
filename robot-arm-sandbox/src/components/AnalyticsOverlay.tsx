import { useSandboxStore, getEEPosition } from '../lib/store';
import type { JointAnalytics } from '../lib/store';

const DEG = 180 / Math.PI;

const TYPE_COLORS: Record<string, string> = {
  base: '#6e7d93',
  revolute: '#5090b8',
  prismatic: '#8a72c8',
  elbow: '#c08540',
  'end-effector': '#c05858',
};

function JointRow({ data }: { data: JointAnalytics }) {
  const color = TYPE_COLORS[data.type] || '#888';
  const cell: React.CSSProperties = {
    fontSize: 10, padding: '2px 4px', fontFamily: 'var(--font-mono)',
  };

  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <td style={{ ...cell, color, fontWeight: 500, fontFamily: 'var(--font-sans)' }}>
        {data.name}
      </td>
      <td style={{ ...cell, color: 'var(--text-secondary)' }}>
        {data.type === 'revolute' || data.type === 'elbow'
          ? `${(data.theta * DEG).toFixed(1)}\u00B0`
          : data.type === 'prismatic'
          ? `d=${data.d?.toFixed(3)}`
          : '\u2014'}
      </td>
      {data.type === 'elbow' && data.theta2 !== undefined ? (
        <td style={{ ...cell, color: 'var(--text-secondary)' }}>
          {(data.theta2 * DEG).toFixed(1)}\u00B0
        </td>
      ) : (
        <td style={{ ...cell, color: 'var(--text-faint)' }}>\u2014</td>
      )}
      <td style={{ ...cell, color: 'var(--text-faint)', fontSize: 9 }}>
        ({data.worldPos[0].toFixed(2)}, {data.worldPos[1].toFixed(2)}, {data.worldPos[2].toFixed(2)})
      </td>
      <td style={{ ...cell, color: 'var(--text-faint)', textAlign: 'right' }}>
        {data.distToNext > 0 ? data.distToNext.toFixed(3) : '\u2014'}
      </td>
    </tr>
  );
}

export function AnalyticsOverlay() {
  const getAnalytics = useSandboxStore(s => s.getAnalytics);
  const joints = useSandboxStore(s => s.joints);
  const basePosition = useSandboxStore(s => s.basePosition);
  const ikTarget = useSandboxStore(s => s.ikTarget);

  const data = getAnalytics();
  const eePos = getEEPosition(joints, basePosition);
  const distToTarget = eePos.distanceTo(ikTarget);

  const th: React.CSSProperties = {
    fontSize: 10, color: 'var(--text-faint)', textAlign: 'left', padding: '1px 4px', fontWeight: 500,
  };

  return (
    <div className="analytics-dock">
      <div style={{
        fontSize: 10, fontWeight: 500, textTransform: 'uppercase',
        letterSpacing: '0.04em', color: 'var(--text-faint)', marginBottom: 4,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Joint Analytics</span>
        <span className={distToTarget < 0.01 ? 'text-emerald' : distToTarget < 0.1 ? 'text-amber' : 'text-rose'}>
          EE→Target: {distToTarget.toFixed(3)}
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
            <th style={th}>Joint</th>
            <th style={th}>θ₁</th>
            <th style={th}>θ₂</th>
            <th style={th}>World Pos</th>
            <th style={{ ...th, textAlign: 'right' }}>Link</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => <JointRow key={d.id} data={d} />)}
        </tbody>
      </table>

      <div style={{
        marginTop: 4, display: 'flex', gap: 12,
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-faint)',
      }}>
        <span>EE: ({eePos.x.toFixed(3)}, {eePos.y.toFixed(3)}, {eePos.z.toFixed(3)})</span>
        <span>Target: ({ikTarget.x.toFixed(2)}, {ikTarget.y.toFixed(2)}, {ikTarget.z.toFixed(2)})</span>
      </div>
    </div>
  );
}
