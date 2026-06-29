/**
 * 닉네임 금지어 필터 — 대형 게임 닉네임 필터 방식 기반 자동 차단 시스템
 *
 * 검사 순서 (13단계):
 *  1. 입력값 방어
 *  2. NFKC 정규화
 *  3. 길이 검사
 *  4. 허용 문자 검사
 *  5. 개인정보성 숫자 패턴 검사
 *  6. normalize 적용
 *  7. RESERVED_WORDS 하드차단 (normalized + confusable 양쪽)
 *  8. 퍼지 정규식 (NFKC 원본 + normalized 양쪽)
 *  9. 금지 부분문자열 검사
 * 10. 초성 욕설 검사
 * 11. 자모 유사도 검사 (카테고리별 threshold)
 * 12. 통과
 */

// ── 차단 로그 타입 ────────────────────────────────────────────────────────────

export type NicknameBlockLog = {
  userId: string;
  attemptedNick: string;
  normalizedNick: string;
  matchedRule: string;
  category: 'profanity' | 'sexual' | 'political' | 'hate' | 'reserved' | 'bot' | 'format' | 'personalInfo';
  createdAt: Date;
};

/** 관리용 차단 로그 (인메모리, 최대 1000건) — 사용자에게 노출 금지 */
export const nickBlockLogs: NicknameBlockLog[] = [];

function addBlockLog(log: NicknameBlockLog): void {
  nickBlockLogs.push(log);
  if (nickBlockLogs.length > 1000) nickBlockLogs.shift();
}

// ── 정규화 ────────────────────────────────────────────────────────────────────

/**
 * 강화된 정규화:
 * NFKC → lowercase → zero-width/장난 문자 제거 → 공백·숫자·특수문자 제거 → 연속 중복 축소
 */
function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\uFFA0\u3164]/g, '') // zero-width·장난 문자
    .replace(/[\s\d!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '')
    .replace(/(.)\1+/g, '$1');
}

/**
 * 영어 사칭어 우회 정규화 (예약어/사칭어 검사에만 적용)
 * adm1n, 0fficial, systern 등 차단
 */
function normalizeLatinConfusables(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/[1!|l]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/rn/g, 'm')   // rn → m (systern → system)
    .replace(/vv/g, 'w');
}

// ── 개인정보 숫자 패턴 ────────────────────────────────────────────────────────

function hasPersonalInfoPattern(nick: string): boolean {
  const digits = nick.replace(/\D/g, '');
  if (digits.length >= 8) return true;          // 8자리 이상 연속 숫자
  if (/^010\d{7,8}$/.test(digits)) return true; // 010 전화번호
  return false;
}

// ── 자모 분해 & 유사도 ────────────────────────────────────────────────────────

const CHO_TABLE  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNG_TABLE = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG_TABLE = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

/** 한글 음절 → 초성+중성+종성 자모 문자열 */
function decomposeJamo(s: string): string {
  return Array.from(s).map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const off = code - 0xAC00;
      return CHO_TABLE[Math.floor(off / 588)]
           + JUNG_TABLE[Math.floor((off % 588) / 28)]
           + JONG_TABLE[off % 28];
    }
    return ch;
  }).join('');
}

/** 한글 음절 → 초성만 추출 */
function getChosung(s: string): string {
  return Array.from(s).map(ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3)
      return CHO_TABLE[Math.floor((code - 0xAC00) / 588)];
    return ch;
  }).join('');
}

/** Levenshtein 유사도: 1 − editDist(a, b) / max(|a|, |b|) */
function jamoSim(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m && !n) return 1;
  if (!m || !n) return 0;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return 1 - dp[n] / Math.max(m, n);
}

/** 닉네임 자모열에서 금지어 자모열 길이 ±25% 윈도우 슬라이드 → 최대 유사도 반환 */
function maxJamoSim(nickJamo: string, bannedJamo: string): number {
  const L = bannedJamo.length;
  const N = nickJamo.length;
  if (!N || !L) return 0;
  const wMin = Math.max(1, Math.floor(L * 0.8));
  const wMax = Math.min(N, Math.ceil(L * 1.25));
  let best = 0;
  for (let w = wMin; w <= wMax; w++) {
    for (let i = 0; i + w <= N; i++) {
      const sim = jamoSim(nickJamo.slice(i, i + w), bannedJamo);
      if (sim > best) best = sim;
      if (best >= 1) return 1;
    }
  }
  return best;
}

