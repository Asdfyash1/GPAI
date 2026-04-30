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

    stream.start(
      "/api/chat",
      {
        messages: next.map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments,
        })),
        modelChoice,
        deepExplain,
        webEnabled,
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
          onMessagesChange([
            ...next,
            {
              id: `e_${Date.now()}`,
              role: "assistant",
              content: `Error: ${msg}`,
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

function AssistantBlock({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <div className="chat-row chat-row-assistant">
      <div className="assistant-content">
        <MathMarkdown content={content} />
        {streaming && <span className="streaming-cursor" aria-hidden />}
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
