import { LayoutUtils } from "../../LayoutUtils";
import { useModelStore } from "../../Model";
import { ParallelPrompts } from "../utils/ParallelPrompts";
import { SentenceActionsExtractor } from "./SentenceActionsExtractor";


let VisualRefresherInstance : VisualRefresher | null = null;

export class VisualRefresher {
    previousText: string;
    onUpdate: () => void;
    onRefreshDone: () => void;

    private constructor() {
        this.previousText = "";
        this.onUpdate = () => {};
        this.onRefreshDone = () => {};
    }

    public static getInstance() {
        if (!VisualRefresherInstance) {
            VisualRefresherInstance = new VisualRefresher();
        }

        return VisualRefresherInstance;
    }

    reset() {
        this.previousText = "";
    }

    clearInvalidActions(text: string) {
        const actionEdges = useModelStore.getState().actionEdges;
        const newActionEdges = actionEdges.filter((actionEdge) => text.includes(actionEdge.data!.passage));
        useModelStore.getState().setActionEdges(newActionEdges);
    }

    clearInvalidEntities(text: string) {
        const entityNodes = useModelStore.getState().entityNodes;
        const newEntityNodes = entityNodes.filter((entityNode) => text.toLowerCase().includes(entityNode.data.name.toLowerCase()));
        useModelStore.getState().setEntityNodes(newEntityNodes);
    }

    clearInvalidLocations() {
        // We consider a location as invalid if it is not mentioned in any of the actions
        const locationNodes = useModelStore.getState().locationNodes;
        const actionEdges = useModelStore.getState().actionEdges;
        const locationsInActions = [...new Set(actionEdges.map((actionEdge) => actionEdge.data!.sourceLocation).concat(actionEdges.map((actionEdge) => actionEdge.data!.targetLocation)))];
        const newLocationNodes = locationNodes.filter((locationNode) => locationsInActions.includes(locationNode.data.name));
        useModelStore.getState().setLocationNodes(newLocationNodes);
    }

    refreshFromText(text: string, onUpdate?: () => void, onFinished?: () => void) {
        if (this.previousText === text) return;

        // First we clear everything that became invalid since the new text
        LayoutUtils.stopAllSimulations();
        // We will be playing with the actions, the selection will become meaningless, better to clear it
        //TODO: Be smart and only unselect the things that are actually becoming invalid. Otherwise try very hard to preserve the selection
        useModelStore.getState().setSelectedNodes([]);
        useModelStore.getState().setSelectedEdges([]);
        useModelStore.getState().setFilteredActionsSegment(null, null);
        useModelStore.getState().setHighlightedActionsSegment(null, null);

        this.clearInvalidActions(text);
        
        // Loop over the sentences in the text by finding the index position of the periods
        const regex = /[^.!?]+[.!?]+/g;
        let result;
        let sentences : {start: number, end: number, text: string}[] = [];

        while ( (result = regex.exec(text)) ) {
            const startIdx = result.index;
            const endIdx = result.index + result[0].length;
            const sentenceStr = result[0].replace(/^\s+|\s+$/g, '');

            if (sentenceStr.length < 20 && sentences.length > 0) { // Arbitrary threshold just to detect very short sentences
                sentences[sentences.length - 1].end = endIdx;
                sentences[sentences.length - 1].text = text.substring(sentences[sentences.length - 1].start, endIdx).replace(/^\s+|\s+$/g, '');
            } else {
                sentences.push({start: startIdx, end: endIdx, text: sentenceStr});
            }
        }

        // Only bother updating the sentences that were not already in the previous text
        sentences = sentences.filter((sentence) => !this.previousText.includes(sentence.text));
        
        // Now we extract the actions from each sentences
        const actionPromises = sentences.map((sentence) => {
            const entities = useModelStore.getState().entityNodes;
            const prompt = new SentenceActionsExtractor(entities, text.substring(0, sentence.start), sentence.text, text.substring(sentence.end, text.length));
            prompt.onUpdate = () => {
                if (onUpdate) onUpdate();
                this.onUpdate();
            }
            return prompt
        });

        new ParallelPrompts(actionPromises).execute().then(() => {
            const actions = useModelStore.getState().actionEdges.map((actionEdge) => {
                const sourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionEdge.source);
                const targetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionEdge.target);
                return {name: actionEdge.data?.name, source: sourceEntity?.data.name, target: targetEntity?.data.name, location: actionEdge.data?.sourceLocation, passage: actionEdge.data?.passage}
            });
            console.log("Extracted actions:", actions);
            
            if (onFinished) onFinished();
            this.onRefreshDone();
        });


        this.previousText = text;
    }
}
