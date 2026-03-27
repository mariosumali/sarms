import { Vector3 } from 'three';
import { positionFromMatrix, computeFK, type Joint } from '../src/lib/kinematics.ts';
import { getJointDefaults } from '../src/lib/jointDefaults.ts';

const PI = Math.PI;
const BP: [number, number, number] = [0, 0, 0];

function J(t: Joint['type'], id: string, p: Partial<Joint> = {}): Joint {
  const d = getJointDefaults(t);
  return { id, name: id, ...d, ...p };
}

function arm() {
  return [
    J('base', 'b'),
    J('revolute', 'waist', { d: 0.35, a: 0, alpha: 0, thetaMin: -PI, thetaMax: PI }),
    J('elbow', 'el', {
      d: 0.2,
      a: 0.75,
      alpha: -PI / 2,
      thetaMin: -PI,
      thetaMax: PI,
      theta2Min: -PI,
      theta2Max: PI,
    }),
    J('revolute', 'wrist', { d: 0, a: 0.55, alpha: 0, thetaMin: -PI, thetaMax: PI }),
    J('end-effector', 'ee', { d: 0.12, a: 0, alpha: 0 }),
  ];
}

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function jointsWithSeededPose(joints: Joint[], seed: number): Joint[] {
  let s = seed;
  const next = () => {
    s += 1;
    return seededUnit(s);
  };
  return joints.map(j => {
    if (j.type === 'revolute') {
      const u = next() * 0.5 + 0.5;
      const t = j.thetaMin + u * (j.thetaMax - j.thetaMin);
      return { ...j, theta: t };
    }
    if (j.type === 'prismatic') {
      const u = next() * 0.5 + 0.5;
      const d = j.dMin + u * (j.dMax - j.dMin);
      return { ...j, d };
    }
    if (j.type === 'elbow') {
      const u1 = next() * 0.5 + 0.5;
      const u2 = next() * 0.5 + 0.5;
      return {
        ...j,
        theta: j.thetaMin + u1 * (j.thetaMax - j.thetaMin),
        theta2: j.theta2Min + u2 * (j.theta2Max - j.theta2Min),
      };
    }
    return { ...j };
  });
}

const target = new Vector3(0.8738330895499379, 1.173253200185464, -0.7432167786495325);
const safeT = target.clone();
safeT.y = Math.max(0.02, safeT.y);
const template = arm();
let best = Infinity;
for (let i = 0; i < 50000; i++) {
  const shot = jointsWithSeededPose(template, 50000 + i * 1103);
  const e = safeT.distanceTo(positionFromMatrix(computeFK(shot, BP)));
  if (e < best) best = e;
}
console.log('min deterministic shot', best);
