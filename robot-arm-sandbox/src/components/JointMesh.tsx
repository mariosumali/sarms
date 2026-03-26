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
        <meshBasicMaterial color="#ff3333" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, len / 2, 0]}>
        <boxGeometry args={[0.01, len, 0.01]} />
        <meshBasicMaterial color="#33ff33" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0, len / 2]}>
        <boxGeometry args={[0.01, 0.01, len]} />
        <meshBasicMaterial color="#3388ff" transparent opacity={0.7} />
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

  const pos: [number, number, number] = [worldMatrix.elements[12], worldMatrix.elements[13], worldMatrix.elements[14]];
  const euler = new Euler(); euler.setFromRotationMatrix(worldMatrix);
  const rot: [number, number, number] = [euler.x, euler.y, euler.z];

  const color = JOINT_COLORS[joint.type];
  const emC = isSelected ? '#3b82f6' : hovered ? '#60a5fa' : '#000000';
  const emI = isSelected ? 0.5 : hovered ? 0.2 : 0;

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
      <torusGeometry args={[0.28, 0.012, 16, 48]} />
      <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.7} transparent opacity={0.75} toneMapped={false} />
    </mesh>
  );

  const discColor = isSelected ? '#3b82f6' : hovered ? '#60a5fa' : color;
  const discEmI = isSelected ? 0.8 : hovered ? 0.4 : 0.15;

  return (
    <group position={pos} rotation={rot}>
      {joint.type === 'base' && (
        <group>
          <mesh {...ip} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.05, 6]} />
            <meshStandardMaterial color="#556070" emissive={emC} emissiveIntensity={emI} metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.04, 0]} {...ip}>
            <cylinderGeometry args={[0.08, 0.1, 0.03, 16]} />
            <meshStandardMaterial color="#667080" metalness={0.7} roughness={0.3} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}

      {joint.type === 'revolute' && (
        <group>
          {/* Rotation disc in XY plane -- rotation about local Z */}
          <mesh {...ip} castShadow>
            <torusGeometry args={[0.14, 0.025, 16, 32]} />
            <meshStandardMaterial
              color={discColor} emissive={discColor} emissiveIntensity={discEmI}
              metalness={0.4} roughness={0.4} transparent opacity={0.85}
            />
          </mesh>
          {/* Z-axis indicator (rotation axis) */}
          <mesh position={[0, 0, 0.12]}>
            <coneGeometry args={[0.03, 0.08, 8]} />
            <meshStandardMaterial color="#3388ff" emissive="#3388ff" emissiveIntensity={0.3} />
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
          {/* Rail along Z axis */}
          <mesh {...ip} castShadow>
            <boxGeometry args={[0.06, 0.06, 0.35]} />
            <meshStandardMaterial color="#7766bb" emissive={emC} emissiveIntensity={emI} metalness={0.5} roughness={0.3} transparent opacity={0.5} />
          </mesh>
          {/* Carriage block */}
          <mesh {...ip} castShadow>
            <boxGeometry args={[0.1, 0.1, 0.12]} />
            <meshStandardMaterial color={color} emissive={emC} emissiveIntensity={emI} metalness={0.6} roughness={0.25} />
          </mesh>
          {/* Z arrow */}
          <mesh position={[0, 0, 0.22]}>
            <coneGeometry args={[0.025, 0.06, 8]} />
            <meshStandardMaterial color="#9b7bf0" emissive="#9b7bf0" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0, -0.22]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.025, 0.06, 8]} />
            <meshStandardMaterial color="#9b7bf0" emissive="#9b7bf0" emissiveIntensity={0.3} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}

      {joint.type === 'elbow' && (
        <group>
          {/* Ring 1: first rotation in parent XY plane (about Z before this frame) */}
          <mesh {...ip} castShadow>
            <torusGeometry args={[0.14, 0.022, 16, 32]} />
            <meshStandardMaterial
              color={discColor} emissive={discColor} emissiveIntensity={discEmI}
              metalness={0.4} roughness={0.4} transparent opacity={0.8}
            />
          </mesh>
          {/* Ring 2: second rotation about the orthogonal axis (rotated 90° in X) */}
          <mesh rotation={[Math.PI / 2, 0, 0]} {...ip} castShadow>
            <torusGeometry args={[0.11, 0.02, 16, 32]} />
            <meshStandardMaterial
              color="#ffaa44" emissive="#ffaa44" emissiveIntensity={discEmI * 0.8}
              metalness={0.4} roughness={0.4} transparent opacity={0.75}
            />
          </mesh>
          {/* Hub sphere */}
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
          {/* Finger prongs */}
          <mesh position={[-0.04, 0, 0.12]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.02, 0.02, 0.08]} />
            <meshStandardMaterial color="#ff7766" metalness={0.5} roughness={0.4} />
          </mesh>
          <mesh position={[0.04, 0, 0.12]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.02, 0.02, 0.08]} />
            <meshStandardMaterial color="#ff7766" metalness={0.5} roughness={0.4} />
          </mesh>
          <AxisIndicator />
          {selRing}
        </group>
      )}
    </group>
  );
}
