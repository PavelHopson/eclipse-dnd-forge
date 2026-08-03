import { Handle, NodeProps, Position, useKeyPress, useReactFlow } from '@xyflow/react';
import { useCallback, useEffect } from 'react';

import { Slider } from '@nextui-org/react';
import '@xyflow/react/dist/style.css';
import { Entity, EntityKind, EntityNode, useModelStore } from '../../model/Model';
import { ABILITY_LABELS, AbilityKey, ChangeAbilityScorePrompt } from '../../model/prompts/textEditors/ChangeAbilityScorePrompt';
import { ChangeHpPrompt } from '../../model/prompts/textEditors/ChangeHpPrompt';
import { ChangePropertyPrompt } from '../../model/prompts/textEditors/ChangePropertyPrompt';
import { RemoveEntityPrompt } from '../../model/prompts/textEditors/RemoveEntityPrompt';

const KIND_STYLE: Record<EntityKind, { label: string; bg: string; fg: string }> = {
  hero: { label: 'Герой', bg: '#1e3a8a', fg: '#dbeafe' },
  npc: { label: 'NPC', bg: '#854d0e', fg: '#fef3c7' },
  monster: { label: 'Монстр', bg: '#7f1d1d', fg: '#fecaca' },
  faction: { label: 'Фракция', bg: '#3f3f46', fg: '#e4e4e7' },
  unknown: { label: '—', bg: '#e5e7eb', fg: '#374151' },
};


export function CreateEntityNode(entity: Entity, index: number): EntityNode {
  const x = index % 2;
  const y = Math.floor(index / 2);

  return {
    id: "entity-" + entity.name,
    type: "entityNode",
    dragHandle: '.custom-drag-handle',
    measured: { width: 160, height: 160 },
    position: { x: 20 + x * 350, y: 20 + y * 200 },
    data: { ...entity }
  }
}

