import { create } from 'zustand';
import { Vector3 } from 'three';
import { v4 as uuid } from 'uuid';
import type { Joint } from './kinematics';
import {
  solveIK as solveIKFn,
  applyIKResult,
  computeFK,
  positionFromMatrix,
  FLOOR_Y,
  checkConstraints,
  getJointPositions,
} from './kinematics';
import { getJointDefaults, FRIENDLY_NAMES } from './jointDefaults';

export interface Keyframe {
  time: number;
  pose: Record<string, number>;
}

export interface Waypoint {
  id: string;
  position: Vector3;
  label: string;
}

export interface JointAnalytics {
  id: string;
  name: string;
  type: string;
  theta: number;
  theta2?: number;
  d?: number;
  worldPos: [number, number, number];
  distToNext: number;
}

export interface SandboxStore {
  joints: Joint[];
  selectedJointId: string | null;
  basePosition: [number, number, number];
  ikTarget: Vector3;
  ikResult: { converged: boolean; iterations: number } | null;
  autoIK: boolean;
  isDraggingJoint: boolean;
  undoStack: Joint[][];

  animState: 'idle' | 'playing' | 'paused';
  animStartPose: Record<string, number> | null;
  animEndPose: Record<string, number> | null;
  animProgress: number;

  keyframes: Keyframe[];
  simulationState: 'idle' | 'playing' | 'paused';
  playbackTime: number;

  waypoints: Waypoint[];
  waypointPoses: Record<string, number>[] | null;
  waypointEEPath: [number, number, number][] | null;
  pathAnimState: 'idle' | 'playing' | 'paused';
  pathAnimProgress: number;

  eeTrace: [number, number, number][];
  showTrace: boolean;

  animSpeed: number;
  animLoop: boolean;

  showAnalytics: boolean;
  showPathLine: boolean;

  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;

  addJoint: (type: Joint['type'], afterIndex?: number) => void;
  removeJoint: (id: string) => void;
  updateJoint: (id: string, patch: Partial<Joint>) => void;
  reorderJoint: (id: string, direction: 'up' | 'down') => void;
  selectJoint: (id: string | null) => void;
  setBasePosition: (pos: [number, number, number]) => void;
  setIKTarget: (pos: Vector3) => void;
  setAutoIK: (v: boolean) => void;
  solveIK: () => void;
  solveAndAnimate: () => void;
  play: () => void;
  stop: () => void;
  resetPose: () => void;
  setAnimProgress: (p: number) => void;
  setIsDraggingJoint: (v: boolean) => void;
  loadPreset: (name: string) => void;
  undo: () => void;
  pushUndo: () => void;

  recordKeyframe: () => void;
  startTimelinePlayback: () => void;
  pauseTimelinePlayback: () => void;
  stopTimelinePlayback: () => void;
  setPlaybackTime: (t: number) => void;
  tickTimeline: (dt: number) => void;
  clearKeyframes: () => void;

  addWaypoint: (pos: Vector3) => void;
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, pos: Vector3) => void;
  clearWaypoints: () => void;
  solveWaypointPath: () => void;
  playPath: () => void;
  pausePath: () => void;
  stopPath: () => void;
  setPathProgress: (p: number) => void;
  tickPath: (dt: number) => void;

  toggleTrace: () => void;
  clearTrace: () => void;
  recordTracePoint: () => void;

  setAnimSpeed: (s: number) => void;
  toggleAnimLoop: () => void;

  toggleAnalytics: () => void;
  togglePathLine: () => void;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;

  getAnalytics: () => JointAnalytics[];
}

function makeName(type: Joint['type'], joints: Joint[]): string {
  if (type === 'base') return 'Base';
  const prefix = FRIENDLY_NAMES[type];
  const count = joints.filter(j => j.type === type).length;
  return count > 0 ? `${prefix} ${count + 1}` : prefix;
}

function makeJoint(type: Joint['type'], joints: Joint[]): Joint {
  return { id: uuid(), ...getJointDefaults(type), name: makeName(type, joints) };
}

function buildArm(types: Joint['type'][]): Joint[] {
  const joints: Joint[] = [];
  for (const t of types) joints.push(makeJoint(t, joints));
  return joints;
}

