import { Background, BackgroundVariant, Controls, Node, NodeProps, ReactFlow, useReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import '@xyflow/react/dist/style.css';
import { forceCollide, forceSimulation, forceX, forceY } from 'd3-force';
import { LayoutUtils } from '../../model/LayoutUtils';
import { Entity, useModelStore } from '../../model/Model';
import { useViewModelStore } from '../../model/ViewModel';
import { MoveEntityPrompt } from '../../model/prompts/textEditors/MoveEntityPrompt';
import LocationNodeComponent, { CreateLocatioNode } from './LocationNodeComponent';


export type SpatialEntity = {
  location: string;
} & Entity;

export type SpatialEntityNode = Node<SpatialEntity>;


function SpatialEntityNodeComponent(props: NodeProps<SpatialEntityNode>) {
  const isSelected = useModelStore(state => state.selectedNodes.includes(props.id));
  const filteredActionsSegment = useModelStore(state => state.filteredActionsSegment);
  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);

  let filter = filteredActionsSegment || highlightedActionsSegment;

  const filteredEntities = useModelStore.getState().getFilteredEntityNodes(filter);

  let isFaded = !filteredEntities.map(entity => entity.data.name).includes(props.data.name);
  
  return <>
    <div className='custom-drag-handle' style={{position: 'relative', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${isSelected ? 'blue' : 'white'}`, width: 50, height: 50, boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px', padding: 10, background: 'white', borderRadius: 999, opacity: isFaded ? '0.3' : 1 }}>
          <span style={{fontSize: 24}}>{props.data.emoji}</span>
          <div style={{position: 'relative'}}>
            <span style={{ whiteSpace: 'nowrap', fontWeight: 400, padding: 1, position: 'absolute', borderRadius: 3, background: 'white', transform: 'translate(-50%, 0%)',  boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px', top: -4, left: 0, fontSize: 10 }}>{props.data.name} </span>
          </div>
    </div>
  </>
}


export default function LocationsEditor() {
  const entityNodes = useModelStore(state => state.entityNodes);
  const locationNodes = useModelStore(state => state.locationNodes);
  const getFilteredActionEdges = useModelStore(state => state.getFilteredActionEdges);
  const setLocationNodes = useModelStore(state => state.setLocationNodes);
  const [spatialEntityNodes, setSpatialEntityNodes] = useState<SpatialEntityNode[]>([]);
  const filteredActionsSegment = useModelStore(state => state.filteredActionsSegment);
  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);
  const [canSimulateForce, setCanSimulateForce] = useState(true);
  const [newLocationInputPosition, setNewLocationInputPosition] = useState<{ x: number, y: number } | null>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);
  const { getIntersectingNodes, screenToFlowPosition } = useReactFlow();
  const isReadOnly = useModelStore(state => state.isReadOnly);


  if (entityNodes.length > 0 && locationNodes.length === 0) {
    const unkownLocation = CreateLocatioNode({ name: "unknown", emoji: "" }, 0);
    setLocationNodes([unkownLocation]);
  }


  useMemo(() => {
    if (!canSimulateForce) {
      LayoutUtils.stopSimulation('spatial-nodes');
      return;
    }
    let onlyLastKnownLocations = false;
    let filter = filteredActionsSegment;
    if (filteredActionsSegment) {
      onlyLastKnownLocations = true;
      filter = { start: 0, end: filteredActionsSegment.end }
    }

    if (highlightedActionsSegment) {
      onlyLastKnownLocations = true;
      filter = { start: 0, end: highlightedActionsSegment.end }
    }

    const filteredActionEdges = getFilteredActionEdges(filter);

    // Retrieve all entities and their locations based on the actions
    const entityLastKnownLocation: { [key: string]: string } = {};
    const entityVisitedLocations : { [key: string]: string[] } = {};

    for (const actionEdge of filteredActionEdges) {
      const locations = [
        { location: locationNodes.find(location => location.data.name === actionEdge.data?.sourceLocation), entityAtLocation: actionEdge.source },
        { location: locationNodes.find(location => location.data.name === actionEdge.data?.targetLocation), entityAtLocation: actionEdge.target }
      ];
      
      locations.forEach(({ location, entityAtLocation }) => {
        if (location) {
          const entity = entityNodes.find(e => e.id === entityAtLocation);
      
          if (entity) {
            const entityName = entity.data.name;
      
            if (!entityVisitedLocations[entityName]) {
              entityVisitedLocations[entityName] = [];
            }
      
            entityVisitedLocations[entityName].push(location.data.name);
            entityLastKnownLocation[entityName] = location.data.name;
          }
        }
      });      
    }


    // Now create the spatialEntityNodes
    const newSpatialEntityNodes: SpatialEntityNode[] = [];
    for (const [entity, locations] of Object.entries(entityVisitedLocations)) {
      const locationsToConsider = onlyLastKnownLocations ? [locations[locations.length-1]] : new Set(locations);
      for (const location of locationsToConsider) {
        const locationNode = locationNodes.find(node => node.data.name === location);
        const entityNode = entityNodes.find(node => node.data.name === entity);
        const id = `spatial-entity-${entity}-${onlyLastKnownLocations ? "" : location}`;
        const previousNode = spatialEntityNodes.find(node => node.id === id);

        if (locationNode && entityNode) {
          const locationWidth = locationNode?.measured?.width || 0;
          const locationHeight = locationNode?.measured?.height || 0;
          newSpatialEntityNodes.push({
            ...(previousNode? previousNode : {}),
            id: id,
            draggable: !isReadOnly,
            selectable: !isReadOnly,
            type: "spatialEntityNode",
            dragHandle: '.custom-drag-handle',
            measured: { width: 50, height: 50 }, // Since ReactFlow 12, not giving this value results in some NaN value when dragging
            position: { x: previousNode?.position.x || locationNode.position.x + locationWidth/2-25, y: previousNode?.position.y || locationNode.position.y +  locationHeight/2 - 25 },
            data: {...entityNode.data, location: location}
          })
        }
      }
    }

    
    // Run a force simulation to properly position the entities
    const nodes = newSpatialEntityNodes.map(node => {
      const location = useModelStore.getState().locationNodes.find(location => location.data.name === node.data.location);
      const targetX = ((location?.position.x || 0) + (location?.measured?.width || 0)/2);
      const targetY = ((location?.position.y || 0) + (location?.measured?.height || 0)/2);

      return { id: node.id, x: node.position.x, y: node.position.y, data: node, cx: targetX, cy: targetY }
    });


    
    const simulation = forceSimulation(nodes)
      .force("x", forceX(d => d.cx - (d.data?.measured?.width || 0)/2)) 
      .force("y", forceY(d => d.cy - (d.data?.measured?.height || 0)/2))
      .force("collide", forceCollide(30))
      .tick(1) // Because we might be restarting the simulation, we want to make sure we are not starting from scratch because it would cause some jittering

    LayoutUtils.startSimulation('spatial-nodes', simulation as any, () => {
      let stable = false;
      if (spatialEntityNodes.length === nodes.length) {
        stable = true;
        nodes.forEach((node, i) => {
          let dx = node.x - spatialEntityNodes[i].position.x;
          let dy = node.y - spatialEntityNodes[i].position.y;
          let movement = Math.sqrt(dx * dx + dy * dy);
  
          if (Math.abs(movement) > 0.08) {
              stable = false;
          }
      });
      }

      
      if (!stable) {
        setSpatialEntityNodes(nodes.map(node => {
          return  node.data.dragging ? node.data : { ...node.data, position: { x: node.x, y: node.y } }
      }))
      } else {
        // Stop early, seems like there will not be any more movement
        LayoutUtils.stopSimulation('spatial-nodes');
      }
    }, 100);
  }, [filteredActionsSegment, highlightedActionsSegment, spatialEntityNodes, locationNodes, canSimulateForce]);


  useEffect(() => {
    // Give the focus to the input
    if (locationInputRef.current && newLocationInputPosition) {
      // clear it as well
      locationInputRef.current.value = "";
      locationInputRef.current.focus();
    }
  }, [newLocationInputPosition]);

  const nodeTypes = useMemo(() => ({
    spatialEntityNode: SpatialEntityNodeComponent,
    locationNode: LocationNodeComponent
  }), []);

  return (
    <>
      <div ref={divRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <ReactFlow
        
          nodes={[...locationNodes, ...spatialEntityNodes]}
          nodeTypes={nodeTypes as any}
          deleteKeyCode={[]}
          zoomOnDoubleClick={false}

        /*onSelectionChange={(selection) => {
        }}*/

        onNodesChange={(changes) => {
          const positionChanges = new Map(
            changes.flatMap((change) => change.type === 'position' && change.position
              ? [[change.id, change.position] as const]
              : []),
          );
          if (positionChanges.size > 0) {
            //setCanSimulateForce(false);
            setSpatialEntityNodes(spatialEntityNodes.map((node) => {
              const position = positionChanges.get(node.id);
              return position ? { ...node, position } : node;
            }));
            setLocationNodes(locationNodes.map((node) => {
              const position = positionChanges.get(node.id);
              return position ? { ...node, position } : node;
            }));
          } 
        }}

        onDoubleClick={(event) => {
          // get x and y relative to the divRef
          if (!useModelStore.getState().isReadOnly && (event.target as HTMLElement).classList.contains("react-flow__pane") && divRef.current) {
            const x = event.clientX - divRef.current?.getBoundingClientRect().left;
            const y = event.clientY - divRef.current?.getBoundingClientRect().top;
            setNewLocationInputPosition({ x: x, y: y });
          }
        }}

        onNodeDragStart={() => {
          setCanSimulateForce(false);
        }}

        onNodeDrag={(_event, node) => {
          const intersections = getIntersectingNodes(node);
          let resetHoveredElement = true;
          if (node.type === "spatialEntityNode") {
            for (const intersection of intersections) {
              if (intersection.type === "locationNode") {
                useViewModelStore.getState().setHoveredLocation(intersection.data?.name as any);
                resetHoveredElement = false;
              }
            }
  
            if (resetHoveredElement) {
              useViewModelStore.getState().setHoveredLocation(null);
            }
          }
        }}

        onNodeDragStop={(_event, node) => {
          const hoveredLocation = useViewModelStore.getState().hoveredLocation;
          if (node.type === "spatialEntityNode" && hoveredLocation) {
            const spatialEntityNode = (node as SpatialEntityNode);
            const locationNode = locationNodes.find(location => location.data.name === hoveredLocation);
            if (locationNode && hoveredLocation !== spatialEntityNode.data.location) {
              // Update the id of the spatialEntityNode so that it matches the new simuation
              const previousId = spatialEntityNode.id;
              spatialEntityNode.id = `spatial-entity-${spatialEntityNode.data.name}-${hoveredLocation}`;
              const newSpatialEntityNodes = spatialEntityNodes.map(node => node.id === previousId ? spatialEntityNode : node);
              setSpatialEntityNodes([...newSpatialEntityNodes]);

              new MoveEntityPrompt(spatialEntityNode.data, locationNode.data).execute();
            }
          }

          setCanSimulateForce(true);

          useViewModelStore.getState().setHoveredLocation(null);
        }}

        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
        {newLocationInputPosition && <div style={{ position: 'absolute', top: newLocationInputPosition.y, left: newLocationInputPosition.x, zIndex: 999, transform: 'translate(-50%, -50%)', background: 'white', padding: 10, borderRadius: 5, boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px' }}>
          <input ref={locationInputRef} autoFocus type="text" placeholder="Введите название локации"

          onBlur={() => {
            setNewLocationInputPosition(null);
          }}
          
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              const location = event.currentTarget.value;
              const pos = screenToFlowPosition({x: newLocationInputPosition.x + divRef.current!.getBoundingClientRect().left, y: newLocationInputPosition.y + divRef.current!.getBoundingClientRect().top}, {snapToGrid: false});
              const newLocatioNodes = [...locationNodes, { id: `location-${location}`, type: "locationNode", measured: { width: 160, height: 160 }, position: { x: pos.x, y: pos.y }, data: { name: location, emoji: "" } }]
              setLocationNodes(newLocatioNodes)
              setNewLocationInputPosition(null);
              LayoutUtils.optimizeNodeLayout("location", newLocatioNodes, setLocationNodes, { x: divRef.current!.clientWidth/2, y: divRef.current!.clientHeight/2 }, 120);
            } else if (event.key === "Escape") {
              setNewLocationInputPosition(null);
            }
          }} /></div>}
        {!isReadOnly && <span style={{position: 'absolute', bottom: 5, left: '50%', transform: 'translate(-50%, 0%)', pointerEvents: 'none', color: '#888'}}>Двойной клик — создать новую локацию</span>}
      </div>
    </>
  )
}