export default function EntityNodeComponent(props: NodeProps<EntityNode>) {
  const handleStyle = { background: 'white', border: '1px solid #c8c8c8', width: 7, height: 7 };
  const isSelected = useModelStore(state => state.selectedNodes.includes(props.id));
  const { setNodes, setEdges } = useReactFlow();
  const deletePressed = useKeyPress(["Delete", "Backspace"]);
  const entityNodes = useModelStore(state => state.entityNodes);
  const setEntityNodes = useModelStore(state => state.setEntityNodes);
  const getFilteredEntityNodes = useModelStore(state => state.getFilteredEntityNodes);
  const highlightedEntities = useModelStore(state => state.highlightedEntities);
  const isReadOnly = useModelStore(state => state.isReadOnly);

  const highlightedActionsSegment = useModelStore(state => state.highlightedActionsSegment);
  const filteredActionsSegment = useModelStore(state => state.filteredActionsSegment);

  let isFaded = false;

  if (highlightedActionsSegment) {
    const filteredEntities = getFilteredEntityNodes(highlightedActionsSegment);
    isFaded = !filteredEntities.map(entity => entity.id).includes(props.id);
  }

  if (!isFaded && filteredActionsSegment) {
    const filteredEntities = getFilteredEntityNodes(filteredActionsSegment);
    isFaded = !filteredEntities.map(entity => entity.id).includes(props.id);
  }

  if (!isFaded && highlightedEntities.length > 0 && highlightedEntities.indexOf(props.id) === -1) {
    // Fade if no actions are connected to this entity
    isFaded = useModelStore.getState().actionEdges.filter(edge => highlightedEntities.includes(edge.source) && edge.target === props.id 
                                                          || highlightedEntities.includes(edge.target) && edge.source === props.id).length === 0;
  }

  if (!isReadOnly) {
    useEffect(() => {
      if (deletePressed && useModelStore.getState().selectedNodes.includes(props.id)) {
        // Also remove the edges that had this node as a source or target
        setEdges((edges) => edges.filter((edge) => edge.source !== props.id && edge.target !== props.id));
  
        // Remove the node
        setNodes((nodes) => nodes.filter((node) => node.id !== props.id));
  
        // Modify the story accordingly by executing a prompt
        new RemoveEntityPrompt(props.data).execute()
      }
    }, [deletePressed])
  }


  const onPropertySliderChanged = useCallback((property: string, newValue: number, triggerPrompt: boolean = false) => {
    const nodeToModify = entityNodes.find(node => node.id === props.id) as EntityNode;
    if (nodeToModify) {
      let previousValue = 0;
      nodeToModify.data.properties = nodeToModify.data.properties.map(p => {
        if (p.name === property) {
          previousValue = p.value;
          p.value = newValue;
        }
        return p;
      });
      setEntityNodes([...entityNodes]);

      if (triggerPrompt) {
        // Also trigger a prompt to modify the story
        new ChangePropertyPrompt(nodeToModify.data, property, previousValue, newValue).execute()
      }
    }
  }, [entityNodes, setEntityNodes])


  const propertySliders = props.data.properties.map(property => {
    return <div className="nodrag nopan" style={{ display: 'flex', flexDirection: 'column' }} key={`property-${props.data.name}-${property.name}`}>
      <Slider size='sm' label={property.name} className="max-w-md" step={1} color='primary' minValue={1} maxValue={10} defaultValue={property.value}
        onChangeEnd={(newValue) => onPropertySliderChanged(property.name, newValue as number, true)}>
      </Slider>
    </div>
  })


  return <>
    <div className='custom-drag-handle node-entity' style={{ position: 'relative', border: `1px solid ${isSelected ? '#4180d9' : 'white'}`, boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px', padding: 10, background: 'white', borderRadius: 5, opacity: isFaded ? '0.4' : 1 }}
      onMouseEnter={() => {
        useModelStore.getState().setHighlightedEntities([props.id]);
      }}

      onMouseLeave={() => {
        useModelStore.getState().setHighlightedEntities([]);
      }}
    >
      <Handle style={handleStyle} type="source" id="t" position={Position.Top} />
      <Handle style={handleStyle} type="source" id="b" position={Position.Bottom} />
      <Handle style={handleStyle} type="source" id="l" position={Position.Left} />
      <Handle style={handleStyle} type="source" id="r" position={Position.Right} />
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'left', minWidth: 130, minHeight: 50 }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: 10, background: 'rgb(243 244 246)', width: 40, height: 40, borderRadius: 99999 }}>
          {props.data.emoji}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <span style={{ fontWeight: 800, lineHeight: 1.1 }}>{props.data.name}</span>
          {props.data.kind && props.data.kind !== 'unknown' && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 999,
                background: KIND_STYLE[props.data.kind].bg,
                color: KIND_STYLE[props.data.kind].fg,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              {KIND_STYLE[props.data.kind].label}
            </span>
          )}
          {props.data.role && (
            <span style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.1 }}>{props.data.role}</span>
          )}
        </div>
      </div>

      {!isReadOnly && isSelected && <div style={{position: 'absolute', zIndex: 99999, border: '1px solid #e5e7eb', width: '100%', top: '100%', left: 0, background: 'white', padding: 10, borderRadius: 5, boxShadow: 'rgba(0, 0, 0, 0.24) 0px 3px 8px', display: 'flex', flexDirection: 'column', gap: 6}}>
        {propertySliders}
        {typeof props.data.hp === 'number' && props.data.hp > 0 && (
          <div className="nodrag nopan" style={{ display: 'flex', flexDirection: 'column' }}>
            <Slider
              size="sm"
              label={`Здоровье`}
              className="max-w-md"
              step={1}
              color="danger"
              minValue={0}
              maxValue={Math.max(props.data.hp, 50)}
              defaultValue={props.data.hp}
              onChangeEnd={(newValue) => {
                const previousHp = props.data.hp ?? 0;
                const newHp = newValue as number;
                if (newHp === previousHp) return;
                // Update the entity stat in the model first so the visual badge / dialogue reflect the change.
                const nodes = useModelStore.getState().entityNodes.map((n) =>
                  n.id === props.id ? { ...n, data: { ...n.data, hp: newHp } } : n,
                );
                useModelStore.getState().setEntityNodes(nodes);
                // Then ask the AI to rewrite the scene around the HP shift.
                new ChangeHpPrompt(props.data, previousHp, newHp).execute();
              }}
            />
          </div>
        )}
        {props.data.abilities && (
          <details className="nodrag nopan" style={{ fontSize: 11, color: '#3a2a2a' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, marginBottom: 4 }}>
              Характеристики (drag → AI перепишет сцену, если меняется тир)
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(Object.keys(ABILITY_LABELS) as AbilityKey[]).map((key) => {
                const value = props.data.abilities?.[key];
                if (typeof value !== 'number') return null;
                return (
                  <Slider
                    key={`ability-${key}`}
                    size="sm"
                    label={ABILITY_LABELS[key]}
                    className="max-w-md"
                    step={1}
                    color="primary"
                    minValue={3}
                    maxValue={20}
                    defaultValue={value}
                    onChangeEnd={(newValue) => {
                      const previous = props.data.abilities?.[key] ?? value;
                      const next = newValue as number;
                      if (next === previous) return;
                      const nodes = useModelStore.getState().entityNodes.map((n) =>
                        n.id === props.id
                          ? { ...n, data: { ...n.data, abilities: { ...(n.data.abilities || {}), [key]: next } } }
                          : n,
                      );
                      useModelStore.getState().setEntityNodes(nodes);
                      // ChangeAbilityScorePrompt skips itself when both values land in the same
                      // tier (high/mid/low), so cosmetic 14→15 changes don't burn a rewrite.
                      new ChangeAbilityScorePrompt(props.data, key, previous, next).execute();
                    }}
                  />
                );
              })}
            </div>
          </details>
        )}
      </div>}
    </div>
  </>
}
