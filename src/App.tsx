import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';

import { WorkshopAudio } from './audio';
import { createFortuneCard } from './fortune-card';

type Scene = 'welcome' | 'write' | 'choose' | 'release' | 'cookie';
type Mode = 'shred' | 'burn';
const fortunes = [
  { keys: /일|업무|회사|직장|야근|상사|피곤|지쳐/, text: '오늘도 충분히 애썼어요.\n잠시 멈춰 쉬어도 괜찮아요.\n당신의 속도로 걸어가요.' },
  { keys: /친구|관계|사람|사랑|이별|가족|외로/, text: '모든 마음을 맞추지 않아도 괜찮아요.\n당신의 마음도 소중하니까요.\n오늘은 내 편이 되어주세요.' },
  { keys: /공부|시험|성적|학교|취업|미래|불안/, text: '아직 피지 않은 꽃도 자라고 있어요.\n작은 한 걸음이면 충분해요.\n당신만의 계절이 찾아올 거예요.' },
  { keys: /자신|실수|실패|못|후회/, text: '한 번의 실수가 당신을 정하지 않아요.\n다시 시작할 작은 용기는\n이미 당신 안에 있어요.' },
];
function getFortune(worry: string) { return fortunes.find(f => f.keys.test(worry))?.text ?? '오늘의 무거움은 잠시 내려놓아요.\n잘해내지 않아도 소중한 당신,\n내일은 조금 더 가벼워질 거예요.'; }

