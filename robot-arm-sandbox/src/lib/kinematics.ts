import { Matrix4, Vector3 } from 'three';

export const FLOOR_Y = 0;
const COLLISION_MARGIN = 0.08;

/** World-space goal used by IK (Y lifted to stay above the floor workspace). */
export function ikPositionTarget(target: Vector3): Vector3 {
  const t = target.clone();
  t.y = Math.max(FLOOR_Y + 0.02, t.y);
  return t;
}

export interface DHRow {
  index: number;
  type: string;
  a: number;
  d: number;
  alpha: number;
  theta: number;
  thetaMin: number;
  thetaMax: number;
}

export interface Joint {
  id: string;
  type: 'revolute' | 'prismatic' | 'elbow' | 'end-effector' | 'base';
  name: string;
  theta: number;
  d: number;
  a: number;
  alpha: number;
  thetaMin: number;
  thetaMax: number;
  dMin: number;
  dMax: number;
  theta2: number;
  theta2Min: number;
  theta2Max: number;
}

/**
 * Build the standard DH 4x4 homogeneous transform:
 * T = Rot_z(theta) * Trans_z(d) * Trans_x(a) * Rot_x(alpha)
 */
export function dhTransform(theta: number, d: number, a: number, alpha: number): Matrix4 {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  const m = new Matrix4();
  m.set(
    ct, -st * ca,  st * sa, a * ct,
    st,  ct * ca, -ct * sa, a * st,
     0,      sa,       ca,      d,
     0,       0,        0,      1
  );
  return m;
}

export function buildDHTable(joints: Joint[]): DHRow[] {
  return joints
    .filter(j => j.type !== 'base')
    .map((j, i) => ({
      index: i + 1,
      type: j.type,
      a: j.a,
      d: j.d,
      alpha: j.alpha,
      theta: j.theta,
      thetaMin: j.thetaMin,
      thetaMax: j.thetaMax,
    }));
}

/**
 * Compute cumulative transforms for every joint frame.
 * Elbow joints produce two sequential DH transforms (theta,d,0,alpha)
 * then (theta2,0,a,0) but contribute a single output frame.
 */
export function computeAllTransforms(
  joints: Joint[],
  basePosition?: [number, number, number],
): { transforms: Matrix4[] } {
  const transforms: Matrix4[] = [];
  let cumulative = new Matrix4().identity();

  if (basePosition) {
    cumulative.setPosition(basePosition[0], basePosition[1], basePosition[2]);
  }

  for (const joint of joints) {
    if (joint.type === 'base') {
      transforms.push(cumulative.clone());
      // Align DH Z-axis with world Y (up) so revolute theta = turntable rotation
      // and d = vertical translation, matching standard robotics Y-up convention.
      const alignZtoY = new Matrix4().makeRotationX(-Math.PI / 2);
      cumulative = cumulative.clone().multiply(alignZtoY);
      continue;
    }

    if (joint.type === 'elbow') {
      const T1 = dhTransform(joint.theta, joint.d, 0, joint.alpha);
      cumulative = cumulative.clone().multiply(T1);
      const T2 = dhTransform(joint.theta2, 0, joint.a, 0);
      cumulative = cumulative.clone().multiply(T2);
      transforms.push(cumulative.clone());
      continue;
    }

    const T = dhTransform(joint.theta, joint.d, joint.a, joint.alpha);
    cumulative = cumulative.clone().multiply(T);
    transforms.push(cumulative.clone());
  }
  return { transforms };
}

export function computeFK(
  joints: Joint[],
  basePosition?: [number, number, number],
): Matrix4 {
  const { transforms } = computeAllTransforms(joints, basePosition);
  return transforms.length > 0 ? transforms[transforms.length - 1] : new Matrix4().identity();
}

export function positionFromMatrix(m: Matrix4): Vector3 {
  const v = new Vector3();
  v.setFromMatrixPosition(m);
  return v;
}

/* ── Constraints ── */

export function getJointPositions(
  joints: Joint[],
  basePosition?: [number, number, number],
): Vector3[] {
  const { transforms } = computeAllTransforms(joints, basePosition);
  return transforms.map(t => positionFromMatrix(t));
}

export function checkFloorViolation(positions: Vector3[]): boolean {
  return positions.some(p => p.y < FLOOR_Y - 0.001);
}

