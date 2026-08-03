import { Button } from '@nextui-org/react';
import React, { useCallback } from 'react';
import { FaCheck } from 'react-icons/fa6';
import { ImCross } from 'react-icons/im';
import { Editor, NodeEntry, Range, Transforms, createEditor } from 'slate';
import { Editable, ReactEditor, RenderLeafProps, Slate, withReact } from "slate-react";
import { useModelStore } from '../model/Model';
import { SlateUtils } from '../model/SlateUtils';
import { TextUtils } from '../model/TextUtils';
import { useViewModelStore } from '../model/ViewModel';


const Leaf = (props: any) => {
  // By default we just render a basic span
  const classes = [];
  if (props.leaf.added) {
    classes.push('suggest-addition');
  } else if (props.leaf.removed) {
    classes.push('suggest-deletion');
  } 
  
  if (props.leaf.highlight)  classes.push('highlight');

  return <span className={classes.join(" ")} {...props.attributes}>{props.children}</span>
}

export const globalEditor = withReact(createEditor());
// @ts-ignore
window['globalEditor'] = globalEditor;

const { normalizeNode } = globalEditor
globalEditor.normalizeNode = entry => {
    const [node, path] = entry

    if (path.length === 0) { // Root node
        const paragraphs = (node as any).children;
        // Ensure that there is only one paragraph
        if (paragraphs.length > 1) {

            // Add a new line at the begining of the following paragraph
            Transforms.insertText(globalEditor, "\n", { at: {path: [1, 0], offset: 0} })
            //useOriginalRemoveNodes = true;
            Transforms.mergeNodes(globalEditor, { at: [1] })
            //useOriginalRemoveNodes = false;
        }
    }

    // Fallback to the original `normalizeNode` to enforce other constraints.
    normalizeNode(entry)
}

