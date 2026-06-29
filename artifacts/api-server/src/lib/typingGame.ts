// ── 타자게임 모듈 ────────────────────────────────────────────────────────────

export const TYPING_SENTENCES: string[] = [
  "오늘 날씨가 정말 맑고 화창해요",
  "아침에 커피 한 잔 마시면 기분이 좋아요",
  "주말에 가족과 함께 공원에서 산책했어요",
  "배가 고파서 떡볶이를 사 먹었어요",
  "봄이 오면 벚꽃이 흩날려서 아름다워요",
  "매일 삼십 분씩 운동하려고 노력해요",
  "오늘 시험이 생각보다 어렵지 않았어요",
  "친구와 함께 영화를 보러 갔다 왔어요",
  "밥을 먹고 나서 달콤한 디저트가 먹고 싶어요",
  "겨울에는 따뜻한 국물 요리가 생각나요",
  "비가 오는 날에는 파전이 먹고 싶어요",
  "내일 일찍 일어나서 아침 운동을 해야겠어요",
  "도서관에서 조용히 공부하는 게 좋아요",
  "새로운 카페를 발견해서 기분이 너무 좋았어요",
  "고양이가 소파 위에서 낮잠을 자고 있어요",
  "음악을 들으면 마음이 편안해져요",
  "이번 주말에 친구들과 캠핑을 갈 예정이에요",
  "바다 근처에서 신선한 해산물을 먹었어요",
  "매운 음식을 좋아하지만 위가 약해서 조심해요",
  "밤하늘에 별이 정말 많이 보여서 신기했어요",
  "오래된 친구를 우연히 만나서 반가웠어요",
  "취미로 그림을 그리기 시작했어요",
  "오늘 처음으로 요리를 직접 해봤는데 맛있었어요",
  "강아지와 함께 산책하면 기분이 상쾌해요",
  "독서를 하면 상상력이 풍부해진다고 해요",
  "새벽에 일어나면 고요하고 평화로워요",
  "가을에 단풍이 물들면 정말 예뻐요",
  "친구한테 깜짝 선물을 받아서 감동했어요",
  "할머니의 음식이 세상에서 제일 맛있어요",
  "여름에는 시원한 수박이 최고예요",
  "요즘 운동을 시작했더니 몸이 가벼워졌어요",
  "맛있는 음식 앞에서 다이어트는 잊어버려요",
  "오늘은 퇴근 후 좋아하는 드라마를 봤어요",
  "지하철에서 음악을 들으면 시간이 빨리 가요",
  "점심으로 짜장면과 짬뽕 중에 고민했어요",
  "비 오는 날 창문 너머로 빗소리가 좋아요",
  "새로운 사람을 만나면 항상 설레요",
  "커피 향기가 퍼지면 하루가 시작되는 것 같아요",
  "오늘도 열심히 살아냈어요",
  "따뜻한 봄바람이 불어와서 기분이 좋아요",
  "숲속을 걸으면 머리가 맑아지는 것 같아요",
  "친구와 수다를 떨면 스트레스가 풀려요",
  "밤새 눈이 와서 세상이 하얗게 변했어요",
  "점심을 든든하게 먹었더니 오후가 행복해요",
  "새 신발을 신으면 어디든 가고 싶어져요",
  "좋아하는 노래를 크게 틀고 춤을 췄어요",
  "오래된 앨범을 보면 추억이 떠올라요",
  "집에서 혼자 요리하면 뿌듯한 기분이에요",
  "아이들이 뛰어노는 모습이 귀여워요",
  "계절이 바뀔 때마다 새로운 기분이에요",
  "신선한 공기를 마시며 아침을 시작해요",
  "한강 다리 위에서 야경을 보면 멋있어요",
  "밤에 따뜻한 차 한 잔이 최고예요",
  "책 한 권이 인생을 바꿀 수도 있어요",
  "서로 다른 생각을 나누면 시야가 넓어져요",
  "산 정상에서 내려다보는 경치가 장관이에요",
  "오늘 하루도 수고했어요",
  "행복은 멀리 있는 게 아니에요.",
  "작은 것에도 감사할 줄 알면 행복해져요",
  "사람들과 어울리면 에너지가 충전돼요",
  "가족과 함께하는 저녁 식사가 행복해요",
  "무지개가 뜬 하늘을 보면 기분이 환해요",
  "오늘 처음 들은 노래가 머릿속에서 맴돌아요",
  "고소한 참기름 냄새가 식욕을 돋워요",
  "운동 후 시원한 물 한 잔이 정말 좋아요",
  "봄비가 내리면 꽃이 더 탐스럽게 피어요",
  "오랜만에 고향 음식을 먹으니 눈물이 났어요",
  "달콤한 초콜릿 한 조각으로 기분을 달래요",
  "창문을 열면 싱그러운 바람이 들어와요",
  "오늘 길에서 예쁜 고양이를 봤어요",
  "돌아오는 길에 편의점에서 간식을 샀어요",
  "밤하늘의 달이 유난히 크고 밝아 보여요",
  "차가운 아이스크림이 더위를 식혀줘요",
  "오늘은 일찍 자고 내일 상쾌하게 일어날래요",
  "맛있는 빵 냄새가 골목 전체에 퍼졌어요",
  "잔잔한 음악이 흐르는 카페에서 책을 읽었어요",
  "생각보다 일이 쉽게 끝나서 기분이 좋아요",
  "하늘에 구름 한 점 없이 맑고 파랬어요",
  "새소리를 들으며 아침을 맞이하면 기분이 좋아요",
  "따뜻한 햇살이 창문으로 들어와 포근해요",
  "길을 걷다가 예쁜 꽃을 발견했어요",
  "피곤할 때 달콤한 음료 한 잔이 힘이 돼요",
  "버스를 타고 창밖을 보면 생각이 정리돼요",
  "오늘 좋은 일이 생겨서 하루가 기분 좋아요",
  "낮잠을 자고 나면 머리가 맑아져요",
  "향기로운 꽃이 가득한 화원을 구경했어요",
  "구름 사이로 햇살이 비칠 때 가장 예뻐요",
  "어릴 때 먹던 과자 맛이 아직도 그리워요",
  "외출 전에 날씨를 꼭 확인하는 편이에요",
  "부드러운 이불 속에 있으면 일어나기 싫어요",
  "오늘 마신 커피가 유난히 진하고 맛있었어요",
  "밤에 빗소리를 들으며 잠들면 잘 자요",
  "시원한 바람이 불어오자 기분이 상쾌해졌어요",
  "두꺼운 책을 다 읽고 나면 뿌듯해요",
  "가끔 아무 생각 없이 멍하니 하늘을 봐요",
  "친구들과 보드게임을 하면 시간이 훌쩍 가요",
  "따뜻한 이불 속에서 좋아하는 책을 읽어요",
  "초승달이 뜨는 밤하늘이 참 아름다워요",
  "지금 이 순간이 충분히 행복해요",
  "초능력자 봇 개발자는 혁도동이에요",
  
];

