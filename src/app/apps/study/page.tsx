import { SessionProvider } from "@/components/SessionProvider";
import { StudyApp } from "@/components/StudyApp";

export default function StudyPage() {
  return (
    <SessionProvider>
      <StudyApp />
    </SessionProvider>
  );
}
