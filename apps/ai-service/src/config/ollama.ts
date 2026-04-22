import { createLogger } from "@duckops/shared-utils";

const logger = createLogger("ai-config");

// Unified AI client that handles both Ollama (local) and OpenAI-compatible (cloud) protocols.
export const AI_CONFIG = {
  host: (process.env.OLLAMA_HOST || "http://localhost:11434").replace(/\/$/, ""),
  key: process.env.OLLAMA_API_KEY,
  codeModel: process.env.OLLAMA_CODE_MODEL || "qwen2.5-coder:7b",
  stackModel: process.env.OLLAMA_STACK_MODEL || "qwen2.5-coder:7b",
};

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

// Response shape for OpenAI-compatible (cloud) endpoints
interface CloudChatResponse {
  choices: Array<{
    message: { content: string };
    delta?: { content: string };
  }>;
}

// Response shape for Ollama (local) endpoints
interface OllamaChatResponse {
  message: { content: string };
  done?: boolean;
}

export async function chat(options: any): Promise<any> {
  const isCloud = AI_CONFIG.host.includes("api.") || 
                  AI_CONFIG.host.includes(".cn") || 
                  AI_CONFIG.host.includes("openai") ||
                  AI_CONFIG.host.includes("deepseek") ||
                  AI_CONFIG.host.includes("anthropic");

  const url = isCloud ? `${AI_CONFIG.host}/chat/completions` : `${AI_CONFIG.host}/api/chat`;

  // SiliconFlow and other OpenAI-clones often require sk- prefix
  let apiKey = AI_CONFIG.key;
  if (isCloud && apiKey && !apiKey.startsWith("sk-") && AI_CONFIG.host.includes("siliconflow")) {
    apiKey = `sk-${apiKey}`;
  }

  const temperature = options.temperature ?? options.options?.temperature ?? 0.2;
  const maxTokens = options.max_tokens ?? options.options?.num_predict ?? 4096;

  const body = isCloud ? {
    model: options.model,
    messages: options.messages,
    temperature,
    max_tokens: maxTokens,
    stream: options.stream ?? false,
  } : {
    model: options.model,
    messages: options.messages,
    stream: options.stream ?? false,
    options: {
      temperature,
      num_predict: maxTokens,
    }
  };

  if (apiKey) {
    const maskedKey = apiKey.length > 8 
      ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` 
      : "****";
    logger.info(`Using AI API key: ${maskedKey} for host: ${AI_CONFIG.host}`);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error(`AI API error (${response.status}): ${errorBody}`);
    
    // Check for common SiliconFlow/OpenAI-compatible errors
    if (response.status === 401) {
      if (errorBody.includes("Api key is invalid") || errorBody.includes("Invalid token")) {
        logger.error("AUTHENTICATION FAILED: Your OLLAMA_API_KEY might be invalid for the current host.");
        if (AI_CONFIG.host.includes("siliconflow") && AI_CONFIG.key?.includes(".")) {
          logger.error("TIP: Your key format looks like a DashScope (Aliyun) key, but you are hitting SiliconFlow. Ensure your key and host match.");
        }
      }
    }
    
    throw new Error(`AI API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  if (options.stream) {
    return (async function* () {
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (isCloud) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const data = JSON.parse(dataStr);
                const content = data.choices?.[0]?.delta?.content || "";
                if (content) yield { message: { content } };
              } catch { /* skip partial */ }
            }
          } else {
            try {
              const data = JSON.parse(line);
              const content = data.message?.content || "";
              if (content) yield { message: { content } };
              if (data.done) break;
            } catch { /* skip partial */ }
          }
        }
      }
    })();
  } else {
    if (isCloud) {
      const data = await response.json() as CloudChatResponse;
      return { message: { content: data.choices?.[0]?.message?.content || "" } };
    } else {
      const data = await response.json() as OllamaChatResponse;
      return data;
    }
  }
}

// Deprecated: existing code imports 'ollama' and 'CODE_MODEL'. 
// We provide a shim to avoid breaking changes.
export const ollama = {
  chat: (opts: any) => chat(opts)
} as any;

export const CODE_MODEL = AI_CONFIG.codeModel;
export const STACK_MODEL = AI_CONFIG.stackModel;