function segmentSegmentDist(
  a1: Vector3, a2: Vector3,
  b1: Vector3, b2: Vector3,
): number {
  const d1 = new Vector3().subVectors(a2, a1);
  const d2 = new Vector3().subVectors(b2, b1);
  const r = new Vector3().subVectors(a1, b1);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);

  if (a < 1e-10 && e < 1e-10) return r.length();

  if (a < 1e-10) {
    const t = Math.max(0, Math.min(1, f / e));
    return new Vector3().subVectors(a1, new Vector3().copy(b1).addScaledVector(d2, t)).length();
  }

  const c = d1.dot(r);
  if (e < 1e-10) {
    const s = Math.max(0, Math.min(1, -c / a));
    return new Vector3().copy(a1).addScaledVector(d1, s).sub(b1).length();
  }

  const b = d1.dot(d2);
  const denom = a * e - b * b;

  let s = denom > 1e-10 ? Math.max(0, Math.min(1, (b * f - c * e) / denom)) : 0;
  let t = (b * s + f) / e;

  if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -c / a)); }
  else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - c) / a)); }

  const p1 = new Vector3().copy(a1).addScaledVector(d1, s);
  const p2 = new Vector3().copy(b1).addScaledVector(d2, t);
  return p1.distanceTo(p2);
}

export function checkSelfCollision(positions: Vector3[]): boolean {
  for (let i = 0; i < positions.length - 1; i++) {
    for (let j = i + 2; j < positions.length - 1; j++) {
      if (segmentSegmentDist(positions[i], positions[i + 1], positions[j], positions[j + 1]) < COLLISION_MARGIN) {
        return true;
      }
    }
  }
  return false;
}

export function checkConstraints(
  joints: Joint[],
  basePosition: [number, number, number],
): { valid: boolean } {
  const positions = getJointPositions(joints, basePosition);
  if (checkFloorViolation(positions)) return { valid: false };
  if (checkSelfCollision(positions)) return { valid: false };
  return { valid: true };
}

/* ── IK Solver ── */

interface ActuatedDOF {
  jointIndex: number;
  param: 'theta' | 'd' | 'theta2';
}

function getActuatedDOFs(joints: Joint[]): ActuatedDOF[] {
  const dofs: ActuatedDOF[] = [];
  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    if (j.type === 'revolute') {
      dofs.push({ jointIndex: i, param: 'theta' });
    } else if (j.type === 'prismatic') {
      dofs.push({ jointIndex: i, param: 'd' });
    } else if (j.type === 'elbow') {
      dofs.push({ jointIndex: i, param: 'theta' });
      dofs.push({ jointIndex: i, param: 'theta2' });
    }
  }
  return dofs;
}

function getDOFValue(joint: Joint, param: ActuatedDOF['param']): number {
  if (param === 'theta') return joint.theta;
  if (param === 'theta2') return joint.theta2;
  return joint.d;
}

function setDOFValue(joint: Joint, param: ActuatedDOF['param'], value: number): Joint {
  if (param === 'theta') return { ...joint, theta: value };
  if (param === 'theta2') return { ...joint, theta2: value };
  return { ...joint, d: value };
}

function clampDOF(joint: Joint, param: ActuatedDOF['param'], value: number): number {
  if (param === 'theta') return Math.max(joint.thetaMin, Math.min(joint.thetaMax, value));
  if (param === 'theta2') return Math.max(joint.theta2Min, Math.min(joint.theta2Max, value));
  return Math.max(joint.dMin, Math.min(joint.dMax, value));
}

function cloneJoints(joints: Joint[]): Joint[] {
  return joints.map(j => ({ ...j }));
}

function computeJacobian(
  joints: Joint[],
  dofs: ActuatedDOF[],
  currentPos: Vector3,
  basePosition?: [number, number, number],
): number[][] {
  const delta = 0.001;
  const n = dofs.length;
  const J: number[][] = [
    new Array<number>(n).fill(0),
    new Array<number>(n).fill(0),
    new Array<number>(n).fill(0),
  ];

  for (let col = 0; col < n; col++) {
    const dof = dofs[col];
    const perturbedJoints = cloneJoints(joints);
    const joint = perturbedJoints[dof.jointIndex];
    const original = getDOFValue(joint, dof.param);
    perturbedJoints[dof.jointIndex] = setDOFValue(joint, dof.param, original + delta);
    const perturbed = positionFromMatrix(computeFK(perturbedJoints, basePosition));

    J[0][col] = (perturbed.x - currentPos.x) / delta;
    J[1][col] = (perturbed.y - currentPos.y) / delta;
    J[2][col] = (perturbed.z - currentPos.z) / delta;
  }

  return J;
}

