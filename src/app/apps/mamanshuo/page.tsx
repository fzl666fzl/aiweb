import { ChatApp } from "@/components/ChatApp";
import { SessionProvider } from "@/components/SessionProvider";

export default function MamanShuoPage() {
  return (
    <SessionProvider>
      <ChatApp />
    </SessionProvider>
  );
}