// ── 금지어 목록 (카테고리별 분리) ─────────────────────────────────────────────

/** 운영자/관리자/공식/봇명 사칭 — 하드차단 (별도 처리) */
const RESERVED_WORDS: string[] = [
  '운영자', '운영진', '관리자', '어드민',
  'admin', 'administrator', 'manager', 'gm',
  'official', 'system', 'notice', 'support',
  '공지', '공식', '시스템', '고객센터',
  '초능력자', '초능력자봇',
  // 봇 게임 명령어 (게임 내 혼란 방지)
  '훈민정음', '자모연성', '초성퀴즈', '다음문제',
  // 커뮤니티 이름 (닉네임 사칭·홍보 방지)
  '일베', '일간베스트', '여시', '메갈', '메갈리아', '워마드', '펨코',
  // 정치 관련 추가 예약어
  '부엉바위',
];

/** 초성 욕설 (음절 초성 추출 후 검사) */
const BANNED_CHOSUNG: string[] = [
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅈㄴ', 'ㅁㅊ', 'ㅈㄹ', 'ㅅㄲ', 'ㄱㅅㄲ',
];

/** 욕설/비속어 */
const PROFANITY_WORDS: string[] = [
  '씨발', '시발', '씨팔', '시팔', '씨빨', '시빨', '쉬발', '쉬팔', '쉬빨',
  '개새끼', '개세끼', '개새키', '갸새끼', '개쌔끼', '개쌔키',
  '병신', '벙신', '병쉰',
  '지랄', '지럴', '지랬',
  '좆같', '좆나', '존나', '존내', '졸라', '조낸',
  '자지', '쟤지',
  '씹새끼', '씹창', '씹탱', '씹놈', '씹년',
  '새끼', '세끼', '쌔끼',
  '미친놈', '미친년', '미친새끼', '미친개',
  '창녀', '창년', '매춘', '매음',
  '니미', '니애미', '느금마', '니엄마', '니어미',
  '니에미', '니에비', '애미', '애비',
  '염병', '영병',
  '개소리', '개지랄', '좆지랄',
  '놈팡이',
  // 자모 단독 욕 (BANNED_CHOSUNG와 별개로 직접 입력 시 차단)
  'ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅈㄴ', 'ㅁㅊ', 'ㅈㄹ', 'ㅅㄲ', 'ㄱㅅ',
];

/** 성적 표현 */
const SEXUAL_WORDS: string[] = [
  '섹스', '야동', '야사',
  '강간', '성교', '자위', '발기', '정액',
  '음부', '음핵', '음경', '음란',
  '보지', '봐지',
  '응디', '엉덩이',
];

/** 정치인 이름, 정치 밈, 정치 성향 비하 */
const POLITICAL_WORDS: string[] = [
  '노무현', '이명박', '박근혜', '문재인', '윤석열',
  '김대중', '김영삼', '전두환', '노태우', '이승만', '박정희',
  '최규하',
  '윤어게인', '윤어겐',
  '시진핑', '김정은', '김정일', '김일성',
  '노무통', '노무딱', '부엉이바위',
  // 노무현 관련 밈
  '봉하마을', '노무원', '북딱',
  // 박근혜 관련 밈
  '최순실', '순실이', '비선실세',
  // 이명박 관련 밈
  '다스뇨',
  // 일반 정치 혐오·비하어
  '빨갱이', '개돼지', '홍위병', '촛불충', '탄핵충', '태극기충', '민주당', '국민의', '내란의', '이준석', '통일당', '개혁신당', '정의당', '조국혁신당', '자유와혁신', '기본소득당', '사회민주당', '진보당', '녹색당', '기독당', '국민대통령당', '공화당', '가가국민참여신당', '가나반공정당코리아', '공화당', '국가혁명당', '국민연합', '국민주권당', '국민통합연대', '녹색당', '대중민주당', '대한상공인당', '미래당', '미래연대', '민주평화당', '민중민주당', '새누리당', '새미래민주당', '소나무당', '여성의당', '우릭공화당', '자유와혁신', '정의당', '한국농어민당', '한국독립당', '한나라당', '한류연합당', '홍익당', '한반도미래당', '한류연합당', '한국독립당', '통일한국당', '태건당', '친미연합', '중도혁신당', '소나무당',

  // 정치 성향 비하어
  '좌좀', '좌빨', '수꼴', '수구꼴통', '진보충', '보수충',
];

