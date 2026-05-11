import { Button, Tab, Tabs, Tooltip } from '@nextui-org/react';
import { ReactFlowProvider, useKeyPress } from '@xyflow/react';
import React, { useEffect, useState } from 'react';
import { FaTrashAlt } from 'react-icons/fa';
import { GiCastle, GiCrossedSwords } from 'react-icons/gi';
import { TbArrowBigLeftLinesFilled, TbArrowBigRightLinesFilled } from 'react-icons/tb';
import { useHistoryModelStore } from '../model/HistoryModel';
import { LayoutUtils } from '../model/LayoutUtils';
import { useModelStore } from '../model/Model';
import { RewriteFromVisual } from '../model/prompts/textEditors/RewriteFromVisual';
import { EntitiesExtractor } from '../model/prompts/textExtractors/EntitiesExtractor';
import { LocationExtractor } from '../model/prompts/textExtractors/LocationsExtractor';
import { VisualRefresher } from '../model/prompts/textExtractors/VisualRefresher';
import { useStudyStore } from '../study/StudyModel';
import HistoryTree from './HistoryTree';
import TextEditor from './TextEditor';
import ActionTimeline from './actionTimeline/ActionTimeline';
import EntitiesEditor from './entityActionView/EntitiesEditor';
import LocationsEditor from './locationView/LocationsEditor';