function matMulJJT(J: number[][], n: number): number[][] {
  const result: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += J[i][k] * J[j][k];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function invert3x3(m: number[][]): number[][] | null {
  const [a, b, c] = [m[0][0], m[0][1], m[0][2]];
  const [d, e, f] = [m[1][0], m[1][1], m[1][2]];
  const [g, h, i] = [m[2][0], m[2][1], m[2][2]];

  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;

  const invDet = 1 / det;
  return [
    [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
    [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
    [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet],
  ];
}

function dampedPseudoinverse(J: number[][], n: number, lambda: number): number[][] | null {
  const tryLambda = (lam: number): number[][] | null => {
    const JJT = matMulJJT(J, n);
    const l2 = lam * lam;
    JJT[0][0] += l2;
    JJT[1][1] += l2;
    JJT[2][2] += l2;

    const inv = invert3x3(JJT);
    if (!inv) return null;

    const result: number[][] = [];
    for (let i = 0; i < n; i++) {
      result[i] = [0, 0, 0];
      for (let j = 0; j < 3; j++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          sum += J[k][i] * inv[k][j];
        }
        result[i][j] = sum;
      }
    }
    return result;
  };

  let out = tryLambda(lambda);
  if (!out) out = tryLambda(lambda * 10);
  if (!out) out = tryLambda(0.25);
  return out;
}

/** Jacobian-transpose fallback when J J^T is still ill-conditioned. */
function jacobianTransposeStep(J: number[][], n: number, e: number[], scale: number): number[] {
  const dq: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      dq[i] += J[k][i] * e[k];
    }
    dq[i] *= scale;
  }
  return dq;
}

export interface IKResult {
  angles: number[];
  converged: boolean;
  iterations: number;
}

export function applyIKResult(joints: Joint[], result: IKResult): Joint[] {
  const dofs = getActuatedDOFs(joints);
  const updated = joints.map(j => ({ ...j }));
  for (let i = 0; i < dofs.length && i < result.angles.length; i++) {
    const dof = dofs[i];
    updated[dof.jointIndex] = setDOFValue(updated[dof.jointIndex], dof.param, result.angles[i]);
  }
  return updated;
}

/** Deterministic PRNG in [0, 1) — uncorrelated across calls (unlike sin(seed)). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exported for tests / diagnostics — reproducible uniform sample inside joint limits. */
export function jointsWithSeededPose(joints: Joint[], seed: number): Joint[] {
  const rnd = mulberry32(seed);
  return joints.map(j => {
    if (j.type === 'revolute') {
      const u = rnd();
      const t = j.thetaMin + u * (j.thetaMax - j.thetaMin);
      return { ...j, theta: t };
    }
    if (j.type === 'prismatic') {
      const u = rnd();
      const d = j.dMin + u * (j.dMax - j.dMin);
      return { ...j, d };
    }
    if (j.type === 'elbow') {
      const u1 = rnd();
      const u2 = rnd();
      return {
        ...j,
        theta: j.thetaMin + u1 * (j.thetaMax - j.thetaMin),
        theta2: j.theta2Min + u2 * (j.theta2Max - j.theta2Min),
      };
    }
    return { ...j };
  });
}

