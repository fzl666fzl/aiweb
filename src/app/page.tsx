import { HomeContent } from "@/components/HomeContent";
import { HomeGate } from "@/components/HomeGate";
import { SessionProvider } from "@/components/SessionProvider";

export default function Home() {
  return (
    <SessionProvider>
      <HomeGate>
        <HomeContent />
      </HomeGate>
    </SessionProvider>
  );
}
