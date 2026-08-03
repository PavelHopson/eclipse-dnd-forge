import { useStudyStore } from "../../../study/StudyModel";
import { Action, ActionEdge, useModelStore } from "../../Model";
import { TextEditPrompt } from "./TextEditPrompt";

export class ReorderActionPrompt extends TextEditPrompt {
    action: Action;
    previousPosition: number;
    newPosition: number;

    constructor(action: Action, previousPosition: number, newPosition: number) {
        super();
        this.action = action;
        this.previousPosition = previousPosition;
        this.newPosition = newPosition;
        useStudyStore.getState().logEvent("REORDER_ACTION_PROMPT", { action: action.name, previousPosition: previousPosition, newPosition: newPosition });
    }

    getActionDescription(actionEdge: ActionEdge): string {
        const sourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionEdge.source);
        const targetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionEdge.target);

        return `${sourceEntity?.data.name} ${actionEdge.data?.name} ${targetEntity?.data.name}`;
    }

    getPrompt(): string {
        return this.getPromptV4(); 
    }

    getPromptV0(): string {
        const actionToMove = useModelStore.getState().textActionMatches[this.previousPosition];
        const actionRightAfterNewLocation = useModelStore.getState().textActionMatches[this.newPosition];
        const text = useModelStore.getState().text;

        const textToMove = text.slice(actionToMove.start, actionToMove.end);

        let markedText = "";
        if (this.newPosition < this.previousPosition) {
            // Then we need to first mark the new position and then mark the text to be moved
            markedText += text.slice(0, actionRightAfterNewLocation.start) + ` ${textToMove} ` + text.slice(actionRightAfterNewLocation.start, actionToMove.start);
            markedText +=  text.slice(actionToMove.end, text.length);
        } else {
            // Then we need to first mark the text to be moved and then mark the new position
            markedText += text.slice(0, actionToMove.start) + text.slice(actionToMove.end, actionRightAfterNewLocation.start);
            markedText += ` ${textToMove} ` + text.slice(actionRightAfterNewLocation.start, text.length);
        }

        return `${markedText}\n\nRewrite the story so that it makes sense. Keep the same order of events.`;
    }

    getPromptV4(): string {
        const actionEdges = useModelStore.getState().actionEdges;
        const currentActionOrder = actionEdges.map((actionEdge, index) => `${(index+1)}) ` + this.getActionDescription(actionEdge)).join("\n");
        if (this.newPosition < this.previousPosition) {
            const actionToMove = actionEdges.splice(this.previousPosition, 1)[0];
            actionEdges.splice(this.newPosition, 0, actionToMove);
        } else {
            const actionToMove = actionEdges[this.previousPosition];
            actionEdges.splice(this.newPosition, 0, actionToMove);
            actionEdges.splice(this.previousPosition, 1);
        }
        const newActionOrder = actionEdges.map((actionEdge, index) => `${(index+1)}) ` + this.getActionDescription(actionEdge)).join("\n");

        const text = useModelStore.getState().text;

        useModelStore.getState().setActionEdges([...actionEdges]);

        return `${text}\n\nIn this story, the current order of actions is:\n${currentActionOrder}\n\nRewrite the story to EXACTLY follow this new order:\n${newActionOrder}`;
    }

    getPromptV3() : string {
        const actionToMove = useModelStore.getState().actionEdges[this.previousPosition];
        const actionToMoveSourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionToMove.source);
        const actionToMoveTargetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionToMove.target);

        const actionRightAfterNewLocation = useModelStore.getState().actionEdges[this.newPosition];
        const actionRightAfterNewLocationSourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionRightAfterNewLocation.source);
        const actionRightAfterNewLocationTargetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionRightAfterNewLocation.target);


        let locationInformation = `before "${actionRightAfterNewLocationSourceEntity?.data.name}" ${actionRightAfterNewLocation.data?.name} "${actionRightAfterNewLocationTargetEntity?.data.name}"`;

        if (this.newPosition > 0) {
            const actionRightBeforeNewLocation = useModelStore.getState().actionEdges[this.newPosition-1];
            const actionRightBeforeNewLocationSourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionRightBeforeNewLocation.source);
            const actionRightBeforeNewLocationTargetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionRightBeforeNewLocation.target);

            locationInformation += ` and after "${actionRightBeforeNewLocationSourceEntity?.data.name}" ${actionRightBeforeNewLocation.data?.name} "${actionRightBeforeNewLocationTargetEntity?.data.name}"`;
        }

        const actionToMoveDescription = `"${actionToMoveSourceEntity?.data.name}" ${actionToMove.data?.name} "${actionToMoveTargetEntity?.data.name}"`;

        const text = useModelStore.getState().text;

        return `${text}\n\nRewrite the story to move the action ${actionToMoveDescription} so that it happens ${locationInformation}.`;
    }

    getPromptV2() : string {
        const actionToMove = useModelStore.getState().actionEdges[this.previousPosition];
        const actionToMoveSourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionToMove.source);
        const actionToMoveTargetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionToMove.target);

        const actionRightAfterNewLocation = useModelStore.getState().actionEdges[this.newPosition];
        const actionRightAfterNewLocationSourceEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionRightAfterNewLocation.source);
        const actionRightAfterNewLocationTargetEntity = useModelStore.getState().entityNodes.find(entity => entity.id === actionRightAfterNewLocation.target);

        const text = useModelStore.getState().text;

        return `${text}\n\nRewrite the story so that "${actionToMoveSourceEntity?.data.name}" ${actionToMove.data?.name} "${actionToMoveTargetEntity?.data.name}" ` +
        `happens right BEFORE "${actionRightAfterNewLocationSourceEntity?.data.name}" ${actionRightAfterNewLocation.data?.name} "${actionRightAfterNewLocationTargetEntity?.data.name}"`;
    }

    getPromptV1() : string {
        // For some reason, this idea for the prompt does not want to work
        // Idea is to mark the text with the passage that has to be moved and where it should be moved to
        const actionToMove = useModelStore.getState().textActionMatches[this.previousPosition];
        const actionRightAfterNewLocation = useModelStore.getState().textActionMatches[this.newPosition];
        const text = useModelStore.getState().text;

        let markedText = "";
        if (this.newPosition < this.previousPosition) {
            // Then we need to first mark the new position and then mark the text to be moved
            markedText += text.slice(0, actionRightAfterNewLocation.start) + " LOCATION " + text.slice(actionRightAfterNewLocation.start, actionToMove.start);
            markedText += " ACTION " + text.slice(actionToMove.end, text.length);
        } else {
            // Then we need to first mark the text to be moved and then mark the new position
            markedText += text.slice(0, actionToMove.start) + " ACTION " + text.slice(actionToMove.end, actionRightAfterNewLocation.start);
            markedText += " LOCATION " + text.slice(actionRightAfterNewLocation.start, text.length);
        }

        return `${markedText}\n\nTEXT_TO_MOVE: ${text.slice(actionToMove.start, actionToMove.end)}\n\n` +
        `Rewrite the story so that ACTION is moved to LOCATION `;
    }

    execute(): void {
        super.execute();
    }
}
