// Requests outside any locale segment fall through to the Arabic 404.
import { redirect } from "next/navigation";

export default function RootNotFound() {
  redirect("/");
}
