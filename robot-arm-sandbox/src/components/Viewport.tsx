import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, Line, Environment } from '@react-three/drei';
import { Vector3, Mesh, Plane, Raycaster, Vector2, Quaternion } from 'three';
import { useSandboxStore } from '../lib/store';
import { computeAllTransforms, FLOOR_Y, checkFloorViolation, checkSelfCollision } from '../lib/kinematics';
import { setViewportRefs } from '../lib/viewportRef';
import { JointMesh } from './JointMesh';
import { AllSnapConnectors } from './SnapConnector';
import { SimControls } from './SimControls';
import { WaypointMarkers } from './WaypointMarkers';
import { PathVisualization } from './PathVisualization';
import { AnalyticsOverlay } from './AnalyticsOverlay';

function SceneBridge() {
  const { camera, gl } = useThree();
  useEffect(() => { setViewportRefs(camera, gl.domElement); }, [camera, gl]);
  return null;
}

function IKTargetSphere() {
  const meshRef = useRef<Mesh>(null);
  const ikTarget = useSandboxStore(s => s.ikTarget);
  const setIKTarget = useSandboxStore(s => s.setIKTarget);
  const isDragging = useRef(false);
  const dragPlane = useRef(new Plane());
  const dragOffset = useRef(new Vector3());
  const { camera, gl } = useThree();

  const getNDC = useCallback((e: PointerEvent): Vector2 => {
    const r = gl.domElement.getBoundingClientRect();
    return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }, [gl]);

  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation(); isDragging.current = true; gl.domElement.style.cursor = 'grabbing';
    const wp = new Vector3(ikTarget.x, ikTarget.y, ikTarget.z), cd = new Vector3();
    camera.getWorldDirection(cd); dragPlane.current.setFromNormalAndCoplanarPoint(cd, wp);
    const ndc = getNDC(e), rc = new Raycaster(); rc.setFromCamera(ndc, camera);
    const hp = new Vector3(); rc.ray.intersectPlane(dragPlane.current, hp);
    dragOffset.current.subVectors(wp, hp); gl.domElement.setPointerCapture(e.pointerId);
  }, [gl, camera, ikTarget, getNDC]);

  const handlePointerMove = useCallback((e: any) => {
    if (!isDragging.current) return; e.stopPropagation();
    const ndc = getNDC(e), rc = new Raycaster(); rc.setFromCamera(ndc, camera);
    const hp = new Vector3(); rc.ray.intersectPlane(dragPlane.current, hp);
    if (!hp) return;
    const tgt = hp.add(dragOffset.current);
    tgt.y = Math.max(FLOOR_Y, tgt.y);
    setIKTarget(tgt);
  }, [camera, getNDC, setIKTarget]);

  const handlePointerUp = useCallback((e: any) => {
    isDragging.current = false; gl.domElement.style.cursor = 'auto';
    gl.domElement.releasePointerCapture(e.pointerId);
  }, [gl]);

  return (
    <group>
      <mesh ref={meshRef} position={[ikTarget.x, ikTarget.y, ikTarget.z]}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        onPointerOver={() => { gl.domElement.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!isDragging.current) gl.domElement.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[0.09, 24, 24]} />
        <meshStandardMaterial color="#ff4444" emissive="#ff3333" emissiveIntensity={1.2} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      <mesh position={[ikTarget.x, ikTarget.y, ikTarget.z]}>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial color="#ff4444" transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function FloorPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y - 0.001, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#0c1117" transparent opacity={0.55} metalness={0.1} roughness={0.9} />
    </mesh>
  );
}