/**
 * 혐오·차별 표현 (지역비하, 성별비하, 세대비하, 커뮤니티 파생 혐오어)
 * ALL_BANNED에 포함 → 부분문자열 검사(step 9)에서 차단
 */
const HATE_WORDS: string[] = [
  // 지역 비하
  '홍어', '홍어새끼', '전라디언',
  // 성별 비하
  '한남', '한남충', '남충',
  '김치녀', '보슬아치', '한녀', '꼴페미',
  // 세대·계층 비하
  '틀딱', '틀딱충',
  '급식충', '맘충',
  '개저씨', '폐급',
  // 커뮤니티 파생 혐오어
  '일베충', '메갈충', '워마드충', '디씨충', '펨코충',
  '좌좀충', '한남혐',
  // 민족 비하어
  '짱깨', '짱개', '쪽발이', '되놈',
];

/** 검사에 사용할 전체 금지어 (RESERVED는 별도 하드차단) */
const ALL_BANNED: string[] = [
  ...PROFANITY_WORDS,
  ...SEXUAL_WORDS,
  ...POLITICAL_WORDS,
  ...HATE_WORDS,
];

// ── 퍼지 정규식 ──────────────────────────────────────────────────────────────

const FUZZY_PATTERNS: Array<{ re: RegExp; category: NicknameBlockLog['category'] }> = [
  // 씨발 계열
  { re: /씨.{0,3}발/, category: 'profanity' },
  { re: /시.{0,3}발/, category: 'profanity' },
  { re: /쉬.{0,3}발/, category: 'profanity' },
  { re: /씨.{0,3}팔/, category: 'profanity' },
  { re: /시.{0,3}팔/, category: 'profanity' },
  // 개새끼 계열
  { re: /개.{0,2}새.{0,2}끼/, category: 'profanity' },
  { re: /갸.{0,2}새.{0,2}끼/, category: 'profanity' },
  // 병신 계열
  { re: /병.{0,2}신/, category: 'profanity' },
  { re: /벙.{0,2}신/, category: 'profanity' },
  // 미친 계열
  { re: /미.{0,2}친/, category: 'profanity' },
  // 존나/좆나 계열
  { re: /존.{0,2}나/, category: 'profanity' },
  { re: /좆.{0,2}나/, category: 'profanity' },
  // 씹 계열
  { re: /씹.{0,2}새/, category: 'profanity' },
  // 니에미/애미/애비 계열
  { re: /니.{0,2}에.{0,2}미/, category: 'profanity' },
  { re: /니.{0,2}에.{0,2}비/, category: 'profanity' },
  { re: /애.{0,2}미/, category: 'profanity' },
  { re: /애.{0,2}비/, category: 'profanity' },
  // 정치인 (글자 삽입 우회)
  { re: /노.{0,2}무.{0,2}현/, category: 'political' },
  { re: /이.{0,2}명.{0,2}박/, category: 'political' },
  { re: /박.{0,2}근.{0,2}혜/, category: 'political' },
  { re: /문.{0,2}재.{0,2}인/, category: 'political' },
  { re: /윤.{0,2}석.{0,2}열/, category: 'political' },
  { re: /전.{0,2}두.{0,2}환/, category: 'political' },
  { re: /노.{0,2}태.{0,2}우/, category: 'political' },
  { re: /이.{0,2}승.{0,2}만/, category: 'political' },
  { re: /박.{0,2}정.{0,2}희/, category: 'political' },
  { re: /김.{0,2}대.{0,2}중/, category: 'political' },
  { re: /김.{0,2}영.{0,2}삼/, category: 'political' },
  { re: /윤.{0,2}어.{0,2}게.{0,2}인/, category: 'political' },
  // 응디/엉덩이 계열
  { re: /응.{0,2}디/, category: 'sexual' },
  { re: /엉.{0,2}덩.{0,2}이/, category: 'sexual' },
  // 정치 밈 (글자 삽입 우회)
  { re: /노.{0,2}무.{0,2}통/, category: 'political' },
  { re: /노.{0,2}무.{0,2}딱/, category: 'political' },
  { re: /부.{0,2}엉.{0,2}이.{0,2}바.{0,2}위/, category: 'political' },
  { re: /좌.{0,2}좀/, category: 'political' },
  { re: /좌.{0,2}빨/, category: 'political' },
  { re: /수.{0,2}꼴/, category: 'political' },
  { re: /빨.{0,2}갱.{0,2}이/, category: 'political' },
  { re: /개.{0,2}돼.{0,2}지/, category: 'political' },
  { re: /홍.{0,2}위.{0,2}병/, category: 'political' },
  { re: /촛.{0,2}불.{0,2}충/, category: 'political' },
  { re: /봉.{0,2}하.{0,2}마.{0,2}을/, category: 'political' },
  { re: /최.{0,2}순.{0,2}실/, category: 'political' },
  // 커뮤니티 이름 (글자 삽입 우회)
  { re: /일.{0,2}베/, category: 'reserved' },
  { re: /메.{0,2}갈/, category: 'reserved' },
  { re: /워.{0,2}마.{0,2}드/, category: 'reserved' },
  // 혐오·차별 표현 (글자 삽입 우회)
  { re: /홍.{0,2}어/, category: 'hate' },
  { re: /틀.{0,2}딱/, category: 'hate' },
  { re: /한.{0,2}남.{0,2}충/, category: 'hate' },
  { re: /급.{0,2}식.{0,2}충/, category: 'hate' },
  { re: /맘.{0,2}충/, category: 'hate' },
  { re: /김.{0,2}치.{0,2}녀/, category: 'hate' },
  { re: /보.{0,2}슬.{0,2}아.{0,2}치/, category: 'hate' },
  { re: /꼴.{0,2}페.{0,2}미/, category: 'hate' },
  { re: /개.{0,2}저.{0,2}씨/, category: 'hate' },
  // 운영자/사칭 (글자 삽입 우회)
  { re: /운.{0,2}영.{0,2}자/, category: 'reserved' },
  { re: /운.{0,2}영.{0,2}진/, category: 'reserved' },
  { re: /관.{0,2}리.{0,2}자/, category: 'reserved' },
  { re: /공.{0,2}식/, category: 'reserved' },
  { re: /시.{0,2}스.{0,2}템/, category: 'reserved' },
  // 봇 이름 (글자 삽입 우회)
  { re: /초.{0,2}능.{0,2}력.{0,2}자/, category: 'bot' },
];

