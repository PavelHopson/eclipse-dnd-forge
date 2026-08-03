import { z } from "zod";
import { ActionEdge, Entity, useModelStore } from "../../Model";
import { JSONPrompt } from "../utils/JSONPrompt";
import { CreateActionEdge } from "./SentenceActionsExtractor";



const PASSAGE_SCHEMA = z.object({
    location: z.string(),
    passage: z.string()
});


export function GetActionPassage(text: string, actionName: string, source: Entity, target: Entity): Promise<ActionEdge> {
    const prompt = text + 
    `\n\nFor the action where ${source.name} ${actionName} ${target.name}, extract ` +
    `the location of the action (you can use 'unknown' if the location cannot be inferred from the text).`+
    `and the exact passage from the text that describes the action. The passage has to be extracted word-for-word from the text.`

    const actionExtactor = new JSONPrompt({ prompt: prompt }, PASSAGE_SCHEMA)
    const sourceNode = useModelStore.getState().entityNodes.find((node) => node.data.name === source.name);
    const targetNode = useModelStore.getState().entityNodes.find((node) => node.data.name === target.name);

    if (sourceNode && targetNode) {
        return new Promise((resolve) => {
            actionExtactor.execute().then((result) => {
                console.log("Actions extracted", result);
                const actionEdge = CreateActionEdge({
                    name: actionName, source: source.name, target: target.name, location: result.result.location}, result.result.passage, sourceNode, targetNode);

                resolve(actionEdge);
            })
        });
    }

    return Promise.reject("Source or target entity not found");
}
