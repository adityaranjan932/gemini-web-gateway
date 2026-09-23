export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  finishReason: "stop" | "length";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
