/**
 * RESCENE (리센느) — 2024 활동기 ~ 2026 역주행 타임라인 데이터
 *
 * 기준일 2026-08-11. "2년 전" 활동기(2024)에서 시작해 2026년 대박 분기점까지 이어진다.
 * 출처: 나무위키 RESCENE / RESCENE:공연 및 행사 / Pretty Girl(RESCENE),
 *       위키백과 리센느, 코리아중앙데일리, 경향신문, 스포츠경향, 톱스타뉴스
 */

/**
 * 시간 → X 좌표 매핑은 연도별로 축척이 다르다 (구간 선형).
 * 사건이 몰린 2024·2026은 넓게, 조용했던 2025는 압축해서 배치한다.
 */
export const ERAS = [
  {
    // 데뷔(2024-03-26) 전은 활동기가 아니다. 멤버 공개가 여기 놓인다.
    // 경계는 원래 2024 구간을 날짜 비율 그대로 자른 것이라 좌표는 하나도 안 움직인다.
    id: 'trainee',
    label: '연습생',
    year: '2024',
    caption: '데뷔 전',
    sub: 'TRAINEE',
    from: '2024-01-01',
    to: '2024-03-26',
    x0: -780,
    x1: -427,
    tickEvery: 1,
    labelEvery: 1,
    cam: { pos: [-540, 96, 640], tgt: [-520, 24, 0] },
  },
  {
    id: '2024',
    label: '2024',
    year: '2024',
    caption: '활동기',
    sub: 'ACTIVITY ERA',
    from: '2024-03-26',
    to: '2025-01-01',
    x0: -427,
    x1: 740,
    tickEvery: 1,
    labelEvery: 3,
    cam: { pos: [140, 130, 1180], tgt: [150, 20, 0] },
  },
  {
    id: '2025',
    label: '2025',
    caption: '축적기',
    sub: 'QUIET ERA',
    from: '2025-01-01',
    to: '2026-01-01',
    x0: 740,
    x1: 1660,
    tickEvery: 1,
    labelEvery: 4,
    cam: { pos: [1190, 66, 1000], tgt: [1200, -30, 0] },
  },
  {
    id: '2026',
    label: '2026',
    caption: '역주행 · 대박',
    sub: 'NEXUS ERA',
    from: '2026-01-01',
    to: '2027-01-01',
    x0: 1660,
    x1: 3380,
    tickEvery: 1,
    labelEvery: 3,
    cam: { pos: [2170, 300, 1420], tgt: [2310, 168, 0] },
  },
];

/**
 * 데뷔 이전 — "파묘 구간".
 * 2026년에 팬들이 발굴해 낸 멤버들의 데뷔 전 영상이 놓이는, 본류의 흐린 꼬리.
 * ERAS 와 달리 눈금은 그리지 않고 축척도 훨씬 압축돼 있다.
 */
export const PAST = {
  id: 'past',
  label: '~2023',
  caption: '파묘 구간',
  sub: 'EXCAVATED',
  from: '2017-06-01',
  x0: -1130,
  x1: -810,
  cam: { pos: [-973, 56, 900], tgt: [-970, 16, 0] },
};

export const TIME = {
  start: Date.UTC(2024, 0, 1),
  end: Date.UTC(2027, 0, 1),
  xMin: ERAS[0].x0,
  xMax: ERAS[ERAS.length - 1].x1,
  // 본류는 양 끝으로 더 뻗어나가 잘린 느낌이 나지 않게 한다
  xTailHead: -1300,
  xTailEnd: 3620,
};

/**
 * 원이의 개인 유튜브 채널 「안녕하세요원이입니다잘부탁드립니다」.
 * 거제 야호도 사투리편도 전부 여기서 나왔다.
 * 이 지점 전까지 본류는 가늘게, 이후로는 제 굵기로 그린다.
 */
export const CHANNEL = {
  date: '2026-02-04',
  label: '안원잘부 채널 개설',
  sub: '안녕하세요원이입니다잘부탁드립니다',
  thin: 0.4,   // 개설 전 본류 굵기 배율
};

/**
 * 재생 중 배경음.
 * 파일명이 한글 + 특수 따옴표(U+2018/U+2019)라 encodeURI 를 거쳐야 한다.
 */
/**
 * 재생 중 배경음.
 * mp3 를 들고 있지 않고 **공식 MV 를 그대로 튼다.**
 * 음원 파일을 저장소에 넣으면 배포가 되고, 그건 권리사 허락 없이는 안 되는 일이다.
 * 유튜브 임베드는 권리사가 올려 둔 걸 정해진 방법으로 재생하는 것이라 문제가 없다.
 *
 * 다만 숨겨 놓고 소리만 쓰면 이번엔 유튜브 약관에 걸린다 — 플레이어는
 * **최소 200×200 으로 보여야 하고 가리면 안 된다.** 그래서 우상단에 작은 모니터로 띄운다.
 */
export const BGM = {
  id: '9XttLI0oH0I',        // RESCENE 「LOVE ATTACK」 Official MV
  title: 'LOVE ATTACK',
  album: '미니 1집 《SCENEDROME》',
  volume: 0.5,
  fade: 1.4,   // 켜고 끌 때 페이드(초)
};

/** 전체 조망 카메라 */
export const HOME_CAM = { pos: [1090, 420, 3200], tgt: [1160, 130, 0] };

/**
 * 기간 밴드 — 타임라인의 특정 구간을 발광 슬리브로 감싸 강조한다.
 * line: 어느 시간선에 그릴지 ('main' = 원래 본류, 'nexus' = 대박 이후 새 시간선)
 * labelAt: 구간 내 라벨 위치 (0=시작, 1=끝)
 * offset: 라벨을 시간선에서 얼마나 아래로 띄울지
 * r     : 감싸는 슬리브 반지름. 그 구간 시간선의 실제 굵기에 맞춰야 한다.
 *         (채널 개설 전 본류는 40% 굵기라 밴드도 같이 얇아야 한다)
 * i     : 슬리브 밝기
 */
export const PERIODS = [
  {
    id: 'peak',
    line: 'main',
    from: '2024-02-29',
    to: '2024-09-14',
    label: '제철 구간',
    caption: '데뷔 초 — 팬들이 꼽는 리센느 제철. 숙소 문과 함께 끝난다',
    endLabel: '제철 종료',
    color: 0xffb14a,
    r: 5,      // 이 구간 본류는 채널 개설 전이라 얇다
    i: 0.13,
    labelAt: 0.42,
    offset: 196,
  },
  {
    id: 'reverse',
    line: 'nexus',
    from: '2026-03-20',
    to: '2026-07-25',
    label: '역주행 구간',
    caption: '거제 야호 → 음악방송 2관왕',
    color: 0xffd76e,
    r: 12,     // 새 시간선은 제 굵기
    i: 0.2,
    labelAt: 1,
    offset: -75,
  },
];

/**
 * 메라디오 — 메이(MAY)가 진행하는 라이브 라디오 방송.
 * 본류 아래 얇은 보조 시간선 위에 방송일 순서대로 놓인다.
 * 출처: 나무위키 RESCENE/라이브 방송
 */
export const RADIO = {
  id: 'meradio',
  label: '메라디오',
  sub: 'MERADIO',
  caption: '메이(MAY)의 라이브 라디오 · RESCENE 공식 유튜브',
  color: 0xffc06a,
  core: 0xfff0d2,
  // 실제 방송일 · 영상 ID · 조회수. 역주행 이후 조회수가 한 자릿수 배로 뛴다.
  episodes: [
    { date: '2024-12-20', id: 'I5n1JjWPgQU', title: '메라디오 — 첫 방송', views: 95292 },
    { date: '2025-01-15', id: 'UAVL6qhNeG4', title: '메라디오 2탄', views: 40149 },
    { date: '2025-01-22', id: 'YJ8QR4BwAzE', title: '다시 돌아온 메라디오3', views: 61083 },
    { date: '2025-02-08', id: '7ufduZI1wkw', title: '메라디오4 — 특별 게스트', views: 34295 },
    { date: '2025-02-17', id: 'R3PwWttEdIw', title: '메라디오5', views: 48865 },
    { date: '2025-03-23', id: 'zuaw_7yM6cs', title: '드디어! 메라디오6 시쟉-', views: 54818 },
    { date: '2025-04-21', id: 'CIUHzr5FhuI', title: '오늘도 돌아온 메라디오7', views: 50353 },
    { date: '2025-05-04', id: 'AGDTlHt-u-w', title: '메라디오8', views: 46889 },
    { date: '2025-05-15', id: 'iOIDJK_N6ZE', title: '심야 메라디오9', views: 66715 },
    { date: '2025-05-22', id: '2M9XTQKscLs', title: '좌우멩(Motto.) — 그치만 메라디오인', views: 93850 },
    { date: '2025-06-20', id: 'r_TFRK1PMY8', title: '메라디오11 기다렸죠??!', views: 62316 },
    { date: '2025-07-12', id: 'Clu4G1Ht0po', title: '메라디오12', views: 42823 },
    { date: '2025-08-11', id: 'pay7oTvcvu0', title: '팬콘 끝!! — 메라디오13', views: 47566 },
    { date: '2025-09-10', id: '3zWV9lPx8YY', title: '메라디오14', views: 82295 },
    { date: '2025-10-22', id: 'Ps8ek0RwnGw', title: '메라디오 컴백-!!!!', views: 76104 },
    { date: '2025-11-19', id: 'Lyipu8YHFps', title: '새벽 메라디오', views: 31707 },
    { date: '2025-12-09', id: 'F-ySwaNhyjQ', title: '먹방 아님, 메라디오임', views: 45577 },
    { date: '2026-01-07', id: 'G2fH76iGIww', title: '메라디오 — 해를 넘겨 복귀', views: 77514 },
    { date: '2026-01-29', id: 'umvrWnLKJf8', title: '메라디오 맞음🤨', views: 69327 },
    { date: '2026-03-04', id: '01BFjTsRHBk', title: '메라디오 — 대박 분기점 직전', views: 42332 },
    { date: '2026-04-12', id: 'g92oyTei23w', title: '런어웨이 첫 주 끝!! 메라디오', views: 95439 },
    { date: '2026-04-27', id: 'Kg7eQZ4c0jA', title: '메라디오 드루와', views: 145176 },
    { date: '2026-05-17', id: 'Aapj6tR9TZ0', title: '메라디오얌', views: 138876 },
    { date: '2026-07-17', id: 'hcCz-RVTC58', title: '메라디오는 그립감이 좋다~!', views: 682691 },
    { date: '2026-08-03', id: 'dgUOLHElpJg', title: '원쨩먹짱 × 메라디오 × CU', views: 944899 },
  ],
};


