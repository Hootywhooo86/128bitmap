import { useEffect, useRef } from "react";
import { onFrame } from "../pixel/anim";
import { CAR_H, CAR_W } from "../pixel/cars";
import { frameUrl } from "../pixel/frames";

type Props = {
  kind: "building" | "car";
  id: string;
  scale?: number;
  animated?: boolean;
  className?: string;
};

// A pixel sprite drawn as a crisp <img>. Animated ones swap frames from the shared clock.
export function SpriteImg({ kind, id, scale = 2, animated = true, className }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const w = kind === "building" ? 24 : CAR_W;
  const h = kind === "building" ? 24 : CAR_H;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.src = frameUrl(kind, id, 0);
    if (!animated) return;
    return onFrame((frame) => {
      el.src = frameUrl(kind, id, frame);
    }, kind === "car" ? 2 : 3);
  }, [kind, id, animated]);

  return (
    <img
      ref={ref}
      className={`sprite ${className ?? ""}`}
      src={frameUrl(kind, id, 0)}
      width={w * scale}
      height={h * scale}
      alt=""
      draggable={false}
    />
  );
}
