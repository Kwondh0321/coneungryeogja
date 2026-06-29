import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const seed = JSON.parse(readFileSync('./src/lib/dict_words_seed.json', 'utf8'));

const { rows: before } = await pool.query('SELECT COUNT(*) as c FROM dict_words');
console.log(`DB 현재: ${before[0].c}개`);

const BATCH = 1000;
let inserted = 0;

for (let i = 0; i < seed.length; i += BATCH) {
  const batch = seed.slice(i, i + BATCH);
  const vals = batch.map((_, j) => `($${j*3+1},$${j*3+2},$${j*3+3})`).join(',');
  const params = batch.flatMap(r => [r[0], r[1], r[2]]);
  try {
    const res = await pool.query(
      `INSERT INTO dict_words (word, chosung, word_len) VALUES ${vals} ON CONFLICT DO NOTHING`,
      params
    );
    inserted += res.rowCount || 0;
  } catch(e) {
    console.error(`배치 ${i} 오류:`, e.message);
  }
  if ((i/BATCH) % 10 === 0) process.stdout.write(`\r${i}/${seed.length} 처리 중... 삽입: ${inserted}`);
}

const { rows: after } = await pool.query('SELECT COUNT(*) as c FROM dict_words');
console.log(`\n완료! DB: ${before[0].c} → ${after[0].c} (신규 ${inserted}개 삽입)`);

const { rows: dist } = await pool.query('SELECT word_len, COUNT(*) as c FROM dict_words GROUP BY word_len ORDER BY word_len');
console.log('길이별:', dist.map(r => `${r.word_len}글자: ${r.c}개`).join(', '));

await pool.end();
