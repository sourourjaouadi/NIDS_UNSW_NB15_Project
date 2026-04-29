import { ChatMessage } from "../types/nids";

export const starterConversation: ChatMessage[] = [
  {
    id: "assistant-welcome-1",
    role: "assistant",
    content:
      "Select a flow and ask what triggered the prediction. I can summarize feature signals and suggest next investigation steps."
  }
];
