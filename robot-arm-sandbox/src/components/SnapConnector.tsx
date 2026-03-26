import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh } from 'three';
import { useSandboxStore } from '../lib/store';
import { computeAllTransforms } from '../lib/kinematics';

interface SnapConnectorProps {
  position: [number, number, number];
  isChainTip: boolean;
}

export function SnapConnector({ position, isChainTip }: SnapConnectorProps) {
  const meshRef = useRef<Mesh>(null);
  const isDragging = useSandboxStore(s => s.isDraggingJoint);

  useFrame(() => {
    if (!meshRef.current) return;
    if (isChainTip) {
      const t = performance.now() * 0.003;
      const pulse = 1 + Math.sin(t) * 0.15;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  const baseRadius = isChainTip ? 0.045 : 0.03;
  const glowColor = isChainTip ? '#34d399' : '#3b82f6';
  const opacity = isChainTip ? 0.85 : (isDragging ? 0.6 : 0.3);

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[baseRadius, 16, 16]} />
      <meshStandardMaterial
        color={glowColor}
        emissive={glowColor}
        emissiveIntensity={isChainTip ? 0.5 : 0.2}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

export function AllSnapConnectors() {
  const joints = useSandboxStore(s => s.joints);
  const basePosition = useSandboxStore(s => s.basePosition);
  const { transforms } = computeAllTransforms(joints, basePosition);

  return (
    <>
      {transforms.map((t, i) => {
        const pos: [number, number, number] = [
          t.elements[12],
          t.elements[13],
          t.elements[14],
        ];
        return (
          <SnapConnector
            key={`snap-${joints[i].id}`}
            position={pos}
            isChainTip={i === transforms.length - 1 && joints.length > 1}
          />
        );
      })}
    </>
  );
}
