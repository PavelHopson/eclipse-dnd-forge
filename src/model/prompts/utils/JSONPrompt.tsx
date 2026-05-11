import { zodResponseFormat } from 'openai/helpers/zod';
import { ChatCompletionChunk } from "openai/resources/index.mjs";
import { Allow, parse } from "partial-json";
import { ZodObject, z } from "zod";
import { useStudyStore } from "../../../study/StudyModel";
import { openai } from "../../Model";
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
  };


  addMissingFields(partialResponse: any, schema: z.ZodType): any {
    const emptyObject = (schema as any as z.ZodObject<any>).shape;

    const filledData = Object.keys(emptyObject).reduce((acc, key) => {
      if (emptyObject[key] instanceof z.ZodObject) {
        acc[key] = this.addMissingFields(partialResponse[key] || {}, emptyObject[key]);
      } else if (emptyObject[key] instanceof z.ZodArray) {
        acc[key] = (partialResponse[key] || []).map((item: any) => this.addMissingFields(item, emptyObject[key].element));
      } else {
        acc[key] = partialResponse.hasOwnProperty(key) ? partialResponse[key] : this.getDefaultValue(emptyObject[key]);
      }
      return acc;
    }, {} as Record<string, z.ZodTypeAny>);


    return filledData;
  }

  partialParse(response: string): T | null {
    try {
      // Partial parse
      let partialResponse = parse(response, ~Allow.STR);
      // Try adding missing values to the partial response using sensible defaults
      return this.schema.parse(this.addMissingFields(partialResponse, this.schema)); // Should add the missing fields
    } catch (e) {
      // Do nothing if we could not parse the partial response
      /*if (e instanceof z.ZodError) {
        console.log(e.issues);
      }
      console.error("Partial parse error for ", response, e);*/
    }
    return null;
  }



  execute(): Promise<PromptResult<T>> {
    return new Promise<PromptResult<T>>((resolve, reject) => {
      (async () => {
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
        this.onPartialResponse = null; // Reset the partial response callback     
        resolve({ result: JSON.parse(response) as T }); // The parsing should now never fail thanks to the new API. So no need for trying to fix / retrying the request by feeding the error anymore
      })();
    });
  }
}