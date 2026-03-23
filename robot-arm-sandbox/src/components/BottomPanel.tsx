import { useState } from 'react';
import { useSandboxStore } from '../lib/store';
import { exportDHJSON, exportURDFStub, downloadFile } from '../lib/exporters';
import { DHTable } from './DHTable';

export function BottomPanel() {
  const joints = useSandboxStore(s => s.joints);
  const animState = useSandboxStore(s => s.animState);
  const animProgress = useSandboxStore(s => s.animProgress);
  const keyframes = useSandboxStore(s => s.keyframes);
  const simulationState = useSandboxStore(s => s.simulationState);
  const playbackTime = useSandboxStore(s => s.playbackTime);
  const startTimelinePlayback = useSandboxStore(s => s.startTimelinePlayback);
  const pauseTimelinePlayback = useSandboxStore(s => s.pauseTimelinePlayback);
  const stopTimelinePlayback = useSandboxStore(s => s.stopTimelinePlayback);
  const recordKeyframe = useSandboxStore(s => s.recordKeyframe);
  const setPlaybackTime = useSandboxStore(s => s.setPlaybackTime);
  const clearKeyframes = useSandboxStore(s => s.clearKeyframes);

  const pathAnimState = useSandboxStore(s => s.pathAnimState);
  const pathAnimProgress = useSandboxStore(s => s.pathAnimProgress);
  const waypoints = useSandboxStore(s => s.waypoints);
  const waypointPoses = useSandboxStore(s => s.waypointPoses);
  const eeTrace = useSandboxStore(s => s.eeTrace);

  const [showDH, setShowDH] = useState(false);

  const handleExportDH = () => downloadFile(exportDHJSON(joints), 'dh-parameters.json', 'application/json');
  const handleExportURDF = () => downloadFile(exportURDFStub(joints), 'robot_arm.urdf', 'application/xml');

  const jointCount = joints.filter(j => j.type !== 'base').length;
  const dofCount = joints.reduce((n, j) => {
    if (j.type === 'revolute' || j.type === 'prismatic') return n + 1;
    if (j.type === 'elbow') return n + 2;
    return n;
  }, 0);

  const sortedKf = [...keyframes].sort((a, b) => a.time - b.time);
  const tMax = sortedKf.length ? sortedKf[sortedKf.length - 1].time : 0;
  const rangeMax = Math.max(3, tMax + 1.5, playbackTime + 0.25);
  const canPlayTimeline = keyframes.length >= 2;

  const pathSegCount = waypointPoses ? waypointPoses.length - 1 : 0;
  const currentWpIdx = Math.min(Math.floor(pathAnimProgress), waypoints.length - 1);

  return (
    <div className="panel panel-bottom">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', flexShrink: 0,
        flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            {jointCount} parts &middot; {dofCount} DOF
          </span>

          {animState === 'playing' && (
            <span className="mono" style={{ fontSize: '10px', color: 'var(--accent)' }}>
              IK {Math.round(animProgress * 100)}%
            </span>
          )}

          {pathAnimState !== 'idle' && waypoints.length > 0 && (
            <span className="mono" style={{ fontSize: '10px', color: '#ffaa00' }}>
              Path {pathAnimProgress.toFixed(1)}/{pathSegCount}
              {currentWpIdx >= 0 && ` → WP${currentWpIdx + 1}`}
            </span>
          )}

          {eeTrace.length > 0 && (
            <span className="mono" style={{ fontSize: '10px', color: '#00ff88' }}>
              Trail: {eeTrace.length} pts
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Timeline</span>
            <button
              type="button"
              onClick={() => (simulationState === 'playing' ? pauseTimelinePlayback() : startTimelinePlayback())}
              disabled={!canPlayTimeline}
              title={canPlayTimeline ? 'Play or pause keyframe playback' : 'Need at least 2 keyframes'}
              style={{
                fontSize: '10px', padding: '4px 10px',
                opacity: canPlayTimeline ? 1 : 0.45,
              }}
            >
              {simulationState === 'playing' ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={stopTimelinePlayback} style={{ fontSize: '10px', padding: '4px 10px' }}>
              Stop
            </button>
            <button
              type="button"
              onClick={recordKeyframe}
              disabled={simulationState === 'playing'}
              title="Save current pose at the scrub time"
              style={{
                fontSize: '10px', padding: '4px 10px',
                background: 'rgba(255,68,68,0.08)', borderColor: 'rgba(255,68,68,0.25)', color: '#ff8888',
                opacity: simulationState === 'playing' ? 0.45 : 1,
              }}
            >
              Record KF
            </button>
            {keyframes.length > 0 && (
              <button type="button" onClick={clearKeyframes} style={{ fontSize: '10px', padding: '4px 8px', color: 'var(--text-dim)' }}>
                Clear KF
              </button>
            )}
            <span className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', minWidth: '5em' }}>
              {keyframes.length} kf
            </span>
            <input
              type="range"
              min={0}
              max={rangeMax}
              step={0.02}
              value={Math.min(rangeMax, playbackTime)}
              disabled={simulationState === 'playing'}
              onChange={e => setPlaybackTime(Number(e.target.value))}
              style={{ width: '120px', verticalAlign: 'middle' }}
              title="Scrub timeline (pause first)"
            />
            <span className="mono" style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              t={playbackTime.toFixed(2)}s
            </span>
          </div>
          <button
            onClick={() => setShowDH(!showDH)}
            style={{
              fontSize: '10px', padding: '3px 8px',
              background: showDH ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.03)',
              borderColor: showDH ? 'var(--accent)' : 'var(--border-panel)',
              color: showDH ? 'var(--accent)' : 'var(--text-dim)',
            }}
          >
            {showDH ? 'Hide' : 'Show'} DH Table
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {waypoints.length > 0 && (
            <span className="mono" style={{ fontSize: '10px', color: '#ffaa00' }}>
              {waypoints.length} waypoints
            </span>
          )}
          <button onClick={handleExportDH} style={{ fontSize: '10px', padding: '3px 8px' }}>Export JSON</button>
          <button onClick={handleExportURDF} style={{ fontSize: '10px', padding: '3px 8px' }}>Export URDF</button>
        </div>
      </div>

      {showDH && (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 4px', borderTop: '1px solid var(--border-panel)' }}>
          <DHTable />
        </div>
      )}
    </div>
  );
}
