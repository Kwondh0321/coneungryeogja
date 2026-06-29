export interface TitleDef {
  id: string;
  name: string;
  category: "초성퀴즈" | "훈민정음" | "자모연성" | "유물" | "포인트";
  description: string;
  score: number;
  icon: string;
}

export interface TitleInput {
  correct: number;
  total: number;
  hunminWins: number;
  hunminMax: number;
  hunminTotal: number;
  jamoTotalCount: number;
  jamoBestStreak: number;
  jamoHardCount: number;
  jamoNormalCount: number;
  jamoEasyCount: number;
  currentScore: number;
  attendanceDays: number;
  relics: Array<{ grade: number; enhance: number; level: number; typeId: number }>;
}

// ┌─────────────────────────────────────────────────────────────────────────┐
// │  기준 근거 (2025-05 프로덕션 상위 30명 데이터 기반)                        │
// │  · 초성정답 최고 7,628 / 3일  → 지속 ~500/일 → 1년 ≈ 150,000            │
// │  · 훈민승리 최고    48 / 5일  → 지속   ~4/일 → 1년 ≈  1,000             │
// │  · 자모총판 최고   660 / 5일  → 지속  ~40/일 → 1년 ≈ 10,000             │
// │  · 자모연속 최고   661 (현재 최고기록, 200회 기준은 이미 초과됨)            │
// │  · 훈민한게임 최고  31 (현재 15개 기준 이미 초과됨)                        │
// │  "장기간" = 꾸준한 헌신 플레이어 기준 1~5년 투영                           │
// └─────────────────────────────────────────────────────────────────────────┘

