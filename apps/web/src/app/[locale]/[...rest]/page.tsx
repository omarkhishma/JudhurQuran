import { notFound } from "next/navigation";

// Any path inside a locale that no route matches is a real 404 (rendered by [locale]/not-found), never a
// redirect: a redirect hides the mistake from the reader and turns broken links into soft-404s for search.
export default function CatchAll() {
  notFound();
}