/**
 * 광고 — 데뷔 직후 258회짜리 향수 앰버서더에서 1,791만짜리 피자 CF 까지.
 * 이 팀의 형편이 가장 정직하게 드러나는 줄이다.
 *
 * PPL(간접광고)도 같은 줄에 섞는다 — 따로 떼면 「광고 하나 받기까지」라는 한 줄이
 * 두 동강 난다. `ppl: true` 인 회차는 칩에 점을 하나 더 찍어 구분한다.
 * PPL 은 브랜드가 날짜를 발표하지 않으므로, 그 브랜드가 나온 영상의 공개일을 쓴다.
 */
export const AD = {
  id: 'ad',
  label: '광고',
  sub: 'COMMERCIALS',
  caption: '258회짜리 향수 광고에서 1,791만짜리 피자 CF 까지',
  color: 0xffd9a0,
  core: 0xfff8ec,
  episodes: [
    // 화장품 — 데뷔 한 달 뒤, 아무도 모를 때 이미 브랜드 앰버서더였다
    { date: '2024-04-28', id: 'QSnJmss1_7k', title: '클린(CLEAN) 앰버서더 — 「순수하고 깨끗한 매력」', brand: '화장품 · 미국 비건 향수 CLEAN', views: 258, hi: true },
    { date: '2025-08-18', id: 'y02oP5-gQJ4', title: '아프로치과 「국가대표치과의사」', brand: '치과', views: 422051 },
    // 맥주 — 거제 편에서 「중요한 순간에」 잡혔다고 팬들이 짚었다
    { date: '2026-06-05', id: 'SF29doLuBfc', title: '갸루와 거제 2편 — KGB 가 중요한 순간에', brand: '맥주 · KGB', views: 6049214, ppl: true },
    { date: '2026-06-19', id: 'XD3rCGvMPJE', title: '진짜 「야호」 하는지 물어봤습니다 — 서브웨이', brand: '서브웨이', views: 5560471, ppl: true },
    // 식초 — 이탈리아 프리미엄 와인 비니거. 팬들이 「레와비」라 부른다
    { date: '2026-06-24', id: 'TQnDvlJH4Bk', title: '리센느가 온세상을 물들이도록 (30s)', brand: '식초 · 카사베르디 와인 비니거', views: 678857, hi: true },
    { date: '2026-06-24', id: 'e4rq-V5shOA', title: '온세상이 리센느로 가득하길 (15s)', brand: '식초 · 카사베르디', views: 2314393, hi: true },
    { date: '2026-06-26', id: '9i1cbplzxQM', title: 'TVCF 메이킹 필름', brand: '식초 · 카사베르디', views: 107975 },
    { date: '2026-07-02', id: 'd0DjgHztn0Y', title: "'GOOD BETTER VERDI' TVCF 45s 풀버전", brand: '식초 · 카사베르디', views: 141933 },
    { date: '2026-07-05', id: 'sa29RXO7ruM', title: '[BASE NOTES] 그레인온 카사베르디 광고 Behind', brand: '식초 · 카사베르디', views: 161044 },
    { date: '2026-07-08', id: 'nPRJfcYitH8', title: '리센느 라디오 CM', brand: '식초 · 카사베르디', views: 17083 },
    { date: '2026-07-15', id: 'Z8WMp0GM284', title: '도미노피자 × 무신사 「무진장 슈림프 스테이크 피자」', brand: '피자 · 도미노피자', views: 17913526, hi: true },
    { date: '2026-07-15', id: 'uWOd7CWGj5k', title: '도미노피자 × 무신사 full ver.', brand: '피자 · 도미노피자', views: 228145 },
    { date: '2026-07-16', id: 'UhxSM84Q8mg', title: 'TV CF 클로즈업 미공개 컷 모음', brand: '식초 · 카사베르디', views: 29895 },
    { date: '2026-07-31', id: 'agdQf7SDOLY', title: '인기가요 매점 — 「빼빼로를 향해 당당하게 걷기」', brand: 'SBS 인기가요 매점', views: 545416, ppl: true },
    { date: '2026-08-03', id: 'dgUOLHElpJg', title: '원쨩먹짱 × 메라디오 × CU', brand: 'CU 편의점', views: 952158, ppl: true, hi: true },
    { date: '2026-08-03', id: 'iErR_tXzb8g', title: 'CU 점주에게 보내는 인사 영상', brand: 'CU 편의점', views: 677, ppl: true },
    { date: '2026-08-04', id: 'yy7_rC_ODAk', title: '카사베르디 × 나랑드사이다 첫 콜라보 티저', brand: '식초 × 사이다', views: 95457 },
    // 사이다 — 대기업 CF. 이 줄에서 가장 큰 숫자
    { date: '2026-08-06', id: 'z49A40CwgwM', title: '나랑드사이다 「나랑드로 와」 full', brand: '사이다 · 동아오츠카', views: 4595791, hi: true },
    { date: '2026-08-06', id: 'GsWCHR9N1ew', title: '나랑드사이다 「나랑드로 와」 15s', brand: '사이다 · 동아오츠카', views: 98379 },
  ],
};

/**
 * 「이것도 사주마」.
 * 광고가 붙을 때마다 팬들이 다는 말이다 — 리센느가 광고를 받으면 그것도 사주겠다는 뜻.
 * 그래서 이 줄은 광고 줄(AD) 바로 아래에 나란히 흐른다. 광고가 나오면 여기서 반응이 뜬다.
 * 시작점은 역주행 1년 전, 아무도 안 볼 때 「유튜브 광고를 처음 눌러봤다」는 영상이다.
 */
export const BUY = {
  id: 'buy',
  label: '이것도 사주마',
  sub: 'I WILL BUY THAT TOO',
  caption: '광고가 붙으면 팬들이 사 준다',
  color: 0xff9f86,
  core: 0xffe0d2,
  episodes: [
    { date: '2025-02-25', id: 'S5yRnQzkVq8', title: '유튜브 광고 처음 눌러봄 ㅋㅋㅋ — LOVE ATTACK', who: '트렌디', views: 386117, hi: true },
    { date: '2026-07-11', id: 'mw5SFLKxnKI', title: '앨범에 왜 앰버그리스 향료를 선택했을까 — 향수덕후 관점', who: '향수덕후 쎈스쟁이', views: 27872 },
    { date: '2026-07-18', id: 'zF8cD7OfHlc', title: '리센느 피자가 나왔다고? 이건 일단 먹어야', who: '흑백리뷰', views: 209113, hi: true },
    { date: '2026-07-26', id: '5Kn8zhsZksk', title: '과연 뉴욕에서 리센느 앨범을 구할 수 있을까?!', who: '자바데이', views: 12004 },
    { date: '2026-08-01', id: 'eeTS6mL7pFQ', title: '앨범 3개 언박싱 — 이봐협 뉴욕지부! 오이데~!', who: '자바데이', views: 2810 },
    { date: '2026-08-01', id: 'lQSN0QZP5nQ', title: '포스터 샀더니 온 카사베르디 패키지 언박싱 & 나랑드사이다 꿀조합', who: '여행하는민', views: 37524 },
    { date: '2026-08-05', id: 'ycIaN3ijs1c', title: '굿즈도 웃돈 거래 — 인형 10만원, 사인 포카 70만원?', who: '뉴스1', views: 47273, hi: true },
    { date: '2026-08-06', id: 'VhJbkY4WmAE', title: '나랑드 광고, 왜 급하게 찍었을까 — 마케팅은 속도다', who: '마케팅 터치', views: 15572 },
    { date: '2026-08-10', id: 'hu6oqPZx7jY', title: '나랑드루와 :: 신세계', who: '코숏', views: 49973 },
  ],
};


/**
 * 더뮤즈엔터테인먼트 — 대표와 이사.
 * 버클리 음대 동문 둘이 차린 작은 회사다. 멤버들 콘텐츠에 본인들이 그대로 나온다.
 * 「꾸 대표」는 하이브로우 시절 뮤비 속 패션을 보고 멤버들이 "저건 꾸꾸꾸
 * (꾸미고 꾸미고 또 꾸몄다)다" 한 데서 붙었고, 간식을 같이 시켜 먹다 20kg 이 쪄서
 * 「꿀꿀꿀」이 파생됐다. 원이에게 살쪘다고 놀림받고 슬리퍼를 소심하게 던진 일도 있다.
 */
/**
 * 멤버 소개 — 본명 · 부모 · 별명.
 * 별명은 대부분 방송 중에 즉석에서 붙은 것들이라, 어디서 나왔는지가 곧 서사다.
 * 가족은 **멤버 본인이 자기 이야기로 한 것만** 남긴다.
 * 성함·생년·직장처럼 그 사람을 특정하는 것은 적지 않는다 — 멤버와 달리 공인이 아니다.
 */
