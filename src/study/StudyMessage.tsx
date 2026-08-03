import { Button, Card, CardBody } from "@nextui-org/react";
import { useStudyStore } from "./StudyModel";

function StudyContent({ content }: { content: string }) {
  const anchor = content.match(/<a\b([^>]*)>(.*?)<\/a>/i);
  if (!anchor || anchor.index === undefined) return <>{content}</>;

  const before = content.slice(0, anchor.index);
  const after = content.slice(anchor.index + anchor[0].length);
  const label = anchor[2].replace(/<[^>]*>/g, "").trim() || "Open link";
  const hrefMatch = anchor[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i);
  const rawHref = hrefMatch?.[2]?.trim();
  let safeHref: string | null = null;

  if (rawHref) {
    try {
      const parsed = new URL(rawHref, window.location.origin);
      if (parsed.protocol === "https:") safeHref = parsed.href;
    } catch {
      safeHref = null;
    }
  }

  return (
    <>
      {before}
      {safeHref
        ? <a href={safeHref} target="_blank" rel="noopener noreferrer">{label}</a>
        : label}
      {after}
    </>
  );
}

export default function StudyMessage(props: { content: string, showNextButton?: boolean }) {
  const nextStep = useStudyStore(state => state.nextStep);

  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'rgb(242, 238, 240)' }}>
  <Card style={{ width: 500, padding: 10 }}>
    <CardBody>
      <div><StudyContent content={props.content} /></div>
     { props.showNextButton && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'right' }}>
        <Button style={{ marginTop: 20, width: 100 }} onClick={() => {
          useStudyStore.getState().logEvent("NEXT_PRESSED");
          nextStep();
        }}>Next</Button>
      </div> }

      { !props.showNextButton && 
      <Button style={{ marginTop: 20}} onClick={() => {
        // Download the data from localStorage (backup)
        useStudyStore.getState().saveData(false, true);
      }
      }>Download data</Button>}
    </CardBody>
  </Card>
</div>
}