function Machine({ active = false }: { active?: boolean }) {
  return <div className={`machine art-machine ${active ? 'working' : ''}`} aria-hidden="true">
    <img className="machine-art" src="/assets/shredder.png" alt="" draggable={false}/>
    <div className="animated-shreds"><div className="strips">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}/>)}</div></div>
    <i className="machine-indicator"/>
  </div>;
}
function Fireplace({ active = false }: { active?: boolean }) {
  return <div className={`fireplace art-fireplace ${active ? 'blazing' : ''}`} aria-hidden="true">
    <img className="fireplace-art" src="/assets/fireplace.png" alt="" draggable={false}/>
    <img className="fire-motion" src="/assets/fireplace.png" alt="" draggable={false}/>
    <div className="fire-light"/>
    <div className="fire-embers">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}/>)}</div>
    <div className="smoke"><i/><i/><i/></div>
  </div>;
}
function Room() {
  return <div className="room illustrated-room" aria-hidden="true">
    <picture className="unified-workshop">
      <source media="(max-aspect-ratio: 4/5)" srcSet="/assets/workshop-unified-mobile.png"/>
      <img src="/assets/workshop-unified-desktop.png" alt="" draggable={false} fetchPriority="high"/>
    </picture>
    <div className="workshop-lantern-glow"/>
    <div className="workshop-jar-glow"/>
    <div className="cat cat-art"><img src="/assets/sleeping-cat.png" alt="" draggable={false}/></div><div className="room-prop room-star-jar"><img src="/assets/room-star-jar.png" width="1254" height="1254" alt="" draggable={false}/></div>
    
    <div className="vignette"/>
    {Array.from({ length: 22 }, (_, i) => <i className="mote" key={i} style={{ '--i': i, left: `${(i * 37 + 7) % 100}%`, top: `${(i * 19 + 9) % 92}%` } as CSSProperties}/>)}
  </div>;
}
export default function App() {
  const [scene, setScene] = useState<Scene>('welcome');
  const [worry, setWorry] = useState('');
  const [mode, setMode] = useState<Mode>('shred');
  const [selecting, setSelecting] = useState<Mode | null>(null);
  const [folding, setFolding] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [opened, setOpened] = useState(false);
  const [sound, setSound] = useState(true);
  const [audioError, setAudioError] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState(false);
  const [cardUrl, setCardUrl] = useState('');
  const cardDialog = useRef<HTMLDialogElement>(null);
  const exportVersion = useRef(0);
  const soundWanted = useRef(true);
  const audioStarted = useRef(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ x: 0, y: 0 });
  const drop = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const audio = useRef<WorkshopAudio | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const busy = useRef(false);

  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => {
    const engine = new WorkshopAudio(() => { soundWanted.current = false; setSound(false); setAudioError('이 브라우저에서는 소리를 재생할 수 없어요.'); });
    audio.current = engine;
    const visibility = () => engine.setHidden(document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const unlock = (event: Event) => {
      if (event.type === 'keydown' && !['Enter', ' '].includes((event as KeyboardEvent).key)) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('.sound')) return;
      if (!soundWanted.current || audioStarted.current) return;
      audioStarted.current = true;
      const enabled = engine.setEnabled(true);
      soundWanted.current = enabled;
      setSound(enabled);
    };
    document.addEventListener('pointerup', unlock, true);
    document.addEventListener('keydown', unlock, true);
    document.addEventListener('click', unlock, true);
    return () => { exportVersion.current++; audioStarted.current = false; document.removeEventListener('pointerup', unlock, true); document.removeEventListener('keydown', unlock, true); document.removeEventListener('click', unlock, true); timers.current.forEach(clearTimeout); document.removeEventListener('visibilitychange', visibility); engine.dispose(); audio.current = null; };
  }, []);
  useEffect(() => { title.current?.focus(); }, [scene, opened]);
  function toggleSound() {
    setAudioError('');
    soundWanted.current = !soundWanted.current; audioStarted.current = soundWanted.current; setSound(audio.current?.setEnabled(soundWanted.current) ?? false);
  }
  useEffect(() => {
    if (!cardUrl) return;
    cardDialog.current?.showModal();
    return () => URL.revokeObjectURL(cardUrl);
  }, [cardUrl]);
  async function saveCard() {
    if (saving || !message) return;
    const version = ++exportVersion.current;
    setSaving(true); setCopied('');
    try {
      const blob = await createFortuneCard(message);
      if (version === exportVersion.current) setCardUrl(URL.createObjectURL(blob));
    } catch {
      if (version === exportVersion.current) setCopied('이미지를 만들지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (version === exportVersion.current) setSaving(false);
    }
  }
  function next() { if (!worry.trim() || busy.current) return; busy.current = true; setFolding(true); later(() => { setScene('choose'); setFolding(false); busy.current = false; }, 750); }
  function select(value: Mode) { if (busy.current) return; busy.current = true; setSelecting(value); setMode(value); later(() => { setScene('release'); setSelecting(null); busy.current = false; }, 500); }
  function release() { if (busy.current) return; busy.current = true; setDragging(false); setOffset({ x: 0, y: 0 }); setReleasing(true); setMessage(getFortune(worry)); audio.current?.playAction(mode); later(() => { setWorry(''); setReleasing(false); setScene('cookie'); busy.current = false; }, 3400); }
  function reset() { exportVersion.current++; setSaving(false); setCardUrl(''); audio.current?.cancelAction(); timers.current.forEach(clearTimeout); timers.current = []; busy.current = false; setWorry(''); setMessage(''); setFolding(false); setSelecting(null); setReleasing(false); setDragging(false); setOpened(false); setCopied(''); setOffset({ x: 0, y: 0 }); setScene('welcome'); }
  function startDrag(e: PointerEvent<HTMLButtonElement>) { if (releasing) return; e.currentTarget.setPointerCapture(e.pointerId); origin.current = { x: e.clientX, y: e.clientY }; setDragging(true); }
  function endDrag(e: PointerEvent<HTMLButtonElement>) { if (!dragging) return; const r = drop.current?.getBoundingClientRect(); setDragging(false); setOffset({ x: 0, y: 0 }); if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) release(); }
  async function copy() { try { await navigator.clipboard.writeText(message); setCopied('복사했어요'); } catch { setCopied('아래 문구를 길게 누르거나 선택해서 복사해주세요.'); } }
  const step = scene === 'write' ? 1 : scene === 'choose' || scene === 'release' ? 2 : scene === 'cookie' ? 3 : 0;
  return <main className={`app scene-${scene}`}><Room/><header className="topbar"><button className="brand" onClick={reset} aria-label="처음 화면으로" title="마음이 쉬어가는 작업실"><svg className="brand-emblem" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#3D2949" stroke="#EBC795" strokeWidth="1.5"/><path d="M30.8 11.5a14 14 0 1 0 5.7 24.9A14.5 14.5 0 0 1 30.8 11.5Z" fill="#FFE2A9"/><path d="m35 8 .9 2.5L38.4 11l-2.5.9L35 14.4l-.9-2.5-2.5-.9 2.5-.5L35 8ZM11 28l.7 1.8 1.8.7-1.8.7L11 33l-.7-1.8-1.8-.7 1.8-.7L11 28Z" fill="#FFE8BC"/></svg><span className="brand-wordmark"><span className="brand-overline">마음이 쉬어가는</span><span className="brand-name">작업실 <span aria-hidden="true">✦</span></span></span></button><button className="sound" aria-pressed={sound} onClick={toggleSound} aria-label={`소리 ${sound ? '끄기' : '켜기'}`} title="잔잔한 배경음과 분쇄기·장작 소리"><span>{sound ? '♫' : '♪'}</span> 소리 {sound ? 'ON' : 'OFF'}</button></header>{audioError && <p className="audio-status" role="status">{audioError}</p>}
    {step > 0 && <nav className="steps" aria-label="게임 진행 단계">{['고민 적기', '마음 비우기', '행운 만나기'].map((s, i) => <span key={s} className={step === i + 1 ? 'current' : step > i + 1 ? 'done' : ''} aria-current={step === i + 1 ? 'step' : undefined}><b>{step > i + 1 ? '✓' : i + 1}</b>{s}</span>)}</nav>}
    <section key={scene} className="content">
    {scene === 'welcome' && <div className="welcome"><div className="eyebrow"><span/> A LITTLE MAGIC FOR YOUR MIND <span/></div><div className="title-star">✧</div><h1 ref={title} tabIndex={-1}>고민 분쇄기</h1><p className="intro">오늘의 고민을 비우면,<br/>내일의 행운이 찾아와요.</p><div className="welcome-decoration">✦ <span>잠시, 마음의 짐을 내려놓는 시간</span> ✦</div><button className="primary start" onClick={() => { setScene('write'); }}>마음 비우러 가기 <span>✧</span></button><p className="duration">약 1–2분 · 오롯이 나를 위한 작은 쉼</p></div>}
    {scene === 'write' && <div className="write-panel"><div className="eyebrow">LEAVE YOUR WORRIES HERE</div><h1 ref={title} tabIndex={-1}>오늘, 어떤 고민이 있나요?</h1><p className="subtitle">마음에 담아두었던 이야기를 살짝 적어주세요.</p><div className={`paper-editor ${folding ? 'folding' : ''}`}><label htmlFor="worry">DEAR, MY HEART</label><textarea id="worry" maxLength={200} value={worry} onChange={e => setWorry(e.target.value)} disabled={folding} placeholder={'오늘은 할 일이 너무 많아서 지쳤어요…\n어떤 이야기든 괜찮아요.'}/><div className="paper-bottom"><span>작은 한숨까지, 여기에 두고 가요.</span><output>{worry.length} / 200</output></div></div><button className="primary" disabled={!worry.trim() || folding} onClick={next}>{folding ? '마음을 접고 있어요…' : '다 적었어요'} <span>✧</span></button><p className="privacy">♧ 이 이야기는 저장되거나 전송되지 않아요.</p></div>}
    {scene === 'choose' && <div className="choose-panel"><div className="eyebrow">LET IT GO, YOUR WAY</div><h1 ref={title} tabIndex={-1}>어떻게 마음을 비울까요?</h1><p className="subtitle">지금 마음이 이끄는 쪽을 골라주세요.</p><div className={`choices ${selecting ? `selected-${selecting}` : ''}`}><button className="choice" disabled={!!selecting} onClick={() => select('shred')}><div className="tool-art"><div className="mini-paper">오늘의 고민</div><Machine/></div><div className="choice-text"><span className="choice-tag">가볍게, 사르르</span><h2>잘게 분쇄하기 <span>✧</span></h2><p>복잡한 마음을 작은 조각으로.</p></div></button><button className="choice fire-choice" disabled={!!selecting} onClick={() => select('burn')}><div className="tool-art"><Fireplace/></div><div className="choice-text"><span className="choice-tag">따뜻하게, 훨훨</span><h2>불꽃에 보내기 <span>✧</span></h2><p>무거운 마음을 포근한 재로.</p></div></button></div><button className="text-button" disabled={!!selecting} onClick={() => setScene('write')}>고민 다시 적기</button></div>}
    {scene === 'release' && <div className={`release-panel ${releasing ? 'is-releasing' : ''} ${mode}`}><div className="eyebrow">A SMALL RITUAL OF RELEASE</div><h1 ref={title} tabIndex={-1}>{releasing ? '이제, 가볍게 보내주세요.' : mode === 'shred' ? '복잡한 마음도, 조각조각.' : '무거운 마음을 불꽃 속으로.'}</h1><p className="subtitle" aria-live="polite">{releasing ? '잘 버텨온 당신에게, 작은 행운이 오고 있어요.' : '종이를 아래로 끌어 놓거나, 보내기 버튼을 눌러주세요.'}</p><div className="release-stage"><div className="paper-flight"><button aria-label="고민 종이. Enter 키로 보내기" className={`worry-paper ${dragging ? 'dragging' : ''}`} disabled={releasing} style={{ '--dx': `${offset.x}px`, '--dy': `${offset.y}px` } as CSSProperties} onPointerDown={startDrag} onPointerMove={e => { if (dragging) setOffset({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y }); }} onPointerUp={endDrag} onPointerCancel={() => { setDragging(false); setOffset({ x: 0, y: 0 }); }} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); release(); } }}><span>{worry}</span><small>놓아주어도 괜찮아요</small></button></div><div ref={drop} className={`drop-zone ${dragging ? 'ready' : ''}`}>{mode === 'shred' ? <Machine active={releasing}/> : <Fireplace active={releasing}/>}</div>{releasing && mode === 'burn' && <div className="release-particles">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}/>)}</div>}</div><button className="primary" disabled={releasing} onClick={release}>{releasing ? '마음이 가벼워지는 중…' : mode === 'shred' ? '분쇄기로 보내기' : '불꽃으로 보내기'}</button></div>}
    {scene === 'cookie' && <div className={`fortune-panel ${opened ? 'opened' : ''}`}><div className="eyebrow">A LITTLE LUCK, JUST FOR YOU</div><h1 ref={title} tabIndex={-1}>{opened ? '당신에게 도착한 다정한 한마디' : <>고민이 사라진 자리에,<br/>행운이 찾아왔어요.</>}</h1><p className="subtitle">{opened ? '이 작은 문장이 오늘의 마음에 오래 머물기를.' : '반짝이는 포춘쿠키를 열어보세요.'}</p><div className="cookie-stage"><div className="cookie-halo"/><button className="cookie" aria-label="포춘쿠키 열기" disabled={opened} onClick={() => { if (opened) return; setOpened(true); audio.current?.playCookieCrack(); }}><span className="cookie-half half-left"/><span className="cookie-half half-right"/>{opened && <span className="cookie-crumbs" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}/>)}</span>}</button>{opened && <div className="fortune-note"><span>✦ 오늘의 행운 ✦</span><p>{message}</p><small>당신을 응원하는 작은 마법 작업실에서</small></div>}<span className="spark spark-one">✦</span><span className="spark spark-two">✧</span><span className="spark spark-three">✦</span></div>{opened ? <><div className="fortune-actions"><button className="secondary" onClick={reset}>↻ 다시 마음 비우기</button><button className="primary" onClick={copy}>문구 복사하기 <span>▣</span></button><button className="primary" onClick={saveCard} disabled={saving}>{saving ? '이미지 만드는 중…' : '이미지로 저장'}</button></div><p className="copy-status" role="status">{copied || '오늘도, 당신의 마음이 조금 더 가볍기를.'}</p></> : <p className="cookie-hint">쿠키를 클릭하면 작은 선물이 펼쳐져요 <span>✧</span></p>}</div>}
    </section>
    {cardUrl && <dialog className="card-dialog" ref={cardDialog} onCancel={() => setCardUrl('')} aria-labelledby="card-title">
      <div className="card-dialog-header"><h2 id="card-title">오늘의 행운을 간직하세요</h2><button autoFocus onClick={() => setCardUrl('')} aria-label="이미지 미리보기 닫기">✕</button></div>
      <img src={cardUrl} alt={`작업실 배경에 담긴 행운 문구: ${message}`}/>
      <a className="primary card-download" href={cardUrl} download="고민분쇄기-오늘의행운.png">PNG 다운로드</a>
      <p>1080 × 1440 · 휴대폰에서는 이미지를 길게 눌러 저장할 수도 있어요.</p>
    </dialog>}
    <footer><span>✦</span> 오늘의 고민은 여기에, 내일의 당신은 조금 더 가볍게 <span>✦</span></footer></main>;
}