export const MEMBERS = [
  {
    key: 'woni', name: '원이', real: '정원이', hanja: '鄭沅乁',
    born: '2004-05-25', from: '경남 거제시 옥포동', role: '리더',
    family: [
      { rel: '아버지', note: '회사 관계자가 “팀에 미나미가 있다”고 한 걸 “팀에 미남이 있다”로 알아들어 원이가 입사를 못 할 뻔했다 — 미나미의 별명 「미남이」가 여기서 나왔다' },
      { rel: '반려견', name: '별이', note: '말티즈 · 거제 본가' },
    ],
    nick: [
      { n: '거제 소녀', why: '전참시 자기소개' },
      { n: '거제야호 · 거제 불주먹', why: '거제 1편에서 바다 보고 「야호」' },
      { n: '가든투', why: '본명 정원이를 Garden + Two 로 직역' },
      { n: '칙칙원이', why: '라이브 중 조명 때문에 칙칙해진 걸 보고 제나가 지어 줌' },
      { n: '원냥이', why: '본인이 고양이 닮았다고 한 데서' },
      { n: '파이리', why: '닮은꼴' },
      { n: '원삼이', why: '야구 팬들이 삼성 좌완 장원삼에 빗대서' },
    ],
  },
  {
    key: 'liv', name: '리브', real: '진경은',
    from: '경기 수원시 구운동', role: '보컬',
    family: [
      { rel: '어머니', note: '수원의 한 초등학교에 리센느를 좋아하는 어린 팬이 있어 행사 요청이 들어왔고, 무대도 없는 흙바닥 운동장 공연이 성사됐다 — 「등용문」이라 불리는 그 무대다' },
    ],
    nick: [
      { n: '수원 왕발가락', why: '「저희도 리센느입니다」 — 「매일 저녁마다 내 발가락 칭찬해」' },
      { n: '리트', why: '안원잘부에 메이와 같이 나왔는데 줄무늬 옷차림이 「패트와 매트」 같다고' },
      { n: '치즈냥이', why: '' },
      { n: '엽떡인간', why: '떡볶이만은 도저히 못 끊는다고' },
      { n: '진리브', why: '팬을 놀리는 모드일 때' },
    ],
  },
  {
    key: 'minami', name: '미나미', real: '이토 미나미', hanja: '伊藤 南美',
    born: '2006-11-29', from: '일본 치바현 야치요시', role: '메인보컬 · 메인댄서',
    family: [
      { rel: '어머니', note: '「사실 엄마가 진짜 갸루였다」 — 갸루 화장을 어머니에게 직접 배웠다. 「야호」가 일본에서 인사말처럼 쓰인다는 것도 여기서 왔다' },
    ],
    nick: [
      { n: '갸루', why: '안원잘부 갸루 콘셉트 — 정통은 어머니한테 배운 것' },
      { n: '미남이', why: '원이 아버지가 「미나미」를 「미남이」로 알아들어서' },
      { n: '거제 홍보대사', why: '거제 편에 원이보다 더 신나 있었다고' },
      { n: '서예 미나미', why: '취미가 서예와 그림. 치바 편에서 서예 선생님이 등장한다' },
    ],
  },
  {
    key: 'may', name: '메이', real: '이예빈',
    from: '경기 고양시 (일산)', role: '보컬',
    family: [
      { rel: '아버지', note: '그림 실력이 대단하다. 일산호수공원에서 메이에게 두발자전거를 가르쳐 줬다' },
    ],
    nick: [
      { n: '메트', why: '안원잘부에 리브와 같이 나왔는데 「패트와 매트」 같다고' },
      { n: '이토 메이', why: '혀가 짧아 발음이 일본인 같다고 미나미 성씨를 따서' },
      { n: '햇살 메이', why: '' },
      { n: '초딩 메이', why: '장촌초 4-2반 뮤직비디오가 파묘됐다' },
    ],
  },
  {
    key: 'zena', name: '제나', real: '김가영',
    born: '2008-11-27', from: '경북 경주', role: '막내',
    family: [],
    nick: [
      { n: '신라공주', why: '라이브에서 메이와 전생 얘기를 하다 「나는 신라의 공주였을 것」' },
      { n: '신라할매', why: '「똥 밟았네」 할머니 커버가 파묘된 뒤' },
      { n: '까엉이', why: '본명 김가영 — 파묘 클립 제목이 「열심히 살았던 까엉이」' },
    ],
  },
];

export const STAFF = {
  id: 'staff',
  label: '대표와 이사',
  sub: 'THE MUZE',
  caption: '꾸 대표(이주헌) · 김혜수 이사 — 버클리 동문 둘이 차린 회사',
  color: 0xffd28a,
  core: 0xfff6e6,
  ceo: { name: '이주헌', born: '1990-09-09', nick: ['꾸 대표', '꾸꾸꾸', '꿀꿀꿀'], note: '버클리 음대 · 前 하이브로우' },
  dir: { name: '김혜수', nick: ['이사님'], note: '버클리 음대 동문 · 프로듀서' },
  episodes: [
    { date: '2024-11-03', id: 'xmh8I54ZG70', title: '꾸대표님의 거친 숨소리에 설레버린 리마인들', views: 41102, who: '리브 · 미나미 · 제나' },
    { date: '2024-12-21', id: '4hoqe74fT6c', title: '살찐 대표님 놀렸다가 대표님 어머니랑 면담한 썰', views: 174225, who: '원이 · 제나' },
    { date: '2025-04-01', id: 'LdPFaoG0-s0', title: '대표님은 아이돌 절대 아니고 가수 선배님!', views: 18228, who: 'RESCENE' },
    { date: '2025-07-13', id: 'SorzSl_X03M', title: '대표님 흑역사 들췄다가 호출 당한 미나미', views: 158608, who: '리브 · 미나미' },
    { date: '2025-09-12', id: 'MWEBO7idPhQ', title: '아이돌 VS 소속사 끝장토론', views: 776466, who: 'RESCENE' },
    { date: '2026-02-10', id: '6sIeZF5_ixU', title: '곰을 만났을 때 대처법 (실전편) — 대표가 곰돌이 탈을 썼다', views: 1743181, who: '원이 · 대표', hi: true },
    { date: '2026-03-13', id: '--QzVnSp-UI', title: '대표님 오픈카로 운전연수 받고 첫 홍어 먹방 (BMW Z4)', views: 1994328, who: '원이 · 대표' },
    { date: '2026-05-29', id: 'Xgat3KARhIE', title: '대표님이 차력쇼함', views: 897024, who: 'RESCENE' },
    { date: '2026-07-15', id: 'IgHf8s4RKfM', title: '[원가공개] 역주행 터지면 소속사 통장에 실제로 뭐가 꽂히나', views: 263723, who: '원가 공개 경제학' },
    { date: '2026-07-17', id: 'rXEBDG78yw0', title: '걸그룹 덕질하다가 대표님 모음까지 만들게 될 줄이야', views: 464110, who: '팬 편집' },
    { date: '2026-08-08', id: 'D0MZmUIobN4', title: '전참시 410회 — 대표와 김혜수 이사가 나왔다', views: 2077255, who: 'RESCENE · 대표 · 이사', hi: true },
  ],
};

/**
 * 나의연수아저씨 — 원이가 무면허에서 시작해 면허를 따고 첫 차를 사기까지.
 * 스튜디오ㅋㅇㅋ 채널의 시리즈로, 메라디오 아래 또 하나의 보조 시간선에 놓인다.
 * 2025-08 무면허 → 2026-07 졸업식까지 22편.
 */
export const DRIVE = {
  id: 'drive',
  label: '나의 연수아저씨',
  sub: 'MY DRIVING MISTER',
  caption: '원이의 운전 연수기 · 스튜디오ㅋㅇㅋ',
  color: 0xffa876,
  core: 0xffe2ce,
  episodes: [
    { date: '2025-08-15', id: '0MDOY5m-Xa4', title: '현대차도 모르는데 운전을 어떻게 해', views: 2196920 },
    { date: '2025-08-29', id: 'FkzlNowaWOY', title: '“필기시험을 떨어졌다고?” 무면허 아이돌과 운전 연수', views: 924695 },
    { date: '2025-09-19', id: 'vi-4XTy-Sl8', title: 'BMW 3시리즈 타고 풀악셀 밟는 면허 1일차', views: 1084963 },
    { date: '2025-10-10', id: 'r5B1ZUu3VrE', title: '을왕리 드라이브 중 접촉사고 날 뻔한 면허 1달차', views: 1260311 },
    { date: '2025-10-24', id: 'OgzZei1v22M', title: '아이오닉 왜 타요? 첫 전기차 운전하는 면허 2달 차', views: 1140116 },
    { date: '2025-11-14', id: 'RwQPrwx4GdQ', title: '이선민 삼촌의 스포티지(Old)로 첫 셀프 세차', views: 1036423 },
    { date: '2025-12-05', id: 'HamNe9Fntew', title: '초보운전이 뽑은 운전 중 가장 빡치는 최악의 빌런은?', views: 773078 },
    { date: '2025-12-12', id: 'k3SHr4Cvkk0', title: '초보운전 3개월 만에 800만원짜리 첫 차 질렀습니다', views: 1730992 },
    { date: '2026-01-02', id: 'RAdzJewQUs0', title: '초보운전이 내비 없이 왕복 8시간 거제까지 갈 수 있을까?', views: 3264449 },
    { date: '2026-01-16', id: 'aFhYXNCn-g8', title: '경차로 떠난 거제 풀코스 여행', views: 2596841 },
    { date: '2026-02-06', id: 'ALL7wNu1oV8', title: '주차 스트레스 많이 받을거야', views: 706906 },
    { date: '2026-02-13', id: 'CdCTblZ6TBs', title: '원이랑 운전 연수 할 사람?', views: 2628230 },
    { date: '2026-03-20', id: 'YmG80DphBgE', title: '레이에 20인치 휠 달고 팝콘 소리 터트릴 수 있나요?', views: 647078 },
    { date: '2026-03-27', id: '2ej7jEBCJnQ', title: '리센느 멤버들이랑 카니발 타고 봄나들이 (with. 갸루, 경주 공주)', views: 1769081 },
    { date: '2026-04-10', id: '899JRmfaCx8', title: '초보운전이 서울 불지옥 주차장에서 안 긁을 수 있을까?', views: 739136 },
    { date: '2026-05-08', id: 'TuBlsrL8HDE', title: '레이 버리고 제네시스 G80으로 갈아탄 초보운전', views: 1085944 },
    { date: '2026-05-13', id: '1k0DHqu_MwQ', title: '초보운전 피해자 속출', views: 3360515 },
    { date: '2026-05-15', id: '2S15hwuwMuA', title: '원이만 빼고 전기차 캠핑가기', views: 1645655 },
    { date: '2026-05-19', id: '_p1K7NeldkE', title: '아이오닉9을 만난 초보운전', views: 1599239 },
    { date: '2026-06-05', id: 'LTmcHWbUcBw', title: '비 오는 날 초보운전이 운전하면 생기는 일', views: 1725843 },
    { date: '2026-06-26', id: 'eUHfCCP1AsU', title: '성공한 원이가 사주는 특별한 선물 (feat. 케이카 고객 심부름)', views: 2090831 },
    { date: '2026-07-03', id: 'paJ8svJ1IoE', title: '원이, 편안함에 이르렀나 — 나의연수아저씨 졸업식', views: 3803294 },
  ],
};

