import { Button, Card, CardBody, CardHeader, Divider, Input } from "@nextui-org/react";
import { useState } from "react";
import { GiCrossedSwords } from "react-icons/gi";
import { useModelStore } from '../model/Model';
import { CAMPAIGN_TEMPLATES, CampaignTemplate, seedToNodes } from "../model/dnd/campaignTemplates";
import { VisualRefresher } from "../model/prompts/textExtractors/VisualRefresher";
import { useStudyStore } from "../study/StudyModel";

export default function Launcher() {
  const [accessKey, setAccessKey] = useState('');
  const setOpenAIKey = useModelStore((state) => state.setOpenAIKey);
  const resetModel = useModelStore((state) => state.reset);
  const resetStudyModel = useStudyStore((state) => state.reset);

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
          <p style={{ fontSize: 14, color: '#3a2a2a' }}>
            Paste an OpenAI API key to enable AI extraction and scene rewriting. Get one at{' '}
            <a href="https://platform.openai.com/account/api-keys" style={{ color: '#7a1f1f', textDecoration: 'underline' }}>
              platform.openai.com
            </a>
            . The key stays in your browser.
          </p>
          <Input
            variant="faded"
            label="OpenAI API Key"
            placeholder="sk-..."
            type="password"
            style={{ marginTop: 10 }}
            onChange={(e) => {
              setAccessKey(e.target.value);
              setOpenAIKey(e.target.value);
            }}
          />
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
            {CAMPAIGN_TEMPLATES.map((template) => (
              <button
                key={template.id}
                disabled={accessKey.length === 0 && template.id !== 'blank-campaign'}
                onClick={() => startCampaign(template)}
                style={{
                  textAlign: 'left',
                  padding: 14,
                  borderRadius: 8,
                  border: '1px solid #d4c5a0',
                  background: '#fffbf0',
                  cursor: accessKey.length === 0 && template.id !== 'blank-campaign' ? 'not-allowed' : 'pointer',
                  opacity: accessKey.length === 0 && template.id !== 'blank-campaign' ? 0.5 : 1,
                  transition: 'transform 120ms, box-shadow 120ms',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={(e) => {
                  if (accessKey.length > 0 || template.id === 'blank-campaign') {
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
            ))}
          </div>
        </CardBody>
        <Divider />
        <CardBody style={{ padding: '12px 24px', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#7a6a5a' }}>
            Forked from VisualStoryWriting (MIT). Engine: React 18 · @xyflow/react · Slate · OpenAI.
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
