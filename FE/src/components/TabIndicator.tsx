import { useLayoutEffect, useRef, useState } from "react";

type Placement = {
  x: number;
  y: number;
  width: number;
  height: number;
  animate: boolean;
};

/** Follows only the committed tab; event handling and guarded selection stay outside. */
export default function TabIndicator({
  activeKey,
  variant,
}: {
  activeKey: string;
  variant: "pill" | "underline";
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const previousKey = useRef<string | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const parent = marker.current?.parentElement;
    if (!parent) return;
    const buttons = Array.from(
      parent.querySelectorAll<HTMLButtonElement>(
        ":scope > button[data-tab-key]",
      ),
    );
    const selected = buttons.find(
      (button) => button.dataset.tabKey === activeKey,
    );
    if (!selected) {
      setPlacement(null);
      return;
    }

    const measure = (animate: boolean) => {
      const underline = variant === "underline";
      const next: Placement = {
        x: selected.offsetLeft + (underline ? 1 : 0),
        y: selected.offsetTop + (underline ? selected.clientHeight - 1 : 0),
        width: Math.max(0, selected.clientWidth - (underline ? 2 : 0)),
        height: underline ? 2 : selected.clientHeight,
        animate,
      };
      setPlacement((current) =>
        current &&
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
    };

    // Initial layout and resizing snap into place; only a committed tab change slides.
    measure(previousKey.current !== null && previousKey.current !== activeKey);
    previousKey.current = activeKey;
    const observer = new ResizeObserver(() => measure(false));
    observer.observe(parent);
    buttons.forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [activeKey, variant]);

  return (
    <span
      ref={marker}
      className={`tab-indicator tab-indicator-${variant}`}
      aria-hidden="true"
      data-active-key={activeKey}
      data-animate={placement?.animate ? "true" : "false"}
      style={
        placement
          ? {
              transform: `translate3d(${placement.x}px, ${placement.y}px, 0)`,
              width: placement.width,
              height: placement.height,
            }
          : { visibility: "hidden" }
      }
    />
  );
}