/**
 * 굴욕 타임라인 — 멤버마다 한 줄씩, 연수아저씨 아래에 짧게 깔린다.
 * moments 가 비어 있는 멤버는 선을 그리지 않는다 (링크가 들어오면 그때 생긴다).
 *
 * lane : 아래로 내려가는 깊이
 * moments: { date, id, title, note, views }
 */
export const SHAME = {
  label: '굴욕',
  sub: 'HALL OF SHAME',
  members: [
    {
      key: 'woni', name: '원이', color: 0xff8a4a, core: 0xffd9b6, lane: -368,
      moments: [
        {
          date: '2026-07-22',
          id: 'l2GnjywCPjE',
          title: '드라마도 끊겠어요',
          note: '볼빨간사춘기 「여름아 부탁해」 공식 채널 · 254만',
          views: 2541807,
        },
        {
          date: '2026-08-02',
          id: '4oMbZj3EH4Y',
          title: '소리 질뤄↗어어~',
          note: '2026 영주 시원나잇 페스타 · 무대에서 난 사고',
          views: 74322,
        },
      ],
    },
    {
      key: 'may', name: '메이', color: 0xffc464, core: 0xfff6e0, lane: -414,
      moments: [
        {
          date: '2025-07-18',
          id: 'N5AT1nDp7aQ',
          title: '아임 어 미스 코리아',
          note: '「벤80도」 EP.06 · 대선배님 앞에서',
          views: 207298,
        },
        {
          date: '2026-07-23',
          id: 'KVLGD-Nrf1A',
          title: '당당하게 걷기 — 「걷기」 놓침',
          note: '「메이의 성장기」 · IDM CAM · 843만',
          views: 8433052,
        },
        {
          date: '2026-07-24',
          id: 'tCkTmpQDQZQ',
          title: '산악코스터에서 방언',
          note: 'KBS 「마이데이트립 정선」편 · 아이돌캐치 · 129만',
          views: 1294031,
        },
      ],
    },
    {
      key: 'liv', name: '리브', color: 0xffcb6b, core: 0xfff1d2, lane: -460,
      moments: [
        {
          date: '2026-06-27',
          id: 'J-L8pScuXeQ',
          title: '안녕하세요↑',
          note: '2026 서든어택 챔피언십 시즌1 Day8',
          views: 387948,
        },
      ],
    },
    {
      key: 'zena', name: '제나', color: 0xffa53c, core: 0xffe6bb, lane: -506,
      moments: [
        {
          date: '2026-05-29',
          id: '8JmGysKzAsI',
          title: '꿈에도 몰랐습니다',
          note: '긴장한 두건남에게 극딜 받은 신라공주 · 야! 너두심심',
          views: 517932,
        },
      ],
    },
    {
      // 추정 — 확인 필요. 클립 채널이 「미나미의 완벽한 시구」라고 붙였고
      // 같은 원본에서 「시구하기 전 파라파라 추기」가 같이 나왔다.
      key: 'minami', name: '미나미', color: 0xff6a2a, core: 0xffcaa2, lane: -552,
      moments: [
        {
          date: '2026-07-31',
          id: 'WPkKRjZN-TE',
          title: '완벽한 시구',
          note: '삼성 vs 롯데 KBO 시구 · 던지기 전 파라파라부터',
          views: 26405,
        },
      ],
    },
  ],
};

/**
 * 구간별 배경 가스.
 * 뒤에 깔리는 성운 색이 그 시기의 온도를 말한다 —
 * 연습생 시절은 차갑고 옅게, 활동기는 미지근한 호박색, 축적기는 잦아든 잉걸,
 * 대박 이후는 금빛과 벚꽃빛이 한꺼번에.
 *
 * hue: 캔버스 텍스처를 만들 때 쓰는 HSL 색상 범위(0~1)
 * tint: 그 위에 곱해지는 재질 색
 */
/**
 * 배경 가스.
 * **거제 야호(2026-03-20) 이전에는 가스가 없다** — 빛이 닿지 않는 심연이다.
 * 2년 넘게 아무도 안 보던 시간이라, 배경까지 비워 두는 편이 그 시간을 더 잘 말한다.
 *
 * 멀리 뒤에 깔린 성운이 아니라 **시간선 주변에 낮게 깔리는 한 가지 색의 기운**이다.
 * 무늬는 넣지 않는다 — 결이 보이면 배경이 아니라 그림이 돼서 시선을 가져간다.
 * 부드럽게 번지는 덩어리 모양만 남긴다.
 */
export const GAS_CUT = '2026-03-20';
export const GAS = {
  from: 2030,          // 분기점 바로 뒤에서 시작한다
  to: 3620,            // 축 끝까지
  color: 0xff8a3c,     // 한 가지 색
  op: 0.11,            // 덩어리 하나의 불투명도 (겹쳐서 짙어진다)
  n: 38,               // 덩어리 수 — 앞뒤로 겹쳐야 부피가 생긴다
  // 깊이를 넉넉히 줘야 카메라가 돌 때 앞뒤 덩어리가 서로 스쳐 지나며 부피로 읽힌다
  spread: { y: 280, z: [-900, 420] },
  size: [320, 900],
};

/** 사건 분류별 색/라벨 */
export const KINDS = {
  debut: { label: '데뷔', glow: 0xffc464, core: 0xfff6e0 },
  member: { label: '멤버 공개', glow: 0xffd9a8, core: 0xfff8ec },
  release: { label: '음반', glow: 0xffa53c, core: 0xffe6bb },
  japan: { label: '일본', glow: 0xff6a2a, core: 0xffcaa2 },
  ost: { label: 'OST', glow: 0xffcb6b, core: 0xfff1d2 },
  award: { label: '기록 · 수상', glow: 0xffe08a, core: 0xfffaea },
  stage: { label: '무대 · 팬', glow: 0xff8a4a, core: 0xffd9b6 },
  viral: { label: '바이럴', glow: 0xff9a20, core: 0xffe2ae },
  nexus: { label: '대박 분기점', glow: 0xffd76e, core: 0xffffff },
  radio: { label: '메라디오', glow: 0xffc06a, core: 0xfff0d2 },
  drive: { label: '나의 연수아저씨', glow: 0xffa876, core: 0xffe2ce },
  shame: { label: '굴욕', glow: 0xff8a4a, core: 0xffd9b6 },
  dig: { label: '파묘 · 발굴', glow: 0xe8c9a0, core: 0xfff4e4 },
  small: { label: '작은 무대 · 광고', glow: 0xffb87a, core: 0xffe8ce },
};

/**
 * 타이틀곡 뮤직비디오 — 시간선 앞쪽(카메라 방향)에 떠 있는 스크린으로 띄운다.
 * 분기는 위/아래로만 뻗으므로 화면 앞쪽(+Z) 통로는 비어 있고, MV 만 그 자리에 놓인다.
 *
 * 노드는 해당 날짜의 시간선 위에 그대로 박히고(클릭 가능한 사건),
 * 썸네일 스크린만 lift 만큼 카메라 위쪽으로 띄운다.
 * 오프셋 방향이 카메라 up 이라 어느 각도에서 봐도 시간선에 붙어 보인다.
 *
 * lift  : 스크린을 띄우는 높이. 날짜가 붙은 MV 끼리는 두 단(104 / 188)을 번갈아 쓴다.
 * major : 스크린을 더 크고 밝게
 * note  : 카드 아래에 붙는 한 줄 사연
 * completedBy / completesFrom : 미완성 → 완성으로 이어지는 한 쌍(실로 잇는다)
 */
export const MVS = [
  /* 선공개 「YoYo」 — 데뷔 4주 전.
   * 예산이 모자라 곡 전체를 영상으로 만들지 못했다. 실제 러닝타임 1:47.
   * 한 달 뒤 「UhUh」가 3:34 풀 버전으로 서면서 공식 데뷔 타이틀이 된다. */
  {
    id: 'uDYy2UyO1X4', song: 'YoYo', album: '선공개 싱글 《YoYo》', date: '2024-02-28',
    views: 7976427, line: 'main', lift: 104, noPlay: true,
    run: '1:47', note: '예산이 모자라 곡 전체를 못 찍은 반쪽짜리 선공개 MV',
    completedBy: 'UhUh',
  },
  {
    id: 'zpSejlkSXLA', song: 'UhUh', album: '싱글 1집 《Re:Scene》', date: '2024-03-26',
    views: 15415976, line: 'main', lift: 188, major: true,
    run: '3:34', note: '한 달 뒤 풀 버전으로 완성 — 이쪽이 공식 데뷔곡',
    completesFrom: 'YoYo',
  },
  { id: '9XttLI0oH0I', song: 'LOVE ATTACK', album: '미니 1집 《SCENEDROME》', date: '2024-08-27', views: 23300743, line: 'main', lift: 104, major: true },
  { id: 'B8JJ8RNM-60', song: 'Pinball', album: '미니 1집 《SCENEDROME》', date: '2024-09-21', views: 9459176, line: 'main', lift: 188 },
  { id: 'h0xUtrb_JBc', song: 'Glow Up', album: '미니 2집 《Glow Up》', date: '2025-02-05', views: 14715534, line: 'main', lift: 104 },
  { id: 'ZbO9PBdFRdc', song: 'Deja Vu', album: '싱글 2집 《Dearest》', date: '2025-07-02', views: 19097600, line: 'main', lift: 188 },
  { id: 'ByX8EZq8500', song: 'Heart Drop', album: '선공개 싱글 《Heart Drop》', date: '2025-11-06', views: 18097712, line: 'main', lift: 104 },
  { id: 'MC6-82GRK5I', song: 'Bloom', album: '미니 3집 《lip bomb》', date: '2025-11-25', views: 26174529, line: 'main', lift: 188, major: true },
  { id: 'rsZwrTNklos', song: 'Runaway', album: '디지털 싱글 《Runaway》', date: '2026-04-08', views: 20938571, line: 'nexus', lift: 104, major: true },
  { id: 'qZlu2j2SiBA', song: 'Pretty Girl', album: '스페셜 싱글 《Pretty Girl》', date: '2026-07-08', views: 21799127, line: 'nexus', lift: 188, major: true },
];

