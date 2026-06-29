import { Pool } from "pg";

const WORDS_TO_DELETE = [
  // 성적 표현
  "섹스","섹스가","섹스는","섹스도","섹스랑","섹스로","섹스를","섹스에","섹스요","섹스의","섹스하고","섹스한","섹스할",
  "섹시하게","섹시하고","섹시하군","섹시하다","섹시한","섹시해",
  "강간","강간은","강간하고","강간한",
  "성교","성교를","성교하다",
  "성폭력",
  "발기","발기되다","발기부전","발기하다",
  "보지는","보지를","보지지","보지직","백보지","밴대보지","해보지",
  "자위","자위하다","자위행위",
  "자지도","자지레","자지를","자지리",
  "정액","정액을",
  "음경","음부","음핵","음란","음란하다",
  "항문","항문관","항문에","항문외과","항문을",
  "에이즈","콘돔",
  "고추자지","카섹스",
  // 비속어·욕설
  "갈보","똥갈보","양갈보",
  "개새끼",
  "개지랄","돈지랄","좆지랄","지랄","지랄을","지랄이","지랄이야","지랄이여","지랄하다",
  "나체","나체화","반나체",
  "매음부","매춘","매춘부","매춘하다",
  "반병신","병신","병신들아","병신아","병신은","병신이",
  "변태","변태성욕","변태심리","변태야",
  "씨발","씨발놈",
  "씹거웃","씹구멍","씹두덩","씹새끼","씹창","씹탱이","씹하다","씹히다",
  "좆같은","좆대가리","좆새끼",
  "창녀","창녀야","창녀와",
  "미친","미친개","미친갯병","미친거","미친것","미친게",
  "멍청","멍청아","멍청이","멍청이야","멍청하다","어리멍청",
  "바보","바보로","바보야","바보인","바보짓",
  // 장애 비하어
  "귀머거리","벙어리","벙어리가","앉은뱅이",
  "저능","저능아","천치",
  "애자지정",
  // 성적 지향 관련
  "동성애","동성애자","레즈비언","범성애자","양성애","양성애자",
];

async function main() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL 환경변수가 없습니다.");

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: before } = await client.query<{ cnt: string }>(
      "SELECT COUNT(*) AS cnt FROM dict_words WHERE word = ANY($1::text[])",
      [WORDS_TO_DELETE],
    );
    const beforeCnt = parseInt(before[0]!.cnt, 10);
    console.log(`삭제 대상 단어 현재 DB 존재: ${beforeCnt}개`);

    if (beforeCnt === 0) {
      await client.query("ROLLBACK");
      console.log("이미 모두 제거되었습니다. 종료.");
      return;
    }

    const result = await client.query(
      "DELETE FROM dict_words WHERE word = ANY($1::text[])",
      [WORDS_TO_DELETE],
    );

    const { rows: after } = await client.query<{ cnt: string }>(
      "SELECT COUNT(*) AS cnt FROM dict_words WHERE word = ANY($1::text[])",
      [WORDS_TO_DELETE],
    );
    const afterCnt = parseInt(after[0]!.cnt, 10);

    await client.query("COMMIT");
    console.log(`삭제 완료. 삭제 건수: ${result.rowCount ?? 0}개, 잔여: ${afterCnt}개`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
