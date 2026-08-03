import { useHistoryModelStore } from "../../HistoryModel";
import { useModelStore } from "../../Model";
import { useViewModelStore } from "../../ViewModel";
import { VisualRefresher } from "../textExtractors/VisualRefresher";
import { TextPrompt } from "../utils/TextPrompt";

export abstract class TextEditPrompt {
    temporaryResult: string = '';

    onResult(result: string): void {
        this.temporaryResult = this.reconstructResult(result);
    }

    execute(): void {
        if (this.canBeExecuted()) {
            const prompt = new TextPrompt({prompt: this.getPrompt()})
            prompt.onPartialResponse = (result) => this.onPartialResult(result.result);
            prompt.execute().then((result) => {
                if (result && this.isResultValid(result.result)) {
                    this.onResult(result.result);
                }
                this.finalize();
              }
            );
            useViewModelStore.getState().setTextIsBeingEdited(true);
        }
    }

    finalize(): void {
        VisualRefresher.getInstance().refreshFromText(this.temporaryResult,
        undefined,
        () => {
            useModelStore.getState().suggestNextTextChanges();
            useModelStore.getState().setTextState([{children: [{text: this.temporaryResult}]}], true, false);
            useModelStore.getState().setIsStale(false);
            useHistoryModelStore.getState().addHistoryNode(useModelStore.getState())
            useViewModelStore.getState().setTextIsBeingEdited(false);
        });
    }

    abstract getPrompt(): string

    reconstructResult(result: string): string {
        return result;
    }

    isResultValid(_result: string): boolean {
        return true;
    }

    canBeExecuted(): boolean {
        return useModelStore.getState().text.length > 0;
    }

    onPartialResult(_result: string): void {}
}
