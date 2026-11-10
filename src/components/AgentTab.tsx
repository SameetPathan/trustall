"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionLog } from "./OwnerDashboard";
import { postJson } from "@/lib/client-image";

interface Proposal {
  id: string;
  tool: string;
  summary: string;
  state: "open" | "working" | "done" | "failed" | "cancelled";
  message?: string;
  debugId?: string | null;
}
type Entry =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "proposal"; proposal: Proposal }
  | { kind: "error"; text: string };

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

const EXAMPLES = [
  "How much did I make today, and what sold best?",
  "Refund the last honey sale.",
  "Send Riverside Cafe an invoice for 5 dozen eggs.",
];

const TOOL_LABEL: Record<string, string> = {
  create_refund: "Refund through PayPal",
  "create_invoice+send_invoice": "Create and send a PayPal invoice",
};

export default function AgentTab(props: { actions: ActionLog[]; onChanged: () => Promise<void> | void; aiReady: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [entries, busy]);

  async function send(message: string) {
    const content = message.trim();
    if (!content || busy) return;
    setText("");
    setBusy(true);
    const nextHistory: ApiMessage[] = [...history, { role: "user", content }];
    setEntries((e) => [...e, { kind: "user", text: content }]);
    const res = await postJson<{ reply: string; actions: { id: string; tool: string; summary: string }[] }>("/api/agent", {
      messages: nextHistory.slice(-30),
    });
    setBusy(false);
    if (!res.ok) {
      setEntries((e) => [...e, { kind: "error", text: res.data.error ?? "The assistant did not answer. Try again." }]);
      return;
    }
    const proposalNotes = res.data.actions.map((a) => `[Proposed action ${a.id}, waiting for the owner: ${a.summary}]`).join("\n");
    setHistory([...nextHistory, { role: "assistant", content: [res.data.reply, proposalNotes].filter(Boolean).join("\n") }]);
    setEntries((e) => [
      ...e,
      { kind: "assistant", text: res.data.reply },
      ...res.data.actions.map((a) => ({ kind: "proposal" as const, proposal: { ...a, state: "open" as const } })),
    ]);
  }

  function patch(id: string, change: Partial<Proposal>) {
    setEntries((es) => es.map((e) => (e.kind === "proposal" && e.proposal.id === id ? { ...e, proposal: { ...e.proposal, ...change } } : e)));
  }

  async function decide(p: Proposal, decision: "confirm" | "cancel") {
    patch(p.id, { state: "working" });
    const res = await postJson<{ status: string; message: string; paypalDebugId: string | null }>("/api/agent/confirm", {
      actionId: p.id,
      decision,
    });
    const message = res.data.message ?? res.data.error ?? "The action failed.";
    const state: Proposal["state"] = !res.ok ? "failed" : res.data.status === "DONE" ? "done" : res.data.status === "CANCELLED" ? "cancelled" : "failed";
    patch(p.id, { state, message, debugId: res.data.paypalDebugId });
    // Tell the assistant what really happened, so it never has to guess.
    setHistory((h) => [
      ...h,
      { role: "user", content: `[System note, not typed by the owner: action ${p.id} (${p.summary}) is now ${state.toUpperCase()}. ${message}]` },
      { role: "assistant", content: "Noted." },
    ]);
    await props.onChanged();
  }

  return (
    <div>
      <p className="text-moss">
        Ask about your takings, or ask for a refund or an invoice. Nothing is sent to PayPal until you press Confirm on its card.
      </p>

      {!props.aiReady && (
        <p className="mt-3 card-alert p-3 text-sm">
          The assistant is off on this server: <code>AI_API_KEY</code> and <code>AI_MODEL</code> are not set.
        </p>
      )}

      <div className="mt-4 space-y-3" aria-live="polite">
        {entries.length === 0 && (
          <div className="card-empty p-5">
            <p className="font-bold">Try one of these</p>
            <ul className="mt-2 space-y-2">
              {EXAMPLES.map((ex) => (
                <li key={ex}>
                  <button className="btn-plain w-full !justify-start text-left" onClick={() => void send(ex)} disabled={busy || !props.aiReady}>
                    {ex}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entries.map((e, i) => {
          if (e.kind === "user")
            return (
              <p key={i} className="rise ml-10 rounded-3xl rounded-br-lg bg-board px-4 py-3 text-chalk">
                <span className="sr-only">You: </span>
                {e.text}
              </p>
            );
          if (e.kind === "assistant")
            return (
              <p key={i} className="card rise mr-10 whitespace-pre-wrap !rounded-3xl !rounded-bl-lg px-4 py-3">
                <span className="sr-only">Assistant: </span>
                {e.text}
              </p>
            );
          if (e.kind === "error")
            return (
              <p key={i} className="card-alert p-3 font-bold text-beet" role="alert">
                {e.text}
              </p>
            );
          const p = e.proposal;
          return (
            <div key={i} className="card-note rise p-5">
              <p className="text-sm font-bold text-moss">{TOOL_LABEL[p.tool] ?? p.tool}</p>
              <p className="mt-1 text-lg font-bold">{p.summary}</p>
              {p.state === "open" && (
                <>
                  <p className="mt-1 text-sm">Nothing has happened yet.</p>
                  <div className="mt-3 flex gap-3">
                    <button className="btn-sign flex-1" onClick={() => void decide(p, "confirm")}>
                      Confirm
                    </button>
                    <button className="btn-plain flex-1" onClick={() => void decide(p, "cancel")}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {p.state === "working" && <p className="mt-2 font-bold">Talking to PayPal…</p>}
              {p.state !== "open" && p.state !== "working" && (
                <p className={`mt-2 font-bold ${p.state === "done" ? "text-leaf" : p.state === "failed" ? "text-beet" : ""}`} role="status">
                  {p.message}
                </p>
              )}
              {p.debugId && <p className="mt-1 text-sm text-moss">PayPal debug id: {p.debugId}</p>}
            </div>
          );
        })}
        {busy && (
          <p className="card dots mr-10 inline-block !rounded-3xl !rounded-bl-lg px-5 py-4 text-moss" role="status" aria-label="The assistant is working">
            <i />
            <i />
            <i />
          </p>
        )}
        <div ref={end} />
      </div>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <label htmlFor="agent-text" className="sr-only">
          Message to the assistant
        </label>
        <input
          id="agent-text"
          className="field"
          placeholder="Refund the last honey sale"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-sign shrink-0" disabled={busy || !text.trim() || !props.aiReady}>
          Send
        </button>
      </form>

      {props.actions.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl">Action log</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {props.actions.map((a) => (
              <li key={a.id} className="py-2">
                <p>
                  <span className="font-bold">{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</span>: {a.summary}
                </p>
                <p className="text-moss">
                  {new Date(a.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {a.message ? `. ${a.message}` : ""}
                  {a.paypalDebugId ? ` PayPal debug id: ${a.paypalDebugId}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
