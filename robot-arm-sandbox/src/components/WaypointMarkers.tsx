import { useCallback, useRef } from 'react';
import { Vector3, Plane, Raycaster, Vector2, Quaternion } from 'three';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useSandboxStore } from '../lib/store';
import { FLOOR_Y } from '../lib/kinematics';

function WaypointSphere({ id, position, label, index }: {
  id: string; position: Vector3; label: string; index: number;
}) {
  const updateWaypoint = useSandboxStore(s => s.updateWaypoint);
  const removeWaypoint = useSandboxStore(s => s.removeWaypoint);
  const isDragging = useRef(false);
  const dragPlane = useRef(new Plane());
  const dragOffset = useRef(new Vector3());
  const { camera, gl } = useThree();

  const getNDC = useCallback((e: PointerEvent): Vector2 => {
    const r = gl.domElement.getBoundingClientRect();
    return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }, [gl]);

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation();
    isDragging.current = true;
    gl.domElement.style.cursor = 'grabbing';
    const wp = new Vector3(position.x, position.y, position.z);
    const cd = new Vector3();
    camera.getWorldDirection(cd);
    dragPlane.current.setFromNormalAndCoplanarPoint(cd, wp);
    const ndc = getNDC(e);
    const rc = new Raycaster();
    rc.setFromCamera(ndc, camera);
    const hp = new Vector3();
    rc.ray.intersectPlane(dragPlane.current, hp);
    dragOffset.current.subVectors(wp, hp);
    gl.domElement.setPointerCapture(e.pointerId);
  }, [gl, camera, position, getNDC]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging.current) return;
    e.stopPropagation();
    const ndc = getNDC(e);
    const rc = new Raycaster();
    rc.setFromCamera(ndc, camera);
    const hp = new Vector3();
    rc.ray.intersectPlane(dragPlane.current, hp);
    if (!hp) return;
    const tgt = hp.add(dragOffset.current);
    tgt.y = Math.max(FLOOR_Y, tgt.y);
    updateWaypoint(id, tgt);
  }, [id, camera, getNDC, updateWaypoint]);

  const handlePointerUp = useCallback((e: any) => {
    isDragging.current = false;
    gl.domElement.style.cursor = 'auto';
    gl.domElement.releasePointerCapture(e.pointerId);
  }, [gl]);

  const hue = (index * 60 + 30) % 360;
  const color = `hsl(${hue}, 80%, 55%)`;

  return (
    <group>
      <mesh
        position={[position.x, position.y, position.z]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerOver={() => { gl.domElement.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!isDragging.current) gl.domElement.style.cursor = 'auto'; }}
        onDoubleClick={(e) => { e.stopPropagation(); removeWaypoint(id); }}
      >
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>
      <Html
        position={[position.x, position.y + 0.14, position.z]}
        center
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          color: color,
          fontSize: '10px',
          fontWeight: 700,
          fontFamily: 'monospace',
          padding: '1px 5px',
          borderRadius: '3px',
          border: `1px solid ${color}44`,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </div>
      </Html>
      {/* Vertical line to floor */}
      {position.y > 0.02 && (
        <mesh position={[position.x, position.y / 2, position.z]}>
          <cylinderGeometry args={[0.003, 0.003, position.y, 4]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

export function WaypointMarkers() {
  const waypoints = useSandboxStore(s => s.waypoints);

  if (waypoints.length === 0) return null;

  return (
    <group>
      {waypoints.map((wp, i) => (
        <WaypointSphere
          key={wp.id}
          id={wp.id}
          position={wp.position}
          label={wp.label}
          index={i}
        />
      ))}
      {waypoints.length >= 2 && waypoints.slice(0, -1).map((wp, i) => {
        const next = waypoints[i + 1];
        const start = wp.position;
        const end = next.position;
        const mid = new Vector3().addVectors(start, end).multiplyScalar(0.5);
        const dir = new Vector3().subVectors(end, start);
        const len = dir.length();
        if (len < 0.001) return null;
        const q = new Quaternion();
        q.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
        return (
          <mesh key={`line-${i}`} position={mid} quaternion={q}>
            <cylinderGeometry args={[0.004, 0.004, len, 4]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
          </mesh>
        );
      })}
    </group>
  );
}
