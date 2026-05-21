import { ChatApp } from "@/components/ChatApp";

export default function CelebritiesPage() {
  return (
    <ChatApp
      appId="celebrities"
      title="和名人对话"
      subtitle="用一个公开资料整理出的思维视角，帮你拆解问题。"
      statusLabel="顾问模式"
    />
  );
}
