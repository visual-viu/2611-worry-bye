const loadImage = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  const timeout = setTimeout(() => reject(new Error('이미지 불러오기 시간 초과')), 15000);
  image.onload = () => { clearTimeout(timeout); resolve(image); };
  image.onerror = () => { clearTimeout(timeout); reject(new Error('이미지를 불러오지 못했어요.')); };
  image.src = src;
});

/** Only the prepared fortune is exported, never the user's worry. */
export async function createFortuneCard(message: string): Promise<Blob> {
  const [background, jarArt, cookie, cat] = await Promise.all([
    loadImage('/assets/workshop-unified-mobile.png'),
    loadImage('/assets/room-star-jar.png'),
    loadImage('/assets/fortune-cookie-v2.png'),
    loadImage('/assets/sleeping-cat.png'),
  ]);
  // Canvas does not automatically wait for font-display: swap.
  // Load both weights before measuring text or drawing the saved card.
  if (document.fonts) {
    let fontTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('400 24px "Heejoy"', message + '마음이 가벼워지는 작은 마법'),
          document.fonts.load('700 42px "Heejoy"', message + '당신에게 도착한 행운 고민 분쇄기'),
        ]),
        new Promise<never>((_, reject) => { fontTimeout = setTimeout(() => reject(new Error('폰트를 불러오지 못했어요. 다시 시도해주세요.')), 15000); }),
      ]);
    } finally { clearTimeout(fontTimeout); }
  }
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 이미지 저장을 지원하지 않아요.');
  const drawProp = (image: HTMLImageElement, x: number, y: number, width: number) => {
    ctx.drawImage(image, x, y, width, width * image.naturalHeight / image.naturalWidth);
  };
  // Crop the portrait room like CSS object-fit: cover; never stretch it.
  const targetRatio = 1080 / 1440;
  const imageRatio = background.naturalWidth / background.naturalHeight;
  const cropWidth = imageRatio > targetRatio ? background.naturalHeight * targetRatio : background.naturalWidth;
  const cropHeight = imageRatio > targetRatio ? background.naturalHeight : background.naturalWidth / targetRatio;
  ctx.drawImage(background, (background.naturalWidth - cropWidth) / 2, (background.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, 1080, 1440);
  drawProp(jarArt, 820, 1095, 235);
  ctx.fillStyle = '#21142e55';
  ctx.fillRect(0, 0, 1080, 1440);

  ctx.strokeStyle = '#f5d49888';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(36, 36, 1008, 1368, 26); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6d6aa';
  ctx.font = '24px "Heejoy", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText('마음이 가벼워지는 작은 마법', 540, 135);
  ctx.save();
  ctx.shadowColor = '#ffba5e88'; ctx.shadowBlur = 40;
  drawProp(cookie, 350, 180, 380);
  ctx.restore();
  ctx.fillStyle = '#fff0d5';
  ctx.font = 'bold 46px "Heejoy", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText('당신에게 도착한 행운', 540, 468);

  const paper = ctx.createLinearGradient(110, 0, 970, 0);
  paper.addColorStop(0, '#eed2aa'); paper.addColorStop(.18, '#fff2dc');
  paper.addColorStop(.82, '#fff2dc'); paper.addColorStop(1, '#eed2aa');
  ctx.save(); ctx.shadowColor = '#ffce8260'; ctx.shadowBlur = 55;
  ctx.fillStyle = paper; ctx.beginPath(); ctx.roundRect(100, 540, 880, 480, 24); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#b88b5d88'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(117, 557, 846, 446, 15); ctx.stroke();
  ctx.fillStyle = '#ae8055';
  ctx.font = '24px "Heejoy", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText('✦  오늘의 다정한 한마디  ✦', 540, 622);

  let fontSize = 42;
  let lines: string[] = [];
  // Wrap by measured glyph width so Korean text stays safely inside the card.
  do {
    ctx.font = `bold ${fontSize}px "Heejoy", "Apple SD Gothic Neo", sans-serif`;
    lines = [];
    for (const paragraph of message.split('\n')) {
      let line = '';
      for (const char of paragraph) {
        if (line && ctx.measureText(line + char).width > 760) { lines.push(line.trim()); line = char; }
        else line += char;
      }
      lines.push(line.trim());
    }
    if (lines.length <= 5) break;
    fontSize -= 2;
  } while (fontSize >= 26);
  ctx.fillStyle = '#54394c';
  const lineHeight = fontSize * 1.65;
  const firstLine = 797 - (lines.length - 1) * lineHeight / 2;
  lines.forEach((line, i) => ctx.fillText(line, 540, firstLine + i * lineHeight));
  ctx.font = '22px "Heejoy", "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = '#9a765f';
  ctx.fillText('오늘의 당신도, 충분히 소중해요.', 540, 966);
  drawProp(cat, 58, 1110, 285);
  ctx.fillStyle = '#f9dfb8';
  ctx.font = 'bold 32px "Heejoy", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText('고민 분쇄기', 540, 1235);
  ctx.font = '21px "Heejoy", "Apple SD Gothic Neo", sans-serif';
  ctx.fillStyle = '#e3c8dc';
  ctx.fillText('고민은 내려놓고, 다정함은 간직해요.', 540, 1280);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('이미지 생성에 실패했어요.')), 'image/png'));
}





