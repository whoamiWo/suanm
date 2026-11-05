import { calculateBazi, toBaziText, toBaziJson } from 'taibu-core/bazi';

const chart = calculateBazi({
  gender: 'male',
  birthYear: 1990,
  birthMonth: 5,
  birthDay: 15,
  birthHour: 9,
  birthMinute: 0,
});

console.log('=== 四柱 ===');
const fp = chart.fourPillars;
for (const k of ['year','month','day','hour']) {
  const p = fp[k];
  if (!p) { console.log(k, '(无)'); continue; }
  console.log(`${k}: ${p.stem}${p.branch}  十神=${p.tenGod}  纳音=${p.naYin}  长生=${p.diShi}  藏干=[${p.hiddenStems.map(h=>h.stem+':'+h.qiType+':'+h.tenGod).join(', ')}]`);
}
console.log('日主:', chart.dayMaster);
console.log('空亡:', JSON.stringify(chart.kongWang));
console.log('命宫:', chart.mingGong, ' 胎元:', chart.taiYuan);
console.log('真太阳时:', chart.trueSolarTimeInfo ? JSON.stringify(chart.trueSolarTimeInfo) : '无');
console.log('关系数:', chart.relations?.length);
console.log('\n=== canonical text (前1200字) ===');
console.log(toBaziText(chart).slice(0, 1200));
