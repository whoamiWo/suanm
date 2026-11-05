import { Solar } from 'lunar-javascript';
import { calculateBazi } from 'taibu-core/bazi';

const cases = [
  { y: 1990, m: 5, d: 15, h: 9, g: 'male' },
  { y: 1984, m: 2, d: 4, h: 12, g: 'female' },
  { y: 2000, m: 1, d: 1, h: 0, g: 'male' },
  { y: 1976, m: 8, d: 8, h: 20, g: 'female' },
  { y: 2024, m: 2, d: 4, h: 23, g: 'male' },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const lunar = Solar.fromYmdHms(c.y, c.m, c.d, c.h, 0, 0).getLunar();
  const ec = lunar.getEightChar();
  const tb = calculateBazi({ gender: c.g, birthYear: c.y, birthMonth: c.m, birthDay: c.d, birthHour: c.h, birthMinute: 0 });
  const fp = tb.fourPillars;
  const got = ['year','month','day','hour'].map(k => fp[k] ? fp[k].stem + fp[k].branch : '--').join(' ');
  const want = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()].join(' ');
  const ok = got === want;
  if (ok) {
    pass++;
  } else {
    fail++;
  }
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.y}-${c.m}-${c.d} ${c.h}:00 ${c.g}`);
  console.log(`   taibu: ${got}`);
  console.log(`   lunar: ${want}`);
}
console.log(`\n合计: ${pass} pass / ${fail} fail`);
