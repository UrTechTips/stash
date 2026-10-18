import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Eases a number toward its target. Used for bars and rings so they move when
 * something changes (a transaction is added) rather than jumping.
 * Skips the animation when the phone's "reduce motion" setting is on.
 */
export function useAnimatedNumber(target: number, duration = 450): number {
  const [value, setValue] = useState(0);
  const current = useRef(0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on;
    });
  }, []);

  useEffect(() => {
    if (reduceMotion.current) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      current.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
