/* =====================================================
   co-work-sim — appicon.js  (OC.ui.appicon)

   앱 아이콘의 **단일 출처**. 학생 독(ui/desktop.js) · 강사 관제 독(main.js
   renderHostDock) · 열린 창(ui/windows.js) · 셸 목업 독(ui/shell.js)
   네 곳이 전부 여기를 거친다.

   ─────────────────────────────────────────────────────────────────────────
   글리프(가운데 그림) 출처 — Phosphor Icons, **Fill** weight
     https://phosphoricons.com  ·  https://github.com/phosphor-icons/core

     MIT License
     Copyright (c) 2023 Phosphor Icons

     Permission is hereby granted, free of charge, to any person obtaining a
     copy of this software and associated documentation files (the "Software"),
     to deal in the Software without restriction, including without limitation
     the rights to use, copy, modify, merge, publish, distribute, sublicense,
     and/or sell copies of the Software, and to permit persons to whom the
     Software is furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in
     all copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
     THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
     FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
     DEALINGS IN THE SOFTWARE.
   ─────────────────────────────────────────────────────────────────────────

   🔴 왜 한 곳으로 모았나 (2026-08-09 → 2026-08-15)
      한때 관제 독만 컬러 타일이고 학생 독은 그림 문자였다(오너: "학생 아이콘이랑
      다르다"). 2026-08-15 오너가 그 그림 문자들을 지목해("애플 아이콘 디자인들
      참고해") 이번에는 **위쪽으로** 통일했다 — 네 곳 모두 같은 그림을 쓴다.
      S68a 가 그 계약("독이 두 종류로 갈리지 않는다")을 지킨다.

   🔴 왜 글리프를 **직접 그리지 않는가** (2026-08-15 3차 · 두 번 반려된 뒤)
      1차(생성 래스터) "너무너무 안이뻐" · 2차(손으로 그린 SVG) **"너무 구린데"**.
      타일은 실물 독을 픽셀로 떠서 맞췄으니 잘 됐는데, 그 위에 얹은 책·문서·표를
      **손으로 그려서** 뭉툭했다. 이 저장소 규칙(`design-taste-frontend` 3.C)이
      답을 이미 적어 두고 있었다 — **"NEVER hand-roll SVG icons."**
      → 평판 좋은 오픈소스 세트에서 가져온다. **Phosphor**인 이유: MIT(재배포
      자유 — **애플 SF Symbols 는 라이선스상 금지다**) · **Fill 굵기가 따로 있다**
      (40px 에서 선 굵기는 안 보인다) · 애플과 같은 결(둥근 끝단) · 세부를
      **감김 방향(nonzero)으로 파내** 타일이 구멍으로 비친다 · 한 세트로 통일
      (섞으면 그게 티가 난다).

      🔴 npm 패키지를 런타임에 물리지 않는다. `public/` 은 자족적이어야 하고 빌드
         도구가 없다. **쓰는 17장의 path 데이터만 인라인**했다(세트 통째 금지).
         원본은 `@phosphor-icons/core@2.1.1` 의 `assets/fill/<이름>.svg` 다.
         글리프를 바꾸려면 그 파일의 `d` 를 그대로 옮겨 온다 — 손으로 고치지 마라.

   🔴 4차 (2026-08-18) — **흰 타일 + 색 글리프**로 뒤집었다
      오너: *"흰색 배경에 [Word·Excel 아이콘] 이거처럼 이 안에 뭐 이렇게 보이게
      해줘. **다른 아이콘도 다 배경을 흰색으로**"* (+ 전화·계약 조건·신규 제안서
      셋은 「이상하게 생겼다」고 콕 집었다 — 아래 ART 표의 해당 키 주석 참조)

      3차까지는 **색 타일 + 흰 글리프**였다. 옛 색 17종을 OKLab 으로 재 보면
      명도 L 0.232~0.768(**폭 0.536**) · 채도 C 0.004~0.217(**폭 0.213**) —
      시계는 새까맣고 표 계산은 형광이라 나란히 서면 한 벌로 안 보였다.
      "채도만 높고 가족 관계가 없다"의 정체가 이 숫자다.

      새 문법 (17종 **전부** 이것을 지킨다. 하나만 튀면 그게 촌스러움이다)
        ① **타일은 17종 전부 같다** — 흰 계열 3스톱 한 벌(TILE_STOPS 주석 참조).
        ② **글리프는 앱마다 한 가지 색.** OKLab L 0.400~0.575(폭 **0.175**) ·
           C 0.010~0.116(폭 **0.106**) — 명도 편차 **67% 축소**, 최고 채도 **47%
           축소**. 색상(H)은 옛 색 그대로다(law 만 이동, 사유는 표에) — 학생이
           외운 "이 앱은 주황"을 지키면서 밝기·채도만 한 밴드로 모았다.
           고른 방법: OKLCH(L,C,H) → sRGB, 제약은 **빨강 채널 R ≥ 0x44** 하나다
           (host-loop `S68o` 가 `fill="#0…~#3…"` 를 어두운 잉크로 잡는다). 차가운
           색은 그 하한에서 채도가 깎이는데, 깎인 만큼이 곧 "흰 배경에서 읽히는
           채도"라 방향이 같다. 한 화면에 같이 서는 색끼리 OKLab 거리를 쟀다
           (학생 화면 13색 최소 0.052 · 강사 화면 13색 최소 0.049).
        ③ 타일 그림자와 가장자리 분리는 **여기가 아니라 app.css** 가 준다
           (`.dt-icon .ic.tile` / `.dock-app .dock-img`). 흰 타일은 밝은 벽지에서
           사라지므로 그 규칙이 **아이콘이 보이느냐를 결정한다** — 지우지 마라.
           ⚠️ 실물 macOS 독(ref/macos-dock-정답.png)은 아래 6~8px 짜리 옅은 한
              겹뿐인데 그건 **색 타일** 기준이다. 흰 타일은 그 한 겹으로 부족해서
              app.css 가 접촉 그림자를 한 겹 더 깐다. 타일 자체에 윤곽선은 없다.
        ④ 모서리는 스퀘어클 그대로. 글자 없음. 실루엣은 앱마다 확연히 다르다.

   지킨 것
      - 크기는 `app.css` 의 --dock-icon 파생이다. 여기에 숫자를 만들지 않는다.
      - 요청 0건 · 캐시 0 의존. 벡터라 배율과 독 확대에서 전부 선명하다.
      - **폴백**: 모르는 키면 종전 그림 문자로 떨어진다. 화면이 비는 일은 없다.
      - RTDB 읽기·쓰기 0, 리스너 0. 이 파일은 게임 상태를 모른다.
      - **모션 없음.** 수업 도구다 — 아이콘이 움직이면 그것부터 본다.

   Public API (OC.ui.appicon):
     src(key)              -> 'data:image/svg+xml,…' | null   (그림의 주소)
     has(key)              -> bool
     paint(el, key, emoji) -> bool   el 을 비우고 아이콘(또는 그림 문자)을 넣는다
     fragKey(title)        -> 자료 조각 제목을 타일 키로 (모르면 'frag')
     KEYS                  -> 키 목록(검사·테스트용)
     markup(key)           -> '<svg …>' | null   (검사·미리보기용. 그림의 원본)
     TILE_STOPS            -> 타일 그라디언트 스톱 문자열 (17종 공통 · 검사용)
===================================================== */
(function () {
  'use strict';

  /* 브라우저(window)와 Node(globalThis) 양쪽에서 로드된다 — clock.js 와 같은 방식.
     Node 로도 열려야 host-loop 의 self-test 가 fragKey 를 **실제 조각 제목으로**
     돌려 볼 수 있고, tools/icons/preview.js 가 같은 그림을 렌더할 수 있다. */
  var g = (typeof window !== 'undefined') ? window : globalThis;
  g.OC = g.OC || {};
  var OC = g.OC;
  OC.ui = OC.ui || {};

  /* ---- 스퀘어클 -------------------------------------------------------------
     |x|⁵+|y|⁵≤1 (애플 근사, n=5)을 큐빅 8개로 맞춘 path. viewBox 는 0 0 100 100.
     🔴 반경 22% 둥근사각으로 바꾸지 마라 — 45° 부근이 깎여 애플 타일과 어긋난다.
     손으로 쓴 숫자가 아니라 `node tools/icons/squircle.js` 의 출력이다(오차는
     40px 표시에서 0.0056px). 모서리를 바꾸려면 그 스크립트의 n 을 바꿔 다시 뽑아라. */
  var SQUIRCLE =
    'M100 50C100 25.71 100.55 13.5 93.53 6.47C86.5-.55 74.29 0 50 0' +
    'C25.71 0 13.5-.55 6.47 6.47C-.55 13.5 0 25.71 0 50' +
    'C0 74.29-.55 86.5 6.47 93.53C13.5 100.55 25.71 100 50 100' +
    'C74.29 100 86.5 100.55 93.53 93.53C100.55 86.5 100 74.29 100 50Z';

  /* ---- 타일 --------------------------------------------------------------
     🔴 **17종이 전부 이 한 줄을 쓴다.** 키마다 다른 타일을 만드는 순간 독이
        두 종류로 보이고, 그게 오너가 세 번 반려한 「촌스러움」의 시작이다.
        (`tools/icons/tile-contract.test.js` 가 17종의 스톱이 한 벌인지 센다.)
     · 위 두 스톱 = 안쪽 하이라이트. 40px 에서 7% ≈ 2.8px.
     · 아래로 #E6E8EE — 순백에서 21계조 내린 값이라 "위에서 오는 빛"이 읽힌다.
     ⚠️ 순백(#ffffff)을 넣지 마라. 하이라이트가 배경과 붙어 타일이 평평해진다. */
  var TILE_STOPS =
    '<stop offset="0" stop-color="#FDFDFF"/>' +
    '<stop offset=".07" stop-color="#F8F9FC"/>' +
    '<stop offset="1" stop-color="#E6E8EE"/>';

  /* ── 글리프 컬러감 (2026-08-18 오너 지시) ─────────────────────────────────
     🔴 종전에는 글리프가 **단색**이라 흰 타일 위에서 납작했다. 오너가 든 보기
        (크롬 아이콘)는 **흰 타일 안의 그림 자체가 색을 갖는다.**
     🔴 색상(H)은 학생이 외운 정체성이라 **안 바꾼다.** 같은 색의 밝기만 위아래로
        벌려 깊이를 만든다.
     🔴 벌리는 폭이 크면 윗부분이 흰 타일에 묻는다 — 흰 배경 위에서 밝히는 것과
        읽히는 것은 **물리적으로 상충**한다(+30%면 대비 3.0, +40%면 2.4로 기준 아래).
        지금 폭은 `tile-contract` 의 대비 3:1 을 지키는 선에서 고른 값이다. */
  function shade(hex, pct) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    function f(v) {
      var x = pct > 0 ? v + (255 - v) * pct : v * (1 + pct);
      return Math.max(0, Math.min(255, Math.round(x)));
    }
    function h(v) { var t = f(v).toString(16); return t.length < 2 ? '0' + t : t; }
    return '#' + h(r) + h(g) + h(b);
  }
  /** 글리프용 세로 그라디언트 스톱. 가운데는 정본 색 그대로 둔다. */
  function glyphStops(hex) {
    return '<stop offset="0" stop-color="' + shade(hex, 0.12) + '"/>' +
           '<stop offset=".55" stop-color="' + hex + '"/>' +
           '<stop offset="1" stop-color="' + shade(hex, -0.10) + '"/>';
  }

  /* ---- 그림표 ---------------------------------------------------------------
     [글리프색, Phosphor Fill path 의 d, 글리프 상자 크기(타일 100 기준)]

     🔴 둘째 칸은 **`@phosphor-icons/core@2.1.1` 의 assets/fill/<이름>.svg 를 그대로
        옮긴 것**이다. 한 글자도 손으로 고치지 마라 — 고치는 순간 이 파일은 다시
        "손으로 그린 아이콘"이 되고, 그게 두 번 반려된 이유다. 원본 viewBox 가
        0 0 256 256 이라 markup() 이 scale(상자/256) 로 줄인다.
     🔴 셋째 칸(글리프 상자)이 유일하게 눈으로 정하는 숫자다. 실물 독은 글리프가
        타일의 50~60%. Phosphor 가 256 안에서 ≈81% 를 쓰므로 상자 62 → 그림 ≈50%.
        세로로 긴 그림은 줄이고 납작한 그림(계기·책)은 키워 광학적으로 맞춘다.
     🔴 색은 머리말 규칙(OKLCH · R≥0x44)으로 뽑았다. 손으로 고르지 마라.
     ⚠️ 같은 색을 두 키에 쓰지 마라. 실루엣이 달라도 독에서는 색이 먼저 읽힌다. */
  var ART = {
    /* ── 바탕화면 ───────────────────────────────────────────────────────── */
    // 사규집 — 펼친 책 (book-open-fill). 벽돌 빨강 H28
    book: ['#FF3B30', 'M240,56V200a8,8,0,0,1-8,8H160a24,24,0,0,0-24,23.94,7.9,7.9,0,0,1-5.12,7.55A8,8,0,0,1,120,232a24,24,0,0,0-24-24H24a8,8,0,0,1-8-8V56a8,8,0,0,1,8-8H88a32,32,0,0,1,32,32v87.73a8.17,8.17,0,0,0,7.47,8.25,8,8,0,0,0,8.53-8V80a32,32,0,0,1,32-32h64A8,8,0,0,1,240,56Z', 66],
    // 표 계산 — 오르는 막대 (chart-bar-fill). data 의 격자와 실루엣이 갈린다. 숲 초록 H147
    sheet: ['#34C759', 'M232,208a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16h8V136a8,8,0,0,1,8-8H72a8,8,0,0,1,8,8v64H96V88a8,8,0,0,1,8-8h32a8,8,0,0,1,8,8V200h16V40a8,8,0,0,1,8-8h40a8,8,0,0,1,8,8V200h8A8,8,0,0,1,232,208Z', 62],
    // 문서 — 모서리 접힌 종이 + 본문 두 줄 (file-text-fill). 호박 H58
    doc: ['#FF9500', 'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,176H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm-8-56V44l44,44Z', 60],
    // 자료 조각 — 겹친 서류 (files-fill). fragKey 의 폴백이라 "이름 모를 서류"다.
    // 🔴 2026-08-18 오너가 「신규 제안서」를 지목했다: *"아이콘이 너무 이상하게
    //    생겼거든 … 이 안에 뭐 이렇게 보이게"*. 폴더는 **담는 통**이지 문서가
    //    아니라서, 제안서·회의록 같은 낱장 자료에 얹으면 뜻이 어긋났다.
    //    겹친 서류로 바꾼다 — doc(낱장·접힌 모서리)과 실루엣도 갈린다.
    // ⚠️ 클립(paperclip-fill)은 여전히 못 쓴다 — 홈이 40px 에서 0.8px 라 흰
    //    동그라미로만 보이고, 📎 가 메일 첨부를 뜻해서 뜻도 겹친다. 서늘한 회청 H254
    frag: ['#A2845E', 'M213.66,66.34l-40-40A8,8,0,0,0,168,24H88A16,16,0,0,0,72,40V56H56A16,16,0,0,0,40,72V216a16,16,0,0,0,16,16H168a16,16,0,0,0,16-16V200h16a16,16,0,0,0,16-16V72A8,8,0,0,0,213.66,66.34ZM136,192H88a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm0-32H88a8,8,0,0,1,0-16h48a8,8,0,0,1,0,16Zm64,24H184V104a8,8,0,0,0-2.34-5.66l-40-40A8,8,0,0,0,136,56H88V40h76.69L200,75.31Z', 60],
    // 구매 데이터 — 표 격자 (table-fill). sheet 의 막대와 확실히 갈린다. 자주 보라 H298
    data: ['#5E5CE6', 'M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM40,112H80v32H40Zm56,0H216v32H96ZM40,160H80v32H40Zm176,32H96V160H216v32Z', 62],
    // 비용 자료 — 원화 기호 (currency-krw-fill).
    // ⚠️ 동전 무더기(coins-fill)를 먼저 써 봤는데 40px 에서 타원 셋이 한 덩어리로
    //    뭉갰다. 기호 한 글자가 훨씬 또렷하고, 학생이 읽는 언어와도 맞는다. 짙은 금 H84
    cost: ['#FFCC00', 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm72,120H181.42l-14,35a8,8,0,0,1-14.86,0L128,117.54,103.43,179a8,8,0,0,1-14.86,0l-14-35H56a8,8,0,0,1,0-16H68.18L56.57,99A8,8,0,1,1,71.43,93L96,154.46,120.57,93a8,8,0,0,1,14.86,0L160,154.46,184.57,93A8,8,0,1,1,199.43,99l-11.61,29H200a8,8,0,0,1,0,16Z', 60],
    // 상담 기록·클레임 — 수화기 (phone-fill).
    // 🔴 2026-08-18 오너가 콕 집었다: *"전화 이모티콘 이렇게 바꿔줘 저런 느낌으로"*
    //    (참고로 준 것: macOS 독의 전화 앱). 각져 보였던 원인은 글리프가 아니라
    //    **상자 58 + 채도 높은 청록 타일**이었다 — 작게 앉힌 흰 실루엣이라
    //    수화기의 둥근 끝단이 안 읽혔다. 상자를 62 로 키우고 흰 타일에 얹으니
    //    macOS 전화 앱과 같은 **둥근 수화기 실루엣**으로 읽힌다.
    // ⚠️ phone-call-fill(신호 물결 추가)도 재 봤는데 40px 에서 물결이 얼룩이 된다. 청록 H222
    talk: ['#30B0C7', 'M231.88,175.08A56.26,56.26,0,0,1,176,224C96.6,224,32,159.4,32,80A56.26,56.26,0,0,1,80.92,24.12a16,16,0,0,1,16.62,9.52l21.12,47.15,0,.12A16,16,0,0,1,117.39,96c-.18.27-.37.52-.57.77L96,121.45c7.49,15.22,23.41,31,38.83,38.51l24.34-20.71a8.12,8.12,0,0,1,.75-.56,16,16,0,0,1,15.17-1.4l.13.06,47.11,21.11A16,16,0,0,1,231.88,175.08Z', 62],
    // 법무 메모·계약 조건 — 인장 달린 증서 (certificate-fill).
    // 🔴 2026-08-18 오너가 「현 계약 조건」을 지목했다. 방패(shield-check-fill)는
    //    **보안·보호**를 뜻해서 계약서·약관·증빙에 얹으면 뜻이 어긋났다.
    //    가로로 누운 문서 + 원형 인장이라 「도장 찍힌 공식 문서」로 읽히고,
    //    세로형인 doc·frag 와 실루엣도 확실히 갈린다.
    // ⚠️ 색상도 옮겼다. 옛 갈색(H64)은 doc(H58)·cost(H84)와 한 화면에서
    //    OKLab 거리 0.025 로 뭉갰다 — 색상환에서 가장 넓게 빈 자리로 옮겼다. 자두 H332
    law: ['#E0218A', 'M232,86.53V56a16,16,0,0,0-16-16H40A16,16,0,0,0,24,56V184a16,16,0,0,0,16,16H160v24A8,8,0,0,0,172,231l24-13.74L220,231A8,8,0,0,0,232,224V161.47a51.88,51.88,0,0,0,0-74.94ZM128,144H72a8,8,0,0,1,0-16h56a8,8,0,0,1,0,16Zm0-32H72a8,8,0,0,1,0-16h56a8,8,0,0,1,0,16Zm88,98.21-16-9.16a8,8,0,0,0-7.94,0l-16,9.16V172a51.88,51.88,0,0,0,40,0ZM196,160a36,36,0,1,1,36-36A36,36,0,0,1,196,160Z', 62],
    // 휴지통 — (trash-fill). macOS 처럼 무채색이라 "지운 것"으로 읽힌다. 밝은 회색
    trash: ['#8E8E93', 'M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM112,168a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm0-120H96V40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8Z', 60],

    /* ── 학생 독 ────────────────────────────────────────────────────────── */
    // 받은 메일함 — 봉투 (envelope-fill). 접힘선이 knockout 이라 타일색이 비친다. 감청 H262
    mail: ['#0A84FF', 'M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM98.71,128,40,181.81V74.19Zm11.84,10.85,12,11.05a8,8,0,0,0,10.82,0l12-11.05,58,53.15H52.57ZM157.29,128,216,74.18V181.82Z', 64],
    // 코치 피드백 — 꼬리 달린 말풍선 하나 (chat-centered-text-fill).
    // messenger(둥근 풍선 둘)와 모양·개수 양쪽으로 갈린다. 장미 H358
    coach: ['#BF5AF2', 'M216,40H40A16,16,0,0,0,24,56V184a16,16,0,0,0,16,16h60.43l13.68,23.94a16,16,0,0,0,27.78,0L155.57,200H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40ZM160,144H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z', 62],
    // 메신저 — 겹친 말풍선 둘 (chats-circle-fill). 에메랄드 H158
    messenger: ['#00C7BE', 'M232.07,186.76a80,80,0,0,0-62.5-114.17A80,80,0,1,0,23.93,138.76l-7.27,24.71a16,16,0,0,0,19.87,19.87l24.71-7.27a80.39,80.39,0,0,0,25.18,7.35,80,80,0,0,0,108.34,40.65l24.71,7.27a16,16,0,0,0,19.87-19.86Zm-16.25,1.47L224,216l-27.76-8.17a8,8,0,0,0-6,.63,64.05,64.05,0,0,1-85.87-24.88A79.93,79.93,0,0,0,174.7,89.71a64,64,0,0,1,41.75,92.48A8,8,0,0,0,215.82,188.23Z', 64],
    // 시계 — 흰 문자판 + 그라파이트 바늘 (clock-fill). 바늘이 knockout 이다.
    // ⚠️ 옛 검정 타일(#1D1D1F)이 17종 중 유일하게 어두워 명도 폭을 혼자 벌렸다.
    //    흰 타일로 통일하고 잉크만 그라파이트로 남긴다.
    clock: ['#2C2C2E', 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm56,112H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48a8,8,0,0,1,0,16Z', 62],

    /* ── 강사 관제 독 ──────────────────────────────────────────────────── */
    // 상황판 — 계기판 (speedometer-fill). 한눈에 "지금 어디까지"를 뜻한다.
    // ⚠️ 시계(clock)와 같은 원형이지만 두 키가 한 독에 같이 서는 일이 없다 —
    //    clock 은 학생 독, board 는 관제 독이다(main.js HOST_DOCK_ICONS). 인디고 H273
    board: ['#5E5CE6', 'M221.87,90.86a4,4,0,0,0-6.17-.62l-75.42,75.42A8,8,0,0,1,129,154.35l92.7-92.69a8,8,0,0,0-11.32-11.32L197,63.73A112.05,112.05,0,0,0,22.34,189.25,16.09,16.09,0,0,0,37.46,200H218.53a16,16,0,0,0,15.11-10.71,112.28,112.28,0,0,0-11.77-98.43ZM57.44,166.41a8,8,0,0,1-6.25,9.43,7.89,7.89,0,0,1-1.6.16,8,8,0,0,1-7.83-6.41A88.06,88.06,0,0,1,143.59,65.38a8,8,0,0,1-2.82,15.75,72.07,72.07,0,0,0-83.33,85.28Z', 64],
    // 실시간 제출물 — 트레이로 내려오는 화살표 (tray-arrow-down-fill). 틸 H181
    subs: ['#FF9F0A', 'M208,32H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM90.34,114.34a8,8,0,0,1,11.32,0L120,132.69V72a8,8,0,0,1,16,0v60.69l18.34-18.35a8,8,0,0,1,11.32,11.32l-32,32a8,8,0,0,1-11.32,0l-32-32A8,8,0,0,1,90.34,114.34ZM208,208H48V168H76.69L96,187.32A15.89,15.89,0,0,0,107.31,192h41.38A15.86,15.86,0,0,0,160,187.31L179.31,168H208v40Z', 62],
    // 진행 로그 — 집게 달린 서식 (clipboard-text-fill). 위 돌기가 doc 과 가른다. 올리브 H128
    log: ['#34C759', 'M200,32H163.74a47.92,47.92,0,0,0-71.48,0H56A16,16,0,0,0,40,48V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm-72,0a32,32,0,0,1,32,32H96A32,32,0,0,1,128,32Zm32,128H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Zm0-32H96a8,8,0,0,1,0-16h64a8,8,0,0,1,0,16Z', 60],
    // 세션 마무리 — 동그라미 체크 (check-circle-fill). 6차: 오너가 체커 깃발을 「별로」라고 해 바꿨다.
    // ⚠️ book(H28)과 한 화면(강사)에 선다 — 명도를 0.42 로 내려 갈랐다.
    end: ['#1C1C1E', 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm45.66,85.66-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z', 64]
  };

  /* 🔴 여기 없는 키는 그림 문자로 떨어진다. ART 에 넣었으면 이 목록에도 넣어라.
     순서는 화면 순서(바탕화면 → 학생 독 → 관제 독)다 — 미리보기 시트가 이 순서로
     찍히므로 눈으로 대조할 때 순서가 곧 맥락이다. */
  var KEYS = [
    /* 바탕화면 */
    'book',      // 사규집
    'sheet',     // 표 계산
    'doc',       // 문서
    'frag',      // 자료 조각 (fragKey 의 폴백)
    'data',      // 구매 데이터
    'cost',      // 비용 자료
    'talk',      // 상담 기록
    'law',       // 법무 메모
    'trash',     // 휴지통
    /* 학생 독 */
    'mail',      // 받은 메일함 (6차: 오너 지시로 키 이름 inbox → mail)
    'coach',     // 코치 피드백
    'messenger', // 메신저
    'clock',     // 시계
    /* 강사 관제 독 */
    'board',     // 상황판
    'subs',      // 실시간 제출물
    'log',       // 진행 로그
    'end'        // 세션 마무리
  ];

  function has(key) { return !!(key && Object.prototype.hasOwnProperty.call(ART, key)); }

  /* ---- 그림 만들기 ---------------------------------------------------------
     🔴 그라디언트 id 는 **키마다 다르다**(apic-book …). id 가 겹치면 문서에서 처음
        만난 정의가 이겨 **전부 첫 아이콘 색으로 칠해진다.** 지금은 타일 색이 17종
        모두 같아 눈으로는 안 보이지만, 규칙은 유지한다 — 타일을 다시 키별로 가르는
        날 조용히 깨지는 자리가 여기다.
     🔴 gradientUnits="userSpaceOnUse": 기본값(objectBoundingBox)이면 도형마다 제
        크기로 그라디언트가 다시 깔려 어긋난다.
     🔴 글리프는 **감김 방향(nonzero)** 으로 세부를 파낸다. fill-rule 을 evenodd 로
        바꾸지 마라 — Phosphor 의 구멍이 전부 뒤집힌다. */
  var GLYPH_BOX = 62;                 // 크기를 안 적은 키의 기본 글리프 상자
  function n(v) { return +v.toFixed(5); }

  /* ── 처음 세트 되돌리기 (2026-08-18, 23차) ────────────────────────────────
     🔴 오너: *"아이콘 젤 처음에 썼던 것들이 더 맘에 들어 … 그냥 처음 걸로
        만들어주되, 손으로 글씨쓰는 아이콘은 별로고 이 우편함이랑 이런거가
        맘에들었었어"*

     「처음 것」은 `e634a99`(2026-08-15)의 **애플식 컬러 타일 16장**이다. 그 뒤
     Phosphor 도형(2834251) → 흰 타일 + 컬러 글리프(20차)로 두 번 갈아탔는데,
     오너가 원래 것을 다시 골랐다. 그 16장을 `public/img/appicon/` 로 되살렸다.

     ⚠️ 두 개만 그림 파일이 없다. 그래서 아래 SOLID 로 **같은 화법(컬러 타일 +
        흰 그림)으로 직접 그린다** — 화면에서 나란히 서도 이질감이 없다.
       · doc   오너가 뺀 그 손글씨 타일이다. 펜촉을 걷고 종이만 남겼다.
                타일색 #EBAD42 는 **원래 doc 타일에서 뽑은 값**이라 세트와 맞는다.
       · trash 처음 세트에 아예 없었다(휴지통은 2834251 에서 생긴 앱이다).

     ⚠️ 이미지에도 `?v=` 를 붙인다 — firebase.json 이 webp 에 `immutable` 을 걸어
        같은 URL 로 그림만 갈면 브라우저가 7일 동안 옛 그림을 쓴다. 23차에 배경에서
        실제로 당했다. 그림을 갈면 이 숫자를 반드시 올려라. */
  var ART_VER = '2';
  var ART_DIR = 'img/appicon/';

  /* 그림 파일은 더 이상 쓰지 않는다(위 SOLID 주석 참고). 비워 두면 markup 이
     전부 벡터 갈래로 간다 — 되돌리려면 여기에 키를 넣고 파일을 두면 된다. */
  var IMG_KEYS = {};


  /* 🔴 2026-08-18(23차 최종) — 17종 **전부** 여기서 그린다.

     오너가 애플 홈화면·Pages·지도·설정 아이콘을 나란히 보여주며 물었다:
     *"제발 잘 참고해줘 … 뭐가 다른지 진짜 모르겠어?"*
     차이는 색이 아니라 **화법**이었다. 애플 아이콘은 **납작한 색면 + 흰 그림**이다.
     되살렸던 그림 파일(e634a99)은 테두리에 어두운 베벨과 광택이 들어간
     2010년대 스큐어모픽이라, 아무리 밝혀도 침침하고 낡아 보였다.
     밝기·채도를 두 번 올려 본 뒤에야 그게 원인이라는 게 분명해졌다.

     그래서 그림 파일을 버리고 전부 벡터로 그린다. 얻는 것:
       · 어느 배율에서도 안 뭉갠다(래스터는 160px 고정이었다)
       · 17장 100KB → 0KB (그림 요청도 0건)
       · 색을 한 줄로 바꿀 수 있다 — 이번처럼 반려가 오면 즉시 대응된다

     색은 **애플 시스템 컬러**를 기준으로 잡고, 한 화면에 같이 서는 것끼리
     OKLab 거리 0.055 이상이 되도록 자동으로 벌렸다(실측 최소 0.071). */
  var SOLID = {
    book:      '#FF3B30',
    sheet:     '#34C759',
    doc:       '#FF9500',
    frag:      '#FF6482',
    data:      '#5E5CE6',
    cost:      '#FFCC00',
    talk:      '#30B0C7',
    law:       '#E0218A',
    trash:     '#8E8E93',
    mail:      '#0A84FF',
    coach:     '#BF5AF2',
    messenger: '#00C7BE',
    clock:     '#2C2C2E',
    board:     '#5E5CE6',
    subs:      '#FF9F0A',
    log:       '#34C759',
    end:       '#1C1C1E'
  };

  function imgSrc(key) { return ART_DIR + key + '.webp?v=' + ART_VER; }

  /* ---- 타일 위 그림 색 -----------------------------------------------------
     🔴 흰 그림이 늘 옳은 것은 아니다. 노란 타일(#FFCC00) 위의 흰 그림은 1.66:1 로
        **안 읽힌다** — 실측으로 잡혔다. 애플도 노란 아이콘(메모·단축어)에는 흰색이
        아니라 어두운 그림을 쓴다. 그래서 **타일 밝기를 보고 고른다.**
        밝은 타일이면 그 색을 깊게 눌러 잉크로 쓰고, 아니면 흰색이다. */
  function relLum(hex) {
    var v = [1, 3, 5].map(function (i) {
      var c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contrast(a, b) {
    var x = relLum(a) + 0.05, y = relLum(b) + 0.05;
    return x > y ? x / y : y / x;
  }
  /** 타일색 위에서 3:1 을 넘기는 그림 색. 흰색이 안 되면 같은 색을 깊게 눌러 쓴다. */
  function inkFor(base) {
    if (contrast('#FFFFFF', base) >= 3) return '#FFFFFF';
    for (var p = 0.55; p <= 0.9; p += 0.05) {
      var dark = shade(base, -p);
      if (contrast(dark, base) >= 3.2) return dark;
    }
    return '#1C1C1E';
  }

  /* ---- 6차 (2026-09-03) — Office 공식: 흰 타일 + 색 배지 + 흰 그림 + 연한 종이 ------
     오너가 실제 맥 바탕화면(Word·Excel·PowerPoint·Swit·Chrome)을 보여주며 *"이런 건 이쁜데 왜 우리 건
     안 이쁠까"* · *"통일되어 있지 않은 느낌"*. 차이는 색이 아니라 **그림의 구조**였다:
       ① 타일은 대부분 흰색이고 색은 그림이 갖는다(우리는 17개 전부 색 타일 → 견본판)
       ② 그림이 실루엣이 아니라 2~3면이 겹친 작은 물건이다(Word = 파란 배지 + 흰 W + 연한 종이)
       ③ 무게가 같다(그림 크기·잉크가 한 규칙)
     그래서 17종이 한 공식을 쓴다 — 흰 타일(위 #FFF → 아래 #ECEEF3) 위에 앱 색 **배지**(둥근 네모, 세로
     그라데이션 +.18/−.16, 아래 그림자) 와 그 뒤 같은 색의 **연한 종이** 한 장, 배지 안에 **흰 그림**.
     그림 크기는 실측 경계 상자(GLYPH_BBOX, 크롬 getBBox)로 맞춰 긴 변이 배지의 62% 가 되게 한다 — 책·전화·봉투가
     같은 무게로 앉는다. 흰 그림이 3:1 로 안 읽히는 밝은 색(노랑)은 배지만 −.25 눌러 쓴다(잉크는 항상 흰색).
     손으로 그린 도형은 둥근 네모 둘(<rect>)뿐이다. 글리프는 여전히 Phosphor path 그대로(S68s). 타일 path 에는
     stroke 를 주지 않는다(S68o). 검사가 「타일 그라디언트」로 읽는 id="apic-<key>" 는 **배지** 그라디언트다 —
     색·밝기차 계약(S68o4·artset A4/A5)이 색을 가진 면에 걸리게 하려고. */
  var GLYPH_BBOX = {
    book: [16, 48, 224, 192], sheet: [24, 32, 208, 184], doc: [40, 24, 176, 208], frag: [40, 24, 176, 208],
    data: [24, 48, 208, 160], cost: [24, 24, 208, 208], talk: [32, 24, 200, 200], law: [24, 40, 224, 192.1],
    trash: [32, 16, 192, 208], mail: [24, 48, 208, 160], coach: [24, 40, 208, 192], messenger: [16, 24.2, 224, 207.8],
    clock: [24, 24, 208, 208], board: [16, 40, 224, 160], subs: [32, 32, 192, 192], log: [40, 16, 176, 216],
    end: [24, 24, 208, 208]
  };
  var BADGE = { x: 20, y: 22, w: 58, h: 58, r: 13 };   // 타일 100 기준 — 왼쪽 아래로 살짝, 종이가 오른쪽 위에 겹친다
  var PAPER = { x: 34, y: 14, w: 48, h: 60, r: 9 };
  var GLYPH_FRAC = 0.62;                                // 그림 긴 변 = 배지의 62%
  function solidMarkup(key) {
    var base = SOLID[key], a = ART[key], bb = GLYPH_BBOX[key] || [0, 0, 256, 256];
    /* 배지는 크고(타일의 58%) 그림도 크다(배지의 62%) — 애플도 초록·주황 위에 흰 그림을 쓴다(Messages·Notes).
       2:1 아래로 떨어지는 밝은 색(노랑 1.5:1)만 배지를 −.25 눌러 쓴다. 잉크는 항상 흰색이다(통일). */
    var bc = (contrast('#FFFFFF', base) >= 2) ? base : shade(base, -0.25);
    var id = 'apic-' + key;
    var T = BADGE.w * GLYPH_FRAC, sc = T / Math.max(bb[2], bb[3]);
    var tx = n((BADGE.x + BADGE.w / 2) - (bb[0] + bb[2] / 2) * sc), ty = n((BADGE.y + BADGE.h / 2) - (bb[1] + bb[3] / 2) * sc);
    return '<svg class="dock-img" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      '<defs>' +
      '<linearGradient id="' + id + '-w" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">' +
      '<stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#ECEEF3"/></linearGradient>' +
      '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + BADGE.y + '" x2="0" y2="' + (BADGE.y + BADGE.h) + '">' +
      '<stop offset="0" stop-color="' + shade(bc, 0.18) + '"/><stop offset="1" stop-color="' + shade(bc, -0.16) + '"/></linearGradient>' +
      '<linearGradient id="' + id + '-p" gradientUnits="userSpaceOnUse" x1="0" y1="' + PAPER.y + '" x2="0" y2="' + (PAPER.y + PAPER.h) + '">' +
      '<stop offset="0" stop-color="' + shade(bc, 0.80) + '"/><stop offset="1" stop-color="' + shade(bc, 0.62) + '"/></linearGradient>' +
      '<filter id="' + id + '-s" x="-20%" y="-20%" width="140%" height="150%">' +
      '<feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="' + shade(bc, -0.6) + '" flood-opacity=".28"/></filter>' +
      '</defs>' +
      '<path d="' + SQUIRCLE + '" fill="url(#' + id + '-w)"/>' +
      '<rect x="' + PAPER.x + '" y="' + PAPER.y + '" width="' + PAPER.w + '" height="' + PAPER.h + '" rx="' + PAPER.r + '" fill="url(#' + id + '-p)"/>' +
      '<rect x="' + BADGE.x + '" y="' + BADGE.y + '" width="' + BADGE.w + '" height="' + BADGE.h + '" rx="' + BADGE.r + '" fill="url(#' + id + ')" filter="url(#' + id + '-s)"/>' +
      '<g transform="translate(' + tx + ' ' + ty + ') scale(' + n(sc) + ')" fill="#FFFFFF">' +
      '<path d="' + a[1] + '"/></g>' +
      '</svg>';
  }

  function markup(key) {
    if (!has(key)) return null;
    if (IMG_KEYS[key]) {
      return '<img class="dock-img" src="' + imgSrc(key) + '" alt="" aria-hidden="true"' +
        ' draggable="false" decoding="async">';
    }
    return svgMarkup(key);
  }

  /* 그림 파일을 쓰지 않고 직접 그리는 갈래. 그림이 404 날 때의 **폴백**이기도 하다
     — 그래서 ART 에 17종의 path 를 전부 남겨 둔다. 지우면 파일 하나만 없어져도
     그 자리가 빈칸이 된다. */
  function svgMarkup(key) {
    if (!has(key)) return null;
    if (SOLID[key]) return solidMarkup(key);
    var a = ART[key], id = 'apic-' + key;
    var box = a[2] || GLYPH_BOX, off = n((100 - box) / 2), s = n(box / 256);
    return '<svg class="dock-img" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"' +
      ' aria-hidden="true" focusable="false">' +
      '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">' +
      TILE_STOPS +
      '</linearGradient>' +
      '<path d="' + SQUIRCLE + '" fill="url(#' + id + ')"/>' +
      '<linearGradient id="' + id + '-g" gradientUnits="userSpaceOnUse" x1="0" y1="' +
      off + '" x2="0" y2="' + n(100 - off) + '">' + glyphStops(a[0]) + '</linearGradient>' +
      '<g transform="translate(' + off + ' ' + off + ') scale(' + s + ')" fill="url(#' + id + '-g)">' +
      '<path d="' + a[1] + '"/></g>' +
      '</svg>';
  }

  /* 그림의 **주소**. 종전 계약(<img src>)을 쓰는 곳이 있어도 그대로 돌아간다.
     모르는 키는 null — 부르는 쪽이 그림 문자로 떨어질 수 있어야 한다. */
  function src(key) {
    if (!has(key)) return null;
    if (IMG_KEYS[key]) return imgSrc(key);          // 그림 파일은 주소가 곧 src
    var m = markup(key);
    return m ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m) : null;
  }

  /* ---- 자료 조각 제목 → 타일 키 -------------------------------------------
     🔴 2026-08-15 오너 스크린샷: 바탕화면 7개 중 5개가 **같은 「문서」 그림**이라
        구분이 안 됐다. 조각 제목은 `js/data/teamplan.js` 에서 오고 지금 65종이다 —
        종류마다 그림을 만들 수 없으니 **성격 네 갈래로 접는다.**

     ⚠️ 순서가 규칙이다. 위에서부터 처음 걸리는 것이 이긴다:
        「지급 규정」은 규정(law)이고 「미지급 내역」은 금액(cost)이다 —
        law 를 먼저 보지 않으면 둘 다 cost 로 뭉갠다.
     ⚠️ 모르는 제목은 반드시 'frag' 로 떨어진다. 억지로 갖다 붙이면 그림이
        내용과 어긋나 학생이 더 헤맨다. */
  var FRAG_RULES = [
    ['law',  /법무|계약|규정|조항|약관|정책|리스크|메모|증빙/],
    ['cost', /비용|예산|마진|원가|단가|자금|현금|지급|매출|판매|견적|금액|집행|신용|재무/],
    ['talk', /상담|면담|여론|커뮤니티|반응|회신|요구|문의|불만|클레임/],
    ['data', /데이터|통계|실적|현황|이력|성과|결과|수요|재고|모니터|비교|파이프라인|내역|검사|트래픽|채널|지표/]
  ];
  function fragKey(title) {
    var t = String(title || '');
    for (var j = 0; j < FRAG_RULES.length; j++) {
      if (FRAG_RULES[j][1].test(t)) return FRAG_RULES[j][0];
    }
    return 'frag';
  }

  /* ---- 그리기 -------------------------------------------------------------
     el 을 비우고 <svg> 를 넣는다. 모르는 키면 그림 문자를 넣는다.
     🔴 `el` 안의 다른 자식(독 배지 등)은 호출자가 다시 붙인다.
     🔴 innerHTML 에 들어가는 문자열은 **이 파일 안의 상수뿐**이다(§5-6 의
        innerHTML 금지는 사용자 문자열에 대한 규칙이다).
     🔴 폴백의 본체. 빈 칸은 학생에게 「고장」으로 읽힌다 — 그림 문자로
        되돌린다(fail open). */
  function paint(el, key, emoji) {
    if (!el) return false;
    var fall = emoji || '🗔';
    el.textContent = '';
    var m = markup(key);
    if (!m) { el.textContent = fall; return false; }
    el.innerHTML = m;
    /* 🔴 그림 파일이 404 나면 빈칸이 된다. 그때 직접 그린 타일로 받아낸다.
       (23차에 img/appicon/ 을 되살렸는데, 배포 누락 한 번이면 독이 텅 빈다) */
    var im = el.firstChild;
    if (im && im.tagName === 'IMG') {
      im.onerror = function () {
        im.onerror = null;
        var alt = svgMarkup(key);
        if (alt) el.innerHTML = alt; else el.textContent = fall;
      };
    }
    return true;
  }

  OC.ui.appicon = {
    src: src, has: has, paint: paint, fragKey: fragKey,
    KEYS: KEYS, markup: markup, svgMarkup: svgMarkup, TILE_STOPS: TILE_STOPS,
    IMG_KEYS: IMG_KEYS, SOLID: SOLID, ART_VER: ART_VER, ART_DIR: ART_DIR,
    inkFor: inkFor,
    /* 검사용 — 키의 세트 글리프 path(d). host-loop S68s 가 「손으로 그린 path 가 없다」를 이것으로 잰다. */
    art: function (k) { return has(k) ? ART[k][1] : null; }
  };

  /* self-test(host-loop)와 노드 실행용. 브라우저에서는 무시된다. */
  if (typeof module !== 'undefined' && module.exports) module.exports = OC.ui.appicon;
})();
