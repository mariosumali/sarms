import { useRef, useState, useCallback } from 'react';
import { Matrix4 as TMatrix4, Euler, Vector3, Plane, Raycaster, Vector2 } from 'three';
import { useThree } from '@react-three/fiber';
import type { Joint } from '../lib/kinematics';
import { FLOOR_Y } from '../lib/kinematics';
import { useSandboxStore } from '../lib/store';
import { JOINT_COLORS } from '../lib/jointDefaults';

interface JointMeshProps {
  joint: Joint;
  worldMatrix: TMatrix4;
  parentMatrix: TMatrix4 | null;
  index: number;
}

function AxisIndicator() {
  const len = 0.18;
  return (
    <group>
      <mesh position={[len / 2, 0, 0]}>
        <boxGeometry args={[len, 0.01, 0.01]} />
        <meshBasicMaterial color="#cc4444" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, len / 2, 0]}>
        <boxGeometry args={[0.01, len, 0.01]} />
        <meshBasicMaterial color="#44cc44" transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0, len / 2]}>
        <boxGeometry args={[0.01, 0.01, len]} />
        <meshBasicMaterial color="#4488cc" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}

export function JointMesh({ joint, worldMatrix, parentMatrix }: JointMeshProps) {
  const [hovered, setHovered] = useState(false);
  const selectedId = useSandboxStore(s => s.selectedJointId);
  const selectJoint = useSandboxStore(s => s.selectJoint);
  const updateJoint = useSandboxStore(s => s.updateJoint);
  const setBasePosition = useSandboxStore(s => s.setBasePosition);
  const setIsDraggingJoint = useSandboxStore(s => s.setIsDraggingJoint);
  const isSelected = selectedId === joint.id;

  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const dragPlane = useRef(new Plane());
  const dragOffset = useRef(new Vector3());

  // Joint visuals go at the pivot point:
  // - base/end-effector: at own frame
  // - revolute/prismatic/elbow: at parent frame (that's where the rotation/translation axis is)
  const usePivot = parentMatrix && joint.type !== 'base' && joint.type !== 'end-effector';
  const displayMatrix = usePivot ? parentMatrix : worldMatrix;

  const pos: [number, number, number] = [displayMatrix.elements[12], displayMatrix.elements[13], displayMatrix.elements[14]];
  const euler = new Euler(); euler.setFromRotationMatrix(displayMatrix);
  const rot: [number, number, number] = [euler.x, euler.y, euler.z];

  const color = JOINT_COLORS[joint.type];
  const emC = isSelected ? '#5b8ec9' : hovered ? '#7aa8d6' : '#000000';
  const emI = isSelected ? 0.4 : hovered ? 0.15 : 0;

  const getNDC = useCallback((e: PointerEvent): Vector2 => {
    const r = gl.domElement.getBoundingClientRect();
    return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }, [gl]);

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation(); selectJoint(joint.id);
    isDragging.current = true; setIsDraggingJoint(true);
    gl.domElement.style.cursor = 'grabbing';
    const wp = new Vector3(...pos), cd = new Vector3(); camera.getWorldDirection(cd);
    dragPlane.current.setFromNormalAndCoplanarPoint(cd, wp);
    const ndc = getNDC(e), rc = new Raycaster(); rc.setFromCamera(ndc, camera);
    const hp = new Vector3(); rc.ray.intersectPlane(dragPlane.current, hp);
    dragOffset.current.subVectors(wp, hp);
    gl.domElement.setPointerCapture(e.pointerId);
  }, [joint.id, pos, camera, gl, selectJoint, setIsDraggingJoint, getNDC]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging.current) return; e.stopPropagation();
    const ndc = getNDC(e), rc = new Raycaster(); rc.setFromCamera(ndc, camera);
    const hp = new Vector3(); rc.ray.intersectPlane(dragPlane.current, hp);
    if (!hp) return; const tgt = hp.add(dragOffset.current);
    if (joint.type === 'base') { setBasePosition([tgt.x, Math.max(FLOOR_Y, tgt.y), tgt.z]); return; }
    if (!parentMatrix) return;
    const lt = tgt.clone().applyMatrix4(parentMatrix.clone().invert());
    if (joint.type === 'revolute' || joint.type === 'elbow') {
      updateJoint(joint.id, { theta: Math.max(joint.thetaMin, Math.min(joint.thetaMax, Math.atan2(lt.y, lt.x))) });
    } else if (joint.type === 'prismatic') {
      updateJoint(joint.id, { d: Math.max(joint.dMin, Math.min(joint.dMax, lt.z)) });
    }
  }, [joint, camera, parentMatrix, getNDC, updateJoint, setBasePosition]);

  const handlePointerUp = useCallback((e: any) => {
    if (!isDragging.current) return; isDragging.current = false;
    setIsDraggingJoint(false); gl.domElement.style.cursor = 'auto';
    gl.domElement.releasePointerCapture(e.pointerId);
  }, [gl, setIsDraggingJoint]);

  const ip = {
    onClick: (e: any) => { e.stopPropagation(); selectJoint(joint.id); },
    onPointerDown: handlePointerDown, onPointerMove: handlePointerMove, onPointerUp: handlePointerUp,
    onPointerOver: () => { setHovered(true); gl.domElement.style.cursor = 'grab'; },
    onPointerOut: () => { setHovered(false); if (!isDragging.current) gl.domElement.style.cursor = 'auto'; },
  };

  const selRing = isSelected && (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.28, 0.01, 16, 48]} />
      <meshStandardMaterial color="#5b8ec9" emissive="#5b8ec9" emissiveIntensity={0.3} transparent opacity={0.5} toneMapped={false} />
    </mesh>
  );

  const discColor = isSelected ? '#5b8ec9' : hovered ? '#7aa8d6' : color;
  const discEmI = isSelected ? 0.5 : hovered ? 0.25 : 0.1;

  return (
    <group position={pos} rotation={rot}>
      {joint.type === 'base' && (
        <group>
          <mesh {...ip} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.05, 6]} />
            <meshStandardMaterial color="#4a5565" emissive={emC} emissiveIntensity={emI} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.04, 0]} {...ip}>
            <cylinderGeometry args={[0.08, 0.1, 0.03, 16]} />
            <meshStandardMaterial color="#586878" metalness={0.6} roughness={0.35} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}

      {joint.type === 'revolute' && (
        <group>
          <mesh {...ip} castShadow>
            <torusGeometry args={[0.14, 0.025, 16, 32]} />
            <meshStandardMaterial
              color={discColor} emissive={discColor} emissiveIntensity={discEmI}
              metalness={0.4} roughness={0.4} transparent opacity={0.85}
            />
          </mesh>
          <mesh position={[0, 0, 0.12]}>
            <coneGeometry args={[0.03, 0.08, 8]} />
            <meshStandardMaterial color="#4488cc" emissive="#4488cc" emissiveIntensity={0.2} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.05, 0.05, 0.06, 12]} />
            <meshStandardMaterial color={color} emissive={emC} emissiveIntensity={emI} metalness={0.6} roughness={0.3} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}

      {joint.type === 'prismatic' && (
        <group>
          <mesh {...ip} castShadow>
            <boxGeometry args={[0.06, 0.06, 0.35]} />
            <meshStandardMaterial color="#6660a0" emissive={emC} emissiveIntensity={emI} metalness={0.5} roughness={0.35} transparent opacity={0.45} />
          </mesh>
          <mesh {...ip} castShadow>
            <boxGeometry args={[0.1, 0.1, 0.12]} />
            <meshStandardMaterial color={color} emissive={emC} emissiveIntensity={emI} metalness={0.6} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.22]}>
            <coneGeometry args={[0.025, 0.06, 8]} />
            <meshStandardMaterial color="#8a72c8" emissive="#8a72c8" emissiveIntensity={0.2} />
          </mesh>
          <mesh position={[0, 0, -0.22]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.025, 0.06, 8]} />
            <meshStandardMaterial color="#8a72c8" emissive="#8a72c8" emissiveIntensity={0.2} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}

      {joint.type === 'elbow' && (
        <group>
          <mesh {...ip} castShadow>
            <torusGeometry args={[0.14, 0.022, 16, 32]} />
            <meshStandardMaterial
              color={discColor} emissive={discColor} emissiveIntensity={discEmI}
              metalness={0.4} roughness={0.4} transparent opacity={0.8}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} {...ip} castShadow>
            <torusGeometry args={[0.11, 0.02, 16, 32]} />
            <meshStandardMaterial
              color="#d09448" emissive="#d09448" emissiveIntensity={discEmI * 0.6}
              metalness={0.4} roughness={0.4} transparent opacity={0.7}
            />
          </mesh>
          <mesh {...ip}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color={color} emissive={emC} emissiveIntensity={emI} metalness={0.5} roughness={0.4} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}

      {joint.type === 'end-effector' && (
        <group>
          <mesh {...ip} castShadow rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.06, 0.16, 12]} />
            <meshStandardMaterial color={color} emissive={emC} emissiveIntensity={emI} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[-0.04, 0, 0.12]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.02, 0.02, 0.08]} />
            <meshStandardMaterial color="#d07060" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0.04, 0, 0.12]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.02, 0.02, 0.08]} />
            <meshStandardMaterial color="#d07060" metalness={0.5} roughness={0.4} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}
    </group>
  );
}
