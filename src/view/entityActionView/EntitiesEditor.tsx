import { Background, BackgroundVariant, ConnectionMode, Controls, ReactFlow, addEdge, applyEdgeChanges, applyNodeChanges, useReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import '@xyflow/react/dist/style.css';
import { LayoutUtils } from '../../model/LayoutUtils';
import { ActionEdge, useModelStore } from '../../model/Model';
import { AddActionPrompt } from '../../model/prompts/textEditors/AddActionPrompt';
import ActionEdgeComponent from './ActionEdgeComponent';
import EntityNodeComponent, { CreateEntityNode } from './EntityNodeComponent';


export default function EntitiesEditor() {
  const entityNodes = useModelStore(state => state.entityNodes);
  const actionEdges = useModelStore(state => state.actionEdges);
  const getFilteredActionEdges = useModelStore(state => state.getFilteredActionEdges);
  const setEntityNodes = useModelStore(state => state.setEntityNodes);
  const setActionEdges = useModelStore(state => state.setActionEdges);
  const setSelectedNodes = useModelStore(state => state.setSelectedNodes);
  const setSelectedEdges = useModelStore(state => state.setSelectedEdges)
  const filteredActionsSegment = useModelStore(state => state.filteredActionsSegment);
  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);
  const [inputField, setInputField] = useState<{x: number, y: number, placeholder: string, onValidate: (text: string) => void} | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<{x: number, y: number}>({x: 0, y: 0});
  const inputFieldRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null); 
  const highlightedEntities = useModelStore(state => state.highlightedEntities);
  const selectedNodes = useModelStore(state => state.selectedNodes);
  const isReadOnly = useModelStore(state => state.isReadOnly);

  const { screenToFlowPosition } = useReactFlow();



  const nodeTypes = useMemo(() => ({
    entityNode: EntityNodeComponent
  }), []);

  const edgeTypes = useMemo(() => ({
    actionEdge: ActionEdgeComponent
  }), []);


  // If there is a higlighted segment, then we only show the edges from that segment
  const actionsFilter = highlightedActionsSegment ? highlightedActionsSegment : filteredActionsSegment;
  let filteredEdges = getFilteredActionEdges(actionsFilter);

  if (highlightedEntities.length > 0 || selectedNodes.length > 0) {
    const entitiesToConsider = highlightedEntities.concat(selectedNodes);
    // If there are highlighted entities, we only show the edges that are connected to them
    filteredEdges = filteredEdges.filter(edge => entitiesToConsider.includes(edge.source) || entitiesToConsider.includes(edge.target));
  }


  useEffect(() => {
    // Select the input and clear it
    if (inputField && inputFieldRef.current) {
      inputFieldRef.current.focus();
      inputFieldRef.current.value = "";
    }
  }, [inputField]);

  return (
    <>
      <div ref={divRef} style={{ position: 'relative', width: '100%', height: '100%'}}>
        <ReactFlow
          nodes={entityNodes}
          edges={filteredEdges}
          connectionMode={ConnectionMode.Loose}
          nodeTypes={nodeTypes as any}
          edgeTypes={edgeTypes as any}
          deleteKeyCode={[]}
          zoomOnDoubleClick={false}

          onSelectionChange={(selection) => {
            if (!useModelStore.getState().isReadOnly) {
              setSelectedNodes(selection.nodes.map(node => node.id));
            }
            setSelectedEdges(selection.edges.map(edge => edge.id));
          }}

          onNodesChange={(changes) => {
            setEntityNodes(applyNodeChanges(changes, entityNodes))
          }}
          onEdgesChange={(changes) => {
            setActionEdges(applyEdgeChanges(changes, actionEdges))
          }}

          onMouseMove={(event) => {
            setCurrentMousePosition({x: event.clientX, y: event.clientY});
          }}

          onConnect={(params) => {
            if (isReadOnly) return;

            const sourceNode = entityNodes.find(node => node.id === params.source);
            const targetNode = entityNodes.find(node => node.id === params.target);

            setInputField({
              placeholder: "Введите название действия",
              x: currentMousePosition.x - divRef.current!.getBoundingClientRect().left,
              y: currentMousePosition.y - divRef.current!.getBoundingClientRect().top,
              onValidate: (text) => {
                
                new AddActionPrompt(sourceNode!.data, targetNode!.data, text).execute();
                const edge : ActionEdge = {
                  type: "actionEdge",
                  label: text,
                  sourceHandle: params.sourceHandle,
                  targetHandle: params.targetHandle,
                  animated: true,
                  markerEnd: { type: "arrowclosed", width: 25, height: 25} as any,
                  source: params.source,
                  target: params.target,
                  data: { name: text, passage: "", sourceLocation: "unknown", targetLocation: "unknown" },
                  id: "action-" + text
                }
                setActionEdges(addEdge(edge, actionEdges))
              }
            });
          }}

          onDoubleClick={(event) => {
            if (!useModelStore.getState().isReadOnly && (event.target as HTMLElement).classList.contains("react-flow__pane") && divRef.current) {
              setInputField(
                {
                  placeholder: "Введите имя сущности",
                  x: event.clientX - divRef.current!.getBoundingClientRect().left, 
                  y: event.clientY - divRef.current!.getBoundingClientRect().top,
                  onValidate: (text) => {
                    const entity = {name: text, emoji: "",  properties: []};
                    const entityNode = CreateEntityNode(entity, 0);
                    entityNode.position = screenToFlowPosition({x: event.clientX, y: event.clientY}, {snapToGrid: false});
                    const newEntityNodes = [...entityNodes, entityNode];
                    setEntityNodes(newEntityNodes)
                    LayoutUtils.optimizeNodeLayout("entity", newEntityNodes, setEntityNodes, {x: divRef.current!.clientWidth/2, y: divRef.current!.clientHeight/2}, 120, 100);
                  }
                });
            }
          }}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
        {inputField && <div style={{ position: 'absolute', top: inputField.y, left: inputField.x, zIndex: 999, transform: 'translate(-50%, -50%)', background: 'white', padding: 10, borderRadius: 5, boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px' }}>
          <input ref={inputFieldRef} type="text" placeholder={inputField.placeholder} 

          onBlur={() => {
            setInputField(null);
          }}
          
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              inputField.onValidate(inputFieldRef.current!.value);
              setInputField(null);
            } else if (event.key === "Escape") {
              setInputField(null);
            }
          }} /></div>}
          {!isReadOnly && <span style={{position: 'absolute', bottom: 5, left: '50%', transform: 'translate(-50%, 0%)', pointerEvents: 'none', color: '#888'}}>Double click to create a new entity</span>}
      </div>
    </>
  )
}
