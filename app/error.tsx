"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>Unable to open this view</h1>
      <p>Your previously saved reports remain in the data store.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
