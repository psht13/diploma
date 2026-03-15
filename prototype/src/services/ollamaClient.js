import { DEFAULT_MODEL, MAX_JSON_RETRIES, OLLAMA_BASE_URL } from "../core/constants.js";
import { formatValidationErrors } from "../core/contracts.js";
import { extractJsonBlock } from "../core/json.js";

async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class OllamaClient {
  constructor({ baseUrl = OLLAMA_BASE_URL, model = DEFAULT_MODEL } = {}) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  setModel(model) {
    this.model = model || DEFAULT_MODEL;
  }

  async getStatus() {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/tags`, {}, 1500);

      if (!response.ok) {
        return { available: false, message: `HTTP ${response.status}` };
      }

      const data = await response.json();
      const modelNames = Array.isArray(data.models) ? data.models.map((item) => item.name) : [];
      const hasTargetModel = modelNames.some((name) => name.startsWith(this.model));
      const message = hasTargetModel
        ? `Підключено до Ollama, модель ${this.model} доступна`
        : `Ollama доступна, але модель ${this.model} не знайдена локально`;

      return { available: true, hasTargetModel, message, modelNames };
    } catch (error) {
      return { available: false, message: "Ollama недоступна, буде використано fallback" };
    }
  }

  async generateJson({
    prompt,
    fallback,
    validate,
    maxRetries = MAX_JSON_RETRIES,
    temperature = 0.2
  }) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetchWithTimeout(
          `${this.baseUrl}/api/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: this.model,
              prompt,
              stream: false,
              format: "json",
              options: {
                temperature
              }
            })
          },
          12000
        );

        if (!response.ok) {
          throw new Error(`Ollama returned HTTP ${response.status}`);
        }

        const payload = await response.json();
        const parsed = extractJsonBlock(payload.response);

        if (!parsed) {
          throw new Error("Model response does not contain valid JSON");
        }

        if (validate) {
          const validation = validate(parsed);

          if (!validation.ok) {
            throw new Error(`Schema mismatch: ${formatValidationErrors(validation)}`);
          }
        }

        return {
          data: parsed,
          meta: {
            source: "ollama",
            attempts: attempt + 1
          }
        };
      } catch (error) {
        lastError = error;
      }
    }

    return {
      data: typeof fallback === "function" ? fallback() : fallback,
      meta: {
        source: "fallback",
        reason: lastError?.message || "unknown"
      }
    };
  }
}
