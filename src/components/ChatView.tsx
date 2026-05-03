"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  ModelChoice,
  UploadedAsset,
} from "@/types/education";
import { Composer } from "@/components/Composer";
import { MathMarkdown } from "@/components/MathMarkdown";
import { useStream } from "@/hooks/useStream";
import { usePersonalization } from "@/hooks/usePersonalization";

type SourceItem = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

const SOURCES_RE = /<!-- SOURCES:([\s\S]*?):SOURCES -->/;

function extractSources(text: string): {
  content: string;
  sources: SourceItem[];
} {
  const m = text.match(SOURCES_RE);
  if (!m) return { content: text, sources: [] };
  const content = text.replace(SOURCES_RE, "").trimEnd();
  try {
    const sources = JSON.parse(m[1]) as SourceItem[];
    return { content, sources };
  } catch {
    return { content, sources: [] };
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type ChatViewProps = {
  modelChoice: ModelChoice;
  setModelChoice: (m: ModelChoice) => void;
  messages: ChatMessage[];
  onMessagesChange: (next: ChatMessage[]) => void;
};

const SAMPLE_PROMPTS = [
  "Explain the Pythagorean theorem",
  "What are eigenvalues used for?",
  "Compare RNA and DNA",
  "What is entropy in physics vs information theory?",
];

export function ChatView({
  modelChoice,
  setModelChoice,
  messages,
  onMessagesChange,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<UploadedAsset[]>([]);
  const [deepExplain, setDeepExplain] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [streamText, setStreamText] = useState("");
  const stream = useStream();
  const personalization = usePersonalization();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamText]);

  const send = (overrideText?: string) => {
    const content = (overrideText ?? input).trim();
    if (!content && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: new Date().toISOString(),
    };

    const next = [...messages, userMessage];
    onMessagesChange(next);
    setInput("");
    setAttachments([]);
    setStreamText("");

    // Strip raw `dataUrl` (base64) bytes from every attachment that
    // belongs to a previous turn. The server only re-analyzes the
    // attachments on the *last* user message (`lastUser.attachments`
    // in `src/app/api/chat/route.ts`); historical turns still need
    // their `extractedText`, `name`, etc. so the model has context,
    // but the multi-MB image dataUrls are pure body bloat there.
    //
    // Without this, a scanned-PDF upload that rasterizes to ~3 MB of
    // page JPEGs is duplicated into every subsequent chat turn —
    // first turn = 3 MB, second turn = 6 MB (>Vercel 4.5 MB cap),
    // every turn after that fails with FUNCTION_PAYLOAD_TOO_LARGE
    // until the user starts a new chat. Keeping bytes only on the
    // freshly-submitted message keeps the body bounded.
    const lastUserIdx = next.reduce(
      (acc, m, i) => (m.role === "user" ? i : acc),
      -1,
    );
    const wireMessages = next.map((m, i) => {
      const baseContent =
        m.role === "assistant" ? extractSources(m.content).content : m.content;
      if (!m.attachments || m.attachments.length === 0) {
        return { role: m.role, content: baseContent };
      }
      const isLastUser = i === lastUserIdx;
      const stripped = m.attachments.map((a) =>
        isLastUser
          ? a
          : {
              name: a.name,
              type: a.type,
              size: a.size,
              extractedText: a.extractedText,
            },
      );
      return { role: m.role, content: baseContent, attachments: stripped };
    });

    stream.start(
      "/api/chat",
      {
        messages: wireMessages,
        modelChoice,
        deepExplain,
        webEnabled,
        personalization: personalization.request,
      },
      {
        onChunk: (textSoFar) => setStreamText(textSoFar),
        onFinal: (finalText) => {
          onMessagesChange([
            ...next,
            {
              id: `a_${Date.now()}`,
              role: "assistant",
              content: finalText,
              createdAt: new Date().toISOString(),
            },
          ]);
          setStreamText("");
        },
        onError: (msg) => {
          const friendly =
            msg.includes("429") || msg.includes("rate")
              ? "The model is busy right now — please try again in a moment."
              : msg.includes("5") && msg.match(/\b5\d{2}\b/)
                ? "We couldn't reach the model — please try again."
                : `Something went wrong: ${msg}`;
          onMessagesChange([
            ...next,
            {
              id: `e_${Date.now()}`,
              role: "assistant",
              content: friendly,
              createdAt: new Date().toISOString(),
            },
          ]);
        },
      },
    );
  };

  const empty = messages.length === 0 && !stream.isStreaming;

  return (
    <div className={`chat-view ${empty ? "is-empty" : ""}`}>
      {empty ? (
        <header className="chat-hero">
          <h1 className="hero-title">
            <span>Search, ask, and</span>
            <br />
            <span>get deeper explanations</span>
          </h1>
        </header>
      ) : (
        <div className="chat-thread">
          {messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} message={m} />
            ) : (
              <AssistantBlock key={m.id} content={m.content} />
            ),
          )}
          {stream.isStreaming && streamText && (
            <AssistantBlock content={streamText} streaming />
          )}
          {stream.isStreaming && !streamText && <ThinkingDots />}
          <div ref={bottomRef} />
        </div>
      )}

      <div className={`chat-composer-wrap ${empty ? "is-hero" : ""}`}>
        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => send()}
          onStop={stream.stop}
          isStreaming={stream.isStreaming}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          modelChoice={modelChoice}
          onModelChange={setModelChoice}
          showDeepExplain
          deepExplain={deepExplain}
          onDeepExplainChange={setDeepExplain}
          showWeb
          webEnabled={webEnabled}
          onWebToggle={setWebEnabled}
          placeholder={empty ? "Type a message..." : "Ask follow-up question"}
          hint={
            empty ? "Add PDF, image, website or YouTube link as context." : undefined
          }
          compact={!empty}
          enterToSend
        />
        {empty && (
          <div className="chat-suggestions">
            {SAMPLE_PROMPTS.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                onClick={() => send(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="chat-row chat-row-user">
      <div className="chat-bubble chat-bubble-user">
        {message.attachments && message.attachments.length > 0 && (
          <div className="bubble-attachments">
            {message.attachments.map((a, i) =>
              a.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={a.preview} alt={a.name} className="bubble-thumb" />
              ) : (
                <span key={i} className="bubble-file">
                  {a.name}
                </span>
              ),
            )}
          </div>
        )}
        <MathMarkdown content={message.content} />
      </div>
    </div>
  );
}

function SourcesPills({ sources }: { sources: SourceItem[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="sources-pills">
      <span className="sources-label">Sources</span>
      {sources.map((s, i) => {
        const host = hostFromUrl(s.url);
        return (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-pill"
            title={s.title}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${host}&sz=32`}
              alt=""
              className="source-favicon"
              width={16}
              height={16}
            />
            <span className="source-host">{host}</span>
            <span className="source-index">[{i + 1}]</span>
          </a>
        );
      })}
    </div>
  );
}

function AssistantBlock({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const { content: visibleContent, sources } = extractSources(content);
  return (
    <div className="chat-row chat-row-assistant">
      <div className="assistant-content">
        <MathMarkdown content={visibleContent} />
        {streaming && <span className="streaming-cursor" aria-hidden />}
        {!streaming && <SourcesPills sources={sources} />}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="chat-row chat-row-assistant">
      <div className="thinking-dots">
        <span /> <span /> <span />
      </div>
    </div>
  );
}
