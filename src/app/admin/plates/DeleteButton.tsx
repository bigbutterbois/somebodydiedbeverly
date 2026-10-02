"use client";

// Deletes after a confirm, so a stray tap on a phone can't lose a sighting.
export function DeleteButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this sighting?")) e.preventDefault();
      }}
    >
      <button type="submit" className="text-sm text-danger underline">
        Delete sighting
      </button>
    </form>
  );
}
