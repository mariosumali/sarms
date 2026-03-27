import { useMemo } from 'react';
import { useSandboxStore } from '../lib/store';
import { buildDHTable } from '../lib/kinematics';

const DEG = 180 / Math.PI;

export function DHTable() {
  const joints = useSandboxStore(s => s.joints);
  const selectedId = useSandboxStore(s => s.selectedJointId);

  const table = useMemo(() => buildDHTable(joints), [joints]);

  const selectedRowIndex = (() => {
    if (!selectedId) return -1;
    const idx = joints.findIndex(j => j.id === selectedId);
    if (idx <= 0) return -1;
    return idx - 1;
  })();

  const headers = ['#', 'Type', 'a (m)', 'd (m)', 'α (°)', 'θ (°)', 'θ_min', 'θ_max'];

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
      }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                padding: '4px 8px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--text-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                borderBottom: '1px solid var(--border-default)',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.map((row, i) => (
            <tr
              key={row.index}
              style={{
                background: i === selectedRowIndex
                  ? 'var(--bg-active)'
                  : 'transparent',
                borderLeft: i === selectedRowIndex
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              }}
            >
              <td style={cellStyle}>{row.index}</td>
              <td style={cellStyle}>
                <span style={{
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 10,
                  background: 'var(--bg-hover)',
                }}>
                  {row.type}
                </span>
              </td>
              <td style={cellStyle}>{row.a.toFixed(4)}</td>
              <td style={cellStyle}>{row.d.toFixed(4)}</td>
              <td style={cellStyle}>{(row.alpha * DEG).toFixed(1)}</td>
              <td style={cellStyle}>{(row.theta * DEG).toFixed(1)}</td>
              <td style={{ ...cellStyle, color: 'var(--text-faint)' }}>
                {(row.thetaMin * DEG).toFixed(1)}
              </td>
              <td style={{ ...cellStyle, color: 'var(--text-faint)' }}>
                {(row.thetaMax * DEG).toFixed(1)}
              </td>
            </tr>
          ))}
          {table.length === 0 && (
            <tr>
              <td colSpan={8} style={{
                ...cellStyle,
                textAlign: 'center',
                color: 'var(--text-faint)',
                padding: 16,
              }}>
                No joints in chain
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  padding: '4px 8px',
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};
