import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FALLBACK = {
  difficult: [
    '今天你与床铺发生了一场恶战，败于枕下。',
    '你的被子昨晚练成了吸星大法，你挣扎了半小时没能突围。',
    '你昨晚对着空白文档熬到天亮，刚合上眼，早八闹钟就响了。',
    '你的睡眠定位昨晚漂移到了月球，通勤回地球至少要三个半小时。',
    '你的被窝昨晚突然觉醒，宣布独立，并把你扣为人质。',
    '你的闹钟穿越了，响在了昨天。',
    '你的身体系统正在安装早八补丁，进度卡在 99%。',
    '你的课表在凌晨偷偷改成了“床上自习”。',
  ],
  disciplined: [
    '你的生物钟昨晚自己定了 6:30 的闹钟，并拒绝接受你的申诉。',
    '你的身体在凌晨自动完成开机自检，还弹窗提示“今日自律额度已到账”。',
    '你的褪黑素昨晚提前下班，说不想耽误你卷。',
    '你的眼皮今早全票通过“立即开馆”决议。',
    '你与床的量子纠缠今早自动解除，观测即起床。',
    '你的被窝刚想挽留你，就被你的自律气场掀翻了。',
    '你的闹钟和手机今早结成自律联盟，集体拒绝静音。',
    '你的“再睡五分钟”按钮今早 404 了。',
  ],
};

function readPool(file: string, fallback: string[]): string[] {
  try {
    const text = fs.readFileSync(path.join(ROOT, 'data', file), 'utf8');
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    return lines.length ? lines : fallback;
  } catch {
    return fallback;
  }
}

export const difficult = readPool('起床困难户.txt', FALLBACK.difficult);
export const disciplined = readPool('早起自律人.txt', FALLBACK.disciplined);