export default function VisualWritingInterface(props: { children?: React.ReactNode }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedTab, setSelectedTab] = useState('entities');
  const isStale = useModelStore(state => state.isStale);
  const isReadOnly = useModelStore(state => state.isReadOnly);
  const escapePressed = useKeyPress(["Escape"]);

  const visualPanelRef = React.createRef<HTMLDivElement>();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // undo/redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useHistoryModelStore.getState().redo();
        } else {
          useHistoryModelStore.getState().undo();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    }
  }, []);

  useEffect(() => {
    if (escapePressed) {
      // Unselect everything that can be selected
      useModelStore.getState().setSelectedNodes([]);
      useModelStore.getState().setSelectedEdges([]);
      useModelStore.getState().setFilteredActionsSegment(null, null);
    }
  }, [escapePressed]);


  useEffect(() => {
    const center = { x: visualPanelRef.current!.clientWidth / 2, y: visualPanelRef.current!.clientHeight / 2 };

    LayoutUtils.optimizeNodeLayout("entity", useModelStore.getState().entityNodes, useModelStore.getState().setEntityNodes, center, 120, 100);
    LayoutUtils.optimizeNodeLayout("location", useModelStore.getState().locationNodes, useModelStore.getState().setLocationNodes, center, 120);
  }, [selectedTab]);

  useEffect(() => {
    const center = { x: visualPanelRef.current!.clientWidth / 2, y: visualPanelRef.current!.clientHeight / 2 };

    // Make sure we update the layout everytime there is a refresh
    VisualRefresher.getInstance().onUpdate = () => {
      LayoutUtils.optimizeNodeLayout("locations", useModelStore.getState().locationNodes, useModelStore.getState().setLocationNodes, { x: center.x, y: center.y }, 120);
      LayoutUtils.optimizeNodeLayout("entity", useModelStore.getState().entityNodes, useModelStore.getState().setEntityNodes, { x: center.x, y: center.y }, 120, 100);
    }

    VisualRefresher.getInstance().onRefreshDone = () => {
      // Not stale anymore
      if (useModelStore.getState().isStale) {
        useModelStore.getState().setIsStale(false);
      }
    }
  });

  const setSelectedTabLogged = (tab: string) => {
    useStudyStore.getState().logEvent("TAB_CHANGE", { tab });
    setSelectedTab(tab);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'row', flexGrow: 1, height: '80%' }}>
        {props.children}
        <TextEditor />
        <div className='flex flex-col' style={{ position: 'relative' }}>
          <div style={{ width: '50vw', height: '100%', background: '#F3F4F6', borderLeft: '1px solid #DDDDDF', borderBottom: '1px solid #DDDDDF' }} ref={visualPanelRef}>
            {selectedTab === "entities" && <ReactFlowProvider><EntitiesEditor /></ReactFlowProvider>}
            {selectedTab === "locations" && <ReactFlowProvider><LocationsEditor /></ReactFlowProvider>}
            <Tabs keyboardActivation='manual' onSelectionChange={setSelectedTabLogged as any} selectedKey={selectedTab} color='primary' variant='bordered' style={{ position: 'absolute', left: '50%', top: 10, transform: 'translate(-50%, 0)' }} classNames={{ tabList: 'bg-white', }}>
              <Tab key={"entities"} title={<span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: 15 }}><GiCrossedSwords style={{ marginRight: 4, fontSize: 20 }} /> Heroes &amp; NPCs</span>} />
              <Tab key={'locations'} title={<span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: 15 }}><GiCastle style={{ marginRight: 4, fontSize: 20 }} /> Realms &amp; Locations</span>} />
            </Tabs>            

            {!isReadOnly && <Button style={{ position: 'absolute', right: 10, top: 10, fontSize: 18 }} isIconOnly onClick={(e) => {
              console.log(useModelStore.getState().entityNodes);
              // Cancel exisitng animations because otherwise they might revive the deleted nodes
              LayoutUtils.stopAllSimulations();
              useModelStore.getState().setActionEdges([]);
              useModelStore.getState().setLocationNodes([]);
              useModelStore.getState().setEntityNodes([]);
              useModelStore.getState().setFilteredActionsSegment(null, null);
              useModelStore.getState().setHighlightedActionsSegment(null, null);
              VisualRefresher.getInstance().reset();
            }}><FaTrashAlt /></Button>}
          </div>
          <ReactFlowProvider><ActionTimeline /></ReactFlowProvider>
          {!isReadOnly && <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'absolute', left: 0, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 22 }}>
            <Tooltip content="Refresh from text" closeDelay={0}>
              <Button style={{ fontSize: 22 }} color={isStale ? "primary": "default"} isLoading={isExtracting} isIconOnly radius={'full'}
                onClick={() => {

                  const center = { x: visualPanelRef.current!.clientWidth / 2, y: visualPanelRef.current!.clientHeight / 2 };

                  const visualRefreshCallback = () => {
                    VisualRefresher.getInstance().refreshFromText(useModelStore.getState().text,
                      () => { },
                      () => {
                        setIsExtracting(false);
                      });
                  }

                  setIsExtracting(true);

                  const entitiesExtractor = EntitiesExtractor(useModelStore.getState().text, center);
                  const locationsExtractor = LocationExtractor(useModelStore.getState().text, center);


                  let refreshRequirements: Promise<any> = new Promise<void>((resolve, reject) => { resolve() });

                  if (useModelStore.getState().locationNodes.length === 0 && useModelStore.getState().entityNodes.length === 0) refreshRequirements = Promise.all([entitiesExtractor, locationsExtractor]);
                  if (useModelStore.getState().locationNodes.length === 0) refreshRequirements = locationsExtractor;
                  if (useModelStore.getState().entityNodes.length === 0) refreshRequirements = entitiesExtractor;

                  refreshRequirements.then((response) => {
                    visualRefreshCallback();
                  });
                }}
              >
                <TbArrowBigRightLinesFilled />
              </Button>
            </Tooltip>

            <Tooltip placement='bottom' content="Write from visual" closeDelay={0}>
              <Button style={{ fontSize: 22 }} isLoading={isExtracting} isIconOnly radius={'full'}
                onClick={() => {
                  new RewriteFromVisual().execute();
                }}
              >
                <TbArrowBigLeftLinesFilled />
              </Button>
            </Tooltip>

          </div>}
        </div> 
      </div>
      {!isReadOnly && <HistoryTree />}

    </div>
  )
}