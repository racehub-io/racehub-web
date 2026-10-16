import { useRef, useEffect } from "react";

type Fn = () => void;
type Deps = [...args: unknown[]];

export function parseParticipants(buffer: any) {
  return [];
}

function usePrevious(value: Deps) {
  const ref = useRef<Deps>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export function useEffectAllDepsChange(fn: Fn, deps: Deps) {
  const prevDeps = usePrevious(deps);
  const changeTarget = useRef<Deps>();

  useEffect(() => {
    if (changeTarget.current === undefined) {
      changeTarget.current = prevDeps;
    }

    if (changeTarget.current === undefined) {
      return fn();
    }

    if (changeTarget.current.every((dep, i) => dep !== deps[i])) {
      changeTarget.current = deps;

      return fn();
    }
  }, [fn, prevDeps, deps]);
}
