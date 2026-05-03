import { AuthGuard } from "@/components/AuthGuard";
import { EducationApp } from "@/components/EducationApp";

export default function AppPage() {
  return (
    <AuthGuard>
      <EducationApp />
    </AuthGuard>
  );
}
