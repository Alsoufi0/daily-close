import { redirect } from "next/navigation";

// The console nav links point at /console; send that to the default section so
// the bare path doesn't 404. Auth + chrome come from app/console/layout.tsx.
export default function ConsoleIndex() {
  redirect("/console/partners");
}
