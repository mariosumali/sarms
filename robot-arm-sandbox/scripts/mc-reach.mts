import { Vector3 } from 'three';
import { computeFK, positionFromMatrix, type Joint } from '../src/lib/kinematics.ts';
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

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

const target = new Vector3(0.8738330895499379, 1.173253200185464, -0.7432167786495325);
let best = Infinity;
let bestJ: Joint[] | null = null;
for (let i = 0; i < 80000; i++) {
  const j = armColumnElbow().map(x => {
    if (x.id === 'waist') return { ...x, theta: rnd(-PI, PI) };
    if (x.id === 'el') return { ...x, theta: rnd(-PI, PI), theta2: rnd(-PI, PI) };
    if (x.id === 'wrist') return { ...x, theta: rnd(-PI, PI) };
    return x;
  });
  const p = positionFromMatrix(computeFK(j, BP));
  const d = p.distanceTo(target);
  if (d < best) {
    best = d;
    bestJ = j;
  }
}
console.log('best mc distance', best);
