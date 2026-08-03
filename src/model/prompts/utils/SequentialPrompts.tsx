import { BasePrompt } from "./BasePrompt";



export class SequentialPrompts<O> extends BasePrompt<O[]> {
    prompts: BasePrompt<O>[];
    constructor(prompts: BasePrompt<O>[]) {
        super();
        this.prompts = prompts;
    }

    execute(): Promise<O[]> {
        return new Promise<O[]>((resolve) => {
            let results: O[] = [];
            let i = 0;
            let next = () => {
                if (i < this.prompts.length) {
                    this.prompts[i].execute().then((result) => {
                        results.push(result);
                        i++;
                        next();
                    });
                } else {
                    resolve(results);
                }
            }
            next();
        });
    }
}
