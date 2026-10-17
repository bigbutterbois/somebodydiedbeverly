import { permanentRedirect } from "next/navigation";

// The map moved to /metro; old links land there.
export default function OldMetroMap() {
  permanentRedirect("/metro");
}
