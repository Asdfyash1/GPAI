const en = {
  common: {
    appName: "Forge",
    tagline: "STEM Copilot",
    send: "Send",
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    delete: "Delete",
    loading: "Loading…",
    error: "Something went wrong",
    retry: "Retry",
    signIn: "Sign in",
    signOut: "Sign out",
    settings: "Settings",
    newTask: "New task",
    search: "Search",
  },
  modes: {
    solver: "AI Solver",
    chat: "AI Chat",
    visualizer: "AI Visualizer",
    cheatsheet: "AI Cheatsheet Builder",
    report: "AI Report Writer",
    "pdf-notes": "AI PDF Notes",
    notebook: "AI Notebook",
  },
  solver: {
    placeholder: "Ask any STEM question…",
    crossCheck: "Cross-check",
    deepExplain: "Deep explain",
    thinking: "Thinking…",
    regenerate: "Regenerate",
    share: "Share",
    jumpToVisualizer: "Visualize",
  },
  chat: {
    placeholder: "Type a message…",
    newChat: "New chat",
    webSearch: "Web search",
    share: "Share",
  },
  landing: {
    heroTitle: "Your AI-Powered STEM Study Partner",
    heroSubtitle:
      "Step-by-step solutions, visual explanations, and interactive tools — all in one workspace.",
    getStarted: "Get started — it's free",
    signInLink: "Sign in",
    features: "Features",
    howItWorks: "How it works",
    whyForge: "Why Forge",
  },
  auth: {
    emailPlaceholder: "you@example.com",
    sendCode: "Send code",
    verifyCode: "Verify code",
    otpPlaceholder: "Enter 6-digit code",
    backToHome: "Back to home",
  },
  settings: {
    theme: "Theme",
    dark: "Dark",
    light: "Light",
  },
} as const;

export type TranslationKeys = typeof en;
export default en;