function solveIKOnce(
  initialJoints: Joint[],
  target: Vector3,
  basePosition: [number, number, number] | undefined,
  maxIter: number,
  tolerance: number,
  lambda: number,
): { angles: number[]; converged: boolean; iterations: number; finalErr: number; joints: Joint[] } {
  const workingJoints = cloneJoints(initialJoints);
  const dofs = getActuatedDOFs(workingJoints);

  if (dofs.length === 0) {
    return { angles: [], converged: false, iterations: 0, finalErr: Infinity, joints: workingJoints };
  }

  const safeTarget = ikPositionTarget(target);

  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const currentPos = positionFromMatrix(computeFK(workingJoints, basePosition));
    const error = new Vector3().subVectors(safeTarget, currentPos);
    const errMag = error.length();

    if (errMag < tolerance) {
      converged = true;
      break;
    }

    const J = computeJacobian(workingJoints, dofs, currentPos, basePosition);
    const e = [error.x, error.y, error.z];
    const Jpinv = dampedPseudoinverse(J, dofs.length, lambda);

    const dqRaw: number[] = new Array(dofs.length).fill(0);
    if (Jpinv) {
      for (let i = 0; i < dofs.length; i++) {
        for (let k = 0; k < 3; k++) {
          dqRaw[i] += Jpinv[i][k] * e[k];
        }
      }
    } else {
      const jt = jacobianTransposeStep(J, dofs.length, e, 0.15 / (errMag + 0.01));
      for (let i = 0; i < dofs.length; i++) dqRaw[i] = jt[i];
    }

    const maxStep = 0.35;
    let maxAbs = 0;
    for (let i = 0; i < dqRaw.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(dqRaw[i]));
    }
    const stepScale = maxAbs > maxStep ? maxStep / maxAbs : 1;
    const dqScaled = dqRaw.map(v => v * stepScale);

    let bestErr = errMag;
    let bestSnapshot = cloneJoints(workingJoints);

    for (const beta of [1, 0.5, 0.25, 0.125]) {
      const trial = cloneJoints(workingJoints);
      for (let i = 0; i < dofs.length; i++) {
        const dof = dofs[i];
        const joint = trial[dof.jointIndex];
        const currentVal = getDOFValue(joint, dof.param);
        const newVal = clampDOF(joint, dof.param, currentVal + dqScaled[i] * beta);
        trial[dof.jointIndex] = setDOFValue(joint, dof.param, newVal);
      }
      const newPos = positionFromMatrix(computeFK(trial, basePosition));
      const newErr = safeTarget.distanceTo(newPos);
      if (newErr < bestErr - 1e-14) {
        bestErr = newErr;
        bestSnapshot = trial;
      }
    }

    for (let i = 0; i < workingJoints.length; i++) {
      workingJoints[i] = bestSnapshot[i];
    }
  }

  const finalPos = positionFromMatrix(computeFK(workingJoints, basePosition));
  const finalErr = safeTarget.distanceTo(finalPos);
  const angles = dofs.map(dof => getDOFValue(workingJoints[dof.jointIndex], dof.param));

  const internallyConverged = converged && finalErr <= tolerance * 1.25;

  return { angles, converged: internallyConverged, iterations, finalErr, joints: workingJoints };
}

export interface SolveIKOptions {
  /** Extra deterministic restarts from pseudo-random poses inside joint limits (default 15). */
  multiStart?: number;
}

/** Position error for a full joint configuration mapped onto the caller’s template (same as store applyIKResult). */
function appliedErrorFromConfiguration(
  templateJoints: Joint[],
  configuration: Joint[],
  dofs: ActuatedDOF[],
  basePosition: [number, number, number] | undefined,
  safeT: Vector3,
): number {
  const angles = dofs.map(dof => getDOFValue(configuration[dof.jointIndex], dof.param));
  const applied = applyIKResult(templateJoints, {
    angles,
    converged: true,
    iterations: 0,
  });
  return fkDistanceToTarget(applied, basePosition, safeT);
}

function dofLimits(joint: Joint, param: ActuatedDOF['param']): { lo: number; hi: number } {
  if (param === 'theta') return { lo: joint.thetaMin, hi: joint.thetaMax };
  if (param === 'theta2') return { lo: joint.theta2Min, hi: joint.theta2Max };
  return { lo: joint.dMin, hi: joint.dMax };
}

function fkDistanceToTarget(
  joints: Joint[],
  basePosition: [number, number, number] | undefined,
  safeT: Vector3,
): number {
  return safeT.distanceTo(positionFromMatrix(computeFK(joints, basePosition)));
}

/** 1D ternary search on one DOF holding others fixed (unimodal-enough in practice for fine refinement). */
function minimizeAlongDOF(
  w: Joint[],
  dof: ActuatedDOF,
  basePosition: [number, number, number] | undefined,
  safeT: Vector3,
  iters: number,
): Joint[] {
  const joint = w[dof.jointIndex];
  let lo = dofLimits(joint, dof.param).lo;
  let hi = dofLimits(joint, dof.param).hi;
  if (hi - lo < 1e-10) return w;

  const errAt = (val: number): number => {
    const t = cloneJoints(w);
    const v = clampDOF(t[dof.jointIndex], dof.param, val);
    t[dof.jointIndex] = setDOFValue(t[dof.jointIndex], dof.param, v);
    return fkDistanceToTarget(t, basePosition, safeT);
  };

  for (let i = 0; i < iters; i++) {
    if (hi - lo < 1e-8) break;
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (errAt(m1) < errAt(m2)) hi = m2;
    else lo = m1;
  }
  const best = clampDOF(joint, dof.param, (lo + hi) / 2);
  const out = cloneJoints(w);
  out[dof.jointIndex] = setDOFValue(out[dof.jointIndex], dof.param, best);
  return out;
}

