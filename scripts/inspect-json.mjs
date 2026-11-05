import { calculateBazi, toBaziJson } from 'taibu-core/bazi';
const chart = calculateBazi({ gender:'male', birthYear:1990, birthMonth:5, birthDay:15, birthHour:9, birthMinute:0 });
const json = toBaziJson(chart);
console.log('顶层键:', Object.keys(json));
console.log(JSON.stringify(json, null, 1).slice(0, 1500));
