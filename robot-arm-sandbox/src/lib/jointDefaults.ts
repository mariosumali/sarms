import type { Joint } from './kinematics';

const DEG = Math.PI / 180;

type JointType = Joint['type'];

const defaults: Record<JointType, Omit<Joint, 'id' | 'name'>> = {
  base: {
    type: 'base',
    theta: 0, d: 0, a: 0, alpha: 0,
    thetaMin: 0, thetaMax: 0,
    dMin: 0, dMax: 0,
    theta2: 0, theta2Min: 0, theta2Max: 0,
  },
  revolute: {
    type: 'revolute',
    // d = span along joint axis (vertical after base Y-align); a = lateral offset (leans off-axis)
    theta: 0, d: 1.0, a: 0, alpha: 0,
    thetaMin: -180 * DEG, thetaMax: 180 * DEG,
    dMin: 0, dMax: 3,
    theta2: 0, theta2Min: 0, theta2Max: 0,
  },
  prismatic: {
    type: 'prismatic',
    theta: 0, d: 0.5, a: 0, alpha: 0,
    thetaMin: 0, thetaMax: 0,
    dMin: 0.1, dMax: 1.5,
    theta2: 0, theta2Min: 0, theta2Max: 0,
  },
  elbow: {
    type: 'elbow',
    theta: 0, d: 0.3, a: 0.8, alpha: -Math.PI / 2,
    thetaMin: -180 * DEG, thetaMax: 180 * DEG,
    dMin: 0, dMax: 0,
    theta2: 0, theta2Min: -180 * DEG, theta2Max: 180 * DEG,
  },
  'end-effector': {
    type: 'end-effector',
    theta: 0, d: 0.3, a: 0, alpha: 0,
    thetaMin: 0, thetaMax: 0,
    dMin: 0, dMax: 0,
    theta2: 0, theta2Min: 0, theta2Max: 0,
  },
};

export function getJointDefaults(type: JointType): Omit<Joint, 'id' | 'name'> {
  return { ...defaults[type] };
}

export const FRIENDLY_NAMES: Record<JointType, string> = {
  base: 'Base',
  revolute: 'Rotate Joint',
  prismatic: 'Slide Joint',
  elbow: 'Elbow',
  'end-effector': 'Gripper',
};

export const FRIENDLY_DESC: Record<JointType, string> = {
  base: 'Anchor point',
  revolute: 'Rotation about vertical axis; length is along that axis',
  prismatic: 'Extends and retracts',
  elbow: 'Two orthogonal rotation axes',
  'end-effector': 'The tip that grabs things',
};

export const JOINT_ICONS: Record<JointType, string> = {
  base: '⬡',
  revolute: '↻',
  prismatic: '⇕',
  elbow: '⌐',
  'end-effector': '⊕',
};

export const JOINT_COLORS: Record<JointType, string> = {
  base: '#6e7d93',
  revolute: '#5090b8',
  prismatic: '#8a72c8',
  elbow: '#c08540',
  'end-effector': '#c05858',
};