// ── 자모 유사도 타겟 (카테고리별 threshold) ───────────────────────────────────

type JamoTarget = {
  word: string;
  jamo: string;
  threshold: number;
  category: NicknameBlockLog['category'];
};

const JAMO_FUZZY_TARGETS: JamoTarget[] = ([
  // profanity: 0.75 ~ 0.78
  { word: '개새끼',   jamo: decomposeJamo('개새끼'),   threshold: 0.75, category: 'profanity' },
  { word: '씹새끼',   jamo: decomposeJamo('씹새끼'),   threshold: 0.75, category: 'profanity' },
  { word: '병신새끼', jamo: decomposeJamo('병신새끼'), threshold: 0.78, category: 'profanity' },
  // political: 0.82
  { word: '윤석열',   jamo: decomposeJamo('윤석열'),   threshold: 0.82, category: 'political' },
  { word: '노무현',   jamo: decomposeJamo('노무현'),   threshold: 0.82, category: 'political' },
  { word: '이명박',   jamo: decomposeJamo('이명박'),   threshold: 0.82, category: 'political' },
  { word: '박근혜',   jamo: decomposeJamo('박근혜'),   threshold: 0.82, category: 'political' },
  { word: '문재인',   jamo: decomposeJamo('문재인'),   threshold: 0.82, category: 'political' },
  { word: '전두환',   jamo: decomposeJamo('전두환'),   threshold: 0.82, category: 'political' },
  { word: '윤어게인', jamo: decomposeJamo('윤어게인'), threshold: 0.82, category: 'political' },
  { word: '부엉이바위', jamo: decomposeJamo('부엉이바위'), threshold: 0.82, category: 'political' },
  { word: '봉하마을', jamo: decomposeJamo('봉하마을'), threshold: 0.82, category: 'political' },
  { word: '최순실',   jamo: decomposeJamo('최순실'),   threshold: 0.82, category: 'political' },
  { word: '빨갱이',   jamo: decomposeJamo('빨갱이'),   threshold: 0.80, category: 'political' },
  // hate: 0.80 (혐오·차별 표현)
  { word: '한남충',   jamo: decomposeJamo('한남충'),   threshold: 0.80, category: 'hate' },
  { word: '급식충',   jamo: decomposeJamo('급식충'),   threshold: 0.80, category: 'hate' },
  { word: '김치녀',   jamo: decomposeJamo('김치녀'),   threshold: 0.80, category: 'hate' },
  { word: '보슬아치', jamo: decomposeJamo('보슬아치'), threshold: 0.82, category: 'hate' },
  { word: '틀딱충',   jamo: decomposeJamo('틀딱충'),   threshold: 0.80, category: 'hate' },
  { word: '전라디언', jamo: decomposeJamo('전라디언'), threshold: 0.82, category: 'hate' },
  // reserved: 0.85
  { word: '운영자',   jamo: decomposeJamo('운영자'),   threshold: 0.85, category: 'reserved' },
  { word: '운영진',   jamo: decomposeJamo('운영진'),   threshold: 0.85, category: 'reserved' },
  { word: '관리자',   jamo: decomposeJamo('관리자'),   threshold: 0.85, category: 'reserved' },
  // bot: 0.85
  { word: '초능력자', jamo: decomposeJamo('초능력자'), threshold: 0.85, category: 'bot' },
] as JamoTarget[]).filter(t => t.jamo.length >= 7);