/**
 * Coordinate cycles with ternary line search per DOF — escapes Jacobian local minima while respecting limits.
 */
function coordinateDescentPolish(
  joints: Joint[],
  target: Vector3,
  basePosition: [number, number, number] | undefined,
  outerPasses: number,
  innerIters: number,
): Joint[] {
  const safeT = ikPositionTarget(target);
  let w = cloneJoints(joints);
  const dofs = getActuatedDOFs(w);

  for (let pass = 0; pass < outerPasses; pass++) {
    const before = fkDistanceToTarget(w, basePosition, safeT);
    for (const dof of dofs) {
      w = minimizeAlongDOF(w, dof, basePosition, safeT, innerIters);
    }
    const after = fkDistanceToTarget(w, basePosition, safeT);
    if (before - after < 1e-8) break;
  }
  return w;
}

/**
 * Damped least-squares IK with line search and multi-start.
 * Picks the attempt with lowest error after mapping angles back onto the caller's joint array
 * (guards false “converged” states and id-independent templates).
 */
export function solveIK(
  joints: Joint[],
  target: Vector3,
  basePosition?: [number, number, number],
  maxIter = 150,
  tolerance = 0.002,
  lambda = 0.04,
  options?: SolveIKOptions,
): IKResult {
  const dofs = getActuatedDOFs(joints);
  if (dofs.length === 0) {
    return { angles: [], converged: false, iterations: 0 };
  }

  const restarts = options?.multiStart ?? 15;
  const attempts: Joint[][] = [cloneJoints(joints)];
  for (let r = 0; r < restarts; r++) {
    attempts.push(jointsWithSeededPose(joints, 1000 + r * 7919));
  }

  let totalIters = 0;
  let bestRun: ReturnType<typeof solveIKOnce> | null = null;
  let bestRecon = Infinity;
  const safeT = ikPositionTarget(target);

  for (const start of attempts) {
    const run = solveIKOnce(start, target, basePosition, maxIter, tolerance, lambda);
    totalIters += run.iterations;

    const reconErr = appliedErrorFromConfiguration(joints, run.joints, dofs, basePosition, safeT);
    if (reconErr < bestRecon) {
      bestRecon = reconErr;
      bestRun = run;
    }
  }

  let angles = dofs.map(dof => getDOFValue(bestRun!.joints[dof.jointIndex], dof.param));
  let finalRecon = appliedErrorFromConfiguration(joints, bestRun!.joints, dofs, basePosition, safeT);

  if (finalRecon > tolerance * 1.5) {
    let bestPolErr = finalRecon;
    let bestPolJoints = applyIKResult(joints, { angles, converged: false, iterations: 0 });

    const polishOne = (init: Joint[]) =>
      coordinateDescentPolish(init, target, basePosition, 8, 32);

    const consider = (candidate: Joint[]) => {
      const er = appliedErrorFromConfiguration(joints, candidate, dofs, basePosition, safeT);
      if (er < bestPolErr) {
        bestPolErr = er;
        bestPolJoints = candidate;
      }
    };

    consider(polishOne(bestPolJoints));

    for (let i = 0; i < 12000; i++) {
      const shot = jointsWithSeededPose(joints, 50000 + i * 1103);
      const e = fkDistanceToTarget(shot, basePosition, safeT);
      if (e < bestPolErr) {
        bestPolErr = e;
        bestPolJoints = shot;
      }
    }

    consider(polishOne(bestPolJoints));

    if (bestPolErr < finalRecon) {
      angles = dofs.map(dof => getDOFValue(bestPolJoints[dof.jointIndex], dof.param));
      finalRecon = bestPolErr;
    }
  }

  const applied = applyIKResult(joints, { angles, converged: true, iterations: 0 });
  const trueErr = fkDistanceToTarget(applied, basePosition, safeT);

  return {
    angles,
    converged: trueErr < tolerance * 1.5,
    iterations: totalIters,
  };
}
