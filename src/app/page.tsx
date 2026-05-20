"use client";

import { useState } from "react";
import { ChatApp } from "@/components/ChatApp";
import { PasswordGate } from "@/components/PasswordGate";

export default function Home() {
  const [authed, setAuthed] = useState(false);

  return authed ? <ChatApp /> : <PasswordGate onAuthed={() => setAuthed(true)} />;
}
