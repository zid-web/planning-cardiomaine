import { redirect } from "next/navigation";

/**
 * Legacy route from PR #25.
 * Canonical admin page lives at /protected/admin/requests (PR #27).
 * Keep this thin redirect so old links never 404 and so the path is
 * explicitly owned (avoids resurrecting the full page from stale branches).
 */
export default function LegacyChangeRequestsRedirect() {
  redirect("/protected/admin/requests");
}