export interface TypingSession {
  userId:    string;
  roomId:    string;
  sentence:  string;
  startedAt: number;
}

export interface TypingResult {
  pts:        number;
  accuracy:   number;
  타수:        number;
  elapsedSec: number;
  bonuses:    string[];
  failed:     boolean;
}

const typingGameSessions = new Map<string, TypingSession>();

export function startTypingSession(userId: string, roomId: string): TypingSession {
  const idx = Math.floor(Math.random() * TYPING_SENTENCES.length);
  const sentence = TYPING_SENTENCES[idx]!;
  const session: TypingSession = { userId, roomId, sentence, startedAt: Date.now() };
  typingGameSessions.set(userId, session);
  return session;
}

export function getTypingSession(userId: string): TypingSession | undefined {
  return typingGameSessions.get(userId);
}

export function clearTypingSession(userId: string): void {
  typingGameSessions.delete(userId);
}

/** 글자 단위 정확도(%) 계산 */
function calcAccuracy(typed: string, target: string): number {
  if (target.length === 0) return 0;
  let correct = 0;
  const minLen = Math.min(typed.length, target.length);
  for (let i = 0; i < minLen; i++) {
    if (typed[i] === target[i]) correct++;
  }
  return Math.round((correct / target.length) * 100);
}

/** 타수 계산: 한글 1글자 ≈ 3.4 타 기준 */
function calc타수(charCount: number, elapsedMs: number): number {
  const elapsedMin = elapsedMs / 60000;
  if (elapsedMin <= 0) return 0;
  return Math.round((charCount / elapsedMin) * 3.4);
}

export function calcTypingResult(session: TypingSession, typed: string): TypingResult {
  const elapsedMs   = Date.now() - session.startedAt;
  const elapsedSec  = Math.max(1, Math.round(elapsedMs / 1000));
  const target      = session.sentence;
  const accuracy    = calcAccuracy(typed, target);
  const correctChars = Math.round(target.length * accuracy / 100);
  const 타수 = calc타수(correctChars, elapsedMs);
  const bonuses: string[] = [];

  if (accuracy < 90) {
    return {
      pts: 0, accuracy, 타수, elapsedSec, failed: true,
      bonuses: [`정확도 ${accuracy}% — 90% 이상이어야 포인트를 받을 수 있어요.`],
    };
  }

  // 기본: 글자 수 × 120P
  const basePts = target.length * 120;
  bonuses.push(`기본: ${basePts.toLocaleString()}P (${target.length}글자 × 120P)`);
  let pts = basePts;

  // 정확도 보정
  if (accuracy === 100) {
    const bonus = Math.round(pts * 0.1);
    pts += bonus;
    bonuses.push(`완벽 정확도 보너스: +${bonus.toLocaleString()}P (+10%)`);
  } else if (accuracy < 95) {
    const penalty = Math.round(pts * 0.2);
    pts -= penalty;
    bonuses.push(`정확도 ${accuracy}%: -${penalty.toLocaleString()}P (-20%)`);
  }

  // 속도 보너스
  if (타수 >= 700) {
    const bonus = Math.round(pts * 0.8);
    pts += bonus;
    bonuses.push(`⚡ 초고속 타속 (${타수}타): +${bonus.toLocaleString()}P (+80%)`);
  } else if (타수 >= 600) {
    const bonus = Math.round(pts * 0.5);
    pts += bonus;
    bonuses.push(`⚡ 고속 타속 (${타수}타): +${bonus.toLocaleString()}P (+50%)`);
  } else if (타수 >= 500) {
    const bonus = Math.round(pts * 0.3);
    pts += bonus;
    bonuses.push(`🚀 빠른 타속 (${타수}타): +${bonus.toLocaleString()}P (+30%)`);
  } else if (타수 >= 400) {
    const bonus = Math.round(pts * 0.15);
    pts += bonus;
    bonuses.push(`타속 보너스 (${타수}타): +${bonus.toLocaleString()}P (+15%)`);
  }

  bonuses.push(``);
  bonuses.push(`합계: +${pts.toLocaleString()}P`);

  return { pts, accuracy, 타수, elapsedSec, bonuses, failed: false };
}