export function capturePose(joints: Joint[]): Record<string, number> {
  const pose: Record<string, number> = {};
  for (const j of joints) {
    if (j.type === 'revolute') {
      pose[j.id] = j.theta;
    } else if (j.type === 'elbow') {
      pose[j.id + ':t1'] = j.theta;
      pose[j.id + ':t2'] = j.theta2;
    } else if (j.type === 'prismatic') {
      pose[j.id] = j.d;
    }
  }
  return pose;
}

function applyPoseToJoints(joints: Joint[], pose: Record<string, number>): Joint[] {
  return joints.map(j => {
    if (j.type === 'revolute' && j.id in pose) {
      return { ...j, theta: pose[j.id] };
    }
    if (j.type === 'elbow') {
      const t1Key = j.id + ':t1';
      const t2Key = j.id + ':t2';
      let out = j;
      if (t1Key in pose) out = { ...out, theta: pose[t1Key] };
      if (t2Key in pose) out = { ...out, theta2: pose[t2Key] };
      return out;
    }
    if (j.type === 'prismatic' && j.id in pose) {
      return { ...j, d: pose[j.id] };
    }
    return j;
  });
}

function blendKeyframePoses(
  a: Record<string, number>,
  b: Record<string, number>,
  u: number,
): Record<string, number> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    if (va !== undefined && vb !== undefined) out[k] = va + (vb - va) * u;
    else if (va !== undefined) out[k] = va;
    else if (vb !== undefined) out[k] = vb;
  }
  return out;
}

function applyPoseBlend(joints: Joint[], poseA: Record<string, number>, poseB: Record<string, number>, t: number): Joint[] {
  const blended = blendKeyframePoses(poseA, poseB, t);
  return applyPoseToJoints(joints, blended);
}

function poseAtKeyframeTime(sorted: Keyframe[], t: number): Record<string, number> {
  if (sorted.length === 0) return {};
  if (t <= sorted[0].time) return { ...sorted[0].pose };
  const last = sorted[sorted.length - 1];
  if (t >= last.time) return { ...last.pose };

  let i = 0;
  while (i < sorted.length - 1 && sorted[i + 1].time < t) i += 1;
  const k0 = sorted[i];
  const k1 = sorted[i + 1];
  const span = k1.time - k0.time;
  const u = span > 1e-9 ? (t - k0.time) / span : 0;
  return blendKeyframePoses(k0.pose, k1.pose, u);
}

function pauseIkAnim(get: () => SandboxStore, set: (p: Partial<SandboxStore>) => void) {
  if (get().animState === 'playing') set({ animState: 'paused' });
}

function pauseTimelineForIk(get: () => SandboxStore, set: (p: Partial<SandboxStore>) => void) {
  if (get().simulationState === 'playing') set({ simulationState: 'paused' });
}

const PRESETS: Record<string, Joint['type'][]> = {
  'Simple 2-Joint': ['base', 'revolute', 'revolute', 'end-effector'],
  '3-Joint Arm': ['base', 'revolute', 'elbow', 'end-effector'],
  '6-DOF Spherical': ['base', 'revolute', 'elbow', 'revolute', 'end-effector'],
  'Pick & Place': ['base', 'revolute', 'elbow', 'prismatic', 'end-effector'],
  'Telescoping': ['base', 'revolute', 'prismatic', 'revolute', 'end-effector'],
};

export const PRESET_NAMES = Object.keys(PRESETS);

const MAX_TRACE = 600;

function buildUprightArm(types: Joint['type'][]): Joint[] {
  const joints = buildArm(types);
  if (joints.length > 1 && joints[1].type === 'revolute') {
    joints[1] = { ...joints[1], theta: Math.PI / 2 };
  }
  return joints;
}

