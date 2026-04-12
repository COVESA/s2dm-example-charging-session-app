import { Suspense } from "react";
import { SessionActivityScreen } from "./_components/SessionActivityScreen";

export default function SessionActivityPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SessionActivityScreen />
    </Suspense>
  );
}
