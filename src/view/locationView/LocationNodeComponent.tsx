import { Slider } from '@nextui-org/react';
import { NodeProps, useKeyPress } from '@xyflow/react';
import { useEffect } from 'react';

import '@xyflow/react/dist/style.css';
import { Location, LocationNode, useModelStore } from '../../model/Model';
import { ChangeDangerPrompt } from '../../model/prompts/textEditors/ChangeDangerPrompt';
import { useViewModelStore } from '../../model/ViewModel';


export function CreateLocatioNode(location: Location, index: number): LocationNode {
  const x = index % 2;
  const y = Math.floor(index / 2);

  return {
    id: `location-${index}`,
    dragHandle: '.custom-drag-handle',
    type: "locationNode",
    measured: {width: 160, height: 160},
    position: { x: 20 + x * 350, y: 20 + y * 200 },
    data: location
  }
}

export default function LocationNodeComponent(props: NodeProps<LocationNode>) {
  const deletePressed = useKeyPress(["Delete", "Backspace"]);
  const getFilteredLocationNodes = useModelStore(state => state.getFilteredLocationNodes);
  const isSelected = useModelStore(state => state.selectedNodes.includes(props.id));
  const isReadOnly = useModelStore(state => state.isReadOnly);

  const hoveredLocation = useViewModelStore(state => state.hoveredLocation);

  let isHovered = hoveredLocation === props.data.name;

  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);

  let isFaded = false;

  if (highlightedActionsSegment) {
    const filteredLocations = getFilteredLocationNodes(highlightedActionsSegment);
    isFaded = !filteredLocations.map(l => l.id).includes(props.id);
  }

  useEffect(() => {
    if (deletePressed && useModelStore.getState().selectedNodes.includes(props.id)) {
      // TODO
    }
  }, [deletePressed])



  const danger = props.data.danger;
  const dangerRingColor = typeof danger === 'number' && danger >= 7
    ? '#b91c1c'
    : typeof danger === 'number' && danger >= 4
      ? '#b45309'
      : typeof danger === 'number' && danger > 0
        ? '#15803d'
        : null;

  return <>
    <div className='custom-drag-handle' style={{ border: `2px solid ${isHovered ? '#2563eb' : (dangerRingColor || 'white')}`, boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px', width: 160, height: 160, padding: 10, background: 'white', borderRadius: 9999, opacity: isFaded ? '0.3' : 1, position: 'relative' }}>
      <div style={{ display: 'flex', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <span style={{ fontSize: 28 }}>{props.data.emoji}</span>
        <span style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{props.data.name}</span>
        {props.data.biome && (
          <span style={{ fontSize: 10, color: '#6b7280', textTransform: 'lowercase' }}>{props.data.biome}</span>
        )}
        {typeof danger === 'number' && danger > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              background: dangerRingColor || '#9ca3af',
              color: 'white',
              letterSpacing: 0.3,
              marginTop: 2,
            }}
          >
            DANGER {danger}/10
          </span>
        )}
      </div>
      {!isReadOnly && isSelected && (
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            zIndex: 99999,
            border: '1px solid #e5e7eb',
            width: 220,
            top: '100%',
            left: '50%',
            transform: 'translate(-50%, 8px)',
            background: 'white',
            padding: 10,
            borderRadius: 8,
            boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px',
          }}
        >
          <Slider
            size="sm"
            label="Danger"
            step={1}
            color="danger"
            minValue={1}
            maxValue={10}
            defaultValue={typeof danger === 'number' && danger > 0 ? danger : 5}
            onChangeEnd={(newValue) => {
              const previous = typeof danger === 'number' ? danger : 5;
              const next = newValue as number;
              if (next === previous) return;
              const nodes = useModelStore.getState().locationNodes.map((n) =>
                n.id === props.id ? { ...n, data: { ...n.data, danger: next } } : n,
              );
              useModelStore.getState().setLocationNodes(nodes);
              new ChangeDangerPrompt(props.data, previous, next).execute();
            }}
          />
        </div>
      )}
    </div>
  </>
}