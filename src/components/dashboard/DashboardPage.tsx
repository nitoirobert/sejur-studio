import { Suspense } from "react";
import { requireViewer } from "@/lib/supabase/dal";
import { PageHeader } from "./PageHeader";

// Every /dashboard page: header + content that renders only after the user is verified on the server.
export function DashboardPage({
  title,
  subtitle,
  fallback,
  children,
  ownHeader = false,
}: {
  title: string;
  subtitle: string;
  fallback: React.ReactNode;
  children: React.ReactNode;
  /** The page renders PageHeader itself (inside its content, e.g. next to the KPI cards). */
  ownHeader?: boolean;
}) {
  return (
    <div className="px-4 pt-4 pb-10 md:px-6 md:pt-6 xl:pt-8">
      {!ownHeader && <PageHeader title={title} subtitle={subtitle} />}
      <div className={ownHeader ? undefined : "mt-7 md:mt-9"}>
        <Suspense fallback={fallback}>
          <Verified>{children}</Verified>
        </Suspense>
      </div>
    </div>
  );
}

async function Verified({ children }: { children: React.ReactNode }) {
  await requireViewer();
  return children;
}
