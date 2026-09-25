// AI Provider abstraction per §22 — provider-agnostic, task-based model routing
// Phase 4: mock fallback when AI_API_KEY absent (template-based, no hallucination risk)

export type AIModel = 'openai' | 'gemini' | 'groq' | 'mock';
export type AITask = 'job_parse' | 'resume_tailor' | 'cover_letter' | 'qa_check';

export type AIRequest = {
  task: AITask;
  prompt: string;
  systemPrompt?: string;
  jsonSchema?: unknown;
  maxTokens?: number;
};
export type AIResponse = {
  provider: AIModel;
  model: string;
  content: string;
  json?: unknown;
  usage?: { input: number; output: number };
};

export interface AIProvider {
  name: AIModel;
  isConfigured(): boolean;
  complete(req: AIRequest): Promise<AIResponse>;
}

// Mock provider — deterministic template, never invents skills
export const mockProvider: AIProvider = {
  name: 'mock',
  isConfigured() { return true; },
  async complete(req: AIRequest): Promise<AIResponse> {
    // Cheap deterministic logic per AGENTS.md §24 token-saving
    if (req.task === 'resume_tailor') {
      return { provider: 'mock', model: 'mock-template-v1', content: `TAILORED_RESUME_JSON:${req.prompt.slice(0,120)}` };
    }
    if (req.task === 'cover_letter') {
      return { provider: 'mock', model: 'mock-template-v1', content: `COVER_LETTER_DRAFT:${req.prompt.slice(0,120)}` };
    }
    return { provider: 'mock', model: 'mock-template-v1', content: req.prompt.slice(0,500) };
  },
};

export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? 'mock') as AIModel;
  const hasKey = !!process.env.AI_API_KEY;
  if (!hasKey) return mockProvider;
  // Phase 4: real providers stubbed — return mock until keys wired
  // OpenAI/Gemini/Groq adapters can be added here when AI_API_KEY set
  return mockProvider;
}

export async function aiComplete(task: AITask, prompt: string, systemPrompt?: string): Promise<AIResponse> {
  const provider = getAIProvider();
  return provider.complete({ task, prompt, systemPrompt });
}
