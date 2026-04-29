import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageSquare, Send, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { starterConversation } from "../data/mockData";
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

const buildReply = (prompt: string, flow: FlowRecord) => {
  const normalized = prompt.toLowerCase();
  const topFeature = flow.shapFeatures[0];
  const secondFeature = flow.shapFeatures[1];
  const hasShap = flow.shapFeatures.length > 0;

  if (normalized.includes("why") || normalized.includes("flag")) {
    if (!hasShap) {
      return `${flow.id} was marked ${flow.prediction.toLowerCase()} based on the model risk score and extracted traffic profile. Detailed feature drivers are not available for this flow yet.`;
    }
    return `${flow.id} was marked ${flow.prediction.toLowerCase()} because ${topFeature.plainEnglish} ${
      secondFeature ? secondFeature.plainEnglish : ""
    }`.trim();
  }

  if (normalized.includes("shap") || normalized.includes("feature")) {
    if (!hasShap) {
      return `Detailed SHAP feature drivers are not available for ${flow.id} yet. The model still used extracted protocol, timing, and traffic-volume signals to compute the prediction.`;
    }
    return `The strongest model signals for ${flow.id} are ${flow.shapFeatures
      .slice(0, 3)
      .map((feature) => `${feature.name} (${feature.rawValue})`)
      .join(", ")}. In plain language, the model is reacting to traffic shape, timing, and byte patterns that deviate from the baseline.`;
  }

  if (normalized.includes("investigate") || normalized.includes("next") || normalized.includes("suggest")) {
    return flow.recommendations.join(" ");
  }

  if (flow.prediction === "Benign") {
    return `${flow.id} looks benign with ${flow.confidence.toFixed(
      1
    )}% confidence. The traffic matches expected timing, TTL, and size patterns for routine network behavior.`;
  }

  return `${flow.id} is associated with ${flow.attackFamily}. The short version is: ${flow.summary}`;
};

export const Chatbot = ({ flows, selectedFlow }: ChatbotProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(starterConversation);
  const [input, setInput] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const contextFlow = useMemo(
    () => selectedFlow ?? flows.find((flow) => flow.prediction !== "Benign") ?? flows[0],
    [flows, selectedFlow]
  );

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const submitPrompt = (prompt: string) => {
    if (!prompt.trim() || !contextFlow) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      content: buildReply(prompt, contextFlow)
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitPrompt(input);
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
            className="fixed bottom-24 right-4 z-50 flex h-[560px] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1320]/95 shadow-soft backdrop-blur-xl"
          >
            <div className="flex items-start justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-2.5">
                  <Bot className="h-5 w-5 text-cyan-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Flow Explainer</p>
                  <p className="text-xs text-slate-400">
                    Context: {contextFlow?.id} | {contextFlow?.prediction}
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
                    onClick={() => submitPrompt(prompt)}
                    className="rounded-full border border-white/8 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-200"
                  >
                    {prompt}
                  </button>
                ))}
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
                  {message.content}
                </div>
              ))}
              <div ref={scrollAnchorRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-white/8 p-4">
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-3 py-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about the selected flow"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="rounded-full bg-cyan-400 p-2 text-slate-950 transition hover:bg-cyan-300"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
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
