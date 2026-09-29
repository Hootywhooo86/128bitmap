import { buildingFrameUrl } from "./buildings";
import { carFrameUrl } from "./cars";

export function frameUrl(kind: "building" | "car", id: string, frame: number) {
  return kind === "building" ? buildingFrameUrl(id, frame) : carFrameUrl(id, frame);
}
