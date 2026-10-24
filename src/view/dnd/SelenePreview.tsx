import { useEffect, useState } from 'react';
import './SelenePreview.css';

const missionCards = [
  { index: '01', title: 'The first light', body: 'Соберите отряд и выберите, какой след останется в небесном архиве.', tag: 'DEPARTURE' },
  { index: '02', title: 'Dust archive', body: 'Каждая локация хранит событие. Возвращайтесь к нему, когда мир изменится.', tag: 'DISCOVERY' },
  { index: '03', title: 'A quiet orbit', body: 'Свяжите персонажей, угрозы и решения в одну читаемую карту кампании.', tag: 'ORBIT' },
  { index: '04', title: 'Home in sight', body: 'Завершите сцену безопасно и сохраните состояние, чтобы продолжить позже.', tag: 'RETURN' },
];

export default function SelenePreview() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setProgress(Math.min(1, Math.max(0, window.scrollY / max)));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const orbitProgress = Math.min(1, progress * 1.45);
  const moonShift = progress * 150;
  const earthShift = progress * -64;

  return (
    <main className="selene-preview" style={{ '--selene-progress': progress } as React.CSSProperties}>
      <header className="selene-nav">
        <a className="selene-wordmark" href="#/" aria-label="Вернуться к Eclipse DnD Forge">
          <span className="selene-wordmark__mark" aria-hidden="true">✦</span>
          ECLIPSE / FORGE
        </a>
        <div className="selene-nav__meta" aria-label="Статус прототипа">
          <span className="selene-status-dot" aria-hidden="true" />
          SELENE / LOCAL PREVIEW
        </div>
        <a className="selene-nav__back" href="#/">К кампании <span aria-hidden="true">↗</span></a>
      </header>

      <div className="selene-progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>

      <section className="selene-hero" aria-labelledby="selene-title">
        <div className="selene-hero__copy">
          <p className="selene-kicker"><span>01</span> / THE LIVING CAMPAIGN</p>
          <h1 id="selene-title">Make the<br /><em>world</em> remember.</h1>
          <p className="selene-hero__lede">Eclipse DnD Forge превращает решения партии в живой мир: от первого броска до следа, который останется на карте.</p>
          <div className="selene-hero__actions">
            <a className="selene-button selene-button--primary" href="#/">Открыть Forge <span aria-hidden="true">→</span></a>
            <a className="selene-button selene-button--quiet" href="#mission">Как это работает <span aria-hidden="true">↓</span></a>
          </div>
          <dl className="selene-stats">
            <div><dt>384 400</dt><dd>km to the moon</dd></div>
            <div><dt>03</dt><dd>play modes</dd></div>
            <div><dt>∞</dt><dd>world states</dd></div>
          </dl>
        </div>

        <div className="selene-orbit" aria-label="Орбитальная карта кампании">
          <div className="selene-orbit__eyebrow">MISSION / 001 <span>LOCAL SYSTEM</span></div>
          <div className="selene-orbit__stars" aria-hidden="true" />
          <div className="selene-orbit__grid" aria-hidden="true" />
          <svg className="selene-orbit__arc" viewBox="0 0 700 700" aria-hidden="true">
            <path d="M90 554 C170 86 584 36 640 456" pathLength="1" />
            <path className="selene-orbit__arc-dash" d="M90 554 C170 86 584 36 640 456" pathLength="1" style={{ strokeDashoffset: 1 - orbitProgress }} />
          </svg>
          <div className="selene-orbit__earth" style={{ transform: `translate3d(${earthShift}px, ${progress * 32}px, 0)` }}>
            <span className="selene-orbit__earth-glow" />
            <span className="selene-orbit__earth-land" />
            <span className="selene-orbit__earth-label">HOME / 001</span>
          </div>
          <div className="selene-orbit__moon" style={{ transform: `translate3d(${moonShift}px, ${progress * -24}px, 0)` }}>
            <span className="selene-orbit__moon-crater selene-orbit__moon-crater--one" />
            <span className="selene-orbit__moon-crater selene-orbit__moon-crater--two" />
            <span className="selene-orbit__moon-crater selene-orbit__moon-crater--three" />
            <span className="selene-orbit__moon-label">LUNA / 384 400 KM</span>
          </div>
          <div className="selene-orbit__readout"><span>TRAJECTORY</span><strong>{Math.round(orbitProgress * 384400).toLocaleString('ru-RU')} KM</strong><small>signal stable / 0{Math.max(1, Math.ceil(orbitProgress * 4))}</small></div>
          <div className="selene-orbit__crosshair selene-orbit__crosshair--one" aria-hidden="true" />
          <div className="selene-orbit__crosshair selene-orbit__crosshair--two" aria-hidden="true" />
        </div>
      </section>

      <section className="selene-mission" id="mission" aria-labelledby="mission-title">
        <div className="selene-section-head">
          <p className="selene-kicker"><span>02</span> / MISSION REEL</p>
          <h2 id="mission-title">Every choice leaves<br /><em>a trace.</em></h2>
          <p>Прокрутите, чтобы пройти путь от подготовки к кампании до сохранённого финала.</p>
        </div>
        <div className="selene-reel" tabIndex={0} aria-label="Этапы кампании, прокручиваемая лента">
          {missionCards.map((card) => (
            <article className="selene-reel__card" key={card.index}>
              <div className="selene-reel__card-top"><span>{card.index}</span><span>{card.tag}</span></div>
              <div className="selene-reel__planet" aria-hidden="true"><span /></div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <span className="selene-reel__line" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="selene-cta" aria-labelledby="cta-title">
        <div>
          <p className="selene-kicker"><span>03</span> / READY WHEN YOU ARE</p>
          <h2 id="cta-title">Your table.<br /><em>Your orbit.</em></h2>
        </div>
        <a className="selene-button selene-button--primary" href="#/">Запустить кампанию <span aria-hidden="true">→</span></a>
      </section>

      <footer className="selene-footer"><span>ECLIPSE DND FORGE / SELENE STUDY</span><span>SCROLLTIDE-INSPIRED / ORIGINAL IMPLEMENTATION</span></footer>
    </main>
  );
}
