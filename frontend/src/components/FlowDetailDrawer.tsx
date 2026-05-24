import { AnimatePresence, motion } from "framer-motion";
import { Copy, Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FlowRecord } from "../types/nids";
import { buildExplanation, formatBytes, formatDuration, formatTime, predictionStyles } from "../utils/format";

interface FlowDetailDrawerProps {
  flow: FlowRecord | null;
  onClose: () => void;
  onCopy: (message: string) => void;
}

interface DrawerChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  isStreaming?: boolean;
}

const REPORT_PROMPT =
  "Write a formal 3-sentence paragraph suitable for a security incident report describing this alert, the evidence, and the recommended action.";

export const FlowDetailDrawer = ({ flow, onClose, onCopy }: FlowDetailDrawerProps) => {
  const explanation = flow ? buildExplanation(flow) : "";
  const [chatMessages, setChatMessages] = useState<DrawerChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "assistant" | "user"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const chatThreadRef = useRef<HTMLDivElement | null>(null);

  const handleCopy = async () => {
    if (!flow) return;

    try {
      await navigator.clipboard.writeText(explanation);
      onCopy(`Explanation copied for ${flow.id}.`);
    } catch {
      onCopy(`Clipboard access failed for ${flow.id}.`);
    }
  };

  function openChat(sessionId?: string, flowId?: string) {
    void sessionId;
    void flowId;
    setChatInput("");
    setChatHistory([]);
    setChatMessages([
      {
        id: `assistant-initial-${Date.now()}`,
        role: "assistant",
        content: "I've analyzed this alert. Ask me anything about it, or I can write a report paragraph."
      }
    ]);
  }

  async function sendChatMessage(sessionId?: string, flowId?: string, forcedMessage?: string, copyResponse = false) {
    const userText = (forcedMessage ?? chatInput).trim();
    if (!userText) return;

    setChatInput("");

    const historySnapshot = chatHistory;
    const userMessage: DrawerChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userText
    };
    const assistantId = `assistant-${Date.now() + 1}`;
    const assistantMessage: DrawerChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true
    };

    setChatMessages((current) => [...current, userMessage, assistantMessage]);

    if (!sessionId || !flowId) {
      const message = "Chat context is unavailable for this flow because the backend session or flow ID is missing.";
      setChatMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: message, isStreaming: false } : item))
      );
      return;
    }

    let assistantText = "";

    try {
      const response = await fetch("/api/chat/" + sessionId + "/" + flowId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history: historySnapshot })
      });

      if (!response.ok || !response.body) {
        throw new Error("The chat endpoint did not return a readable stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        buffer += decoder.decode(result.value ?? new Uint8Array(), { stream: !done });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const lines = event.split("\n").filter((line) => line.startsWith("data:"));
          for (const line of lines) {
            const data = line.slice(5).trim();
            if (!data) continue;

            const payload = JSON.parse(data) as { text?: string; delta?: string; error?: string; done?: boolean };
            if (payload.error) {
              throw new Error(payload.error);
            }
            if (payload.done) {
              done = true;
              break;
            }

            const delta = payload.text ?? payload.delta ?? "";
            if (!delta) continue;

            assistantText += delta;
            setChatMessages((current) =>
              current.map((item) => (item.id === assistantId ? { ...item, content: assistantText } : item))
            );
          }
        }
      }

      setChatMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: assistantText, isStreaming: false } : item))
      );
      setChatHistory([...historySnapshot, { role: "user", content: userText }, { role: "assistant", content: assistantText }]);

      if (copyResponse && assistantText) {
        await navigator.clipboard.writeText(assistantText);
        onCopy("Report paragraph copied to clipboard.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat request failed.";
      setChatMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, content: message, isStreaming: false } : item))
      );
    }
  }

  useEffect(() => {
    if (!flow) return;
    openChat(flow.sessionId, flow.backendFlowId ?? flow.id);
  }, [flow?.id]);

  useEffect(() => {
    chatThreadRef.current?.scrollTo({ top: chatThreadRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  return (
    <AnimatePresence>
      {flow && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-white/10 bg-[#0A1220]/98 p-6 shadow-soft"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-300">Flow Detail</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{flow.id}</h2>
                <p className="mt-2 text-sm text-slate-400">{flow.attackFamily}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${predictionStyles[flow.prediction].badge}`}>
                {flow.prediction}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                {flow.confidence.toFixed(1)}% confidence
              </span>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/8 bg-white/5 p-5">
              <p className="text-sm leading-7 text-slate-300">{flow.summary}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-slate-500">Source</p>
                <p className="mt-2 font-semibold text-white">{flow.sourceIp}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-slate-500">Destination</p>
                <p className="mt-2 font-semibold text-white">{flow.destIp}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-slate-500">Protocol</p>
                <p className="mt-2 font-semibold text-white">{flow.protocol}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-slate-500">Observed</p>
                <p className="mt-2 font-semibold text-white">{formatTime(flow.timestamp)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-slate-500">Bytes</p>
                <p className="mt-2 font-semibold text-white">{formatBytes(flow.bytes)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-slate-500">Duration</p>
                <p className="mt-2 font-semibold text-white">{formatDuration(flow.duration)}</p>
              </div>
            </div>

            <div className="mt-8 overflow-y-auto pr-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Top feature drivers</h3>
                  <p className="mt-1 text-sm text-slate-400">Hover the info icon to translate each driver into plain English.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-400/15"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy Explanation
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {flow.shapFeatures.map((feature, index) => (
                  <div key={feature.name} className="rounded-2xl border border-white/8 bg-[#0B1320]/80 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{feature.name}</p>
                        <div className="group relative">
                          <Info className="h-4 w-4 text-slate-500 transition group-hover:text-cyan-300" />
                          <div className="pointer-events-none absolute left-1/2 top-6 z-10 hidden w-60 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0B1320]/95 p-3 text-xs leading-6 text-slate-200 shadow-soft group-hover:block">
                            {feature.plainEnglish}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-cyan-200">{feature.rawValue}</span>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/6">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${feature.impact * 100}%` }}
                        transition={{ duration: 0.5, delay: index * 0.08 }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-cyan-200"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Influence on classification</span>
                      <span>{Math.round(feature.impact * 100)}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white">Alert chat</h3>
                <div
                  id="chat-thread"
                  ref={chatThreadRef}
                  className="mt-4"
                  style={{
                    background: "var(--surface2, rgba(15, 23, 42, 0.55))",
                    border: "1px solid var(--border, rgba(255, 255, 255, 0.1))",
                    borderRadius: "8px",
                    padding: "12px",
                    height: "280px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px"
                  }}
                >
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      style={{
                        alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                        background:
                          message.role === "user"
                            ? "var(--blue-dim, rgba(14, 165, 233, 0.22))"
                            : "var(--surface, rgba(15, 23, 42, 0.8))",
                        fontSize: "12px",
                        fontFamily: "var(--sans, Inter, sans-serif)",
                        maxWidth: "85%",
                        borderRadius: "8px",
                        padding: "8px 12px"
                      }}
                      className="leading-6 text-slate-100"
                    >
                      {message.content}
                      {message.isStreaming && <span className="animate-pulse">|</span>}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void sendChatMessage(flow.sessionId, flow.backendFlowId ?? flow.id, REPORT_PROMPT, true)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-400/15"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy as Report
                </button>

                <div className="mt-3 flex gap-2">
                  <input
                    id="chat-input"
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void sendChatMessage(flow.sessionId, flow.backendFlowId ?? flow.id);
                      }
                    }}
                    placeholder="Ask about this alert..."
                    style={{
                      fontFamily: "var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
                      fontSize: "12px",
                      width: "100%"
                    }}
                    className="rounded-lg border border-white/10 bg-[#0B1320]/80 px-3 py-2 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/45"
                  />
                  <button
                    id="chat-send"
                    type="button"
                    onClick={() => void sendChatMessage(flow.sessionId, flow.backendFlowId ?? flow.id)}
                    className="rounded-lg border border-cyan-400/20 bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    Send
                  </button>
                </div>
              </div>

              <div className="mt-8 rounded-[24px] border border-white/8 bg-white/5 p-5">
                <h3 className="text-lg font-semibold text-white">Recommended next actions</h3>
                <div className="mt-4 space-y-3">
                  {flow.recommendations.map((item) => (
                    <div key={item} className="rounded-2xl border border-white/8 bg-[#0B1320]/80 px-4 py-3 text-sm leading-6 text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
