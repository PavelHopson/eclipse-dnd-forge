import { z } from "zod";
import { useModelStore } from "../../Model";
import { PromptResult } from "../utils/BasePrompt";
import { JSONPrompt } from "../utils/JSONPrompt";

export abstract class JSONExtractorPrompt<T> extends JSONPrompt<T> {
    afterPartialResult: ((result: PromptResult<T>) => void) | null = null;
    afterFinalResult: ((result: PromptResult<T>) => void) | null = null;

    constructor() {
        super({prompt: ""}, null as any);
    }
    
    abstract getPrompt(): string
    abstract getJSONSchema(): z.ZodType<T>
    abstract onPartialResult(result: PromptResult<T>): void

    execute(): Promise<PromptResult<T>> {
        if (useModelStore.getState().text.length > 0) {
            this.prompt = {prompt: this.getPrompt()};
            this.schema = this.getJSONSchema();

            this.onPartialResponse = (result) => {
                this.onPartialResult(result);
                if (this.afterPartialResult) {
                    this.afterPartialResult(result);
                }
            };
            
            return super.execute().then((result) => {
                if (this.afterFinalResult) {
                    this.afterFinalResult(result);
                }
                this.finalize();
                return result;
            });
        }
        return new Promise<PromptResult<T>>((resolve) => {resolve({result: [] as any})});
    }

    finalize(): void {}
}
