import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "bg-surface text-fg shadow-[var(--shadow-border)] border-0",
          title: "text-fg",
          description: "text-fg-muted",
        },
      }}
    />
  );
}