export const useSandboxStore = create<SandboxStore>((set, get) => ({
  joints: buildUprightArm(PRESETS['Simple 2-Joint']),
  selectedJointId: null,
  basePosition: [0, 0, 0],
  ikTarget: new Vector3(1.2, 0.8, 0),
  ikResult: null,
  autoIK: true,
  isDraggingJoint: false,
  undoStack: [],
  animState: 'idle',
  animStartPose: null,
  animEndPose: null,
  animProgress: 0,
  keyframes: [],
  simulationState: 'idle',
  playbackTime: 0,

  waypoints: [],
  waypointPoses: null,
  waypointEEPath: null,
  pathAnimState: 'idle',
  pathAnimProgress: 0,

  eeTrace: [],
  showTrace: true,

  animSpeed: 1,
  animLoop: false,

  showAnalytics: false,
  showPathLine: true,

  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: true,

  pushUndo: () => {
    const { joints, undoStack } = get();
    set({ undoStack: [...undoStack.slice(-20), joints.map(j => ({ ...j }))] });
  },
  undo: () => {
    const { undoStack } = get();
    if (!undoStack.length) return;
    set({ joints: undoStack[undoStack.length - 1], undoStack: undoStack.slice(0, -1), selectedJointId: null });
  },

  addJoint: (type, afterIndex) => {
    const s = get(); s.pushUndo();
    const nj = makeJoint(type, s.joints);
    const next = afterIndex !== undefined && afterIndex >= 0 && afterIndex < s.joints.length
      ? [...s.joints.slice(0, afterIndex + 1), nj, ...s.joints.slice(afterIndex + 1)]
      : [...s.joints, nj];
    set({ joints: next, selectedJointId: nj.id });
  },
  removeJoint: (id) => {
    const s = get(); const j = s.joints.find(x => x.id === id);
    if (!j || j.type === 'base') return;
    s.pushUndo();
    set({ joints: s.joints.filter(x => x.id !== id), selectedJointId: s.selectedJointId === id ? null : s.selectedJointId });
  },
  updateJoint: (id, patch) => {
    const { joints, basePosition } = get();
    const updated = joints.map(j => j.id === id ? { ...j, ...patch } : j);
    const hasGeometry = Object.keys(patch).some(k => k !== 'name' && k !== 'id' && k !== 'type');
    if (hasGeometry && !checkConstraints(updated, basePosition).valid) return;
    set({ joints: updated });
  },
  reorderJoint: (id, dir) => {
    const s = get(); const js = s.joints; const i = js.findIndex(x => x.id === id);
    if (i < 0 || js[i].type === 'base') return;
    const ti = dir === 'up' ? i - 1 : i + 1;
    if (ti < 1 || ti >= js.length || js[ti].type === 'base') return;
    s.pushUndo(); const n = [...js]; [n[i], n[ti]] = [n[ti], n[i]]; set({ joints: n });
  },
  selectJoint: (id) => set({ selectedJointId: id }),
  setBasePosition: (pos) => {
    const clamped: [number, number, number] = [pos[0], Math.max(FLOOR_Y, pos[1]), pos[2]];
    const { joints } = get();
    if (!checkConstraints(joints, clamped).valid) return;
    set({ basePosition: clamped });
  },
  setIKTarget: (pos) => {
    const clamped = pos.clone();
    clamped.y = Math.max(FLOOR_Y, clamped.y);
    set({ ikTarget: clamped });
  },
  setAutoIK: (v) => set({ autoIK: v }),
  setIsDraggingJoint: (v) => set({ isDraggingJoint: v }),

  solveIK: () => {
    const { joints, ikTarget, basePosition } = get();
    const result = solveIKFn(joints, ikTarget, basePosition);
    if (result.angles.length > 0) {
      const updated = applyIKResult(joints, result);
      set({ joints: updated, ikResult: { converged: result.converged, iterations: result.iterations } });
    } else {
      set({ ikResult: { converged: false, iterations: 0 } });
    }
  },

  solveAndAnimate: () => {
    pauseTimelineForIk(get, set);
    set({ pathAnimState: 'idle' });
    const { joints, ikTarget, basePosition } = get();
    const startPose = capturePose(joints);
    const result = solveIKFn(joints, ikTarget, basePosition);
    if (result.angles.length === 0) {
      set({ ikResult: { converged: false, iterations: 0 } });
      return;
    }
    const solvedJoints = applyIKResult(joints, result);
    const endPose = capturePose(solvedJoints);
    set({
      animStartPose: startPose,
      animEndPose: endPose,
      animState: 'playing',
      animProgress: 0,
      eeTrace: [],
      ikResult: { converged: result.converged, iterations: result.iterations },
    });
  },

  play: () => {
    pauseTimelineForIk(get, set);
    const { animStartPose, animEndPose } = get();
    if (!animStartPose || !animEndPose) return;
    set({ animState: 'playing', animProgress: 0, eeTrace: [] });
  },
  stop: () => set({ animState: 'idle', animProgress: 0 }),
  resetPose: () => {
    const { animStartPose, joints } = get();
    if (!animStartPose) return;
    const reset = applyPoseToJoints(joints, animStartPose);
    set({ joints: reset, animState: 'idle', animProgress: 0 });
  },
  setAnimProgress: (p) => {
    const { joints, animStartPose, animEndPose } = get();
    if (!animStartPose || !animEndPose) return;
    const blended = applyPoseBlend(joints, animStartPose, animEndPose, p);
    set({ joints: blended, animProgress: p });
  },

  loadPreset: (name) => {
    const types = PRESETS[name]; if (!types) return;
    get().pushUndo();
    let joints = buildArm(types);

    if (joints.length > 1 && joints[1].type === 'revolute') {
      joints[1] = { ...joints[1], theta: Math.PI / 2 };
    }

    if (name === '6-DOF Spherical') {
      joints[1] = { ...joints[1], a: 0.5, d: 0, alpha: -Math.PI / 2, theta: Math.PI / 2, name: 'Waist' };
      joints[3] = { ...joints[3], a: 0.6, name: 'Wrist' };
    }

    set({
      joints,
      selectedJointId: null,
      basePosition: [0, 0, 0],
      ikResult: null,
      animState: 'idle',
      animStartPose: null,
      animEndPose: null,
      keyframes: [],
      simulationState: 'idle',
      playbackTime: 0,
      waypoints: [],
      waypointPoses: null,
      waypointEEPath: null,
      pathAnimState: 'idle',
      pathAnimProgress: 0,
      eeTrace: [],
    });
  },

  recordKeyframe: () => {
    if (get().simulationState === 'playing') return;
    get().pushUndo();
    const { joints, playbackTime, keyframes } = get();
    const pose = capturePose(joints);
    const eps = 1e-4;
    const filtered = keyframes.filter(k => Math.abs(k.time - playbackTime) > eps);
    const next = [...filtered, { time: playbackTime, pose }].sort((a, b) => a.time - b.time);
    set({ keyframes: next });
  },

  startTimelinePlayback: () => {
    const { keyframes, playbackTime, joints } = get();
    if (keyframes.length < 2) return;
    pauseIkAnim(get, set);
    set({ pathAnimState: 'idle' });
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const end = sorted[sorted.length - 1].time;
    let t = playbackTime;
    if (t >= end - 1e-6) t = sorted[0].time;
    const pose = poseAtKeyframeTime(sorted, t);
    set({
      simulationState: 'playing',
      playbackTime: t,
      joints: applyPoseToJoints(joints, pose),
      eeTrace: [],
    });
  },

  pauseTimelinePlayback: () => {
    if (get().simulationState === 'playing') set({ simulationState: 'paused' });
  },

  stopTimelinePlayback: () => {
    const { keyframes, joints } = get();
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    if (sorted.length === 0) {
      set({ simulationState: 'idle', playbackTime: 0 });
      return;
    }
    const t0 = sorted[0].time;
    const pose = poseAtKeyframeTime(sorted, t0);
    set({
      simulationState: 'idle',
      playbackTime: t0,
      joints: applyPoseToJoints(joints, pose),
    });
  },

  setPlaybackTime: (t) => {
    const { keyframes, joints, simulationState } = get();
    const tv = Math.max(0, t);
    if (keyframes.length === 0) {
      set({ playbackTime: tv });
      return;
    }
    if (simulationState === 'playing') return;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const pose = poseAtKeyframeTime(sorted, tv);
    set({ playbackTime: tv, joints: applyPoseToJoints(joints, pose) });
  },

  tickTimeline: (dt) => {
    const { simulationState, keyframes, playbackTime, joints, animSpeed } = get();
    if (simulationState !== 'playing' || keyframes.length < 2) return;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const end = sorted[sorted.length - 1].time;
    const next = playbackTime + dt * animSpeed;
    if (next >= end) {
      const pose = poseAtKeyframeTime(sorted, end);
      set({
        playbackTime: end,
        joints: applyPoseToJoints(joints, pose),
        simulationState: 'idle',
      });
      return;
    }
    const pose = poseAtKeyframeTime(sorted, next);
    set({ playbackTime: next, joints: applyPoseToJoints(joints, pose) });
  },

  clearKeyframes: () => {
    get().pushUndo();
    set({ keyframes: [], playbackTime: 0, simulationState: 'idle' });
  },

  /* ─── Waypoints ─── */

  addWaypoint: (pos) => {
    const clamped = pos.clone();
    clamped.y = Math.max(FLOOR_Y, clamped.y);
    const wp: Waypoint = {
      id: uuid(),
      position: clamped,
      label: `WP ${get().waypoints.length + 1}`,
    };
    set({ waypoints: [...get().waypoints, wp], waypointPoses: null, waypointEEPath: null });
  },

  removeWaypoint: (id) => {
    set({
      waypoints: get().waypoints.filter(w => w.id !== id),
      waypointPoses: null,
      waypointEEPath: null,
    });
  },

  updateWaypoint: (id, pos) => {
    const clamped = pos.clone();
    clamped.y = Math.max(FLOOR_Y, clamped.y);
    set({
      waypoints: get().waypoints.map(w => w.id === id ? { ...w, position: clamped } : w),
      waypointPoses: null,
      waypointEEPath: null,
    });
  },

  clearWaypoints: () => {
    set({
      waypoints: [],
      waypointPoses: null,
      waypointEEPath: null,
      pathAnimState: 'idle',
      pathAnimProgress: 0,
    });
  },

  solveWaypointPath: () => {
    const { joints, waypoints, basePosition } = get();
    if (waypoints.length === 0) return;

    const SUBS = 10;
    const poses: Record<string, number>[] = [capturePose(joints)];
    const eePath: [number, number, number][] = [];
    let currentJoints = joints.map(j => ({ ...j }));

    let prevEE = getEEPosition(currentJoints, basePosition);
    eePath.push([prevEE.x, prevEE.y, prevEE.z]);

    let allConverged = true;

    for (const wp of waypoints) {
      const targetPos = wp.position;

      for (let s = 1; s <= SUBS; s++) {
        const t = s / SUBS;
        const subTarget = new Vector3().lerpVectors(prevEE, targetPos, t);
        const result = solveIKFn(currentJoints, subTarget, basePosition);
        if (result.angles.length > 0) {
          currentJoints = applyIKResult(currentJoints, result);
          if (!result.converged) allConverged = false;
        } else {
          allConverged = false;
        }
        const pose = capturePose(currentJoints);
        poses.push(pose);
        const ep = getEEPosition(currentJoints, basePosition);
        eePath.push([ep.x, ep.y, ep.z]);
      }

      prevEE = getEEPosition(currentJoints, basePosition);
    }

    set({
      waypointPoses: poses,
      waypointEEPath: eePath,
      ikResult: { converged: allConverged, iterations: waypoints.length },
    });
  },

  playPath: () => {
    const { waypointPoses } = get();
    if (!waypointPoses || waypointPoses.length < 2) {
      get().solveWaypointPath();
      const updated = get().waypointPoses;
      if (!updated || updated.length < 2) return;
    }
    pauseIkAnim(get, set);
    pauseTimelineForIk(get, set);
    set({ pathAnimState: 'playing', pathAnimProgress: 0, eeTrace: [] });
  },

  pausePath: () => {
    if (get().pathAnimState === 'playing') set({ pathAnimState: 'paused' });
  },

  stopPath: () => {
    const { waypointPoses, joints } = get();
    if (waypointPoses && waypointPoses.length > 0) {
      const first = waypointPoses[0];
      set({
        pathAnimState: 'idle',
        pathAnimProgress: 0,
        joints: applyPoseToJoints(joints, first),
      });
    } else {
      set({ pathAnimState: 'idle', pathAnimProgress: 0 });
    }
  },

  setPathProgress: (p) => {
    const { waypointPoses, joints } = get();
    if (!waypointPoses || waypointPoses.length < 2) return;
    const maxP = waypointPoses.length - 1;
    const clamped = Math.max(0, Math.min(maxP, p));
    const seg = Math.min(Math.floor(clamped), maxP - 1);
    const u = clamped - seg;
    const blended = blendKeyframePoses(waypointPoses[seg], waypointPoses[seg + 1], u);
    set({ pathAnimProgress: clamped, joints: applyPoseToJoints(joints, blended) });
  },

  tickPath: (dt) => {
    const { pathAnimState, waypointPoses, pathAnimProgress, joints, animSpeed, animLoop } = get();
    if (pathAnimState !== 'playing' || !waypointPoses || waypointPoses.length < 2) return;
    const maxP = waypointPoses.length - 1;
    const next = pathAnimProgress + dt * animSpeed;
    if (next >= maxP) {
      const lastPose = waypointPoses[waypointPoses.length - 1];
      if (animLoop) {
        set({
          pathAnimProgress: 0,
          joints: applyPoseToJoints(joints, waypointPoses[0]),
        });
      } else {
        set({
          pathAnimProgress: maxP,
          joints: applyPoseToJoints(joints, lastPose),
          pathAnimState: 'idle',
        });
      }
      return;
    }
    const seg = Math.min(Math.floor(next), maxP - 1);
    const u = next - seg;
    const blended = blendKeyframePoses(waypointPoses[seg], waypointPoses[seg + 1], u);
    set({ pathAnimProgress: next, joints: applyPoseToJoints(joints, blended) });
  },

  /* ─── EE Trace ─── */

  toggleTrace: () => set({ showTrace: !get().showTrace }),
  clearTrace: () => set({ eeTrace: [] }),
  recordTracePoint: () => {
    const { joints, basePosition, eeTrace, showTrace } = get();
    if (!showTrace) return;
    const pos = getEEPosition(joints, basePosition);
    const pt: [number, number, number] = [pos.x, pos.y, pos.z];
    const next = eeTrace.length >= MAX_TRACE
      ? [...eeTrace.slice(eeTrace.length - MAX_TRACE + 1), pt]
      : [...eeTrace, pt];
    set({ eeTrace: next });
  },

  /* ─── Animation settings ─── */

  setAnimSpeed: (s) => set({ animSpeed: Math.max(0.1, Math.min(5, s)) }),
  toggleAnimLoop: () => set({ animLoop: !get().animLoop }),

  /* ─── Toggles ─── */

  toggleAnalytics: () => set({ showAnalytics: !get().showAnalytics }),
  togglePathLine: () => set({ showPathLine: !get().showPathLine }),

  toggleLeftPanel: () => set({ leftPanelOpen: !get().leftPanelOpen }),
  toggleRightPanel: () => set({ rightPanelOpen: !get().rightPanelOpen }),
  toggleBottomPanel: () => set({ bottomPanelOpen: !get().bottomPanelOpen }),

  /* ─── Analytics ─── */

  getAnalytics: () => {
    const { joints, basePosition } = get();
    const positions = getJointPositions(joints, basePosition);
    return joints.map((j, i) => {
      const p = positions[i] || new Vector3();
      const next = positions[i + 1];
      return {
        id: j.id,
        name: j.name,
        type: j.type,
        theta: j.theta,
        theta2: j.type === 'elbow' ? j.theta2 : undefined,
        d: j.type === 'prismatic' ? j.d : undefined,
        worldPos: [p.x, p.y, p.z] as [number, number, number],
        distToNext: next ? p.distanceTo(next) : 0,
      };
    });
  },
}));

export function getEEPosition(joints: Joint[], basePosition?: [number, number, number]): Vector3 {
  return positionFromMatrix(computeFK(joints, basePosition));
}
