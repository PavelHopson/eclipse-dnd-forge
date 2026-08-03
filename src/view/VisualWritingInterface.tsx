import { Button, Tab, Tabs, Tooltip } from '@nextui-org/react';
import { ReactFlowProvider, useKeyPress } from '@xyflow/react';
import React, { useEffect, useRef, useState } from 'react';
import { FaTrashAlt } from 'react-icons/fa';
import { GiBattleAxe, GiBookmarklet, GiCastle, GiChatBubble, GiCrossedSwords, GiCrown, GiDiceTwentyFacesTwenty, GiMeeple, GiSandsOfTime, GiSpellBook, GiSwordman, GiWorld } from 'react-icons/gi';
import { TbArrowBigLeftLinesFilled, TbArrowBigRightLinesFilled } from 'react-icons/tb';
import { useHistoryModelStore } from '../model/HistoryModel';
import { LayoutUtils } from '../model/LayoutUtils';
import { useModelStore } from '../model/Model';
import { RewriteFromVisual } from '../model/prompts/textEditors/RewriteFromVisual';
import { EntitiesExtractor } from '../model/prompts/textExtractors/EntitiesExtractor';
import { LocationExtractor } from '../model/prompts/textExtractors/LocationsExtractor';
import { VisualRefresher } from '../model/prompts/textExtractors/VisualRefresher';
import { runWorldTick } from '../model/agents/WorldTickAgent';
import { useAgentStore } from '../store/useAgentStore';
import { WORLD_TICK_INTERVAL_MS, useWorldEventStore } from '../store/useWorldEventStore';
import { useStudyStore } from '../study/StudyModel';
import HistoryTree from './HistoryTree';
import TextEditor from './TextEditor';
import ActionTimeline from './actionTimeline/ActionTimeline';
import DiceRollerPanel from './dnd/DiceRollerPanel';
import DmAgentPanel from './dnd/DmAgentPanel';
import EncounterGeneratorPanel from './dnd/EncounterGeneratorPanel';
import InitiativePanel from './dnd/InitiativePanel';
import MapWorkflowPanel from './dnd/MapWorkflowPanel';
import NpcDialoguePanel from './dnd/NpcDialoguePanel';
import NpcGeneratorPanel from './dnd/NpcGeneratorPanel';
import PlayModePanel from './dnd/PlayModePanel';
import SessionsPanel from './dnd/SessionsPanel';
import WorldTickPanel from './dnd/WorldTickPanel';
import EntitiesEditor from './entityActionView/EntitiesEditor';
import LocationsEditor from './locationView/LocationsEditor';


