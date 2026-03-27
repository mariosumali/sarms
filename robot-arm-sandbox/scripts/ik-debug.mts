import { Vector3 } from 'three';
import {
  computeFK,
  positionFromMatrix,
  solveIK,
  applyIKResult,
  type Joint,
} from '../src/lib/kinematics.ts';
import { getJointDefaults } from '../src/lib/jointDefaults.ts';

const PI = Math.PI;
const BP: [number, number, number] = [0, 0, 0];

function J(type: Joint['type'], id: string, patch: Partial<Joint> = {}): Joint {
  const d = getJointDefaults(type);
  return { id, name: id, ...d, ...patch };
}

function armColumnElbow(): Joint[] {
  return [
    J('base', 'b'),
    J('revolute', 'waist', {
      d: 0.35,
      a: 0,
      alpha: 0,
      thetaMin: -PI,
      thetaMax: PI,
    }),
    J('elbow', 'el', {
      d: 0.2,
      a: 0.75,
      alpha: -PI / 2,
      theta: 0.15,
      theta2: -0.1,
      thetaMin: -PI,
      thetaMax: PI,
      theta2Min: -PI,
      theta2Max: PI,
    }),
    J('revolute', 'wrist', {
      d: 0,
      a: 0.55,
      alpha: 0,
      thetaMin: -PI,
      thetaMax: PI,
    }),
    J('end-effector', 'ee', { d: 0.12, a: 0, alpha: 0 }),
  ];
}

function withColumnElbowPose(
  joints: Joint[],
  waist: number,
  e1: number,
  e2: number,
  wrist: number,
): Joint[] {
  return joints.map(j => {
    if (j.id === 'waist') return { ...j, theta: waist };
    if (j.id === 'el') return { ...j, theta: e1, theta2: e2 };
    if (j.id === 'wrist') return { ...j, theta: wrist };
    return j;
  });
}

const seeds: [number, number, number, number][] = [
  [0.1, 0.2, -0.15, 0.05],
  [-0.4, 0.5, 0.3, -0.2],
  [0.8, -0.3, 0.4, 0.6],
  [0, 0.6, -0.5, 0],
];

for (const [w, e1, e2, wr] of seeds) {
  const known = withColumnElbowPose(armColumnElbow(), w, e1, e2, wr);
  const target = positionFromMatrix(computeFK(known, BP));
  const start = withColumnElbowPose(armColumnElbow(), 0, 0, 0, 0);
  const result = solveIK(start, target, BP, 320, 0.002, 0.05);
  const solved = applyIKResult(start, result);
  const p = positionFromMatrix(computeFK(solved, BP));
  const err = p.distanceTo(target);
  console.log('seed', [w, e1, e2, wr], 'err', err, 'conv', result.converged, 'iters', result.iterations);
}