const TITLE_CATALOG: Array<TitleDef & { check: (i: TitleInput) => boolean }> = [
  // ════════════════════════════════════════════════════════════════════════
  //  초성퀴즈 (12개)
  //  · 지속 가능 약 500정답/일 기준
  //  · 100 → 1K → 5K → 15K → 40K → 80K → 150K → 300K → 600K
  // ════════════════════════════════════════════════════════════════════════
  { id: "chosung_00", name: "초성 도전자",  category: "초성퀴즈", icon: "🔤", score: 5,   description: "초성퀴즈 정답 100개 달성",           check: i => i.correct >= 100 },
  { id: "chosung_01", name: "초성 입문",    category: "초성퀴즈", icon: "🔤", score: 10,  description: "초성퀴즈 정답 1,000개 달성",         check: i => i.correct >= 1_000 },
  { id: "chosung_02", name: "초성 수련생",  category: "초성퀴즈", icon: "🔤", score: 20,  description: "초성퀴즈 정답 5,000개 달성",         check: i => i.correct >= 5_000 },
  { id: "chosung_03", name: "초성 탐험가",  category: "초성퀴즈", icon: "🔤", score: 35,  description: "초성퀴즈 정답 15,000개 달성",        check: i => i.correct >= 15_000 },
  { id: "chosung_04", name: "초성 달인",    category: "초성퀴즈", icon: "🔤", score: 55,  description: "초성퀴즈 정답 40,000개 달성",        check: i => i.correct >= 40_000 },
  { id: "chosung_05", name: "초성 고수",    category: "초성퀴즈", icon: "🔤", score: 70,  description: "초성퀴즈 정답 80,000개 달성",        check: i => i.correct >= 80_000 },
  { id: "chosung_06", name: "초성 마스터",  category: "초성퀴즈", icon: "🔤", score: 85,  description: "초성퀴즈 정답 150,000개 달성",       check: i => i.correct >= 150_000 },
  { id: "chosung_07", name: "초성 전문가",  category: "초성퀴즈", icon: "🔤", score: 105, description: "초성퀴즈 정답 300,000개 달성",       check: i => i.correct >= 300_000 },
  { id: "chosung_08", name: "초성의 신",    category: "초성퀴즈", icon: "🔤", score: 130, description: "초성퀴즈 정답 600,000개 달성",       check: i => i.correct >= 600_000 },
  { id: "chosung_09", name: "정확왕",       category: "초성퀴즈", icon: "🎯", score: 60,  description: "정답률 90% 이상 (시도 2,000회↑)",   check: i => i.total >= 2_000 && i.correct / i.total >= 0.90 },
  { id: "chosung_10", name: "무결점 답사",  category: "초성퀴즈", icon: "💫", score: 90,  description: "정답률 95% 이상 (시도 5,000회↑)",   check: i => i.total >= 5_000 && i.correct / i.total >= 0.95 },
  { id: "chosung_11", name: "만번의 도전",  category: "초성퀴즈", icon: "🔁", score: 30,  description: "초성퀴즈 총 시도 20,000회 달성",     check: i => i.total >= 20_000 },

  // ════════════════════════════════════════════════════════════════════════
  //  훈민정음 (12개)
  //  · 지속 가능 약 4승/일 기준
  //  · 10 → 30 → 100 → 250 → 500 → 1K → 2K → 4K → 8K
  //  · 단계 간격: 20 → 70 → 150 → 250 → 500 → 1K → 2K → 4K (갈수록 약 2배)
  //  · 한게임 최다: max 관측 31개 → 20개로 상향
  //  · 총 참여: 장기 기준 5,000회
  // ════════════════════════════════════════════════════════════════════════
  { id: "hunmin_00", name: "훈민 입문",     category: "훈민정음", icon: "📜", score: 5,   description: "훈민정음 10승 달성",               check: i => i.hunminWins >= 10 },
  { id: "hunmin_01", name: "훈민 수련생",   category: "훈민정음", icon: "📜", score: 10,  description: "훈민정음 30승 달성",               check: i => i.hunminWins >= 30 },
  { id: "hunmin_02", name: "훈민 탐험가",   category: "훈민정음", icon: "📜", score: 25,  description: "훈민정음 100승 달성",              check: i => i.hunminWins >= 100 },
  { id: "hunmin_03", name: "훈민 수호자",   category: "훈민정음", icon: "📜", score: 45,  description: "훈민정음 250승 달성",              check: i => i.hunminWins >= 250 },
  { id: "hunmin_04", name: "훈민 챔피언",   category: "훈민정음", icon: "📜", score: 65,  description: "훈민정음 500승 달성",              check: i => i.hunminWins >= 500 },
  { id: "hunmin_05", name: "훈민 영웅",     category: "훈민정음", icon: "📜", score: 80,  description: "훈민정음 1,000승 달성",            check: i => i.hunminWins >= 1_000 },
  { id: "hunmin_06", name: "훈민 용사",     category: "훈민정음", icon: "📜", score: 100, description: "훈민정음 2,000승 달성",            check: i => i.hunminWins >= 2_000 },
  { id: "hunmin_07", name: "훈민 전설",     category: "훈민정음", icon: "📜", score: 120, description: "훈민정음 4,000승 달성",            check: i => i.hunminWins >= 4_000 },
  { id: "hunmin_08", name: "훈민의 신",     category: "훈민정음", icon: "📜", score: 150, description: "훈민정음 8,000승 달성",            check: i => i.hunminWins >= 8_000 },
  { id: "hunmin_09", name: "정답왕",        category: "훈민정음", icon: "👑", score: 60,  description: "한 게임 최다 정답 10개",           check: i => i.hunminMax >= 10 },
  { id: "hunmin_10", name: "초월의 경지",   category: "훈민정음", icon: "👑", score: 90,  description: "한 게임 최다 정답 20개",           check: i => i.hunminMax >= 20 },
  { id: "hunmin_11", name: "꾸준한 훈민인", category: "훈민정음", icon: "🏅", score: 40,  description: "훈민정음 총 참여 5,000회 달성",    check: i => i.hunminTotal >= 5_000 },

  // ════════════════════════════════════════════════════════════════════════
  //  자모연성 (13개)
  //  · 지속 가능 약 40판/일 기준
  //  · 50 → 200 → 1K → 3K → 8K → 20K → 50K
  //  · 연속: 최고 관측 661회 → 달인50 / 신150 / 전설400
  //  · 어려움: 500 → 3,000 (상향)
  // ════════════════════════════════════════════════════════════════════════
  { id: "jamo_00", name: "자모 시작",       category: "자모연성", icon: "🔡", score: 5,   description: "자모연성 50판 달성",               check: i => i.jamoTotalCount >= 50 },
  { id: "jamo_01", name: "자모 탐험가",     category: "자모연성", icon: "🔡", score: 10,  description: "자모연성 200판 달성",              check: i => i.jamoTotalCount >= 200 },
  { id: "jamo_02", name: "자모 수련생",     category: "자모연성", icon: "🔡", score: 25,  description: "자모연성 1,000판 달성",            check: i => i.jamoTotalCount >= 1_000 },
  { id: "jamo_03", name: "자모 고수",       category: "자모연성", icon: "🔡", score: 45,  description: "자모연성 3,000판 달성",            check: i => i.jamoTotalCount >= 3_000 },
  { id: "jamo_04", name: "자모 베테랑",     category: "자모연성", icon: "🔡", score: 65,  description: "자모연성 8,000판 달성",            check: i => i.jamoTotalCount >= 8_000 },
  { id: "jamo_05", name: "자모 전설",       category: "자모연성", icon: "🔡", score: 85,  description: "자모연성 20,000판 달성",           check: i => i.jamoTotalCount >= 20_000 },
  { id: "jamo_06", name: "자모의 신",       category: "자모연성", icon: "🔡", score: 120, description: "자모연성 50,000판 달성",           check: i => i.jamoTotalCount >= 50_000 },
  { id: "jamo_07", name: "연속의 달인",     category: "자모연성", icon: "⚡", score: 30,  description: "자모연성 최고 연속 50회",          check: i => i.jamoBestStreak >= 50 },
  { id: "jamo_08", name: "연속의 신",       category: "자모연성", icon: "⚡", score: 65,  description: "자모연성 최고 연속 150회",         check: i => i.jamoBestStreak >= 150 },
  { id: "jamo_09", name: "연속의 전설",     category: "자모연성", icon: "⚡", score: 95,  description: "자모연성 최고 연속 400회",         check: i => i.jamoBestStreak >= 400 },
  { id: "jamo_10", name: "어려움 마니아",   category: "자모연성", icon: "🔥", score: 50,  description: "자모연성 어려움 500판 달성",       check: i => i.jamoHardCount >= 500 },
  { id: "jamo_11", name: "어려움 달인",     category: "자모연성", icon: "🔥", score: 80,  description: "자모연성 어려움 3,000판 달성",     check: i => i.jamoHardCount >= 3_000 },
  { id: "jamo_12", name: "올라운더",        category: "자모연성", icon: "🌈", score: 40,  description: "쉬움·보통·어려움 각 100판 이상",   check: i => i.jamoEasyCount >= 100 && i.jamoNormalCount >= 100 && i.jamoHardCount >= 100 },

  // ════════════════════════════════════════════════════════════════════════
  //  유물 (13개) — 도감 수집 + S급 다수 보유 중심 (유지)
  // ════════════════════════════════════════════════════════════════════════
  { id: "relic_00", name: "유물 첫 획득",   category: "유물", icon: "🏺", score: 10,  description: "유물 1종 이상 보유",               check: i => new Set(i.relics.map(r => r.typeId)).size >= 1 },
  { id: "relic_01", name: "유물 탐험가",    category: "유물", icon: "🏺", score: 20,  description: "서로 다른 유물 3종 보유",          check: i => new Set(i.relics.map(r => r.typeId)).size >= 3 },
  { id: "relic_02", name: "유물 수집가",    category: "유물", icon: "🏺", score: 40,  description: "서로 다른 유물 5종 보유",          check: i => new Set(i.relics.map(r => r.typeId)).size >= 5 },
  { id: "relic_03", name: "도감 완성자",    category: "유물", icon: "📖", score: 70,  description: "유물 8종 모두 보유 (도감 완성)",   check: i => new Set(i.relics.map(r => r.typeId)).size >= 8 },
  { id: "relic_04", name: "B급 소유자",     category: "유물", icon: "🔵", score: 20,  description: "B등급 유물 1개 이상 보유",         check: i => i.relics.some(r => r.grade >= 3) },
  { id: "relic_05", name: "A급 소유자",     category: "유물", icon: "🔷", score: 35,  description: "A등급 유물 1개 이상 보유",         check: i => i.relics.some(r => r.grade >= 4) },
  { id: "relic_06", name: "A급 수집가",     category: "유물", icon: "🔷", score: 55,  description: "A등급 이상 유물 3개 이상 보유",    check: i => i.relics.filter(r => r.grade >= 4).length >= 3 },
  { id: "relic_07", name: "S급 탄생",       category: "유물", icon: "💛", score: 65,  description: "S등급 유물 1개 보유",              check: i => i.relics.some(r => r.grade >= 5) },
  { id: "relic_08", name: "S급 수집가",     category: "유물", icon: "💛", score: 85,  description: "S등급 유물 2개 이상 보유",         check: i => i.relics.filter(r => r.grade >= 5).length >= 2 },
  { id: "relic_09", name: "S급 마스터",     category: "유물", icon: "💛", score: 105, description: "S등급 유물 4개 이상 보유",         check: i => i.relics.filter(r => r.grade >= 5).length >= 4 },
  { id: "relic_10", name: "강화 입문",      category: "유물", icon: "⚒️", score: 20,  description: "유물 +5강 달성",                   check: i => i.relics.some(r => r.enhance >= 5) },
  { id: "relic_11", name: "강화의 달인",    category: "유물", icon: "⚒️", score: 50,  description: "유물 +10강 달성",                  check: i => i.relics.some(r => r.enhance >= 10) },
  { id: "relic_12", name: "강화의 전설",    category: "유물", icon: "⚒️", score: 100, description: "유물 +20강 달성",                  check: i => i.relics.some(r => r.enhance >= 20) },
  { id: "relic_13", name: "SS급 탄생",      category: "유물", icon: "🔴", score: 150, description: "SS등급 유물 1개 보유",             check: i => i.relics.some(r => r.grade >= 6) },
  { id: "relic_14", name: "SS급 수집가",    category: "유물", icon: "🔴", score: 200, description: "SS등급 유물 2개 이상 보유",        check: i => i.relics.filter(r => r.grade >= 6).length >= 2 },

  // ════════════════════════════════════════════════════════════════════════
  //  포인트 (10개)
  //  · 상위권 피크 ~4.7M/일, 지속 ~1M/일 기준
  //  · 1년 헌신 ≈ 200~500M, 3년 ≈ 600M~1.5B
  //  · 10K → 100K → 1M → 5M → 20M → 60M → 200M → 600M → 2B → 8B
  // ════════════════════════════════════════════════════════════════════════
  { id: "point_00", name: "첫 포인트",      category: "포인트", icon: "💎", score: 5,   description: "10,000P 이상 보유",               check: i => i.currentScore >= 10_000 },
  { id: "point_01", name: "포인트 수집가",  category: "포인트", icon: "💎", score: 15,  description: "100,000P 이상 보유",              check: i => i.currentScore >= 100_000 },
  { id: "point_02", name: "포인트 저축자",  category: "포인트", icon: "💎", score: 30,  description: "1,000,000P 이상 보유",            check: i => i.currentScore >= 1_000_000 },
  { id: "point_03", name: "포인트 부자",    category: "포인트", icon: "💎", score: 45,  description: "5,000,000P 이상 보유",            check: i => i.currentScore >= 5_000_000 },
  { id: "point_04", name: "포인트 자산가",  category: "포인트", icon: "💎", score: 65,  description: "20,000,000P 이상 보유",           check: i => i.currentScore >= 20_000_000 },
  { id: "point_05", name: "포인트 왕",      category: "포인트", icon: "💎", score: 90,  description: "60,000,000P 이상 보유",           check: i => i.currentScore >= 60_000_000 },
  { id: "point_06", name: "포인트 황제",    category: "포인트", icon: "💎", score: 110, description: "200,000,000P 이상 보유",          check: i => i.currentScore >= 200_000_000 },
  { id: "point_07", name: "포인트 제왕",    category: "포인트", icon: "💎", score: 130, description: "600,000,000P 이상 보유",          check: i => i.currentScore >= 600_000_000 },
  { id: "point_08", name: "포인트 신화",    category: "포인트", icon: "💎", score: 150, description: "2,000,000,000P 이상 보유",        check: i => i.currentScore >= 2_000_000_000 },
  { id: "point_09", name: "포인트 불패",    category: "포인트", icon: "💎", score: 170, description: "8,000,000,000P 이상 보유",        check: i => i.currentScore >= 8_000_000_000 },
];

export function computeAllTitles(input: TitleInput): Array<TitleDef & { earned: boolean }> {
  return TITLE_CATALOG.map(({ check, ...rest }) => ({
    ...rest,
    earned: check(input),
  }));
}

export function computeTitles(input: TitleInput): TitleDef[] {
  return TITLE_CATALOG
    .filter(t => t.check(input))
    .map(({ check: _check, ...rest }) => rest)
    .sort((a, b) => b.score - a.score);
}

export function getTopTitle(input: TitleInput): TitleDef | null {
  const earned = computeTitles(input);
  return earned.length > 0 ? earned[0] : null;
}

export { TITLE_CATALOG };