export default function VisualWritingInterface(props: { children?: React.ReactNode }) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedTab, setSelectedTab] = useState('entities');
  const [isNpcPanelOpen, setIsNpcPanelOpen] = useState(false);
  const [talkingToEntityId, setTalkingToEntityId] = useState<string | null>(null);
  const [isDmPanelOpen, setIsDmPanelOpen] = useState(false);
  const [isWorldTickPanelOpen, setIsWorldTickPanelOpen] = useState(false);
  const [encounterForLocationId, setEncounterForLocationId] = useState<string | null>(null);
  const [isInitiativePanelOpen, setIsInitiativePanelOpen] = useState(false);
  const [isDicePanelOpen, setIsDicePanelOpen] = useState(false);
  const [isSessionsPanelOpen, setIsSessionsPanelOpen] = useState(false);
  const [isPlayModePanelOpen, setIsPlayModePanelOpen] = useState(false);
  const [isMapPanelOpen, setIsMapPanelOpen] = useState(false);
  const autoTickInterval = useWorldEventStore((s) => s.autoTickInterval);
  const locationNodes = useModelStore(state => state.locationNodes);
  const selectedNodes = useModelStore(state => state.selectedNodes);
  const entityNodes = useModelStore(state => state.entityNodes);

  // A location is "encounter-able" when exactly one location node is selected
  // on the Realms tab.
  const selectedLocationId = (() => {
    if (selectedNodes.length !== 1) return null;
    const id = selectedNodes[0];
    return locationNodes.some((n) => n.id === id) ? id : null;
  })();
  const isStale = useModelStore(state => state.isStale);
  const isReadOnly = useModelStore(state => state.isReadOnly);
  const escapePressed = useKeyPress(["Escape"]);

  // A selection is "talkable" when exactly one entity node is currently selected.
  const selectedEntityId = (() => {
    if (selectedNodes.length !== 1) return null;
    const id = selectedNodes[0];
    return entityNodes.some((n) => n.id === id) ? id : null;
  })();

  // If the dialogue panel is open and the user clicks a different entity, switch the panel to it.
  useEffect(() => {
    if (talkingToEntityId && selectedEntityId && selectedEntityId !== talkingToEntityId) {
      setTalkingToEntityId(selectedEntityId);
    }
  }, [selectedEntityId, talkingToEntityId]);

  // World-tick auto-scheduler. Polls every 30s and fires a tick when the
  // configured interval has elapsed since the last (manual or auto) tick.
  // Lives at the in-app level — closing the tab pauses the scheduler;
  // there is no background service worker.
  useEffect(() => {
    if (autoTickInterval === "off" || isReadOnly) return;

    const intervalMs = WORLD_TICK_INTERVAL_MS[autoTickInterval];
    let cancelled = false;

    async function tryFire() {
      if (cancelled) return;
      const store = useWorldEventStore.getState();
      if (store.running) return; // a manual tick is in flight
      if (Date.now() - store.lastAutoTickAt < intervalMs) return;

      // Find candidates the same way runWorldTick does — if zero, skip silently.
      const candidates = useModelStore.getState().entityNodes.filter((n) => {
        const d = n.data as any;
        return (d.kind === 'npc' || d.kind === 'monster' || d.kind === 'faction')
          && typeof d.goal === 'string' && d.goal.length > 0;
      });
      if (candidates.length === 0) return;

      const tickId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      store.setRunning(true, tickId);
      try {
        await runWorldTick({
          tickId,
          onEventCommitted: (event) => {
            useWorldEventStore.getState().appendEvent(event);
            if (event.action) {
              const agentStore = useAgentStore.getState();
              const existing = agentStore.getHistory(event.entityId);
              const hasMarker = existing.some(
                (m) => m.role === 'user' && m.content.startsWith('(Off-screen tick:'),
              );
              if (!hasMarker) {
                agentStore.appendUserMessage(
                  event.entityId,
                  '(Off-screen tick: the following lines describe what you did between sessions.)',
                );
              }
              const combined = event.consequence
                ? `${event.action} (${event.consequence})`
                : event.action;
              agentStore.appendAssistantMessage(event.entityId, combined);
            }
          },
        });
        useWorldEventStore.getState().markAutoTicked();
      } catch (e) {
        console.warn('[auto world-tick] failed:', e);
      } finally {
        useWorldEventStore.getState().setRunning(false);
      }
    }

    // Poll cadence: 30s is fine — auto-tick semantics are "approximately every N",
    // not "to the second".
    const handle = window.setInterval(() => { void tryFire(); }, 30 * 1000);
    // Also fire once immediately on mount / interval-change so a 4h reload
    // does not have to wait 30s before the first check.
    void tryFire();

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [autoTickInterval, isReadOnly]);

  const visualPanelRef = useRef<HTMLDivElement>(null);

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
    if (!visualPanelRef.current) return;
    const center = { x: visualPanelRef.current.clientWidth / 2, y: visualPanelRef.current.clientHeight / 2 };

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
              <Tab key={"entities"} title={<span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: 15 }}><GiCrossedSwords style={{ marginRight: 4, fontSize: 20 }} /> Герои и NPC</span>} />
              <Tab key={'locations'} title={<span style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', fontSize: 15 }}><GiCastle style={{ marginRight: 4, fontSize: 20 }} /> Мир и локации</span>} />
            </Tabs>            

            {!isReadOnly && (
              <div style={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: 6 }}>
                <Tooltip content="Режим игры — автономный стол: Мастер и NPC ведут ход за вас" closeDelay={0}>
                  <Button
                    style={{ fontSize: 18, background: isPlayModePanelOpen ? '#7a1f1f' : undefined, color: isPlayModePanelOpen ? 'white' : undefined }}
                    isIconOnly
                    onClick={() => {
                      const next = !isPlayModePanelOpen;
                      setIsPlayModePanelOpen(next);
                      if (next) {
                        setIsNpcPanelOpen(false);
                        setTalkingToEntityId(null);
                        setIsDmPanelOpen(false);
                        setIsWorldTickPanelOpen(false);
                        setIsInitiativePanelOpen(false);
                        setIsDicePanelOpen(false);
                        setIsSessionsPanelOpen(false);
                        setEncounterForLocationId(null);
                        setIsMapPanelOpen(false);
                      }
                    }}
                    aria-label="Переключить режим игры"
                  >
                    <GiMeeple />
                  </Button>
                </Tooltip>
                <Tooltip content="Запустить сцену с AI Мастером Подземелий" closeDelay={0}>
                  <Button
                    style={{ fontSize: 18, background: isDmPanelOpen ? '#7a1f1f' : undefined, color: isDmPanelOpen ? 'white' : undefined }}
                    isIconOnly
                    onClick={() => {
                      const next = !isDmPanelOpen;
                      setIsDmPanelOpen(next);
                      if (next) {
                        setIsNpcPanelOpen(false);
                        setTalkingToEntityId(null);
                        setIsWorldTickPanelOpen(false);
                        setIsPlayModePanelOpen(false);
                        setIsMapPanelOpen(false);
                      }
                    }}
                    aria-label="Toggle DM panel"
                  >
                    <GiCrown />
                  </Button>
                </Tooltip>
                <Tooltip content="Продвинуть мир — каждый NPC / монстр / фракция совершит действие за кулисами" closeDelay={0}>
                  <Button
                    style={{ fontSize: 18, background: isWorldTickPanelOpen ? '#7a1f1f' : undefined, color: isWorldTickPanelOpen ? 'white' : undefined }}
                    isIconOnly
                    onClick={() => {
                      const next = !isWorldTickPanelOpen;
                      setIsWorldTickPanelOpen(next);
                      if (next) {
                        setIsNpcPanelOpen(false);
                        setTalkingToEntityId(null);
                        setIsDmPanelOpen(false);
                        setIsInitiativePanelOpen(false);
                        setEncounterForLocationId(null);
                        setIsPlayModePanelOpen(false);
                        setIsMapPanelOpen(false);
                      }
                    }}
                    aria-label="Toggle World Tick panel"
                  >
                    <GiSandsOfTime />
                  </Button>
                </Tooltip>
                <Tooltip content="Трекер инициативы — порядок боя, HP, счётчик раундов" closeDelay={0}>
                  <Button
                    style={{ fontSize: 18, background: isInitiativePanelOpen ? '#7a1f1f' : undefined, color: isInitiativePanelOpen ? 'white' : undefined }}
                    isIconOnly
                    onClick={() => {
                      const next = !isInitiativePanelOpen;
                      setIsInitiativePanelOpen(next);
                      if (next) {
                        setIsNpcPanelOpen(false);
                        setTalkingToEntityId(null);
                        setIsDmPanelOpen(false);
                        setIsWorldTickPanelOpen(false);
                        setEncounterForLocationId(null);
                        setIsDicePanelOpen(false);
                        setIsPlayModePanelOpen(false);
                        setIsMapPanelOpen(false);
                      }
                    }}
                    aria-label="Переключить трекер инициативы"
                  >
                    <GiSwordman />
                  </Button>
                </Tooltip>
                <Tooltip content="Кубики — d20, d6, произвольные выражения, сканер /roll" closeDelay={0}>
                  <Button
                    style={{ fontSize: 18, background: isDicePanelOpen ? '#7a1f1f' : undefined, color: isDicePanelOpen ? 'white' : undefined }}
                    isIconOnly
                    onClick={() => {
                      const next = !isDicePanelOpen;
                      setIsDicePanelOpen(next);
                      if (next) {
                        setIsNpcPanelOpen(false);
                        setTalkingToEntityId(null);
                        setIsDmPanelOpen(false);
                        setIsWorldTickPanelOpen(false);
                        setIsInitiativePanelOpen(false);
                        setEncounterForLocationId(null);
                        setIsSessionsPanelOpen(false);
                        setIsPlayModePanelOpen(false);
                        setIsMapPanelOpen(false);
                      }
                    }}
                    aria-label="Переключить панель кубиков"
                  >
                    <GiDiceTwentyFacesTwenty />
                  </Button>
                </Tooltip>
                <Tooltip content="Сессии — архив глав, AI-recap'ы возвращаются в DM-агента как контекст" closeDelay={0}>
                  <Button
                    style={{ fontSize: 18, background: isSessionsPanelOpen ? '#7a1f1f' : undefined, color: isSessionsPanelOpen ? 'white' : undefined }}
                    isIconOnly
                    onClick={() => {
                      const next = !isSessionsPanelOpen;
                      setIsSessionsPanelOpen(next);
                      if (next) {
                        setIsNpcPanelOpen(false);
                        setTalkingToEntityId(null);
                        setIsDmPanelOpen(false);
                        setIsWorldTickPanelOpen(false);
                        setIsInitiativePanelOpen(false);
                        setIsDicePanelOpen(false);
                        setEncounterForLocationId(null);
                        setIsPlayModePanelOpen(false);
                        setIsMapPanelOpen(false);
                      }
                    }}
                    aria-label="Переключить панель сессий"
                  >
                    <GiBookmarklet />
                  </Button>
                </Tooltip>
                {selectedTab === 'locations' && (
                  <Tooltip content="Карта мира — создать в Azgaar и импортировать города" closeDelay={0}>
                    <Button
                      style={{ fontSize: 18, background: isMapPanelOpen ? '#7a1f1f' : undefined, color: isMapPanelOpen ? 'white' : undefined }}
                      isIconOnly
                      onClick={() => {
                        const next = !isMapPanelOpen;
                        setIsMapPanelOpen(next);
                        if (next) {
                          setIsNpcPanelOpen(false);
                          setTalkingToEntityId(null);
                          setIsDmPanelOpen(false);
                          setIsWorldTickPanelOpen(false);
                          setIsInitiativePanelOpen(false);
                          setIsDicePanelOpen(false);
                          setIsSessionsPanelOpen(false);
                          setIsPlayModePanelOpen(false);
                          setEncounterForLocationId(null);
                        }
                      }}
                      aria-label="Открыть создание и импорт карты мира"
                    >
                      <GiWorld />
                    </Button>
                  </Tooltip>
                )}
                {selectedTab === 'entities' && selectedEntityId && (
                  <Tooltip content="Поговорить с этим персонажем (AI-агент)" closeDelay={0}>
                    <Button
                      style={{ fontSize: 18, background: talkingToEntityId === selectedEntityId ? '#7a1f1f' : undefined, color: talkingToEntityId === selectedEntityId ? 'white' : undefined }}
                      isIconOnly
                      onClick={() => {
                        if (talkingToEntityId === selectedEntityId) {
                          setTalkingToEntityId(null);
                        } else {
                          setTalkingToEntityId(selectedEntityId);
                          setIsNpcPanelOpen(false);
                          setIsDmPanelOpen(false);
                          setIsWorldTickPanelOpen(false);
                          setIsPlayModePanelOpen(false);
                          setIsMapPanelOpen(false);
                        }
                      }}
                      aria-label="Поговорить с выбранным персонажем"
                    >
                      <GiChatBubble />
                    </Button>
                  </Tooltip>
                )}
                {selectedTab === 'entities' && (
                  <Tooltip content="Сгенерировать NPC" closeDelay={0}>
                    <Button
                      style={{ fontSize: 18, background: isNpcPanelOpen ? '#7a1f1f' : undefined, color: isNpcPanelOpen ? 'white' : undefined }}
                      isIconOnly
                      onClick={() => {
                        const next = !isNpcPanelOpen;
                        setIsNpcPanelOpen(next);
                        if (next) {
                          setTalkingToEntityId(null);
                          setIsDmPanelOpen(false);
                          setIsWorldTickPanelOpen(false);
                          setEncounterForLocationId(null);
                          setIsPlayModePanelOpen(false);
                          setIsMapPanelOpen(false);
                        }
                      }}
                      aria-label="Toggle NPC generator"
                    >
                      <GiSpellBook />
                    </Button>
                  </Tooltip>
                )}
                {selectedTab === 'locations' && selectedLocationId && (
                  <Tooltip content="Сгенерировать энкаунтер в этой локации" closeDelay={0}>
                    <Button
                      style={{ fontSize: 18, background: encounterForLocationId === selectedLocationId ? '#7a1f1f' : undefined, color: encounterForLocationId === selectedLocationId ? 'white' : undefined }}
                      isIconOnly
                      onClick={() => {
                        if (encounterForLocationId === selectedLocationId) {
                          setEncounterForLocationId(null);
                        } else {
                          setEncounterForLocationId(selectedLocationId);
                          setIsNpcPanelOpen(false);
                          setIsDmPanelOpen(false);
                          setIsWorldTickPanelOpen(false);
                          setTalkingToEntityId(null);
                          setIsPlayModePanelOpen(false);
                          setIsMapPanelOpen(false);
                        }
                      }}
                      aria-label="Переключить генератор энкаунтеров"
                    >
                      <GiBattleAxe />
                    </Button>
                  </Tooltip>
                )}
                <Tooltip content="Очистить холст" closeDelay={0}>
                  <Button style={{ fontSize: 18 }} isIconOnly onClick={() => {
                    LayoutUtils.stopAllSimulations();
                    useModelStore.getState().setActionEdges([]);
                    useModelStore.getState().setLocationNodes([]);
                    useModelStore.getState().setEntityNodes([]);
                    useModelStore.getState().setFilteredActionsSegment(null, null);
                    useModelStore.getState().setHighlightedActionsSegment(null, null);
                    VisualRefresher.getInstance().reset();
                    setTalkingToEntityId(null);
                  }}><FaTrashAlt /></Button>
                </Tooltip>
              </div>
            )}
            {isNpcPanelOpen && selectedTab === 'entities' && !isReadOnly && visualPanelRef.current && (
              <NpcGeneratorPanel
                onClose={() => setIsNpcPanelOpen(false)}
                canvasCenter={{
                  x: visualPanelRef.current.clientWidth / 2,
                  y: visualPanelRef.current.clientHeight / 2,
                }}
                defaultLocation={useModelStore.getState().locationNodes[0]?.data.name}
              />
            )}
            {talkingToEntityId && selectedTab === 'entities' && !isReadOnly && (
              <NpcDialoguePanel
                entityId={talkingToEntityId}
                onClose={() => setTalkingToEntityId(null)}
              />
            )}
            {isDmPanelOpen && !isReadOnly && (
              <DmAgentPanel onClose={() => setIsDmPanelOpen(false)} />
            )}
            {isWorldTickPanelOpen && !isReadOnly && (
              <WorldTickPanel onClose={() => setIsWorldTickPanelOpen(false)} />
            )}
            {isInitiativePanelOpen && !isReadOnly && (
              <InitiativePanel onClose={() => setIsInitiativePanelOpen(false)} />
            )}
            {isDicePanelOpen && !isReadOnly && (
              <DiceRollerPanel onClose={() => setIsDicePanelOpen(false)} />
            )}
            {isSessionsPanelOpen && !isReadOnly && (
              <SessionsPanel onClose={() => setIsSessionsPanelOpen(false)} />
            )}
            {isPlayModePanelOpen && !isReadOnly && (
              <PlayModePanel onClose={() => setIsPlayModePanelOpen(false)} />
            )}
            {isMapPanelOpen && selectedTab === 'locations' && !isReadOnly && visualPanelRef.current && (
              <MapWorkflowPanel
                onClose={() => setIsMapPanelOpen(false)}
                canvasCenter={{
                  x: visualPanelRef.current.clientWidth / 2,
                  y: visualPanelRef.current.clientHeight / 2,
                }}
              />
            )}
            {encounterForLocationId && selectedTab === 'locations' && !isReadOnly && visualPanelRef.current && (
              <EncounterGeneratorPanel
                onClose={() => setEncounterForLocationId(null)}
                locationId={encounterForLocationId}
                canvasCenter={{
                  x: visualPanelRef.current.clientWidth / 2,
                  y: visualPanelRef.current.clientHeight / 2,
                }}
              />
            )}
          </div>
          <ReactFlowProvider><ActionTimeline /></ReactFlowProvider>
          {!isReadOnly && <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'absolute', left: 0, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 22 }}>
            <Tooltip content="Обновить граф из текста" closeDelay={0}>
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


                  let refreshRequirements: Promise<any> = Promise.resolve();

                  if (useModelStore.getState().locationNodes.length === 0 && useModelStore.getState().entityNodes.length === 0) refreshRequirements = Promise.all([entitiesExtractor, locationsExtractor]);
                  if (useModelStore.getState().locationNodes.length === 0) refreshRequirements = locationsExtractor;
                  if (useModelStore.getState().entityNodes.length === 0) refreshRequirements = entitiesExtractor;

                  refreshRequirements.then(() => {
                    visualRefreshCallback();
                  });
                }}
              >
                <TbArrowBigRightLinesFilled />
              </Button>
            </Tooltip>

            <Tooltip placement='bottom' content="Переписать текст из визуала" closeDelay={0}>
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
