import { Button, Card, CardBody, CardHeader, Checkbox, Divider, Input, Tab, Tabs } from "@nextui-org/react";
import { useState } from "react";
import { GiCrossedSwords } from "react-icons/gi";
import { useModelStore } from '../model/Model';
import { CAMPAIGN_TEMPLATES, CampaignTemplate, seedToNodes } from "../model/dnd/campaignTemplates";
import { VisualRefresher } from "../model/prompts/textExtractors/VisualRefresher";
import { useStudyStore } from "../study/StudyModel";
import { useAiConfigStore } from "../store/useAiConfigStore";
import { AiProviderId } from "../model/ai/types";

export default function Launcher() {
  const [accessKey, setAccessKey] = useState('');
  const setOpenAIKey = useModelStore((state) => state.setOpenAIKey);
  const resetModel = useModelStore((state) => state.reset);
  const resetStudyModel = useStudyStore((state) => state.reset);

  const providerId = useAiConfigStore((s) => s.providerId);
  const ollamaBaseUrl = useAiConfigStore((s) => s.ollamaBaseUrl);
  const ollamaModel = useAiConfigStore((s) => s.ollamaModel);
  const openaiModel = useAiConfigStore((s) => s.openaiModel);
  const anthropicApiKey = useAiConfigStore((s) => s.anthropicApiKey);
  const anthropicModel = useAiConfigStore((s) => s.anthropicModel);
  const useFallback = useAiConfigStore((s) => s.useFallback);
  const setProviderId = useAiConfigStore((s) => s.setProviderId);
  const setOllamaBaseUrl = useAiConfigStore((s) => s.setOllamaBaseUrl);
  const setOllamaModel = useAiConfigStore((s) => s.setOllamaModel);
  const setOpenaiModel = useAiConfigStore((s) => s.setOpenaiModel);
  const setAnthropicApiKey = useAiConfigStore((s) => s.setAnthropicApiKey);
  const setAnthropicModel = useAiConfigStore((s) => s.setAnthropicModel);
  const setUseFallback = useAiConfigStore((s) => s.setUseFallback);

  // Campaign-start is gated differently per provider:
  //  - openai: needs an API key (entered now or via VITE_OPENAI_API_KEY)
  //  - ollama: no key needed; local daemon is the dependency
  //  - anthropic: needs an Anthropic key
  const startGated =
    (providerId === "openai" && accessKey.length === 0) ||
    (providerId === "anthropic" && anthropicApiKey.length === 0);

  function startCampaign(template: CampaignTemplate) {
    resetModel();
    resetStudyModel();

    const text = template.text;
    useModelStore.getState().setTextState([{ children: [{ text }] }], true, false);
    useModelStore.getState().setIsStale(false);

    const { entityNodes, locationNodes } = seedToNodes(template.seed);
    useModelStore.getState().setEntityNodes(entityNodes);
    useModelStore.getState().setLocationNodes(locationNodes);
    useModelStore.getState().setActionEdges([]);

    VisualRefresher.getInstance().previousText = useModelStore.getState().text;
    VisualRefresher.getInstance().onUpdate();

    window.location.hash = '/free-form' + `?k=${btoa(accessKey)}`;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: 24,
        background: 'linear-gradient(135deg, #1a0f1a 0%, #2a1a1a 50%, #1a0f0f 100%)',
      }}
    >
      <Card style={{ maxWidth: 920, width: '100%', background: '#fdf6e3' }}>
        <CardHeader style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '20px 24px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32, color: '#7a1f1f' }}><GiCrossedSwords /></span>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#2a1a1a', fontFamily: 'serif' }}>
              Eclipse DnD Forge
            </span>
          </div>
          <span style={{ fontSize: 13, color: '#5a4a3a', marginTop: 4, marginLeft: 44 }}>
            AI-менеджер кампаний · визуальный граф мира · таймлайн сессий · операционная система мастера
          </span>
        </CardHeader>
        <Divider />
        <CardBody style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#2a1a1a' }}>AI-провайдер</span>
            <Tabs
              size="sm"
              selectedKey={providerId}
              onSelectionChange={(k) => setProviderId(k as AiProviderId)}
              color="primary"
              variant="bordered"
              classNames={{ tabList: 'bg-white' }}
            >
              <Tab key="openai" title="OpenAI (облако)" />
              <Tab key="ollama" title="Ollama (локально)" />
              <Tab key="anthropic" title="Anthropic Claude (облако)" />
            </Tabs>

            {providerId === "openai" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: '#5a4a3a', margin: 0 }}>
                  Вставьте API-ключ OpenAI — используется для диалогов с NPC, нарратива DM, извлечения сущностей и генерации NPC. Получить ключ можно на{' '}
                  <a href="https://platform.openai.com/account/api-keys" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>
                    platform.openai.com
                  </a>
                  . Ключ хранится только в браузере.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="API-ключ OpenAI"
                  placeholder="sk-..."
                  type="password"
                  onChange={(e) => {
                    setAccessKey(e.target.value);
                    setOpenAIKey(e.target.value);
                  }}
                />
                <Input
                  size="sm"
                  variant="faded"
                  label="Модель OpenAI"
                  value={openaiModel}
                  onValueChange={setOpenaiModel}
                />
              </div>
            )}

            {providerId === "ollama" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: '#5a4a3a', margin: 0 }}>
                  Общается с локальным <a href="https://ollama.com" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>Ollama</a> daemon — для диалогов NPC, нарратива DM, world tick и (через <code style={{ background: '#f0e4c8', padding: '0 4px', borderRadius: 3 }}>format: "json"</code>) извлечения сущностей + генерации NPC. Качество структурированного вывода зависит от модели — instruction-tuned модели (llama 3.x, qwen) справляются хорошо.
                  Запускайте Ollama с <code style={{ background: '#f0e4c8', padding: '0 4px', borderRadius: 3 }}>OLLAMA_ORIGINS="*"</code>, чтобы браузер мог достучаться.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    size="sm"
                    variant="faded"
                    label="Base URL"
                    value={ollamaBaseUrl}
                    onValueChange={setOllamaBaseUrl}
                    style={{ flex: 1 }}
                  />
                  <Input
                    size="sm"
                    variant="faded"
                    label="Модель"
                    value={ollamaModel}
                    onValueChange={setOllamaModel}
                    style={{ flex: 1 }}
                  />
                </div>
                <p style={{ fontSize: 11, color: '#7a6a5a', margin: 0 }}>
                  Опционально: вставьте ключ OpenAI ниже, чтобы включить fallback chain (если Ollama daemon упадёт, запросы пойдут на OpenAI).
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="API-ключ OpenAI (опционально, для fallback chain)"
                  placeholder="sk-... — опционально"
                  type="password"
                  onChange={(e) => {
                    setAccessKey(e.target.value);
                    setOpenAIKey(e.target.value);
                  }}
                />
              </div>
            )}

            {providerId === "anthropic" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: '#5a4a3a', margin: 0 }}>
                  Вставьте API-ключ Anthropic — для диалогов NPC и нарратива DM через Claude. Прямые из браузера запросы используют opt-in заголовок Anthropic <code style={{ background: '#f0e4c8', padding: '0 4px', borderRadius: 3 }}>anthropic-dangerous-direct-browser-access</code> (только для локального прототипа — перед публичным размещением маршрутизировать через бэкенд). Ключ можно получить на{' '}
                  <a href="https://console.anthropic.com/" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>console.anthropic.com</a>.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="API-ключ Anthropic"
                  placeholder="sk-ant-..."
                  type="password"
                  value={anthropicApiKey}
                  onValueChange={setAnthropicApiKey}
                />
                <Input
                  size="sm"
                  variant="faded"
                  label="Модель Claude"
                  value={anthropicModel}
                  onValueChange={setAnthropicModel}
                />
                <p style={{ fontSize: 11, color: '#7a6a5a', margin: 0 }}>
                  Опционально: вставьте ключ OpenAI ниже, чтобы включить fallback chain (если Claude встретит rate-limit, запросы пойдут на OpenAI). Извлечение сущностей и генерация NPC на Claude работают нативно через tool-use.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="API-ключ OpenAI (опционально, для fallback chain)"
                  placeholder="sk-... — опционально"
                  type="password"
                  onChange={(e) => {
                    setAccessKey(e.target.value);
                    setOpenAIKey(e.target.value);
                  }}
                />
              </div>
            )}

            <Divider style={{ margin: '4px 0' }} />
            <Checkbox
              size="sm"
              isSelected={useFallback}
              onValueChange={setUseFallback}
            >
              <span style={{ fontSize: 12, color: '#3a2a2a' }}>
                <strong>Включить fallback chain</strong> — если активный провайдер упадёт (rate-limit, daemon недоступен, ключ просрочен), запросы автоматически уйдут на следующий настроенный. Порядок: активный, затем остальные с валидной конфигурацией.
              </span>
            </Checkbox>
          </div>
        </CardBody>
        <Divider />
        <CardBody style={{ padding: '16px 24px' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#2a1a1a' }}>Запустить кампанию</span>
          <p style={{ fontSize: 12, color: '#5a4a3a', marginTop: 2, marginBottom: 14 }}>
            Каждый шаблон засевает героев, NPC, монстров и локации. Можно править текст сессии слева и
            кликать стрелку «refresh», чтобы обновить визуальный граф через AI.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            {CAMPAIGN_TEMPLATES.map((template) => {
              const disabled = startGated && template.id !== 'blank-campaign';
              return (
              <button
                key={template.id}
                disabled={disabled}
                onClick={() => startCampaign(template)}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #d4c5a0',
                  background: '#fffbf0',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'transform 120ms, box-shadow 120ms',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(122,31,31,0.18)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 28 }}>{template.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#2a1a1a' }}>{template.title}</span>
                </div>
                <span style={{ fontSize: 12, color: '#5a4a3a', lineHeight: 1.4 }}>{template.subtitle}</span>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#f0e4c8', color: '#5a4a3a' }}>
                    Сущностей: {template.seed.entities.length}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#f0e4c8', color: '#5a4a3a' }}>
                    Локаций: {template.seed.locations.length}
                  </span>
                </div>
              </button>
              );
            })}
          </div>
        </CardBody>
        <Divider />
        <CardBody style={{ padding: '12px 24px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#7a6a5a' }}>
            Форк VisualStoryWriting (MIT). Стек: React 19 · @xyflow/react · Slate · OpenAI · Anthropic · Ollama.
          </span>
          <Button
            size="sm"
            variant="light"
            onClick={() => {
              window.location.hash = '/';
              window.location.reload();
            }}
          >
            Сбросить
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
