"use client";

import { useCallback, useEffect, useState } from "react";

export type ReviewCard = {
  id: string;
  question: string;
  answer: string;
  nextReview: string;
  interval: number;
  ease: number;
  reps: number;
};

const SR_KEY = "eduforge:review-queue";

function loadCards(): ReviewCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SR_KEY);
    if (raw) return JSON.parse(raw) as ReviewCard[];
  } catch { /* ignore */ }
  return [];
}

export function useSpacedRepetition() {
  const [cards, setCards] = useState<ReviewCard[]>(loadCards);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SR_KEY, JSON.stringify(cards.slice(0, 200)));
    } catch { /* quota */ }
  }, [cards]);

  const addCard = useCallback((question: string, answer: string) => {
    setCards((prev) => {
      if (prev.some((c) => c.question === question)) return prev;
      const card: ReviewCard = {
        id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        question,
        answer,
        nextReview: new Date().toISOString(),
        interval: 1,
        ease: 2.5,
        reps: 0,
      };
      return [...prev, card];
    });
  }, []);

  const reviewCard = useCallback((id: string, quality: number) => {
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        let { interval, ease, reps } = c;
        if (quality >= 3) {
          if (reps === 0) interval = 1;
          else if (reps === 1) interval = 6;
          else interval = Math.round(interval * ease);
          reps++;
        } else {
          reps = 0;
          interval = 1;
        }
        ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        const next = new Date();
        next.setDate(next.getDate() + interval);
        return { ...c, interval, ease, reps, nextReview: next.toISOString() };
      }),
    );
  }, []);

  const dueCards = cards.filter((c) => new Date(c.nextReview) <= new Date());

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  return { cards, dueCards, addCard, reviewCard, removeCard };
}
