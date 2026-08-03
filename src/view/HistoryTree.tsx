import { Button, Tooltip } from '@nextui-org/react';
import { HierarchyPointNode } from 'd3-hierarchy';
import { useCallback, useEffect } from 'react';
import Tree, { TreeNodeDatum } from 'react-d3-tree';
import { IoArrowRedo, IoArrowUndo } from 'react-icons/io5';
import { useHistoryModelStore } from '../model/HistoryModel';
import { useModelStore } from '../model/Model';


export default function HistoryTree() {
  let historyTree = useHistoryModelStore(state => state.historyTree);
  const positionInTree = useHistoryModelStore(state => state.positionInTree);
  const redoStack = useHistoryModelStore(state => state.redoPositionStack);

  // If the historyTree is empty, we add a state to represent we are at the root
  useEffect(() => {
    if (useHistoryModelStore.getState().historyTree === null) {
      useHistoryModelStore.getState().addHistoryNode(useModelStore.getState());
    }
  }, []);

  if (historyTree === null) {
    // Quick fix to avoid empty tree
    historyTree = {name: '', children: [], state: useModelStore.getState()};
  }


  const findPositionFromHieararchyPointNode = useCallback((nodeData: HierarchyPointNode<TreeNodeDatum>) => {
    // Climb up the tree until the root to figure out the position of the node
    const nodePosition : number[] = [];
    let parent = nodeData.parent;
    let currentNode = nodeData;

    while (parent !== null && parent.children) {
      const posWithinParent = parent.children.findIndex((child: any) => child === currentNode);
      nodePosition.splice(0, 0, posWithinParent);
      currentNode = parent;
      parent = parent.parent;
    }

    return nodePosition;
  }, []);


  const onNodeClick = (position: number[]) => {
    useHistoryModelStore.getState().setPositionInTree(position);
  }


  return (
      <div id="treeWrapper" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', flexGrow: 0, maxHeight: 50, background: '#F3F4F6', borderTop: '1px solid #DDDDDF'}}>
        <Tooltip content="Отменить последнее изменение" closeDelay={0} placement='right'>
          <Button aria-label="Отменить последнее изменение" isDisabled={positionInTree.length === 0} isIconOnly size='sm' style={{fontSize: 18, marginLeft: 5}} onClick={() => useHistoryModelStore.getState().undo()}><IoArrowUndo/></Button>
        </Tooltip>
        <Tooltip content="Вернуть отменённое изменение" closeDelay={0} placement='right'>
          <Button aria-label="Вернуть отменённое изменение" isDisabled={redoStack.length === 0} isIconOnly size='sm' style={{fontSize: 18, marginLeft: 5}} onClick={() => useHistoryModelStore.getState().redo()}><IoArrowRedo/></Button>
        </Tooltip>
        <Tree
          data={historyTree} 
          collapsible={false}
          draggable={false}
          zoomable={false}
          translate={{ x: 25, y: 25 }}
          transitionDuration={500}
        
          nodeSize={{ x: 20, y: 15 }}
          orientation='horizontal' 

          renderCustomNodeElement={(nodeData) => {
            const position = findPositionFromHieararchyPointNode(nodeData.hierarchyPointNode);
            const isSelected = position.join(',') === positionInTree.join(',');

            return <circle className='history-node' r={6} fill={isSelected ? '#326FEE' : '#6D6E6E'} strokeWidth={0}
            onClick={() => onNodeClick(position)}></circle>;
          }}
          />
      </div>
  )
}
