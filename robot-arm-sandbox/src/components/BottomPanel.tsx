import { useState } from 'react';
import { useSandboxStore } from '../lib/store';
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
    <div className="panel-bottom">
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 12px', gap: 8, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
            {jointCount} parts &middot; {dofCount} DOF
          </span>

          {animState === 'playing' && (
            <span className="stat-badge stat-badge--accent" style={{ fontSize: 9 }}>
              IK {Math.round(animProgress * 100)}%
            </span>
          )}

          {pathAnimState !== 'idle' && waypoints.length > 0 && (
            <span className="stat-badge stat-badge--amber" style={{ fontSize: 9 }}>
              Path {pathAnimProgress.toFixed(1)}/{pathSegCount}
              {currentWpIdx >= 0 && ` \u2192 WP${currentWpIdx + 1}`}
            </span>
          )}

          {eeTrace.length > 0 && (
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-faint)' }}>
              Trail: {eeTrace.length} pts
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
            Timeline
          </span>

          <button
            onClick={() => (simulationState === 'playing' ? pauseTimelinePlayback() : startTimelinePlayback())}
            disabled={!canPlayTimeline}
            className={`btn-sm ${canPlayTimeline && simulationState !== 'playing' ? 'btn-accent' : ''}`}
            title={canPlayTimeline ? 'Play or pause keyframe playback' : 'Need at least 2 keyframes'}
          >
            {simulationState === 'playing' ? 'Pause' : 'Play'}
          </button>

          <button onClick={stopTimelinePlayback} className="btn-sm">Stop</button>

          <button
            onClick={recordKeyframe}
            disabled={simulationState === 'playing'}
            className="btn-sm btn-danger"
            title="Save current pose at the scrub time"
          >
            Record
          </button>

          {keyframes.length > 0 && (
            <button onClick={clearKeyframes} className="btn-ghost btn-xs" style={{ color: 'var(--text-faint)' }}>
              Clear KF
            </button>
          )}

          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', minWidth: '4em', flexShrink: 0 }}>
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
            style={{ width: 140, flexShrink: 1, minWidth: 80 }}
            title="Scrub timeline"
          />

          <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>
            t={playbackTime.toFixed(2)}s
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {waypoints.length > 0 && (
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-faint)' }}>
              {waypoints.length} waypoints
            </span>
          )}
          <button
            onClick={() => setShowDH(!showDH)}
            className={showDH ? 'btn-sm btn-accent' : 'btn-sm'}
          >
            {showDH ? 'Hide' : 'Show'} DH Table
          </button>
        </div>
      </div>

      {showDH && (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 4px', borderTop: '1px solid var(--border-subtle)' }}>
          <DHTable />
        </div>
      )}
    </div>
  );
}
