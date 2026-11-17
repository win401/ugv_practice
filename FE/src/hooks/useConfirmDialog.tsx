import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog, {
  type ConfirmDialogOptions,
} from "../components/ConfirmDialog";

/** Resolve one confirmation at a time; interrupted/unmounted requests cancel. */
export function useConfirmDialog() {
  const [request, setRequest] = useState<
    (ConfirmDialogOptions & { id: number }) | null
  >(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const nextId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  const confirm = useCallback(
    (options: ConfirmDialogOptions): Promise<boolean> => {
      // A second click cannot replace the visible question or launch two actions.
      if (!mounted.current || resolver.current) return Promise.resolve(false);
      return new Promise((resolve) => {
        resolver.current = resolve;
        setRequest({ ...options, id: ++nextId.current });
      });
    },
    [],
  );

  const resolve = useCallback((accepted: boolean) => {
    const complete = resolver.current;
    if (!complete) return;
    resolver.current = null;
    if (mounted.current) setRequest(null);
    complete(accepted);
  }, []);

  return {
    confirm,
    isOpen: request !== null,
    dialog: request ? (
      <ConfirmDialog
        key={request.id}
        {...request}
        onConfirm={() => resolve(true)}
        onCancel={() => resolve(false)}
      />
    ) : null,
  };
}
