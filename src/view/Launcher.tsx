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
            AI campaign manager · visual world graph · session timeline · DM operating system
          </span>
        </CardHeader>
        <Divider />
        <CardBody style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#2a1a1a' }}>AI provider</span>
            <Tabs
              size="sm"
              selectedKey={providerId}
              onSelectionChange={(k) => setProviderId(k as AiProviderId)}
              color="primary"
              variant="bordered"
              classNames={{ tabList: 'bg-white' }}
            >
              <Tab key="openai" title="OpenAI (cloud)" />
              <Tab key="ollama" title="Ollama (self-hosted)" />
              <Tab key="anthropic" title="Anthropic Claude (cloud)" />
            </Tabs>

            {providerId === "openai" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: '#5a4a3a', margin: 0 }}>
                  Paste an OpenAI API key — used for NPC dialogue, DM narration, entity extraction and NPC generation. Get one at{' '}
                  <a href="https://platform.openai.com/account/api-keys" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>
                    platform.openai.com
                  </a>
                  . The key stays in your browser.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="OpenAI API key"
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
                  label="OpenAI model"
                  value={openaiModel}
                  onValueChange={setOpenaiModel}
                />
              </div>
            )}

            {providerId === "ollama" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: '#5a4a3a', margin: 0 }}>
                  Talks to a local <a href="https://ollama.com" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>Ollama</a> daemon — used for NPC dialogue and DM narration. Entity extraction and NPC generation still need an OpenAI key (they rely on structured outputs).
                  Start Ollama with <code style={{ background: '#f0e4c8', padding: '0 4px', borderRadius: 3 }}>OLLAMA_ORIGINS="*"</code> so the browser can reach it.
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
                    label="Model"
                    value={ollamaModel}
                    onValueChange={setOllamaModel}
                    style={{ flex: 1 }}
                  />
                </div>
                <p style={{ fontSize: 11, color: '#7a6a5a', margin: 0 }}>
                  Optional but still useful: paste an OpenAI key below to also enable extraction / NPC generation. Without it, only the visual graph and seed-campaign starter NPCs are available — Living-NPC and DM chat will still work through Ollama.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="OpenAI API key (optional, for structured-output paths)"
                  placeholder="sk-... — optional with Ollama"
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
                  Paste an Anthropic API key — used for NPC dialogue and DM narration through Claude. Browser-direct calls use Anthropic's <code style={{ background: '#f0e4c8', padding: '0 4px', borderRadius: 3 }}>anthropic-dangerous-direct-browser-access</code> opt-in (local prototype only — route through a backend before any hosted release). Get a key at{' '}
                  <a href="https://console.anthropic.com/" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>console.anthropic.com</a>.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="Anthropic API key"
                  placeholder="sk-ant-..."
                  type="password"
                  value={anthropicApiKey}
                  onValueChange={setAnthropicApiKey}
                />
                <Input
                  size="sm"
                  variant="faded"
                  label="Claude model"
                  value={anthropicModel}
                  onValueChange={setAnthropicModel}
                />
                <p style={{ fontSize: 11, color: '#7a6a5a', margin: 0 }}>
                  Entity extraction and NPC generation still need an OpenAI key (structured outputs are OpenAI-specific). Paste one below if you want those features too.
                </p>
                <Input
                  size="sm"
                  variant="faded"
                  label="OpenAI API key (optional, for structured-output paths)"
                  placeholder="sk-... — optional with Claude"
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
                <strong>Enable fallback chain</strong> — if the active provider errors out (rate-limited, daemon down, expired key), automatically retry on the next configured provider. Order: active first, then the rest with valid config.
              </span>
            </Checkbox>
          </div>
        </CardBody>
        <Divider />
        <CardBody style={{ padding: '16px 24px' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#2a1a1a' }}>Start a campaign</span>
          <p style={{ fontSize: 12, color: '#5a4a3a', marginTop: 2, marginBottom: 14 }}>
            Each template seeds heroes, NPCs, monsters, and locations. You can keep editing the session text on the left and
            click the refresh arrow to update the visual graph from the AI.
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
                    {template.seed.entities.length} entities
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#f0e4c8', color: '#5a4a3a' }}>
                    {template.seed.locations.length} locations
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
            Forked from VisualStoryWriting (MIT). Engine: React 18 · @xyflow/react · Slate · OpenAI · Ollama.
          </span>
          <Button
            size="sm"
            variant="light"
            onClick={() => {
              window.location.hash = '/';
              window.location.reload();
            }}
          >
            Reset
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
