import { RawNodeDatum } from 'react-d3-tree';
import { create } from 'zustand';
import { useStudyStore } from '../study/StudyModel';
import { globalEditor } from '../view/TextEditor';
import { ModelState, useModelStore } from './Model';
import { VisualRefresher } from './prompts/textExtractors/VisualRefresher';



export interface HistoryNodeDatum  extends RawNodeDatum {
    state: ModelState;
    children?: HistoryNodeDatum[];
}

/** 
 * Model 
 **/
interface HistoryModelState {
    historyTree: HistoryNodeDatum | null;
    positionInTree : number[];
    redoPositionStack: number[][];
    timestampLastAddedNode: number;
}

interface HistoryModelAction {
    reset: () => void;
    setPositionInTree: (position: number[]) => void;
    getNodeAtPosition: (position: number[]) => {node: HistoryNodeDatum, parent: HistoryNodeDatum | null} | null;
    findNodePosition: (node: HistoryNodeDatum) => number[] | null;
    addHistoryNode: (state: ModelState) => void;
    undo: () => void;
    redo: () => void;
}

function getInitialState() : HistoryModelState {
    return {
        historyTree: null,
        positionInTree: [],
        redoPositionStack: [],
        timestampLastAddedNode: 0
    }
}

export const useHistoryModelStore = create<HistoryModelState & HistoryModelAction>()((set, get) => ({
    ...getInitialState(),
    reset: () => set({ ...getInitialState() }),
    setPositionInTree: (position: number[]) => {
        // Restore the state
        const node = get().getNodeAtPosition(position);
        if (node) {
            useModelStore.setState(node.node.state);
            // Make sure the editor is updated
            globalEditor.children = node.node.state.textState;
            globalEditor.onChange();

            // Make sure the layout is clean
            if (VisualRefresher.getInstance().onUpdate) {
                VisualRefresher.getInstance().onUpdate();
            }

            useStudyStore.getState().logEvent("SET_POSITION_IN_HISTORY_TREE", { position });

            set({ positionInTree: position, redoPositionStack: [] });
        }
    },
    getNodeAtPosition: (position: number[]) => {
        if (get().historyTree === null) {
            return null;
        }

        let parent = null;
        let node = get().historyTree as any as HistoryNodeDatum;
    
        for (const index of position) {
            if (node?.children && node.children[index]) {
                parent = node;
                node = node.children[index];
            } else {
                return null; // If the position is invalid, return undefined
            }
        }
    
        return { node, parent };
    },
    findNodePosition: (targetNode: HistoryNodeDatum) => {

        function searchNode(node: RawNodeDatum, path: number[]): number[] | null {
            if (node === targetNode) {
                return path; // Return the path when we find the target node
            }
    
            if (node.children) {
                for (let i = 0; i < node.children.length; i++) {
                    const result = searchNode(node.children[i], [...path, i]);
                    if (result) {
                        return result; // Return the path if found in the subtree
                    }
                }
            }
    
            return null; // Node not found in this branch
        }
    
        return searchNode(get().historyTree || {name: '', children: []}, []);
    },
    addHistoryNode: (state: ModelState) => {
        // Two cases when adding a node
        // 1) If we are on a node that is the last sibling, we add the new node as a child
        // 2) If we are on a node that is not the last sibling, we add the new node as a sibling
        const node: HistoryNodeDatum = {
            state: state,
            name: '',
            attributes: {},
            children: []
        }
        const position = get().positionInTree;
        let newPosition : number[] = [];
        let tree = get().historyTree;

        const timestampLastAddedNode = get().timestampLastAddedNode;

        if ((Date.now() - timestampLastAddedNode) < 700) {
            // Last node was added so recently... This node is probably related, let's just merge it with the current node
            const currentNodeAndParent = get().getNodeAtPosition(position);
            newPosition = get().positionInTree;
            if (currentNodeAndParent) {
                currentNodeAndParent.node.state = useModelStore.getState();
            }
        } else {
            if (tree === null) {
                // The node becomes the root
                tree = node;
                newPosition = [];
            } else {
                const currentNodeAndParent = get().getNodeAtPosition(position);
        
                if (currentNodeAndParent) {
                    const currentNode = currentNodeAndParent.node;
        
                    if (currentNode && currentNode.children) {
                        currentNode.children?.push(node);
                        newPosition = [...position, currentNode.children.length - 1];
                    }
                } 
            }
        }
        set({ historyTree: JSON.parse(JSON.stringify(tree)), positionInTree: newPosition, redoPositionStack: [], timestampLastAddedNode: Date.now() });
    },
    undo: () => {
        const position = get().positionInTree;
        // Simply get rid of the last element
        if (position.length > 0) {
            const newPosition = position.slice(0, position.length - 1);
            const redoStack = [...get().redoPositionStack, position];
            get().setPositionInTree(newPosition);
            set({ redoPositionStack: redoStack });
        }
    },
    redo: () => {
        const redoPositionStack = get().redoPositionStack;
        if (redoPositionStack.length > 0) {
            const position = redoPositionStack[redoPositionStack.length - 1];
            const redoStack = [...redoPositionStack.slice(0, redoPositionStack.length - 1)];
            get().setPositionInTree(position);
            set({ redoPositionStack: redoStack});
        }
    }


}))


//         
