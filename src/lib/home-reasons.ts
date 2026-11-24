import difficultText from '../../data/起床困难户.txt?raw';
import disciplinedText from '../../data/早起自律人.txt?raw';

function parse(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

const fallback = ['今天你与床铺发生了一场恶战，败于枕下。'];
const difficultPool = parse(difficultText);
const disciplinedPool = parse(disciplinedText);
export const difficult: string[] = difficultPool.length ? difficultPool : fallback;
export const disciplined: string[] = disciplinedPool.length ? disciplinedPool : fallback;
