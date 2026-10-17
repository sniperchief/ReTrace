"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Messages } from "./messages/en";

const MessagesContext = createContext<Messages | null>(null);

export function MessagesProvider({ messages, children }: { messages: Messages; children: ReactNode }) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>;
}

/** UI strings for client components, provided once by the root layout. */
export function useMessages(): Messages {
  const messages = useContext(MessagesContext);
  if (!messages) throw new Error("useMessages must be used inside <MessagesProvider>");
  return messages;
}
