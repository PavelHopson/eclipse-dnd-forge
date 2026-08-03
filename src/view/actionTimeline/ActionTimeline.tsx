import { ConnectionMode, Node, NodeProps, ReactFlow, ViewportPortal, applyNodeChanges, useReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';

import { Button, Slider } from '@nextui-org/react';
import '@xyflow/react/dist/style.css';
import { GrNext, GrPrevious } from 'react-icons/gr';
import { ActionEdge, EntityNode, useModelStore } from '../../model/Model';
import { ReorderActionPrompt } from '../../model/prompts/textEditors/ReorderActionPrompt';
import { useStudyStore } from '../../study/StudyModel';

type Timeline = Node<{
  width: number;
  height: number;
  entity: EntityNode;
}>;

type Link = Node<{
  width: number;
  height: number;
  action: ActionEdge;
}>


// Bunch of constants for easy customization
const paddingLeft = 150;
const paddingTop = 15

const timelineHeight = 1;
const timelineSpacing = 30;

const actionSpacing = 30;
const actionWidth = 5;
const actionLeftPadding = actionSpacing / 2;



function TimelineNode(props: NodeProps<Timeline>) {
  return <>
    <div style={{ width: props.data.width, height: props.data.height, background: '#dddddd', borderRadius: 3, transform: 'translate(0%, -50%)' }}>
      <span style={{ transform: 'translate(-100%, -50%)', position: 'absolute', left: -10 }}>{props.data.entity.data.emoji} {props.data.entity.data.name}</span>
    </div>
  </>
}

function ActionLinkNode(props: NodeProps<Link>) {
  const barHeight = 25;
  const entities = useModelStore.getState().entityNodes;

  const sourceIndex = entities.findIndex(node => node.id === props.data.action.source);
  const targetIndex = entities.findIndex(node => node.id === props.data.action.target);

  const topIndex = Math.min(sourceIndex, targetIndex);
  const bottomIndex = Math.max(sourceIndex, targetIndex);

  if (topIndex === -1 || bottomIndex === -1 || sourceIndex >= entities.length || targetIndex >= entities.length) {
    return <></>
  }

  const topEntity = entities[topIndex];
  const bottomEntity = entities[bottomIndex];

  const isInverted = targetIndex === topIndex;

  const getMarker = (emoji: string, size: number) => {
    return <div style={{ width: size, height: size, background: 'rgba(255, 255, 255, 0)', borderRadius: 9999, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {emoji}
    </div>
  }

  if (topIndex === bottomIndex) {
    // Action is within the same entity
    return <div style={{ position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', width: barHeight, height: barHeight, transform: `translate(-100%, -50%)`, top: 0, left: '50%', background: '#BEBEDE', border: `1px solid rgb(73, 75, 168)`, borderRadius: 999 }}>
      {getMarker(topEntity.data.emoji, barHeight)}   
    </div> 
  }

  return <>
    <div style={{ position: 'relative', width: props.data.width, height: props.data.height, background: 'rgb(73, 75, 168)', transform: 'translate(-50%, 0%)', opacity: props.dragging ? 0.5 : 1 }}>


      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: isInverted ? 'right' : 'left', width: barHeight, height: barHeight, transform: `translate(-50%, -50%)`, top: 0, left: '50%', background: '#BEBEDE', border: `1px solid rgb(73, 75, 168)`, borderRadius: 999 }}>
        {getMarker(topEntity.data.emoji, barHeight)}
      </div>
      
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: isInverted ? 'left' : 'right', width: barHeight, height: barHeight, transform: `translate(-50%, 50%)`, bottom: 0, left: '50%', background: '#BEBEDE', border: `1px solid rgb(73, 75, 168)`, borderRadius: 999 }}>
        {getMarker(bottomEntity.data.emoji, barHeight)}
      </div>
    </div>
  </>
}


export default function ActionTimeline() {
  const entityNodes = useModelStore(state => state.entityNodes);
  const actionEdges = useModelStore(state => state.actionEdges);
  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);
  const setHighlightedActionsSegment = useModelStore(state => state.setHighlightedActionsSegment);

  const filteredActionsSegment = useModelStore(state => state.filteredActionsSegment);
  const setFilteredActionsSegment = useModelStore(state => state.setFilteredActionsSegment);
  const [isSelecting, setIsSelecting] = useState(false);

  const [isHovered, setIsHovered] = useState(false);

  const isReadOnly = useModelStore(state => state.isReadOnly);

  const [entityTimelines, setEntityTimelines] = useState<Timeline[]>([]);
  const [actionLinks, setActionLinks] = useState<Link[]>([]);

  const nodeTypes = useMemo(() => ({
    timelineNode: TimelineNode,
    actionLinkNode: ActionLinkNode
  }), []);

  const maxLength = Math.max(actionSpacing, actionEdges.length * actionSpacing);
  const maxHeight = entityNodes.length * (timelineHeight + timelineSpacing);

  const boundaries: [[number, number], [number, number]] = [
    [0, 0],
    [maxLength + paddingLeft + 10, (entityNodes.length) * (timelineHeight + timelineSpacing) + 10]
  ]


  useEffect(() => {
    const newEntityTimelines: Timeline[] = entityNodes.map((entityNode, index) => {
      return {
        id: entityNode.id,
        type: "timelineNode",
        draggable: false,
        selectable: false,
        position: { x: paddingLeft, y: index * (timelineHeight + timelineSpacing) + paddingTop },
        data: { width: maxLength, height: timelineHeight, entity: entityNode }
      }
    });

    const newActionLinks: Link[] = actionEdges.map((actionEdge, index) => {
      const sourceIndex = entityNodes.findIndex(node => node.id === actionEdge.source);
      const targetIndex = entityNodes.findIndex(node => node.id === actionEdge.target);

      return {
        id: "action" + actionEdge.id,
        type: "actionLinkNode",
        draggable: !isReadOnly,
        selectable: !isReadOnly,
        position: { x: index * actionSpacing + paddingLeft + actionLeftPadding, y: Math.min(sourceIndex, targetIndex) * (timelineHeight + timelineSpacing) + paddingTop },
        data: { width: actionWidth, height: Math.abs(sourceIndex - targetIndex) * (timelineHeight + timelineSpacing), action: actionEdge }
      }
    });

    setEntityTimelines(newEntityTimelines);
    setActionLinks(newActionLinks);
  }, [entityNodes, actionEdges, isReadOnly, maxLength]);



  const reactFlow = useReactFlow();


  const [zoom, setZoom] = useState(reactFlow.getZoom());
  
  // Listen for key pressed left or right to scroll the timeline
  useEffect(() => {
    const listener = (e : KeyboardEvent) => {
      if (isHovered && e.key === 'ArrowLeft') {
        reactFlow.setViewport({ ...reactFlow.getViewport(), x: reactFlow.getViewport().x + 100 }, { duration: 100 })
        e.preventDefault();
      } else if (isHovered && e.key === 'ArrowRight') {
        reactFlow.setViewport({ ...reactFlow.getViewport(), x: reactFlow.getViewport().x - 100 }, { duration: 100 })
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', listener);

    return () => {
      document.removeEventListener('keydown', listener);
    }
  }, [reactFlow, isHovered]);


  let nbEventsShown = highlightedActionsSegment ? highlightedActionsSegment.end - highlightedActionsSegment.start + 1 : filteredActionsSegment ? filteredActionsSegment.end - filteredActionsSegment.start + 1: actionEdges.length;
  const highlightedEntities = useModelStore(state => state.highlightedEntities);

  if (highlightedEntities.length > 0) {
    nbEventsShown = actionEdges.filter(edge => highlightedEntities.includes(edge.source) || highlightedEntities.includes(edge.target)).length;
  }

  return (
    <>
    <div 
      style={{ width: '100%', height: 40, background: "rgb(247 246 249)", border: 'solid 1px rgb(242 242 244)', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Slider size='sm' value={zoom}
      style={{width: 100, marginLeft: 10}}
      aria-label='Zoom slider'
      showSteps={true} minValue={0.5} maxValue={1.5} step={0.1}
      onChange={(value) => {
        // Change the zoom level
        reactFlow.zoomTo(value as number, { duration: 50 });
        setZoom(reactFlow.getZoom());
      }}>
      </Slider>
      <span style={{fontSize: 12, color: 'rgba(0,0,0,0.5)', marginRight: 10}}>
        {nbEventsShown < actionEdges.length ? `Viewing ${nbEventsShown} / ${actionEdges.length} Events` : `Viewing all ${actionEdges.length} Events`}
      </span>

      <div>
      <Button variant='light' size="sm" isIconOnly onClick={() => {
        // Scroll the react flow to the left
        reactFlow.setViewport({ ...reactFlow.getViewport(), x: reactFlow.getViewport().x + 100 }, { duration: 100 })
      }}>
        <GrPrevious />
      </Button>
      <Button variant='light' size="sm" isIconOnly onClick={() => {
        // Scroll the react flow to the right
        reactFlow.setViewport({ ...reactFlow.getViewport(), x: reactFlow.getViewport().x - 100 }, { duration: 100 })
      }}>
        <GrNext />
      </Button>
      </div>
    </div>
      <div style={{ width: '100%', height: 300 }}>
        <ReactFlow
          onMouseMove={(e) => {
            const pos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false })
            // Find the closest action link
            const index = Math.round((pos.x - paddingLeft - actionLeftPadding) / actionSpacing);
            const isValid = index >= 0 && index < actionEdges.length;

            if (isSelecting) {
              const min = Math.min(filteredActionsSegment!.start, filteredActionsSegment!.end, index);
              const max = Math.max(filteredActionsSegment!.start, filteredActionsSegment!.end, index);
              setFilteredActionsSegment(min, max);
            } else {
              if (isValid) {
                setHighlightedActionsSegment(index, index);
              } else {
                setHighlightedActionsSegment(null, null);
              }
            }
          }}

          onMouseLeave={() => {
            setHighlightedActionsSegment(null, null);
            setIsHovered(false);
          }}

          onMouseEnter={() => {
            setIsHovered(true);
          }}

          onMouseDown={(e) => {
            if (e.button === 0) {
              const pos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY }, { snapToGrid: false })

              const index = Math.round((pos.x - paddingLeft - actionLeftPadding) / actionSpacing);
              if (index >= 0 && index < actionEdges.length) {
                setFilteredActionsSegment(index, index);
                setHighlightedActionsSegment(null, null);
                setIsSelecting(true);
              } else {
                setFilteredActionsSegment(null, null);
                setHighlightedActionsSegment(null, null);
                setIsSelecting(false);
              }
            }
            e.preventDefault();
            e.stopPropagation();
          }}

          onMouseUp={(e) => {
            if (e.button === 0) {
              setIsSelecting(false);
              useStudyStore.getState().logEvent("TIMELINE_SELECTED", { start: filteredActionsSegment?.start, end: filteredActionsSegment?.end });
            }
          }}

          panOnDrag={false}


          translateExtent={boundaries}
          zoomOnDoubleClick={false}
          defaultViewport={{ x: 0, y: boundaries[0][1], zoom: 1 }}
          nodes={[...entityTimelines, ...actionLinks]}
          connectionMode={ConnectionMode.Loose}
          nodeTypes={nodeTypes as any}
          deleteKeyCode={[]}
          fitView={false}
          panOnScroll={true}


        onNodesChange={(changes) => {
          changes.map(change => {
            if (change.type === 'position' && change.position) {
              const actionLink = actionLinks.find(node => node.id === change.id);
              if (actionLink) {
                change.position.y = actionLink.position.y;
                change.position.x = Math.max(paddingLeft, Math.min(paddingLeft + maxLength, change.position.x));
              }
            }
          })
          // @ts-ignore
          setActionLinks(applyNodeChanges(changes, actionLinks)) 
        }}

        onNodeDragStart={() => {
          setHighlightedActionsSegment(null, null);
          setFilteredActionsSegment(null, null);
        }}

        onNodeDragStop={(_event, node) => {
          const targetIndex = Math.round((node.position.x - paddingLeft - actionLeftPadding+actionSpacing/2) / actionSpacing);
          const originalIndex = actionLinks.findIndex(link => link.id === node.id);

          if (node.type === "actionLinkNode" && targetIndex >= 0 && targetIndex < actionEdges.length+1 && targetIndex !== originalIndex) {
            const actionLinkNode = node as Link;
            new ReorderActionPrompt(actionLinkNode.data?.action?.data as any, originalIndex, targetIndex).execute()
          }
        }}

        >
          <ViewportPortal>
            {highlightedActionsSegment &&
              <div style={{
                pointerEvents: 'none',
                position: 'absolute', left: -(actionSpacing) / 2, height: maxHeight, width: (actionSpacing), background: 'rgba(0,0,0,0.2)',
                transform: `translate(${highlightedActionsSegment.start * actionSpacing + paddingLeft + actionLeftPadding}px, 0px)`
              }} />
            }
            {filteredActionsSegment &&
              <div style={{
                borderLeft: '2px solid rgba(100,100,100,0.5)',
                borderRight: '2px solid rgba(100,100,100,0.5)',
                pointerEvents: 'none',
                position: 'absolute', left: -(actionSpacing) / 2, height: maxHeight, width: (actionSpacing) * ((filteredActionsSegment.end - filteredActionsSegment.start)+1), background: 'rgba(0,0,0,0.2)',
                transform: `translate(${filteredActionsSegment.start * actionSpacing + paddingLeft + actionLeftPadding}px, 0px)`
              }} />
            }
          </ViewportPortal>
        </ReactFlow>
      </div>
    </>
  )
}
