import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>Return to the situation room to continue.</p>
      <Link href="/dashboard" className="button primary">
        Open dashboard
      </Link>
    </div>
  );
}
