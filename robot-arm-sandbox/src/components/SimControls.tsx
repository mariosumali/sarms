import { useSandboxStore } from '../lib/store';

export function SimControls() {
  const animState = useSandboxStore(s => s.animState);
  const ikResult = useSandboxStore(s => s.ikResult);
  const solveAndAnimate = useSandboxStore(s => s.solveAndAnimate);
  const solveIK = useSandboxStore(s => s.solveIK);
  const play = useSandboxStore(s => s.play);
  const stop = useSandboxStore(s => s.stop);
  const resetPose = useSandboxStore(s => s.resetPose);
  const animEndPose = useSandboxStore(s => s.animEndPose);
  const joints = useSandboxStore(s => s.joints);

  const waypoints = useSandboxStore(s => s.waypoints);
  const pathAnimState = useSandboxStore(s => s.pathAnimState);
  const solveWaypointPath = useSandboxStore(s => s.solveWaypointPath);
  const playPath = useSandboxStore(s => s.playPath);
  const pausePath = useSandboxStore(s => s.pausePath);
  const stopPath = useSandboxStore(s => s.stopPath);

  const animSpeed = useSandboxStore(s => s.animSpeed);
  const setAnimSpeed = useSandboxStore(s => s.setAnimSpeed);
  const animLoop = useSandboxStore(s => s.animLoop);
  const toggleAnimLoop = useSandboxStore(s => s.toggleAnimLoop);

  const showTrace = useSandboxStore(s => s.showTrace);
  const toggleTrace = useSandboxStore(s => s.toggleTrace);
  const clearTrace = useSandboxStore(s => s.clearTrace);
  const showAnalytics = useSandboxStore(s => s.showAnalytics);
  const toggleAnalytics = useSandboxStore(s => s.toggleAnalytics);
  const showPathLine = useSandboxStore(s => s.showPathLine);
  const togglePathLine = useSandboxStore(s => s.togglePathLine);

  const hasDOF = joints.some(j => j.type === 'revolute' || j.type === 'prismatic' || j.type === 'elbow');
  const hasWaypoints = waypoints.length > 0;
  const isAnyPlaying = animState === 'playing' || pathAnimState === 'playing';

  return (
    <div className="viewport-toolbar">
      <button
        className="btn-primary btn-sm"
        onClick={solveAndAnimate}
        disabled={!hasDOF || isAnyPlaying}
      >
        Solve &amp; Animate
      </button>

      <button
        className="btn-sm"
        onClick={solveIK}
        disabled={!hasDOF || isAnyPlaying}
        title="Solve instantly"
      >
        Instant
      </button>

      {hasWaypoints && (
        <>
          <div className="toolbar-divider" />
          {pathAnimState === 'idle' ? (
            <>
              <button className="btn-sm" onClick={solveWaypointPath} disabled={!hasDOF}>Solve Path</button>
              <button className="btn-sm" onClick={playPath} disabled={!hasDOF}>Play Path</button>
            </>
          ) : pathAnimState === 'playing' ? (
            <>
              <button className="btn-sm" onClick={pausePath}>Pause</button>
              <button className="btn-sm btn-danger" onClick={stopPath}>Stop</button>
            </>
          ) : (
            <>
              <button className="btn-sm" onClick={playPath}>Resume</button>
              <button className="btn-sm btn-danger" onClick={stopPath}>Stop</button>
            </>
          )}
        </>
      )}

      {animEndPose && animState !== 'playing' && pathAnimState !== 'playing' && (
        <>
          <button className="btn-sm" onClick={play}>Replay</button>
          <button className="btn-sm btn-danger" onClick={resetPose}>Reset</button>
        </>
      )}

      {animState === 'playing' && (
        <button className="btn-sm btn-danger" onClick={stop}>Stop</button>
      )}

      {ikResult && (
        <span className={`stat-badge ${ikResult.converged ? 'stat-badge--emerald' : 'stat-badge--rose'}`}>
          {ikResult.converged ? `OK (${ikResult.iterations})` : 'No sol.'}
        </span>
      )}

      <div className="toolbar-divider" />

      <span className="toolbar-label">Speed</span>
      <input
        type="range" min={0.1} max={4} step={0.1} value={animSpeed}
        onChange={e => setAnimSpeed(Number(e.target.value))}
        style={{ width: 44 }}
      />
      <span className="toolbar-value">{animSpeed.toFixed(1)}x</span>

      <div className="toolbar-divider" />

      <button
        onClick={toggleAnimLoop}
        className={`pill-toggle ${animLoop ? 'pill-toggle--on' : 'pill-toggle--off'}`}
      >
        Loop
      </button>

      <button onClick={toggleTrace}
        className={`pill-toggle ${showTrace ? 'pill-toggle--on' : 'pill-toggle--off'}`}
      >
        Trail
      </button>
      {showTrace && (
        <button onClick={clearTrace} className="pill-toggle pill-toggle--off"
          style={{ fontSize: 9, padding: '0 4px' }}>
          Clear
        </button>
      )}

      <button onClick={togglePathLine}
        className={`pill-toggle ${showPathLine ? 'pill-toggle--on' : 'pill-toggle--off'}`}
      >
        Path
      </button>

      <button onClick={toggleAnalytics}
        className={`pill-toggle ${showAnalytics ? 'pill-toggle--on' : 'pill-toggle--off'}`}
      >
        Analytics
      </button>
    </div>
  );
}
