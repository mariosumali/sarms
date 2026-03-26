import { Matrix4, Vector3 } from 'three';

export const FLOOR_Y = 0;
const COLLISION_MARGIN = 0.08;

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

function computeJacobian(
  joints: Joint[],
  dofs: ActuatedDOF[],
  currentPos: Vector3,
  basePosition?: [number, number, number],
): number[][] {
  const delta = 0.001;
  const n = dofs.length;
  const J: number[][] = [[], [], []];

  for (let col = 0; col < n; col++) {
    const dof = dofs[col];
    const joint = joints[dof.jointIndex];
    const original = getDOFValue(joint, dof.param);

    joints[dof.jointIndex] = setDOFValue(joint, dof.param, original + delta);
    const perturbed = positionFromMatrix(computeFK(joints, basePosition));
    joints[dof.jointIndex] = setDOFValue(joint, dof.param, original);

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
  const JJT = matMulJJT(J, n);
  const l2 = lambda * lambda;
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

export function solveIK(
  joints: Joint[],
  target: Vector3,
  basePosition?: [number, number, number],
  maxIter = 100,
  tolerance = 0.001,
  lambda = 0.01,
): IKResult {
  const workingJoints = joints.map(j => ({ ...j }));
  const dofs = getActuatedDOFs(workingJoints);

  if (dofs.length === 0) {
    return { angles: [], converged: false, iterations: 0 };
  }

  let iterations = 0;
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    const currentPos = positionFromMatrix(computeFK(workingJoints, basePosition));
    const error = new Vector3().subVectors(target, currentPos);
    const errMag = error.length();

    if (errMag < tolerance) {
      converged = true;
      break;
    }

    const J = computeJacobian(workingJoints, dofs, currentPos, basePosition);
    const Jpinv = dampedPseudoinverse(J, dofs.length, lambda);
    if (!Jpinv) break;

    const e = [error.x, error.y, error.z];

    for (let i = 0; i < dofs.length; i++) {
      const dof = dofs[i];
      let dq = 0;
      for (let k = 0; k < 3; k++) {
        dq += Jpinv[i][k] * e[k];
      }

      const joint = workingJoints[dof.jointIndex];
      const currentVal = getDOFValue(joint, dof.param);
      const newVal = clampDOF(joint, dof.param, currentVal + dq);
      workingJoints[dof.jointIndex] = setDOFValue(joint, dof.param, newVal);
    }
  }

  const angles = dofs.map(dof => getDOFValue(workingJoints[dof.jointIndex], dof.param));

  return { angles, converged, iterations };
}
