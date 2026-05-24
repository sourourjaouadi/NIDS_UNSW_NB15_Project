import { AnimatePresence, motion } from "framer-motion";
import { Bot, ClipboardCopy, MessageSquare, Send, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { streamFlowChat } from "../api/csv";
import { ChatMessage, FlowRecord } from "../types/nids";

interface ChatbotProps {
  flows: FlowRecord[];
  selectedFlow: FlowRecord | null;
}

const quickPrompts = [
  "Why was this flow flagged?",
  "Explain the feature drivers simply",
  "What should I investigate next?"
];

const initialMessage: ChatMessage = {
  id: "assistant-initial",
  role: "assistant",
  content: "I've analyzed this alert. Ask me anything about it, or I can write a report paragraph."
};

const reportPrompt =
  "Write a formal 3-sentence paragraph suitable for a security incident report describing this alert, the evidence, and the recommended action.";

export const Chatbot = ({ flows, selectedFlow }: ChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const contextFlow = useMemo(
    () => selectedFlow ?? flows.find((flow) => flow.prediction === "Attack") ?? flows[0],
    [flows, selectedFlow]
  );

  useEffect(() => {
    setMessages([initialMessage]);
  }, [contextFlow?.backendFlowId, contextFlow?.sessionId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const submitPrompt = async (prompt: string, copyWhenDone = false) => {
    const text = prompt.trim();
    if (!text || isStreaming) return;

    if (!contextFlow || !contextFlow.sessionId || !contextFlow.backendFlowId) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content:
            "Chat is not available because the selected flow does not have backend session metadata. Upload the CSV again, then select the flow and ask me about it."
        }
      ]);
      return;
    }

    const history = messages
      .filter((message) => message.id !== initialMessage.id)
      .map(({ role, content }) => ({ role, content }));

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text
    };
    const assistantId = `assistant-${Date.now() + 1}`;

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "" }
    ]);
    setInput("");
    setIsStreaming(true);

    try {
      const responseText = await streamFlowChat(
        contextFlow.sessionId,
        contextFlow.backendFlowId,
        text,
        history,
        (delta) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: `${message.content}${delta}` }
                : message
            )
          );
        }
      );

      if (copyWhenDone && responseText) {
        await navigator.clipboard.writeText(responseText);
      }
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content:
                  error instanceof Error
                    ? `Chat request failed: ${error.message}`
                    : "Chat request failed."
              }
            : message
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitPrompt(input);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-24 right-4 z-50 flex h-[560px] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1320]/95 shadow-soft backdrop-blur-xl"
          >
            <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5">
                  <Bot className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">SOC XAI Chatbot</p>
                  <p className="text-xs text-slate-400">
                    Context: {contextFlow?.id ?? "No flow selected"} | {contextFlow?.prediction ?? "No data"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void submitPrompt(prompt)}
                    disabled={isStreaming || !contextFlow?.sessionId || !contextFlow?.backendFlowId}
                    className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void submitPrompt(reportPrompt, true)}
                  disabled={isStreaming || !contextFlow?.sessionId || !contextFlow?.backendFlowId}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copy as Report
                </button>
              </div>

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-7 ${
                    message.role === "assistant"
                      ? "bg-white/5 text-slate-200"
                      : "ml-auto bg-cyan-400 text-slate-950"
                  }`}
                >
                  {message.content || (isStreaming && message.role === "assistant" ? "..." : "")}
                </div>
              ))}
              <div ref={scrollAnchorRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-white/8 p-4">
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-3 py-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about this alert..."
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  disabled={isStreaming || !contextFlow?.sessionId || !contextFlow?.backendFlowId}
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim() || !contextFlow?.sessionId || !contextFlow?.backendFlowId}
                  className="rounded-full bg-cyan-400 p-2 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {!contextFlow?.sessionId || !contextFlow?.backendFlowId ? (
                <p className="mt-2 text-xs text-slate-500">
                  Chat is unavailable until a flow with backend session metadata is selected.
                </p>
              ) : null}
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen((value) => !value)}
        className="fixed bottom-6 right-4 z-50 inline-flex items-center gap-3 rounded-full border border-cyan-400/20 bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-soft"
      >
        {isOpen ? <X className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        Ask Flow Bot
      </motion.button>
    </>
  );
};
