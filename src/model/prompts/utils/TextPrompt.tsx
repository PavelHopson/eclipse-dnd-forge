import { openai } from "../../Model";
import { BasePrompt, ExecutablePrompt, PromptResult } from "./BasePrompt";

export class TextPrompt extends BasePrompt<PromptResult<string>> {
    prompt: ExecutablePrompt;
    onPartialResponse: null | ((partialResult : PromptResult<string>) => void);
    constructor(prompt: ExecutablePrompt) {
        super();
        this.prompt = prompt;
        this.onPartialResponse = null
    }

    execute(): Promise<PromptResult<string>> {
        return new Promise<PromptResult<string>>((resolve) => {
            
            (async () => {
                const stream = await openai.chat.completions.create({
                  model: this.prompt.model || "gpt-4o-2024-08-06",
                  messages: [{ role: 'user', content: this.prompt.prompt }],
                  temperature: 0,
                  stream: true,
                });
                let response = '';
                for await (const chunk of stream) {
                  response += chunk.choices[0]?.delta?.content || '';
                  if (this.onPartialResponse) {
                    this.onPartialResponse({ result: response });
                  }

                }        
                resolve({ result: response });  
              })();
            
        });
    }
}