function ArmLinks() {
  const joints = useSandboxStore(s => s.joints);
  const bp = useSandboxStore(s => s.basePosition);
  const { transforms } = useMemo(() => computeAllTransforms(joints, bp), [joints, bp]);
  const points = useMemo(() => transforms.map(t => new Vector3(t.elements[12], t.elements[13], t.elements[14])), [transforms]);

  const { hasFloor, hasSelfCol } = useMemo(() => ({
    hasFloor: checkFloorViolation(points),
    hasSelfCol: checkSelfCollision(points),
  }), [points]);

  const linkColor = hasFloor || hasSelfCol ? '#ef4444' : '#3a4e68';
  const traceColor = hasFloor || hasSelfCol ? '#ef4444' : '#3b82f6';

  if (points.length < 2) return null;
  return (
    <>
      {points.slice(0, -1).map((p, i) => {
        const len = p.distanceTo(points[i + 1]);
        if (len < 0.001) return null;
        return (
          <mesh
            key={`rod-${i}`}
            position={new Vector3().addVectors(p, points[i + 1]).multiplyScalar(0.5)}
            quaternion={new Quaternion().setFromUnitVectors(
              new Vector3(0, 1, 0),
              new Vector3().subVectors(points[i + 1], p).normalize(),
            )}
            castShadow
          >
            <cylinderGeometry args={[0.028, 0.028, len, 8]} />
            <meshStandardMaterial color={linkColor} metalness={0.7} roughness={0.25} />
          </mesh>
        );
      })}
      <Line points={points} color={traceColor} lineWidth={1} transparent opacity={0.15} />
    </>
  );
}

function ClickToAddWaypoint() {
  const addWaypoint = useSandboxStore(s => s.addWaypoint);

  const handleClick = useCallback((e: any) => {
    if (e.shiftKey) {
      e.stopPropagation();
      const point = e.point as Vector3;
      addWaypoint(new Vector3(point.x, Math.max(FLOOR_Y, point.y), point.z));
    }
  }, [addWaypoint]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, FLOOR_Y + 0.0001, 0]}
      onClick={handleClick}
      visible={false}
    >
      <planeGeometry args={[40, 40]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

function ArmScene() {
  const joints = useSandboxStore(s => s.joints);
  const bp = useSandboxStore(s => s.basePosition);
  const selectJoint = useSandboxStore(s => s.selectJoint);
  const isDraggingJoint = useSandboxStore(s => s.isDraggingJoint);
  const { transforms } = useMemo(() => computeAllTransforms(joints, bp), [joints, bp]);

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} castShadow shadow-mapSize={1024} color="#eef4ff" />
      <directionalLight position={[-4, 6, -3]} intensity={0.4} color="#aabbdd" />
      <pointLight position={[1, 3, 2]} intensity={0.6} color="#ddeeff" distance={10} />
      <pointLight position={[-2, 1, -1]} intensity={0.2} color="#aaccff" distance={8} />

      <Environment preset="city" environmentIntensity={0.15} />

      <Grid args={[40, 40]} cellSize={0.5} sectionSize={2} cellColor="#131a24" sectionColor="#1a2535" fadeDistance={20} infiniteGrid />
      <FloorPlane />
      <ClickToAddWaypoint />

      <group onPointerMissed={() => selectJoint(null)}>
        {joints.map((j, i) => (
          <JointMesh key={j.id} joint={j} worldMatrix={transforms[i]} parentMatrix={i > 0 ? transforms[i - 1] : null} index={i} />
        ))}
      </group>

      <ArmLinks />
      <AllSnapConnectors />
      <IKTargetSphere />
      <WaypointMarkers />
      <PathVisualization />

      <OrbitControls makeDefault enabled={!isDraggingJoint} enableDamping dampingFactor={0.08} />
      <GizmoHelper alignment="bottom-left" margin={[60, 60]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.8} />
      </GizmoHelper>

      <SceneBridge />
    </>
  );
}

export function Viewport() {
  const addJoint = useSandboxStore(s => s.addJoint);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); const t = e.dataTransfer.getData('application/joint-type');
    if (t) addJoint(t as any);
  }, [addJoint]);

  return (
    <div className="panel-viewport" onDragOver={handleDragOver} onDrop={handleDrop}>
      <Canvas shadows camera={{ position: [2.5, 2.5, 4], fov: 50, near: 0.01, far: 100 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: false, toneMapping: 3 }}
        onCreated={({ gl, scene }) => { gl.setClearColor('#0c1117'); scene.fog = null; }}
      >
        <ArmScene />
      </Canvas>
      <SimControls />
      <AnalyticsOverlay />
      <ViewportHint />
    </div>
  );
}

function ViewportHint() {
  const joints = useSandboxStore(s => s.joints);
  if (joints.length >= 2) return null;
  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-faint)', fontSize: '14px', fontFamily: 'var(--font-sans)', pointerEvents: 'none', textAlign: 'center' }}>
      Pick a preset or add parts from the left
    </div>
  );
}