/**
 * angle : 본류 둘레 기준 분기 방향 (0°=위, 90°=화면 앞, 180°=아래, 270°=화면 뒤)
 * length: 분기 길이
 * major : 굵고 밝은 주요 분기
 * nexus : 타임라인 자체를 바꾼 분기점 (거대 노드 + 상시 충격파 + 이후 본류 증폭)
 * fork  : 분기 도중 다시 갈라지는 갈래 (라벨 포함)
 */
export const EVENTS = [
  /* ---------------- 파묘 구간 · 데뷔 이전 ----------------
   * 촬영 시점에 놓되, 2026년에 발굴돼 역주행에 올라탄 영상들이다.
   * resurfaced 날짜로 새 시간선까지 이어지는 "역류 실"을 그린다. */
  {
    id: 'may-school',
    date: '2018-03-29',
    kind: 'dig',
    title: '메이의 초등학교 방송 — 장촌초 4-2반',
    meta: '이예빈(메이) 초등학교 4학년 · 2026. 07~08 팬들이 발굴',
    desc:
      '메라디오의 원형. 역주행 이후 팬들이 학교·학년·반까지 특정해 파묘해 냈다. 담임 선생님이 학급 유튜브에 올린 4학년 2반 뮤직비디오 안에서 카메라만 돌면 쉴 새 없이 떠들던 열 살 이예빈이 나왔고, 2019년 청소년 차문화대전 금상 영상, 그리고 초딩 시절 방송 클립까지 줄줄이 딸려 나왔다. 8년 뒤 같은 아이가 「메라디오」라는 이름으로 라이브를 켠다.',
    angle: 350,
    length: 102,
    labelOff: [15, 5],
    resurfaced: '2026-07-24',
    videos: [
      { id: 'ZIH0JOXqiv0', t: '솔직히 초딩메이로도 레거시 씹어먹을 수 있을듯', c: '① 2026. 08. 10 · 초딩 메이 방송 파묘 · 프루스트', hi: true, s: true },
      { id: '0sQMwgJL-8c', t: '장촌초 사이(4-2)반 봄봄봄 뮤직비디오', c: '② 2018. 03. 29 · 초4 이예빈 등장' },
      { id: 'azpFgto_69M', t: '4-2 비타민 뮤직비디오', c: '③ 2018. 05. 17 · 같은 반 후속작' },
    ],
  },
  {
    id: 'woni-middle',
    date: '2018-08-21',
    kind: 'dig',
    title: '원이의 중2 댄스학원 — 「Dance The Night Away」',
    meta: '원이 중학교 2학년 · 2026. 08. 01 파묘',
    desc:
      '경남의 「필링댄스」 학원 커버 영상. 크레딧에는 배역과 이름만 적혀 있다 — “지효 · 원이”. 열다섯 살이 여름 노래를 추는 3분짜리 영상이 8년 동안 1만 5천 회에 머물러 있었다. 2026년 8월 1일 누군가 그걸 찾아 잘라 올리자 하루 만에 125만 회가 됐다. 학원 전화번호 앞자리가 055 — 거제 야호가 터져 나온 바로 그 동네다.',
    angle: 176,
    length: 118,
    labelOff: [-18, -14],
    resurfaced: '2026-08-01',
    videos: [
      { id: 'lU2NST5341A', t: '리센느 원이 중2 시절', c: '① 2026. 08. 01 · 파묘 클립 · 125만', hi: true, s: true },
      { id: 'iBYeP6-_uz0', t: 'FEELINGDANCE TWICE — Dance The Night Away | DANCE COVER', c: '② 2018. 08. 21 · 필링댄스 원본 · 1.5만' },
    ],
  },
  {
    id: 'zena-halmae',
    date: '2021-07-26',
    kind: 'dig',
    title: '제나의 할매 영상 — 「똥 밟았네」',
    meta: '제나(본명 김가영) 14살 · 2026. 07. 17 파묘',
    desc:
      '데뷔 3년 전, 경주의 댄스학원에서 친구들과 캐릭터를 하나씩 정해 「똥 밟았네」를 커버했다. 제나가 고른 배역은 할머니. 회색 곱슬 가발에 꽃무늬 바지를 입고 브레이크댄스까지 소화했다. 2026년 7월 17일 「열심히 살았던 까엉이」 클립이 231만 회를 넘기며 퍼졌고, 이튿날 기사까지 나면서 「신라 할매」라는 별명이 붙었다. 본인도 “큰일 난 것 같다”면서도 “부끄럽지 않다”고 했다.',
    angle: 193,
    length: 102,
    labelOff: [0, 15],
    resurfaced: '2026-07-17',
    videos: [
      { id: '0ynTC67SFgc', t: '열심히 살았던 까엉이', c: '① 2026. 07. 17 · 파묘를 퍼뜨린 메인 클립 · 231만', hi: true, s: true },
      { id: 'WKbfta7nsjQ', t: '싱크로율 99% 똥밟았네 DANCE COVER', c: '② 2021. 07. 26 · PREMIUM DANCE STUDIO 원본', hi: true },
      { id: 'mT93rIqMLIc', t: '제나 「똥 밟았네」 할머니 시절', c: '③ 2026. 07. 18 · 확산 클립', s: true },
      { id: 'sFpnET_Ulzc', t: '제나 — 똥 밟았네 (2026 ver.)', c: '④ 2026. 07. 21 · 팬 리믹스', s: true },
    ],
  },

  /* ---------------- 2024 · 활동기 ---------------- */
  {
    id: 'reveal-minami',
    date: '2024-02-16',
    kind: 'member',
    photo: 'minami',
    title: '미나미 공개 — 데뷔 트레일러 #1',
    meta: '일본 치바 출신 · 메인보컬 · 조회수 10만',
    desc:
      '데뷔 40일 전, 하루에 한 명씩 트레일러가 올라왔다. 아직 아무도 이 이름들을 모르던 때다. 조회수는 6~10만. 연습생 시절이 끝나고 처음으로 대중 앞에 얼굴이 놓인 지점이다.',
    angle: 350,
    length: 108,
    labelOff: [-65, 55],
    videos: [
      { id: '4fqiTeVz504', t: 'RESCENE Debut Trailer #1 미나미', c: '① 2024. 02. 16 · 10만' },
    ],
  },
  {
    id: 'reveal-woni',
    date: '2024-02-17',
    kind: 'member',
    // 각자의 데뷔 트레일러 화면을 그대로 얼굴 사진으로 쓴다
    photo: 'woni',
    title: '원이 공개 — 데뷔 트레일러 #2',
    meta: '리더 · 거제 출신 · 조회수 8만',
    desc:
      '데뷔 40일 전, 하루에 한 명씩 트레일러가 올라왔다. 아직 아무도 이 이름들을 모르던 때다. 조회수는 6~10만. 연습생 시절이 끝나고 처음으로 대중 앞에 얼굴이 놓인 지점이다.',
    angle: 10,
    length: 105,
    labelOff: [5, -65],
    videos: [
      { id: 'D88uhaLAGoM', t: 'RESCENE Debut Trailer #2 원이', c: '① 2024. 02. 17 · 8만' },
    ],
  },
  {
    id: 'reveal-zena',
    date: '2024-02-18',
    kind: 'member',
    // 각자의 데뷔 트레일러 화면을 그대로 얼굴 사진으로 쓴다
    photo: 'zena',
    title: '제나 공개 — 데뷔 트레일러 #3',
    meta: '경주 출신 · 막내 · 조회수 7만',
    desc:
      '데뷔 40일 전, 하루에 한 명씩 트레일러가 올라왔다. 아직 아무도 이 이름들을 모르던 때다. 조회수는 6~10만. 연습생 시절이 끝나고 처음으로 대중 앞에 얼굴이 놓인 지점이다.',
    angle: 200,
    length: 96,
    labelOff: [-90, 0],
    videos: [
      { id: 'JnVAt6ZMuG4', t: 'RESCENE Debut Trailer #3 제나', c: '① 2024. 02. 18 · 7만' },
    ],
  },
  {
    id: 'reveal-may',
    date: '2024-02-19',
    kind: 'member',
    // 각자의 데뷔 트레일러 화면을 그대로 얼굴 사진으로 쓴다
    photo: 'may',
    title: '메이 공개 — 데뷔 트레일러 #4',
    meta: '일산 출신 · 연습생 시절 관두려 했다 · 조회수 6만',
    desc:
      '데뷔 40일 전, 하루에 한 명씩 트레일러가 올라왔다. 아직 아무도 이 이름들을 모르던 때다. 조회수는 6~10만. 연습생 시절이 끝나고 처음으로 대중 앞에 얼굴이 놓인 지점이다.',
    angle: 190,
    length: 108,
    labelOff: [-100, 70],
    videos: [
      { id: 'I_K54WugHtQ', t: 'RESCENE Debut Trailer #4 메이', c: '① 2024. 02. 19 · 6만' },
    ],
  },
  {
    id: 'reveal-liv',
    date: '2024-02-20',
    kind: 'member',
    // 각자의 데뷔 트레일러 화면을 그대로 얼굴 사진으로 쓴다
    photo: 'liv',
    title: '리브 공개 — 데뷔 트레일러 #5',
    meta: '막내라인 · 조회수 6만',
    desc:
      '데뷔 40일 전, 하루에 한 명씩 트레일러가 올라왔다. 아직 아무도 이 이름들을 모르던 때다. 조회수는 6~10만. 연습생 시절이 끝나고 처음으로 대중 앞에 얼굴이 놓인 지점이다.',
    angle: 340,
    length: 84,
    labelOff: [-210, -10],
    videos: [
      { id: 'l-RMOXHFMVk', t: 'RESCENE Debut Trailer #5 리브', c: '① 2024. 02. 20 · 6만' },
    ],
  },
  {
    id: 'debut',
    date: '2024-03-26',
    kind: 'debut',
    photo: ['woni', 'liv', 'minami', 'may', 'zena'],
    title: '싱글 1집 《Re:Scene》 · 공식 데뷔',
    meta: '타이틀 「UhUh」 · 데뷔 쇼케이스 · 「YoYo」의 완성형',
    desc:
      '더뮤즈엔터테인먼트 소속 5인조(WONI · LIV · MINAMI · MAY · ZENA)로 정식 데뷔. 팀명은 “향기로 다시(RE) 장면(SCENE)을 떠올린다”는 뜻. 한 달 전 선공개한 「YoYo」 뮤직비디오는 예산이 모자라 곡 전체를 영상으로 만들지 못하고 1분 47초에서 끊겼다. 「UhUh」는 그 기획을 3분 34초 풀 버전으로 다시 세운 완성형이고, 공식 데뷔곡은 이쪽이다. 이날부터 2년간 1,500편이 넘는 라이브·영상 콘텐츠가 쌓이기 시작한다.',
    angle: 15,
    length: 128,
    labelOff: [-5, -10],
    major: true,
    videos: [
      { id: '8T0J9NrvxYs', t: 'RESCENE DEBUT SHOWCASE LIVE', c: '① 2024. 03. 26 · 데뷔 쇼케이스 생중계 · 6만', hi: true },
      { id: 'gU5fP2e777Q', t: 'RESCENE Debut Trailer #6 — 다섯이 모였다', c: '② 2024. 02. 21 · 38만' },
      { id: 'BvwONwBT3w0', t: 'DEBUT SHOWCASE [Re:Scene] LIVE 안내', c: '③ 2024. 03. 21 · 2.7만' },
    ],
  },
  {
    id: 'fansign-1',
    date: '2024-03-29',
    kind: 'stage',
    title: '데뷔 첫 팬사인회',
    meta: '팬덤 REMINE(리마인)과의 첫 접점',
    desc: '데뷔 사흘 뒤 첫 팬사인회를 열었다. 음원과 방송 바깥에서 팬덤 REMINE과 처음으로 직접 마주한 지점.',
    angle: 162,
    length: 126,
    labelOff: [10, 20],
  },
  {
    id: 'ost',
    date: '2024-06-26',
    kind: 'ost',
    title: '「더 매직스타」 OST 「Counting Star」',
    meta: 'OST 참여',
    desc: '드라마 「더 매직스타」 OST에 「Counting Star」로 참여. 자체 앨범 활동 바깥으로 처음 뻗어나간 갈래.',
    angle: 335,
    length: 96,
  },
  {
    id: 'yoyo-jp',
    date: '2024-08-16',
    kind: 'japan',
    title: '「YoYo (Japanese Ver.)」',
    meta: '일본 디지털 싱글',
    desc: '선공개곡의 일본어 버전을 디지털 싱글로 발매하며 해외 활동 라인을 열었다. 이 갈래는 연말 일본 데뷔 공연까지 이어진다.',
    angle: 208,
    length: 66,
    labelOff: [0, 10],
  },
  {
    id: 'scenedrome',
    date: '2024-08-27',
    kind: 'release',
    title: '미니 1집 《SCENEDROME》',
    meta: '더블 타이틀 「LOVE ATTACK」 · 「Pinball」',
    desc:
      '첫 미니앨범 《SCENEDROME》 발매. 더블 타이틀 「LOVE ATTACK」과 「Pinball」로 데뷔 해 최대 규모의 활동을 전개했다. 이때는 조용히 지나갔지만, 이 「LOVE ATTACK」이 2년 뒤 차트 1위로 되돌아온다.',
    angle: 12,
    length: 124,
    labelOff: [165, 10],
    major: true,
  },
  {
    id: 'fansign-2',
    date: '2024-09-08',
    kind: 'stage',
    title: '《SCENEDROME》 팬사인회 · 가을 무대',
    meta: '9월 8일 SCC 선아트홀 / 9월 14일 TCC아트홀',
    desc: '미니 1집 활동과 함께 연이은 팬사인회, 그리고 가을 대학 축제 무대를 소화하며 지역 단위로 접점을 넓혔다.',
    angle: 25,
    length: 126,
    labelOff: [15, -35],
  },
  {
    id: 'award',
    date: '2024-11-02',
    kind: 'award',
    title: '2024 아시아모델어워즈 라이징스타상',
    meta: '하이원리조트 컨벤션센터',
    desc: '데뷔 첫 해에 라이징스타상을 수상. 신인으로서의 존재감을 외부에서 공식적으로 확인받은 장면.',
    angle: 190,
    length: 90,
    labelOff: [0, 50],
  },
  {
    id: 'uhuh-jp',
    date: '2024-12-04',
    kind: 'japan',
    title: '「UhUh (Japanese Ver.)」',
    meta: '일본 디지털 싱글',
    desc: '데뷔곡의 일본어 버전을 발매. 사흘 뒤 열린 일본 데뷔 공연으로 곧장 이어졌다.',
    angle: 345,
    length: 60,
  },
  {
    id: 'jp-debut',
    date: '2024-12-07',
    kind: 'japan',
    title: '일본 데뷔 공연 · 도쿄타워 스카이 스타디움',
    meta: '해외 첫 공연 · 2024 활동기 마무리',
    desc: '도쿄타워 스카이 스타디움에서 일본 첫 공연을 열며 2024년 활동기를 닫았다.',
    angle: 205,
    length: 84,
    labelOff: [-5, -10],
  },

  /* ---------------- 2025 · 축적기 ---------------- */
  {
    id: 'glowup',
    date: '2025-02-05',
    kind: 'release',
    title: '미니 2집 《Glow Up》',
    meta: '두 번째 미니앨범',
    desc: '데뷔 이듬해 첫 컴백. 아직 큰 반향은 없었지만 콘텐츠와 무대는 멈추지 않고 쌓여갔다.',
    angle: 12,
    length: 144,
    labelOff: [5, 20],
  },
  {
    id: 'dearest',
    date: '2025-07-02',
    kind: 'release',
    title: '싱글 2집 《Dearest》',
    meta: '타이틀 「Deja Vu」',
    desc: '중소 기획사 신인으로서 꾸준히 이어간 발매. 이 시기의 축적이 이듬해 역주행의 연료가 된다.',
    angle: 190,
    length: 60,
  },
  {
    id: 'fancon',
    date: '2025-08-09',
    kind: 'stage',
    title: '데뷔 첫 팬콘서트 · 전석 매진',
    meta: '성신여대',
    desc: '데뷔 후 처음 연 단독 팬콘서트가 전석 매진됐다. 규모는 작았지만 팬덤 밀도가 확인된 지점.',
    angle: 22,
    length: 54,
    labelOff: [10, 0],
  },
  {
    id: 'dental',
    date: '2025-08-18',
    kind: 'small',
    title: '치과 광고 — 「국가대표치과의사」',
    meta: 'RESCENE × Apro dental clinic',
    desc:
      '역주행 전, 다섯 명이 동네 치과 광고를 찍었다. 대형 브랜드 CF 대신 들어오는 일을 가리지 않고 받던 시기의 얼굴. 1년 뒤 같은 멤버들이 나랑드사이다·카사베르디 광고를 찍게 되는 걸 생각하면, 이 41만 조회수짜리 치과 광고가 축적기의 성격을 가장 정확히 보여준다.',
    angle: 8,
    length: 189,
    labelOff: [-40, 0],
    videos: [
      { id: 'y02oP5-gQJ4', t: 'RESCENE × Apro dental clinic — 리센느의 선택', c: '① 2025. 08. 18 · 국가대표 치과의사' },
    ],
  },
  {
    id: 'heartdrop',
    date: '2025-11-06',
    kind: 'release',
    title: '선공개 싱글 「Heart Drop」',
    meta: '미니 3집 선공개',
    desc: '미니 3집 《lip bomb》을 3주 앞두고 낸 선공개 싱글. 조용한 해의 마지막 준비운동이었다.',
    angle: 18,
    length: 117,
    labelOff: [80, 0],
  },
  {
    id: 'lipbomb',
    date: '2025-11-25',
    kind: 'release',
    title: '미니 3집 《lip bomb》',
    meta: '타이틀 「Bloom」',
    desc: '2025년을 닫는 세 번째 미니앨범. 대중적 성과 없이 지나간 마지막 해였다.',
    angle: 200,
    length: 114,
    labelOff: [-5, 50],
  },

  /* ---------------- 2026 · 역주행 ---------------- */
  {
    id: 'school-stage',
    date: '2026-01-16',
    kind: 'small',
    title: '학교 방문 무대 — 「등.용.문」',
    meta: '스튜디오클릭 · 전교생이 모여야 무대가 시작된다',
    desc:
      '대박 두 달 전까지도 학교 강당과 주민센터를 돌았다. 전교생이 강당에 다 모여야 무대를 시작하는 「등.용.문」 편이 대표적. 멤버들은 뒷날 “초등학교 운동회에도 주민센터에도 갔다, 무대 크기는 중요하지 않다”고 말했다. 역주행 이후 이 영상들이 다시 돌면서 “저점 매수 구간”이라 불렸다.',
    angle: 355,
    length: 129,
    labelOff: [80, 15],
    videos: [
      { id: 'i9m80tV1Viw', t: '전교생이 모여야 무대가 시작된다?! — 등.용.문 [리센느편]', c: '① 2026. 01. 16 · 스튜디오클릭' },
      { id: 'f94PG5sprsc', t: '리센느, 비주얼 향기로 모교 접수하다!', c: '② 2024. 08. 29 · 오우학 EP.11' },
      { id: '7C9PRXBWWEM', t: '리센느의 하루', c: '③ 2026. 07. 21 · 인생84 — “초등학교 운동회에 주민센터까지”' },
    ],
  },
  {
    id: 'geoje-nexus',
    date: '2026-03-20',
    kind: 'nexus',
    title: '「거제편」 · 「사투리편」 — 거제 야호!',
    meta: "원이 유튜브 채널 「안녕하세요원이입니다잘부탁드립니다」",
    desc:
      '원이의 개인 유튜브 채널에서 일본인 멤버 미나미가 갸루 콘셉트로 촬영하던 중 원이의 고향을 향해 “거제 야호-!”를 외쳤다. 경상도 사투리를 다룬 「사투리편」과 함께 클립이 숏폼·커뮤니티로 퍼지며 밈이 됐고, 뒤이은 거제 방문 콘텐츠는 공개 하루 만에 조회수 100만을 기록했다. 데뷔 후 2년간 1,500편 넘게 쌓아온 콘텐츠 위에서 터진, 타임라인 자체를 바꾼 분기점.',
    major: true,
    nexus: true,
    fork: [
      { label: '사투리편', at: 0.32, spread: -44, length: 96 },
      { label: '거제편', at: 0.64, spread: 48, length: 116 },
    ],
    videos: [
      { id: 'heifaIjlSUc', t: '갸루의 자세에 대해서 배워보았습니다', c: '① 2026. 03. 20 · “거제 야호-!” 최초 발생 · 423만', hi: true },
      { id: 'NS7tSrMrWsc', t: '하루종일 사투리만 써봤습니다', c: '② 2026. 05. 01 · 사투리편 · 925만' },
      { id: 'OrCOflk2QmQ', t: '갸루와 거제에 왔습니다 (거제 1편)', c: '③ 2026. 05. 22 · 거제편 · 1,227만', hi: true },
      { id: 'kH0IYANI47o', t: '보는 사람마다 힐링됐다는 거제갸루편', c: '④ 2026. 05. 22 · 확산 클립', s: true },
      { id: 'SF29doLuBfc', t: '갸루와 거제 2편', c: '⑤ 2026. 06. 05 · 603만' },
      { id: 'pSiSsF2L9Lk', t: '거제야호 피디님야호 조회수야호', c: '⑥ 확산 · 숏폼', s: true },
      { id: '17t9izNAYVE', t: '거제 야호가 문특에 왔습니다', c: '⑦ MMTG 문명특급' },
    ],
  },
  {
    id: 'runaway',
    date: '2026-04-08',
    kind: 'release',
    title: '디지털 싱글 「Runaway」',
    meta: '분기점 19일 뒤 · 새 시간선 위 첫 컴백',
    desc:
      '거제 야호가 터지고 19일 만에 나온 첫 신곡. 밈으로 유입된 사람들이 처음으로 “노래도 좋네”를 확인한 지점이라, 역주행의 연료를 음원 쪽으로 옮겨 붙인 곡이다. 새 시간선이 아직 솟아오르는 중에 놓인다.',
    line: 'nexus',
    angle: 147,
    length: 165,
  },
  {
    id: 'reentry',
    date: '2026-05-28',
    kind: 'award',
    title: '「LOVE ATTACK」 멜론 TOP100 재진입',
    meta: '98위 재진입 · 스트리밍 2,019% 폭증',
    desc:
      '2024년 미니 1집 수록곡이던 「LOVE ATTACK」이 발매 약 2년 만에 멜론 TOP100 98위로 재진입했다. 여기서부터 차트를 거슬러 올라가는 역주행이 시작된다. 6월 18일에는 Mnet 「엠카운트다운」 무대에도 올랐다.',
    line: 'nexus',
    angle: 25,
    length: 90,
    labelOff: [-5, 30],
    videos: [
      { id: 'hulgxqeSbwY', t: '리센느 역주행 — 「LOVE ATTACK」', c: '① 역주행 클립 · 숏폼', s: true },
      { id: 'w3V6gB-LAK4', t: '[RESCENE.zip] 리센느 역주행 야호~', c: '② ALL THE K-POP' },
    ],
  },
  {
    id: 'toe',
    date: '2026-06-12',
    kind: 'viral',
    title: '「저희도 리센느입니다」 — 왕발가락',
    meta: '원이 채널 · 조회수 983만',
    desc:
      '역주행 서사를 멤버들이 직접 읊은 영상. 이 편에서 리브의 “왕발가락(발가락 따봉)”이 다시 튀어나오며 밈으로 굳었다. 최초 발생지는 두 달 전 「기묘한 뷰티샵」 편으로, 팬들이 그 장면을 찾아내 원본 링크를 돌렸다. 이후 수원시 홍보대사 콘텐츠에까지 왕발가락이 따라붙는다.',
    angle: 15,
    length: 156,
    labelOff: [0, -95],
    videos: [
      { id: '5JZ5biQ_hMI', t: '저희도 리센느입니다...', c: '① 2026. 06. 12 · 원이 채널 · 983만', hi: true },
      { id: 'iGgAH6O4JIs', t: "리브 '발가락 따봉' 최초 발생지 🦶👍 | 기묘한 뷰티샵", c: '② 2026. 04. 13 · 왕발가락의 시작 · 85만', hi: true },
      { id: 'r0LX_fEjUCs', t: '리센느, 너도❓ 수원, 나도❗️ — 왕발가락', c: '③ 수원시 · 홍보대사 콘텐츠', s: true },
    ],
  },
  {
    id: 'fanart',
    date: '2026-06-22',
    kind: 'viral',
    title: '리트와 메트 팬아트 — 애니 오프닝',
    meta: '「저희도 리센느입니다」 애니메이션 OP',
    desc:
      '「저희도 리센느입니다」가 팬 창작으로 번진 지점. SENO의 애니메이션 오프닝 OP가 157만 회를 넘겼고, 리브(리트)와 메이(메트)의 서사를 그린 팬아트·애니가 줄줄이 따라 나왔다. 락밴드 버전, 실사 오프닝 버전, 트로트 버전까지 파생됐다.',
    angle: 200,
    length: 90,
    labelOff: [-10, 15],
    videos: [
      { id: 'bLH8mBYzGjE', t: '저희도 리센느입니다... | 애니메이션 오프닝 OP', c: '① 2026. 06. 22 · SENO · 157만', hi: true },
      { id: '5U14hQG8QUw', t: '리센느 서사를 애니로 만들어보았다', c: '② 2026. 07. 12 · 스풉(SPOOP) · 73만' },
      { id: 'Ow5WogS_mJ8', t: '저희도 리센느입니다 (Rock ver) — 메이·리브의 서사', c: '③ 2026. 07. 23 · 태JIN' },
      { id: 'j32oXciRo7o', t: '저희도 리센느입니다... (실사 오프닝 ver.)', c: '④ 한대만맞아' },
    ],
  },
  {
    id: 'chiba',
    date: '2026-07-03',
    kind: 'viral',
    title: '치바편 — 미나미의 뿌리를 찾아서',
    meta: '원이 채널 미나미 3부작 · 「서예하는 미나미」',
    desc:
      '거제가 원이의 고향이었다면, 이번엔 미나미의 고향 치바로 갔다. 「서예하는 미나미」 편의 서예 선생님 장면이 이 시리즈의 하이라이트 — 갸루로만 소비되던 미나미의 뿌리를 보여주며 “거제 야호”의 반대편 축을 완성했다. 두 편 합쳐 1,255만 회.',
    angle: 340,
    length: 120,
    labelOff: [-180, 50],
    videos: [
      { id: 'wdH5_I7UiHA', t: '미나미의 본모습', c: '① 2026. 06. 28 · 치바편 · 741만' },
      { id: '5qmyo1nR3no', t: '서예하는 미나미', c: '② 2026. 06. 29 · 서예 선생님 · 201만', hi: true },
      { id: 'Yy58f1A6F-c', t: '미나미의 뿌리를 찾아서 | 최종화', c: '③ 2026. 07. 03 · 515만' },
      { id: 'z9pVFFikowI', t: '지방인이 무조건 긁히는 순간 월드컵', c: '④ 침착맨 · 원이 & 미나미' },
    ],
  },
  {
    id: 'pretty-girl',
    date: '2026-07-08',
    kind: 'release',
    title: '「Pretty Girl」 발매 · 멜론 1위',
    meta: '카라 원곡 리메이크 · 데뷔 835일 만의 1위',
    desc:
      '스페셜 리메이크 싱글 「Pretty Girl」(카라 원곡)을 발매한 날, 「LOVE ATTACK」이 밤 10시 멜론 TOP100 1위에 올랐다. 데뷔 835일 만의 첫 1위. 다섯 멤버는 이날 밤 깜짝 라이브 방송으로 이 순간을 함께했다.',
    line: 'nexus',
    angle: 340,
    length: 158,
    labelOff: [-100, -85],
    major: true,
  },
  {
    // 부순 날짜는 공개된 적이 없다. 커뮤니티가 짚는 건 「24시즌」뿐이라
    // 제철 구간이 끝나는 지점에 세우고, 2026년 발굴 시점으로 실을 잇는다.
    id: 'minami-door',
    date: '2024-09-14',
    kind: 'viral',
    title: '미나미가 숙소 문을 부쉈다',
    meta: '24시즌 · 정확한 날짜는 공개된 적 없음 · 2026. 06. 12 발굴',
    desc:
      '방문이 뜯긴 건 한참 전 일이다. 팬들이 짚는 건 「24시즌」뿐이고 정확한 날짜는 나온 적이 없다. 이 사실이 드러난 건 2년 가까이 지난 2026년 6월 12일, 「저희도 리센느입니다」(989만)에서 숙소를 비추는데 방에 문이 없었기 때문이다. 이튿날 「리센느 숙소에 방문이 없는 이유…」가 돌았고 — “대체 뭘 얼마나 급하게 나가면 방 문이 뜯기냐”, “미나미가 문짝에 몽골패극도 날림” — 갤러리에는 “그렇게 여리여리한 애가 어떻게”가 올라왔다. 그 글에 붙은 말이 「+ 24시즌 제철 미나미」였고, 거기서부터 팬들은 제철을 과거형으로 부르기 시작한다.',
    resurfaced: '2026-06-12',
    angle: 22,
    length: 168,
    labelOff: [30, 22],
    videos: [
      { id: '5JZ5biQ_hMI', t: '저희도 리센느입니다...', c: '① 2026. 06. 12 · 문 없는 숙소가 잡힌 영상 · 989만', hi: true, s: true },
      { id: 'wdH5_I7UiHA', t: '미나미의 본모습', c: '② 2026. 06. 28 · 744만', s: true },
    ],
  },
  {
    id: 'diet',
    date: '2024-09-20',
    kind: 'viral',
    title: '제철의 끝 — 다이어트 시작',
    meta: '데뷔 초 대비 −8kg · 팬들은 아직도 「제철」을 부른다',
    desc:
      '제철은 여기서 끝난다. 이후 관리가 시작됐고, 원이와 제나는 데뷔 초 대비 8kg을 뺐다고 밝혔다 — 처음엔 무작정 굶다 실패했다는 고백도 함께였다. 식단은 토마토·계란·샐러드에 레드와인 비니거. 2년 뒤 이들이 광고를 찍게 되는 그 카사베르디다. 2026년 6월 숙소 문이 발굴되자 갤러리에는 「나만 제철 미나미, 제철 리브, 제철 제나가 더 귀엽냐?」와 “제철 의원님들 돌아오십시오!!”가 올라왔다. 2년이 지나도 팬들은 그 시절을 제철이라 부른다.',
    angle: 200,
    length: 150,
    labelOff: [-20, -30],
  },
  {
    id: 'dorm-move',
    date: '2026-06-20',
    kind: 'stage',
    title: '99평 숙소로 이사',
    meta: 'JTBC 「아는 형님」에서 처음 밝힘 · 화장실 3개',
    desc:
      '역주행 뒤 숙소를 옮겼다. 99평, 화장실 3개. 「아는 형님」에서 이사 썰을 처음 풀었고, 8월 전참시에서 새 숙소가 공개됐다. 문제는 너무 넓다는 것이었다 — 거실에서 부르면 방에서 안 들려서 무전기를 고민했고, 결국 서로 안 들리니까 그냥 계속 붙어 있는다고 했다. 문이 뜯긴 그 숙소에서 방이 다섯 개인 집으로 왔는데, 여전히 한 방에 모여 있다.',
    line: 'nexus',
    angle: 32,
    length: 206,
    labelOff: [20, -14],
    videos: [
      { id: 'V4_E2h4lZaY', t: '역주행 이후 99평으로 이사 간 리센느의 숙소 썰', c: '① JTBC 「아는 형님」 260620 방송', hi: true },
      { id: 'Ue0k0JtRe5Q', t: '99평 숙소 최초 공개 — “너무 넓어 무전기 고민”', c: '② 2026. 08. 06 · iMBC 연예뉴스' },
      { id: 'mpYfXG72ZZY', t: '넓어진 숙소에 서로 안 들려서 그냥 계속 붙어있는 러브버그', c: '③ 2026. 08. 09 · 전참시', s: true },
    ],
  },
  {
    id: 'geoje-amb',
    date: '2026-07-11',
    kind: 'viral',
    title: '「전지적 참견 시점」 출연 · 거제시 홍보대사',
    meta: 'MBC 260711 방송',
    desc:
      '밈에서 시작된 “거제 야호”가 실제 지역 홍보로 이어져 거제시 홍보대사에 위촉됐다. 지상파 예능 「전지적 참견 시점」에도 출연하며 유튜브 바깥으로 인지도가 번졌다.',
    line: 'nexus',
    angle: 160,
    length: 171,
    labelOff: [90, 0],
    videos: [
      { id: 'adbzlafaesU', t: '한 번도 빛난 적 없었던 리센느의 향으로', c: '① 전지적 참견 시점 · MBC 26.07.11' },
      { id: 'p4ji9qNb6Q4', t: '거제시 홍보대사 리센느의 특별한 하루!', c: '② TVPP · 전지적 참견 시점' },
      { id: 'G2Ajw1Po5f8', t: '“거제 야~호~” 외치다 소원성취?', c: '③ KNN 뉴스 · 거제 홍보대사 위촉' },
    ],
  },
  {
    id: 'music-win',
    date: '2026-07-14',
    kind: 'award',
    title: '데뷔 첫 음악방송 1위 — 「더쇼」',
    meta: 'SBS Life 「더쇼」 · 「Pretty Girl」 · 10,000점 만점',
    desc:
      '데뷔 2년 4개월 만의 첫 음악방송 1위. 「Pretty Girl」로 SBS Life 「더쇼」 정상에 올랐고, 만점인 10,000점을 받았다. 이 뒤로 넉 주 사이에 세 번을 더 이긴다.',
    line: 'nexus',
    angle: 200,
    length: 236,
    labelOff: [130, 105],
    major: true,
    videos: [
      { id: '-e9kETDfeEY', t: '역주행 신화, 데뷔 초 리센느를 다시 만나다', c: '① 인터뷰 · 팬바타 FANVATAR' },
    ],
  },
  {
    id: 'music-mcore',
    date: '2026-07-25',
    kind: 'award',
    title: '지상파 첫 1위 — 「쇼! 음악중심」',
    meta: 'MBC 「쇼! 음악중심」 · 「Pretty Girl」 · 6,772점',
    desc:
      '데뷔 후 첫 지상파 음악방송 1위. 그런데 이날 리센느는 그 자리에 없었다. 무대 출연 없이 이름만 호명됐고, 6,772점은 전부 음원과 시청자·소셜 점수였다. 소속사는 “초심 잃지 않겠다”는 소감을 전했다.',
    line: 'nexus',
    angle: 168,
    length: 196,
    labelOff: [-40, 30],
    major: true,
  },
  {
    id: 'music-inki',
    date: '2026-07-26',
    kind: 'award',
    title: '「인기가요」 1위 — 2년 전 노래로',
    meta: 'SBS 「인기가요」 · 「LOVE ATTACK」 · 원이 눈물',
    desc:
      '하루 뒤, 이번엔 「Pretty Girl」이 아니라 2024년 미니 1집 타이틀 「LOVE ATTACK」으로 1위에 올랐다. 아이오아이 「갑자기」, 에스파 「레모네이드」를 제친 결과다. 원이는 “꿈이라는 걸 꾸는 게 아니라 이룰 수 있도록 해 준 리마인과 대중분들께 감사드린다”며 울먹였고, 잘 울지 않는다는 리브도 1위가 호명되자 눈물을 보였다. 역주행이라는 말이 트로피로 증명된 지점.',
    line: 'nexus',
    angle: 22,
    length: 214,
    labelOff: [10, -18],
    major: true,
    videos: [
      { id: '9XttLI0oH0I', t: 'RESCENE 「LOVE ATTACK」 Official MV', c: '① 2024. 08. 27 · 2년 전 그 곡', hi: true },
    ],
  },
  {
    id: 'music-mcore2',
    date: '2026-08-08',
    kind: 'award',
    title: '「음악중심」 또 1위 — 중소돌의 반란',
    meta: 'MBC 「쇼! 음악중심」 2회차 · 7,518점 · 통산 4관왕',
    desc:
      '또 무대 없이 이겼다. 방송 점수(동영상+방송)는 265점으로 후보 셋 중 꼴찌였다 — 제니 1,087점, 에이티즈 791점. 그런데도 음원과 소셜에서 밀어 올려 7,518점으로 1위. 이로써 통산 4관왕(더쇼 1 · 음악중심 2 · 인기가요 1). 기사 제목은 「중소돌의 반란」이었다.',
    line: 'nexus',
    angle: 200,
    length: 250,
    labelOff: [60, 60],
    major: true,
  },

  {
    id: 'halftime',
    date: '2026-08-09',
    kind: 'stage',
    title: '쿠팡플레이 시리즈 하프타임 쇼 — 상암',
    meta: '맨체스터 시티 vs 아틀레티코 마드리드 · 서울월드컵경기장',
    desc:
      '데뷔 초에 초등학교 운동회와 주민센터 무대를 돌던 팀이, 2년 반 만에 6만 석 상암에서 유럽 명문 두 팀의 하프타임을 채웠다. 「LOVE ATTACK」·「Pinball」·「Pretty Girl」 3곡. 무편집 원본 직캠 하나만 72만 회를 넘겼고, 축구 채널·직관 브이로그 쪽으로도 클립이 번졌다. 「등.용.문」의 강당에서 여기까지 7개월.',
    line: 'nexus',
    major: true,
    angle: 20,
    length: 146,
    labelOff: [-40, -15],
    videos: [
      { id: 'vRQv8DpMffU', t: '[4K 무편집 원본] LOVE ATTACK · Pinball · Pretty Girl', c: '① 2026. 08. 09 · 풋티재 · 72만', hi: true },
      { id: 'uWbwYIFeq48', t: '리센느의 쿠팡플레이 시리즈 하프타임 쇼!', c: '② 쿠팡플레이 스포츠 공식 · 10만' },
      { id: '-r7apRHoZYc', t: '하프타임쇼 FULL [맨시티 – AT 마드리드] 리센느 야호~', c: '③ Janyan TV · 2.4만' },
      { id: 'P_7x0Bl3RiI', t: '[하프타임쇼] LOVE ATTACK / Pinball / Pretty Girl (Full ver.)', c: '④ 축구 좋아하는 여자 · 8.2만' },
      { id: 'NTmM4k79PEU', t: '[4K] 미나미 「LOVE ATTACK」 직캠', c: '⑤ YUBIKIRI · 2.1만', s: true },
    ],
  },
];

/** 소개용 메타 */
export const GROUP = {
  name: 'RESCENE',
  nameKo: '리센느',
  agency: '더뮤즈엔터테인먼트',
  debut: '2024. 03. 26',
  members: ['WONI', 'LIV', 'MINAMI', 'MAY', 'ZENA'],
  fandom: 'REMINE',
};
