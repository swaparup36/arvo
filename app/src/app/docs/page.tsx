import { redirect } from "next/navigation";

// first entry of docsNav; it lives in a "use client" module, so it cannot be
// imported here
export default function DocsIndexPage() {
  redirect("/docs/how-it-works");
}
