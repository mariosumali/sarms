import { useEffect } from 'react';
import { useSandboxStore } from '../lib/store';

export function useIK() {
  const solveIK = useSandboxStore(s => s.solveIK);
  const ikTarget = useSandboxStore(s => s.ikTarget);
  const autoIK = useSandboxStore(s => s.autoIK);
  const animState = useSandboxStore(s => s.animState);

  useEffect(() => {
    if (!autoIK || animState === 'playing') return;
    solveIK();
  }, [ikTarget, solveIK, autoIK, animState]);
}
