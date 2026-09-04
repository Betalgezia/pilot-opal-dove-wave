import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/relay/dashboard";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Dashboard />;
}