// ── 초성 욕설 검사 ────────────────────────────────────────────────────────────

function hasBannedChosung(nick: string): boolean {
  const cho = getChosung(normalize(nick));
  return BANNED_CHOSUNG.some(w => cho.includes(w));
}

// ── 메인 검사 함수 ────────────────────────────────────────────────────────────

const MSG_FORMAT    = '닉네임은 한글, 영문, 숫자만 사용할 수 있어요.';
const MSG_LENGTH    = '닉네임은 1~8자 이내로 입력해주세요.';
const MSG_BLOCKED   = '사용할 수 없는 닉네임이에요.';

/**
 * 닉네임 허용 여부 검사
 * @returns `{ ok: true }` | `{ ok: false, reason: string }`
 *
 * 로그 저장이 필요할 때는 `checkNicknameWithLog(userId, nick)` 를 사용하세요.
 */
export function checkNickname(nick: string): { ok: boolean; reason?: string } {
  // ── 1. 입력값 방어 ──
  if (typeof nick !== 'string' || nick.length === 0) {
    return { ok: false, reason: MSG_LENGTH };
  }

  // ── 2. NFKC 정규화 ──
  const nickNfkc = nick.normalize('NFKC');

  // ── 3. 길이 검사 ──
  if (nickNfkc.length < 1 || nickNfkc.length > 8) {
    return { ok: false, reason: MSG_LENGTH };
  }

  // ── 4. 허용 문자 검사 (한글·자모·영문·숫자만) ──
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+$/.test(nickNfkc)) {
    return { ok: false, reason: MSG_FORMAT };
  }

  // ── 5. 개인정보성 숫자 패턴 ──
  if (hasPersonalInfoPattern(nickNfkc)) {
    return { ok: false, reason: MSG_BLOCKED };
  }

  // ── 6. normalize 적용 ──
  const normalized = normalize(nickNfkc);

  // ── 7. RESERVED_WORDS 하드차단 (normalized + confusable 양쪽) ──
  const confusableNorm = normalize(normalizeLatinConfusables(nickNfkc));
  for (const rw of RESERVED_WORDS) {
    const normRw = normalize(rw);
    if (normalized.includes(normRw) || confusableNorm.includes(normRw)) {
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  // ── 8. 퍼지 정규식 (NFKC 원본 + normalized 양쪽) ──
  for (const { re } of FUZZY_PATTERNS) {
    if (re.test(nickNfkc) || re.test(normalized)) {
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  // ── 9. 금지 부분문자열 (정규화 후 포함 여부) ──
  for (const banned of ALL_BANNED) {
    if (normalized.includes(normalize(banned))) {
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  // ── 10. 초성 욕설 검사 ──
  if (hasBannedChosung(nickNfkc)) {
    return { ok: false, reason: MSG_BLOCKED };
  }

  // ── 11. 자모 유사도 검사 (카테고리별 threshold) ──
  const nickJamo = decomposeJamo(normalized);
  for (const { jamo: bannedJamo, threshold } of JAMO_FUZZY_TARGETS) {
    if (maxJamoSim(nickJamo, bannedJamo) >= threshold) {
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  // ── 12. 통과 ──
  return { ok: true };
}

/**
 * 닉네임 검사 + 차단 로그 저장
 * kakao.ts 핸들러에서 호출 — 사용자에게 matchedRule/category 노출 금지
 */
export function checkNicknameWithLog(
  userId: string,
  nick: string,
): { ok: boolean; reason?: string } {
  // ── 1. 입력값 방어 ──
  if (typeof nick !== 'string' || nick.length === 0) {
    addBlockLog({ userId, attemptedNick: nick, normalizedNick: '', matchedRule: 'empty', category: 'format', createdAt: new Date() });
    return { ok: false, reason: MSG_LENGTH };
  }

  const nickNfkc = nick.normalize('NFKC');

  // ── 3. 길이 ──
  if (nickNfkc.length < 1 || nickNfkc.length > 8) {
    addBlockLog({ userId, attemptedNick: nick, normalizedNick: nickNfkc, matchedRule: 'length', category: 'format', createdAt: new Date() });
    return { ok: false, reason: MSG_LENGTH };
  }

  // ── 4. 허용 문자 ──
  if (!/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]+$/.test(nickNfkc)) {
    addBlockLog({ userId, attemptedNick: nick, normalizedNick: nickNfkc, matchedRule: 'charset', category: 'format', createdAt: new Date() });
    return { ok: false, reason: MSG_FORMAT };
  }

  // ── 5. 개인정보 숫자 ──
  if (hasPersonalInfoPattern(nickNfkc)) {
    addBlockLog({ userId, attemptedNick: nick, normalizedNick: nickNfkc, matchedRule: 'personalInfo', category: 'personalInfo', createdAt: new Date() });
    return { ok: false, reason: MSG_BLOCKED };
  }

  const normalized = normalize(nickNfkc);
  const confusableNorm = normalize(normalizeLatinConfusables(nickNfkc));

  // ── 7. RESERVED_WORDS ──
  for (const rw of RESERVED_WORDS) {
    const normRw = normalize(rw);
    if (normalized.includes(normRw) || confusableNorm.includes(normRw)) {
      addBlockLog({ userId, attemptedNick: nick, normalizedNick: normalized, matchedRule: `reserved:${rw}`, category: 'reserved', createdAt: new Date() });
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  // ── 8. 퍼지 정규식 ──
  for (const { re, category } of FUZZY_PATTERNS) {
    if (re.test(nickNfkc) || re.test(normalized)) {
      addBlockLog({ userId, attemptedNick: nick, normalizedNick: normalized, matchedRule: `fuzzy:${re.source}`, category, createdAt: new Date() });
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  // ── 9. 금지 부분문자열 ──
  for (const banned of PROFANITY_WORDS) {
    if (normalized.includes(normalize(banned))) {
      addBlockLog({ userId, attemptedNick: nick, normalizedNick: normalized, matchedRule: `profanity:${banned}`, category: 'profanity', createdAt: new Date() });
      return { ok: false, reason: MSG_BLOCKED };
    }
  }
  for (const banned of SEXUAL_WORDS) {
    if (normalized.includes(normalize(banned))) {
      addBlockLog({ userId, attemptedNick: nick, normalizedNick: normalized, matchedRule: `sexual:${banned}`, category: 'sexual', createdAt: new Date() });
      return { ok: false, reason: MSG_BLOCKED };
    }
  }
  for (const banned of POLITICAL_WORDS) {
    if (normalized.includes(normalize(banned))) {
      addBlockLog({ userId, attemptedNick: nick, normalizedNick: normalized, matchedRule: `political:${banned}`, category: 'political', createdAt: new Date() });
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  // ── 10. 초성 욕설 ──
  if (hasBannedChosung(nickNfkc)) {
    addBlockLog({ userId, attemptedNick: nick, normalizedNick: normalized, matchedRule: 'chosung', category: 'profanity', createdAt: new Date() });
    return { ok: false, reason: MSG_BLOCKED };
  }

  // ── 11. 자모 유사도 ──
  const nickJamo = decomposeJamo(normalized);
  for (const { word, jamo: bannedJamo, threshold, category } of JAMO_FUZZY_TARGETS) {
    if (maxJamoSim(nickJamo, bannedJamo) >= threshold) {
      addBlockLog({ userId, attemptedNick: nick, normalizedNick: normalized, matchedRule: `jamoSim:${word}`, category, createdAt: new Date() });
      return { ok: false, reason: MSG_BLOCKED };
    }
  }

  return { ok: true };
}
