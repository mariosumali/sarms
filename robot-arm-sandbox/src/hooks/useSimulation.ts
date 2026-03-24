import { useEffect, useRef } from 'react';
import { useSandboxStore } from '../lib/store';

export function useSimulation() {
  const ikRafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const timelineRafRef = useRef<number>(0);
  const lastTimelineRef = useRef<number>(0);
  const pathRafRef = useRef<number>(0);
  const lastPathRef = useRef<number>(0);

  const animState = useSandboxStore(s => s.animState);
  const simulationState = useSandboxStore(s => s.simulationState);
  const pathAnimState = useSandboxStore(s => s.pathAnimState);
  const animSpeed = useSandboxStore(s => s.animSpeed);
  const animLoop = useSandboxStore(s => s.animLoop);
  const setAnimProgress = useSandboxStore(s => s.setAnimProgress);
  const stop = useSandboxStore(s => s.stop);
  const play = useSandboxStore(s => s.play);
  const tickTimeline = useSandboxStore(s => s.tickTimeline);
  const tickPath = useSandboxStore(s => s.tickPath);
  const recordTracePoint = useSandboxStore(s => s.recordTracePoint);

  useEffect(() => {
    if (animState !== 'playing') return;

    const baseDuration = 1.5;
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      const raw = elapsed / (baseDuration / animSpeed);

      if (raw >= 1) {
        setAnimProgress(1);
        recordTracePoint();
        if (animLoop) {
          play();
        } else {
          stop();
        }
        return;
      }

      const eased = raw < 0.5
        ? 4 * raw * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 3) / 2;

      setAnimProgress(eased);
      recordTracePoint();
      ikRafRef.current = requestAnimationFrame(animate);
    };

    ikRafRef.current = requestAnimationFrame(animate);
    return () => { if (ikRafRef.current) cancelAnimationFrame(ikRafRef.current); };
  }, [animState, animSpeed, animLoop, setAnimProgress, stop, play, recordTracePoint]);

  useEffect(() => {
    if (simulationState !== 'playing') return;

    lastTimelineRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTimelineRef.current) / 1000);
      lastTimelineRef.current = now;
      tickTimeline(dt);
      recordTracePoint();
      timelineRafRef.current = requestAnimationFrame(loop);
    };

    timelineRafRef.current = requestAnimationFrame(loop);
    return () => { if (timelineRafRef.current) cancelAnimationFrame(timelineRafRef.current); };
  }, [simulationState, tickTimeline, recordTracePoint]);

  useEffect(() => {
    if (pathAnimState !== 'playing') return;

    lastPathRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - lastPathRef.current) / 1000);
      lastPathRef.current = now;
      tickPath(dt);
      recordTracePoint();
      pathRafRef.current = requestAnimationFrame(loop);
    };

    pathRafRef.current = requestAnimationFrame(loop);
    return () => { if (pathRafRef.current) cancelAnimationFrame(pathRafRef.current); };
  }, [pathAnimState, tickPath, recordTracePoint]);
}