export default function TextEditor({overlayOnHover = true} : {overlayOnHover?: boolean}) {
  const setTextState = useModelStore(state => state.setTextState);
  const textIsBeingEdited = useViewModelStore(state => state.textIsBeingEdited);
  const divRef = React.createRef<HTMLDivElement>();
  const isTextSuggested = useModelStore(state => state.isTextSuggested)();
  const isReadOnly = useModelStore(state => state.isReadOnly);


  const textActionMatches = useModelStore(state => state.textActionMatches);
  const filteredActionsSegment = useModelStore(state => state.filteredActionsSegment);
  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);
  const selectedEdges = useModelStore(state => state.selectedEdges);
  const actionEdges = useModelStore(state => state.actionEdges);
  const selectedNodes = useModelStore(state => state.selectedNodes);
  const highlightedEntities = useModelStore(state => state.highlightedEntities);

  const renderLeaf = useCallback((props: RenderLeafProps) => {
    return <Leaf {...props} editor={globalEditor} />
  }, []);


  const activeSelectionDecoration = useCallback(
    ([, path]: NodeEntry) => {
      const ranges : Range[] = [];
      let idsToDecorate : number[] = [];

      if (selectedEdges.length > 0) {
        for (const edge of selectedEdges) {
          const index = actionEdges.findIndex(e => e.id === edge);
          if (index >= 0) {
            idsToDecorate.push(index);
          }
        }
      }
      const filter =  highlightedActionsSegment || filteredActionsSegment;


      if (filter) {
        for (let i = filter.start; i <= filter.end; i++) {
          if (idsToDecorate.indexOf(i) === -1) {
            idsToDecorate.push(i);
          }
        }
      }

      if (selectedNodes.length > 0 || highlightedEntities.length > 0) {
        const entitiesToConsider = highlightedEntities.concat(selectedNodes);
        const edgesToConsider = useModelStore.getState().getFilteredActionEdges(filter);
        const edgesConnectedToEntities = edgesToConsider.filter(edge => entitiesToConsider.includes(edge.source) || entitiesToConsider.includes(edge.target));
        idsToDecorate = []; // This takes priority over other filters
        for (const edge of edgesConnectedToEntities) {
          const index = actionEdges.findIndex(e => e.id === edge.id);
          if (index >= 0) {
            idsToDecorate.push(index);
          }
        }
      }

      if (idsToDecorate.length > 0) {

        for (const i of idsToDecorate) {
          const start = textActionMatches[i].start;
          const end = textActionMatches[i].end;
  
          const startPt = SlateUtils.toSlatePoint(useModelStore.getState().textState, start);
          const endPt = SlateUtils.toSlatePoint(useModelStore.getState().textState, end);
          
          if (startPt && endPt) {
            const range = { anchor: startPt, focus: endPt };

            const intersection = Range.intersection(range, Editor.range(globalEditor, path));

            if (intersection) {
              ranges.push({
                anchor: intersection.anchor,
                focus: intersection.focus,
                highlight: true,
              } as any);
            }
          }
        }
      }

      return ranges;
    },
    [actionEdges, textActionMatches, filteredActionsSegment, highlightedActionsSegment, selectedEdges, selectedNodes, highlightedEntities]
  )


  return (
    <>
      <div ref={divRef} onClick={(e) => {
        if (e.target === divRef.current) {
          useModelStore.getState().setFilteredActionsSegment(null, null);
          useModelStore.getState().setHighlightedActionsSegment(null, null);
        }
      }} id="dnd-session-editor" className={`${textIsBeingEdited ? "loading " : ""}dnd-session-editor`}>
        <Slate onSelectionChange={(selection) => {
          if (!isReadOnly && selection) {
            const startPoint = selection?.anchor;
            const endPoint = selection?.focus;

            const startIndex = SlateUtils.toStrIndex(globalEditor.children, startPoint);
            const endIndex = SlateUtils.toStrIndex(globalEditor.children, endPoint);

            const actions = TextUtils.getActionsAtPosition(useModelStore.getState().textActionMatches, Math.min(startIndex, endIndex), Math.max(startIndex, endIndex), true);

            if (actions.length > 0) {
              useModelStore.getState().setFilteredActionsSegment(actions[0].index, actions[actions.length - 1].index);
            } else {
              useModelStore.getState().setFilteredActionsSegment(null, null);
            }
          }

        }}
          editor={globalEditor} initialValue={useModelStore.getState().textState} onChange={newValue => {
            setTextState(newValue, false);
          }}>
          <Editable 
          readOnly={isReadOnly}
          decorate={activeSelectionDecoration}
          onMouseLeave={() => {
            useModelStore.getState().setHighlightedActionsSegment(null, null);
          }}
          onMouseMove={(e) => {
            if (!overlayOnHover) return;
            // Get the index of the character under the mouse
            const pos = TextUtils.caretPositionFromPoint(e.clientX, e.clientY);
            if (pos) {
              const slatePoint = ReactEditor.toSlatePoint(globalEditor, [pos.offsetNode, pos.offset], { exactMatch: true, suppressThrow: true });

              if (slatePoint) {
                const index = SlateUtils.toStrIndex(globalEditor.children, slatePoint);

                const actions = TextUtils.getActionsAtPosition(useModelStore.getState().textActionMatches, index, index, true);
                if (actions.length > 0) {
                  useModelStore.getState().setHighlightedActionsSegment(actions[0].index, actions[actions.length - 1].index);
                } else {
                  useModelStore.getState().setHighlightedActionsSegment(null, null);
                }
              }
            }
          }} renderLeaf={renderLeaf} />
        </Slate>

        {isTextSuggested && <div style={{ position: 'absolute', top: 10, transform: 'translate(-50%, 0)', left: '50%' }}>
          <Button size="sm" variant='faded' style={{marginRight: 5}} onClick={() => useModelStore.getState().acceptSuggestions()}><FaCheck /> Accept changes</Button>
          <Button size="sm" variant='faded' onClick={() => useModelStore.getState().rejectSuggestions()} ><ImCross /> Reject changes</Button>
        </div>}
      </div>
    </>
  )
}
