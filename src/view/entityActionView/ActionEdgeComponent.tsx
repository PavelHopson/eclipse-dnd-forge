import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, useInternalNode, useKeyPress, useReactFlow } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';

import '@xyflow/react/dist/style.css';
import { GrFormNext, GrFormPrevious } from 'react-icons/gr';
import { ActionEdge, useModelStore } from '../../model/Model';
import { ChangeActionPrompt } from '../../model/prompts/textEditors/ChangeActionPrompt';
import { RemoveActionPrompt } from '../../model/prompts/textEditors/RemoveActionPrompt';


import { getEdgeParams } from '../utils/initialElements';


export default function ActionEdgeComponent(props: EdgeProps<ActionEdge>) {
  const sourceNode = useInternalNode(props.source);
  const targetNode = useInternalNode(props.target);

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode,
  );

  let [edgePath, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
  });

  const [isBeingEdited, setIsBeingEdited] = useState(false);
  const [temproraryName, setTemporaryName] = useState(props.data!.name);
  const [shouldSelectText, setShouldSelectText] = useState(false);
  const inputFieldRef = useRef<HTMLInputElement>(null);
  const { setEdges } = useReactFlow();
  const deletePressed = useKeyPress(["Delete", "Backspace"]);

  const selectedEdges = useModelStore(state => state.selectedEdges);
  const isSelected = selectedEdges.includes(props.id);

  // Test if there are other actions that have the same source and target (i.e., there is an overlap)
  const getFilteredActionEdges = useModelStore(state => state.getFilteredActionEdges);
  const filteredActionsSegment = useModelStore(state => state.filteredActionsSegment);
  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);

  const filteredEdges = getFilteredActionEdges(highlightedActionsSegment ? highlightedActionsSegment : filteredActionsSegment);

  const overlappingEdges = filteredEdges.filter(edge => edge.source === props.source && edge.target === props.target);
  const inverseEdges = filteredEdges.filter(edge => edge.source === props.target && edge.target === props.source);
  const isGoingBackwards = props.sourceX > props.targetX;
  const currentEdgeIndex = overlappingEdges.findIndex(edge => edge.id === props.id);
  const isLastOverlappingEdge = currentEdgeIndex === overlappingEdges.length - 1;

  const idxOfSelectedOverlappedEdge = overlappingEdges.findIndex(edge => selectedEdges.includes(edge.id));
  const [selectedOverlappingEdgeIdx, setSelectedOverlappingEdgeIdx] = useState(idxOfSelectedOverlappedEdge != -1 ? idxOfSelectedOverlappedEdge : currentEdgeIndex);

  const highlightedEntities = useModelStore(state => state.highlightedEntities);
  const selectedNodes = useModelStore(state => state.selectedNodes);

  const isAnimated = highlightedEntities.length > 0 && (highlightedEntities.includes(props.source) || highlightedEntities.includes(props.target));
  const isFaded = (highlightedEntities.length > 0 && !isAnimated) || (selectedNodes.length > 0 && !selectedNodes.includes(props.source) && !selectedNodes.includes(props.target));
  const isReadOnly = useModelStore(state => state.isReadOnly);


  useEffect(() => {
    if (deletePressed && useModelStore.getState().selectedEdges.includes(props.id)) {
      // Remove the edge
      setEdges((edges) => edges.filter((edge) => edge.id !== props.id));

      // Modify the story accordingly by executing a prompt
      const sourceNode = useModelStore.getState().entityNodes.find(node => node.id === props.source)
      const targetNode = useModelStore.getState().entityNodes.find(node => node.id === props.target)
      if (sourceNode && targetNode) {
        new RemoveActionPrompt(sourceNode.data, targetNode.data, props.data!).execute()
      }
    }
  }, [deletePressed, props.data, props.id, props.source, props.target, setEdges])

  if (props.source === props.target) {
    // This is a self-loop, need to render the path differently
    const radiusX = (props.sourceX - props.targetX) * 0.6;
    const radiusY = 50;
    edgePath = `M ${props.sourceX - 5} ${props.sourceY} A ${radiusX} ${radiusY} 0 1 0 ${props.targetX + 2
      } ${props.targetY}`;

    // Calculate the label position so that it is on edge path
    labelX = (props.sourceX + props.targetX) / 2
    labelY = props.sourceY + (props.sourceY > props.targetY ? -radiusY * 1.5 : radiusY * 1.5);
  }


  const onNameInputValidated = () => {
    setIsBeingEdited(false);

    if (temproraryName !== overlappingEdges[selectedOverlappingEdgeIdx].data!.name) {
      setEdges((edges) => {
        const edgeToModify = edges.find(edge => edge.id === overlappingEdges[selectedOverlappingEdgeIdx].id);
        if (edgeToModify) {
          const previousAction = { ...edgeToModify.data! };
          edgeToModify.data!.name = temproraryName;

          // Modify the story accordingly by executing a prompt
          const sourceNode = useModelStore.getState().entityNodes.find(node => node.id === edgeToModify.source)
          const targetNode = useModelStore.getState().entityNodes.find(node => node.id === edgeToModify.target)
          if (sourceNode && targetNode) {
            new ChangeActionPrompt(sourceNode.data, targetNode.data, previousAction! as any, edgeToModify.data! as any).execute()
          }
        }
        return [...edges];
      });
    }
  }

  useEffect(() => {
    if (shouldSelectText) {
      inputFieldRef.current?.select();
      setShouldSelectText(false);
    }
  }, [shouldSelectText]);

  let labelPositionTransform = `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`

  // Avoid overlapping labels when there are edges going in the opposite direction
  if (inverseEdges.length > 0) {
    if (isGoingBackwards) {
      labelPositionTransform = `translate(-50%, -105%) translate(${labelX}px,${labelY}px)`
    } else {
      labelPositionTransform = `translate(-50%, 5%) translate(${labelX}px,${labelY}px)`
    }
  }


  return (
    <>
      <BaseEdge path={edgePath} markerEnd={props.markerEnd}
      style={{ ...props.style, stroke: isSelected ? '#326FEE' : '#888', strokeWidth: isSelected ? 2 : 1, cursor: 'pointer' }} />
      {isAnimated && isLastOverlappingEdge && overlappingEdges.map((edge, idx) => {
        const offset = (idx / Math.min(overlappingEdges.length, 15))+0.5; // 5 maximum
        const isSending = highlightedEntities.includes(edge.source);
        const isReceiving = highlightedEntities.includes(edge.target);
        let fillColour = isSending ? "#326FEE" : isReceiving ? "#EEB132" : "#888";
        fillColour = isSending && isReceiving ? "url(#grad1)" : fillColour;
        return (<g key={edge.data!.name}>
          <defs>
            <filter x="0" y="0" width="1" height="1" id="solid">
              <feFlood floodColor="white" result="bg" />
              <feMerge>
                <feMergeNode in="bg"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: "#326FEE", stopOpacity: 1}} />
              <stop offset="49%" style={{stopColor: "#326FEE", stopOpacity: 1}} />
              <stop offset="50%" style={{stopColor: "#EEB132", stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: "#EEB132", stopOpacity: 1}} />
            </linearGradient>
          </defs>
        <circle cx={0} cy={0} r={4} fill={fillColour} />
        <text filter="url(#solid)" textAnchor={isGoingBackwards ? 'end' : 'start'} dominantBaseline={isGoingBackwards ? 'auto' : 'hanging'} style={{fontSize: 10, fill: '#000', transform: isGoingBackwards ? "translate(-5px,-5px)" : "translate(5px,5px)"}}>
          {edge.data!.name}
        </text>
        <animateMotion begin={offset*-10} dur="10s" repeatCount="indefinite" path={edgePath} />
        </g>)
      })}
      {!isAnimated && <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            display: isLastOverlappingEdge || isSelected ? 'flex' : 'none',
            flexDirection: 'row',
            alignItems: 'center',
            transform: labelPositionTransform,
            fontSize: 12,
            // everything inside EdgeLabelRenderer has no pointer events by default
            // if you have an interactive element, set pointer-events: all
            pointerEvents: 'all',
            boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px',
            zIndex: isSelected ? 9999 : 0,
            background: isSelected ? 'rgb(73 129 244)' : '#eee',
            color: isSelected ? 'white' : 'black',
            opacity: isFaded ? 0.3 : 1,
          }}
          className="nodrag nopan"
        >
          {overlappingEdges.length > 1 && <button onClick={(e) => {
            e.stopPropagation();
            const idx = (selectedOverlappingEdgeIdx - 1 + overlappingEdges.length) % overlappingEdges.length;
            setSelectedOverlappingEdgeIdx(idx);
            if (isSelected) useModelStore.getState().setSelectedEdges([overlappingEdges[idx].id]);
          }}>
            <GrFormPrevious />
          </button>}

          {!isBeingEdited && <button style={{ width: 100, overflow: 'clip', color: isSelected ? 'white' : 'black', borderRadius: 4, cursor: isReadOnly ? 'pointer' : 'text', background: isSelected ? '#326FEE' : 'white', borderLeft: '1px solid #c8c8c8', borderRight: '1px solid #c8c8c8', paddingLeft: 4, paddingRight: 4, whiteSpace: 'nowrap' }} onClick={(e) => {
            if (useModelStore.getState().isReadOnly) return;
            e.stopPropagation();
            setTemporaryName(overlappingEdges[selectedOverlappingEdgeIdx].data!.name);
            setIsBeingEdited(true);
            setShouldSelectText(true);
          }}>
              {overlappingEdges.length <= selectedOverlappingEdgeIdx ? props.data!.name : overlappingEdges[selectedOverlappingEdgeIdx].data!.name}
          </button>}


          {isBeingEdited && <input ref={inputFieldRef} autoFocus style={{ background: '#white', borderRadius: 4 }}
            value={temproraryName}
            onChange={(e) => { setTemporaryName(e.target.value); }}
            onBlur={() => { onNameInputValidated() }}
            onKeyDown={(e) => { if (e.key === 'Enter') onNameInputValidated(); }}
          />}

          {overlappingEdges.length > 1 &&
            <div style={{marginLeft: 5}}>
              ({selectedOverlappingEdgeIdx+1}/{overlappingEdges.length})
            </div>}
          {overlappingEdges.length > 1 && <button onClick={(e) => {
            e.stopPropagation();
            const idx = (selectedOverlappingEdgeIdx + 1) % overlappingEdges.length;
            setSelectedOverlappingEdgeIdx(idx);
            if (isSelected) useModelStore.getState().setSelectedEdges([overlappingEdges[idx].id]);
          }}>
            <GrFormNext />
          </button>}
        </div>
      </EdgeLabelRenderer>}
    </>
  );
}

