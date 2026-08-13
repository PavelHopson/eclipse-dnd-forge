import { Button, Card, CardBody, CardHeader, Checkbox, Divider, Input, Tab, Tabs } from "@nextui-org/react";
import { useState } from "react";
import { CAMPAIGN_TEMPLATES, type CampaignTemplate } from "../model/dnd/campaignTemplates";
import { useAiConfigStore } from "../store/useAiConfigStore";
import type { AiProviderId } from "../model/ai/types";
import { useDndIdentity } from "../hooks/useDndIdentity";
import { MANAGED_AI_ENABLED } from "../model/auth/dndSession";

function CampaignMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor">
      <path d="M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75.063-.062c21.827 21.93 44.04 43.923 66.405 66.25-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53 68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593-43.852-43.8-86.462-85.842-130.125-125.47-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562 56.81-56.812 13.22 13.187-56.438 56.44 24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906l200.56 200.53c-4.36 4.443-8.84 8.793-13.405 13.032L148.875 153.53l13.22-13.186zm-76.69 113.28l-28.5 28.532 68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717 28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313 17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594-15.068-18.587-28.38-38.758-39.5-60.625z" />
    </svg>
  );
}

export default function Launcher() {
  const identity = useDndIdentity(MANAGED_AI_ENABLED);
  const [startingCampaignId, setStartingCampaignId] = useState<string | null>(null);
  const [campaignStartError, setCampaignStartError] = useState<string | null>(null);

  const providerId = useAiConfigStore((s) => s.providerId);
  const ollamaBaseUrl = useAiConfigStore((s) => s.ollamaBaseUrl);
  const ollamaModel = useAiConfigStore((s) => s.ollamaModel);
  const openaiModel = useAiConfigStore((s) => s.openaiModel);
  const openaiApiKey = useAiConfigStore((s) => s.openaiApiKey);
  const anthropicApiKey = useAiConfigStore((s) => s.anthropicApiKey);
  const anthropicModel = useAiConfigStore((s) => s.anthropicModel);
  const useFallback = useAiConfigStore((s) => s.useFallback);
  const gatewayModel = useAiConfigStore((s) => s.gatewayModel);
  const setProviderId = useAiConfigStore((s) => s.setProviderId);
  const setOllamaBaseUrl = useAiConfigStore((s) => s.setOllamaBaseUrl);
  const setOllamaModel = useAiConfigStore((s) => s.setOllamaModel);
  const setOpenaiModel = useAiConfigStore((s) => s.setOpenaiModel);
  const setOpenaiApiKey = useAiConfigStore((s) => s.setOpenaiApiKey);
  const setAnthropicApiKey = useAiConfigStore((s) => s.setAnthropicApiKey);
  const setAnthropicModel = useAiConfigStore((s) => s.setAnthropicModel);
  const setUseFallback = useAiConfigStore((s) => s.setUseFallback);
  const setGatewayModel = useAiConfigStore((s) => s.setGatewayModel);
  const clearCloudCredentials = useAiConfigStore((s) => s.clearCloudCredentials);

  // Campaign-start is gated differently per provider:
  //  - openai: needs a key entered for the current browser tab
  //  - ollama: no key needed; local daemon is the dependency
  //  - anthropic: needs an Anthropic key
  const startGated =
    (providerId === "eclipse" && !identity.session) ||
    (providerId === "openai" && openaiApiKey.length === 0) ||
    (providerId === "anthropic" && anthropicApiKey.length === 0);

  async function startCampaign(template: CampaignTemplate) {
    if (startingCampaignId) return;

    setStartingCampaignId(template.id);
    setCampaignStartError(null);

    try {
      const { startCampaignFromTemplate } = await import("../model/dnd/campaignRuntime");
      startCampaignFromTemplate(template);
      window.location.hash = '/free-form';
    } catch {
      setCampaignStartError("Не удалось открыть кампанию. Обновите страницу и попробуйте ещё раз.");
      setStartingCampaignId(null);
    }
  }

  return (
    <div className="launcher-shell" data-visual-profile="product">
      <Card className="launcher-card" style={{ maxWidth: 920, width: '100%', background: '#fdf6e3' }}>
        <CardHeader style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '20px 24px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32, color: '#7a1f1f' }}><CampaignMark /></span>
            <span className="launcher-brand" style={{ fontSize: 26, fontWeight: 800, color: '#2a1a1a' }}>
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
              className="launcher-provider-tabs"
              classNames={{ tabList: 'bg-white' }}
            >
              {MANAGED_AI_ENABLED && <Tab key="eclipse" title="Eclipse AI (без ключа)" />}
              <Tab key="openai" title="OpenAI (облако)" />
              <Tab key="ollama" title="Ollama (локально)" />
              <Tab key="anthropic" title="Anthropic Claude (облако)" />
            </Tabs>

            {providerId === "eclipse" && (
              <div className="eclipse-identity-card" aria-live="polite">
                {identity.loading ? (
                  <>
                    <strong>Проверяем безопасный вход…</strong>
                    <span>Это займёт несколько секунд.</span>
                  </>
                ) : identity.session ? (
                  <>
                    <strong>Подключено как {identity.session.user.displayName}</strong>
                    <span>AI работает через Eclipse AI Hub. API-ключи и service token не попадают в браузер.</span>
                    <Input
                      size="sm"
                      variant="faded"
                      label="Модель Eclipse AI"
                      value={gatewayModel}
                      onValueChange={setGatewayModel}
                    />
                    <Button size="sm" variant="bordered" onPress={() => void identity.signOut()}>
                      Отключить аккаунт
                    </Button>
                  </>
                ) : (
                  <>
                    <strong>Войдите один раз — ключи не нужны</strong>
                    <span>Eclipse Chat подтвердит аккаунт и вернёт вас сюда. Пароль и история чатов не передаются.</span>
                    {identity.error && <span className="identity-error" role="alert">{identity.error}</span>}
                    <Button color="primary" size="sm" onPress={() => void identity.signIn()}>
                      Войти через Eclipse Chat
                    </Button>
                  </>
                )}
              </div>
            )}

            {providerId === "openai" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: '#5a4a3a', margin: 0 }}>
                  Вставьте API-ключ OpenAI — используется для диалогов с NPC, нарратива DM, извлечения сущностей и генерации NPC. Получить ключ можно на{' '}
                  <a href="https://platform.openai.com/account/api-keys" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>
                    platform.openai.com
                  </a>
                  . Ключ хранится только до закрытия этой вкладки и не добавляется в URL.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="API-ключ OpenAI"
                  placeholder="sk-..."
                  type="password"
                  value={openaiApiKey}
                  onValueChange={setOpenaiApiKey}
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
                <div className="launcher-provider-fields">
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
                  value={openaiApiKey}
                  onValueChange={setOpenaiApiKey}
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
                  value={openaiApiKey}
                  onValueChange={setOpenaiApiKey}
                />
              </div>
            )}

            <Divider style={{ margin: '4px 0' }} />
            <Checkbox
              size="sm"
              isSelected={useFallback}
              onValueChange={setUseFallback}
              isDisabled={providerId === "eclipse"}
            >
              <span style={{ fontSize: 12, color: '#3a2a2a' }}>
                <strong>Включить fallback chain</strong> — {providerId === "eclipse" ? "для Eclipse AI отключён: запросы не уходят скрытно на browser BYOK." : "если активный провайдер упадёт (rate-limit, daemon недоступен, ключ просрочен), запросы автоматически уйдут на следующий настроенный."}
              </span>
            </Checkbox>
            {providerId !== "eclipse" && (
            <div className="credential-boundary" role="note">
              <strong>Ключи только на эту вкладку.</strong>
              <span> Они удаляются при закрытии вкладки. Не используйте основной production key: публичная demo всё ещё обращается к cloud API прямо из браузера.</span>
              {(openaiApiKey || anthropicApiKey) && (
                <Button
                  size="sm"
                  variant="bordered"
                  onClick={() => {
                    clearCloudCredentials();
                    void import("../model/Model").then(({ useModelStore }) => {
                      useModelStore.getState().setOpenAIKey("");
                    });
                  }}
                >
                  Удалить облачные ключи
                </Button>
              )}
            </div>
            )}
          </div>
        </CardBody>
        <Divider />
        <CardBody style={{ padding: '16px 24px' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#2a1a1a' }}>Запустить кампанию</span>
          <p style={{ fontSize: 12, color: '#5a4a3a', marginTop: 2, marginBottom: 14 }}>
            Каждый шаблон засевает героев, NPC, монстров и локации. Можно править текст сессии слева и
            кликать стрелку «refresh», чтобы обновить визуальный граф через AI.
          </p>
          {campaignStartError && (
            <p role="alert" className="campaign-start-error">{campaignStartError}</p>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
            }}
          >
            {CAMPAIGN_TEMPLATES.map((template) => {
              const isStarting = startingCampaignId === template.id;
              const disabled = (startGated && template.id !== 'blank-campaign') || startingCampaignId !== null;
              return (
              <button
                key={template.id}
                disabled={disabled}
                onClick={() => void startCampaign(template)}
                aria-busy={isStarting}
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
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#2a1a1a' }}>{isStarting ? "Открываем кампанию…" : template.title}</span>
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
        <CardBody className="launcher-footer" style={{ padding: '12px 24px' }}>
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
