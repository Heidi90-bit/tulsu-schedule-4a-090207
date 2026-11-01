import fs from 'node:fs/promises';
import path from 'node:path';
const group='4а-090207',source='https://tulsu.ru/schedule/queries/';
async function get(endpoint,args){
 const url=new URL(endpoint,source);url.search=new URLSearchParams(args);
 let last;for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{Accept:'application/json','User-Agent':'AttendanceScheduleUpdater/1.0'}});if(!r.ok)throw new Error('ТулГУ HTTP '+r.status);return await r.json()}
  catch(e){last=e;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,3000*(attempt+1)))}
 }throw last;
}
const args={search_field:'GROUP_P',search_value:group};
const [range,raw,times]=await Promise.all([get('GetDates.php',{search_value:group}),get('GetSchedule.php',args),get('GetTimeGroups.php',args)]);
if(range.SEARCH_FIELD!=='GROUP_P'||!/^\d{4}-\d{2}-\d{2}$/.test(range.MIN_DATE)||!/^\d{4}-\d{2}-\d{2}$/.test(range.MAX_DATE)||range.MIN_DATE>range.MAX_DATE)throw new Error('Некорректный диапазон расписания');
if(!Array.isArray(raw)||!raw.length||raw.length>1500||!Array.isArray(times)||!times.length||times.length>24)throw new Error('Пустое или некорректное расписание');
const slots=new Set(times.map(t=>t.TIME_START)),seen=new Set();
for(const row of raw){
 if(!Array.isArray(row.GROUPS)||!row.GROUPS.some(g=>g.GROUP_P?.toLowerCase()===group.toLowerCase())||row.GROUPS.some(g=>g.PRIM))throw new Error('Другая группа или появились подгруппы');
 const match=String(row.TIME_Z).match(/^(\d\d:\d\d)\s*-\s*(\d\d:\d\d)$/),parts=String(row.DATE_Z).split('.'),day=parts.reverse().join('-');
 if(!match||!slots.has(match[1])||!row.DISCIP||!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<range.MIN_DATE||day>range.MAX_DATE)throw new Error('Изменился формат расписания');
 const key=day+'|'+match[1];if(seen.has(key))throw new Error('Несколько занятий одновременно');seen.add(key);
}
const file='schedule.json',temporary=file+'.tmp';
await fs.writeFile(temporary,JSON.stringify({version:1,group,source:'https://tulsu.ru/schedule/',fetchedAt:new Date().toISOString(),range,raw,times})+'\n');
await fs.rename(temporary,file);
console.log(`Обновлено: ${raw.length} пар, ${range.MIN_DATE} — ${range.MAX_DATE}`);
