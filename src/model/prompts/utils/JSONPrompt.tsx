import { zodResponseFormat } from 'openai/helpers/zod';
import { Allow, parse } from "partial-json";
import { ZodObject, z } from "zod";
import { useStudyStore } from "../../../study/StudyModel";
import { openai } from "../../Model";
import { useAiConfigStore } from "../../../store/useAiConfigStore";
import { BasePrompt, ExecutablePrompt, PromptResult } from "./BasePrompt";


export class JSONPrompt<T> extends BasePrompt<PromptResult<T>> {
  prompt: ExecutablePrompt;
  schema: z.ZodType<T>;
  optionalSchema: ZodObject<any> | null;
  onPartialResponse: null | ((partialResult: PromptResult<T>) => void);

  constructor(prompt: ExecutablePrompt, schema: z.ZodType<T>) {
    super();
    this.prompt = prompt;
    this.schema = schema;
    this.optionalSchema = null;
    this.onPartialResponse = null;
  }

  getDefaultValue(field: z.ZodTypeAny): any {
    if (field instanceof z.ZodString) {
      return '';
    } else if (field instanceof z.ZodNumber) {
      return 0;
    } else if (field instanceof z.ZodBoolean) {
      return false;
    } else if (field instanceof z.ZodEnum) {
      // First enum option is the safe fallback during streaming (later overwritten by real value)
      const opts = (field as any).options || (field as any)._def?.values;
      return Array.isArray(opts) && opts.length > 0 ? opts[0] : null;
    } else {
      // Default fallback for other types (e.g., ZodUnion)
      return null;
    }
  }


  addMissingFields(partialResponse: any, schema: z.ZodType): any {
    const emptyObject = (schema as any as z.ZodObject<any>).shape;

    const filledData = Object.keys(emptyObject).reduce((acc, key) => {
      if (emptyObject[key] instanceof z.ZodObject) {
        acc[key] = this.addMissingFields(partialResponse[key] || {}, emptyObject[key]);
      } else if (emptyObject[key] instanceof z.ZodArray) {
        acc[key] = (partialResponse[key] || []).map((item: any) => this.addMissingFields(item, emptyObject[key].element));
      } else {
        acc[key] = Object.prototype.hasOwnProperty.call(partialResponse, key) ? partialResponse[key] : this.getDefaultValue(emptyObject[key]);
      }
      return acc;
    }, {} as Record<string, z.ZodTypeAny>);


    return filledData;
  }

  partialParse(response: string): T | null {
    try {
      // Partial parse
      const partialResponse = parse(response, ~Allow.STR);
      // Try adding missing values to the partial response using sensible defaults
      return this.schema.parse(this.addMissingFields(partialResponse, this.schema)); // Should add the missing fields
    } catch {
      // Do nothing if we could not parse the partial response
    }
    return null;
  }

  /**
   * Fast-path: OpenAI streaming with response_format. Yields partial parses
   * through `onPartialResponse` so UI (entity / location extractors) can
   * render rows as they arrive. Used when the active provider is OpenAI
   * and the user has not opted into the fallback chain.
   */
  private async executeOpenAIStreaming(): Promise<PromptResult<T>> {
    useStudyStore.getState().logEvent("PROMPT_TO_EXECUTE", { prompt: this.prompt.prompt });
    const stream = await openai.chat.completions.create({
      model: this.prompt.model || "gpt-4o-2024-08-06",
      messages: [{ role: 'user', content: this.prompt.prompt }],
      stream: true,
      temperature: 0,
      response_format: zodResponseFormat(this.schema, "response"),
    });

    let response = '';
    for await (const chunk of stream) {
      response += chunk.choices[0]?.delta?.content || '';
      if (this.onPartialResponse) {
        const partialResult = this.partialParse(response);
        if (partialResult) {
          this.onPartialResponse({ result: partialResult });
        }
      }
    }
    useStudyStore.getState().logEvent("PROMPT_EXECUTED", { prompt: this.prompt.prompt, response: response });
    this.onPartialResponse = null;
    return { result: JSON.parse(response) as T };
  }

  /**
   * Provider-agnostic path. Routes through `currentProvider().generateStructured`,
   * which uses each provider's native structured-output mechanism (OpenAI
   * response_format, Anthropic tool-use, Ollama format=json + post-validation).
   * No partial streaming — the UI gets a single result at the end.
   *
   * Used when the active provider is Ollama, Anthropic, or the fallback chain.
   */
  private async executeViaProvider(): Promise<PromptResult<T>> {
    useStudyStore.getState().logEvent("PROMPT_TO_EXECUTE", { prompt: this.prompt.prompt });
    const cfg = useAiConfigStore.getState();
    const provider = cfg.getProvider();

    const model = this.prompt.model
      || (cfg.providerId === "ollama" ? cfg.ollamaModel
        : cfg.providerId === "anthropic" ? cfg.anthropicModel
        : cfg.openaiModel);

    const result = await provider.generateStructured(
      [{ role: "user", content: this.prompt.prompt }],
      { schema: this.schema, schemaName: "response" },
      { model, temperature: 0 },
    );
    useStudyStore.getState().logEvent("PROMPT_EXECUTED", { prompt: this.prompt.prompt, response: JSON.stringify(result) });
    // Fire one synthetic "partial" so existing consumers that rely on the
    // callback (e.g. layout-on-each-entity) still get one update before the resolve.
    if (this.onPartialResponse) {
      this.onPartialResponse({ result });
    }
    this.onPartialResponse = null;
    return { result };
  }

  execute(): Promise<PromptResult<T>> {
    const cfg = useAiConfigStore.getState();
    // OpenAI-only path keeps streaming partial parses (visible UI improvement
    // for entity / location extractors). Any other provider — or fallback
    // chain — uses the provider-agnostic single-shot generateStructured.
    if (cfg.providerId === "openai" && !cfg.useFallback) {
      return this.executeOpenAIStreaming();
    }
    return this.executeViaProvider();
  }
}
