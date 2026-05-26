# Curriculum Standards (CCSS ELA grade alignment)

이 문서는 영어 학습 동반자(English Tutor)가 학생의 **목표 학년(Grade 1~12)** 에 맞춰 task를 만들고 평가를 보정할 때 참조하는 **단일 정본**이다.
런타임 시 `lib/curriculum.ts`가 이 파일을 파싱해 prompt에 inject한다 — **이 문서를 수정하는 것만으로 학년 기준이 갱신**된다. 코드 안에 같은 데이터를 중복 보관하지 않는다.

학생 화면의 한국어 톤은 [companion-voice.md](./companion-voice.md) charter가 상위 규칙이며, 이 문서는 **무엇을 기대할 수 있는가**(난이도·구조·어휘)만 다룬다.

## 사용법

- 학년 섹션 헤더는 반드시 `### Grade N — CEFR / 한국어 스테이지` 형식을 유지한다. 예: `### Grade 5 — A2+ / 미국 초등학교 5학년 수준`. 파서가 이 형식을 정규식으로 추출한다.
- 각 학년 섹션은 정해진 순서의 bullet을 가진다 (parser가 라벨로 매칭): `One-line`, `Reading`, `Writing`, `Speaking & Listening`, `Language`, `Sentence complexity`, `Vocabulary range`, `Reasoning structure`, `학습자 기대`(parser는 무시).
- 학년당 약 10–15줄을 한계로 유지한다 (prompt 토큰 예산).
- CCSS 코드(`RL.5.1`, `W.6.1` 등)는 docs 안에 anchor로만 표기한다. parser가 코드 inject 직전에 강제로 제거하므로 prompt나 학생-facing 출력에 노출되지 않는다.
- 학년 expectation은 평가/생성 calibration에만 쓰고, 학생-facing 한국어 톤은 charter를 따른다.

## 영역 정의

각 학년은 CCSS ELA 4개 영역으로 나눠 기대치를 적는다:

- **Reading (R / RL / RI)** — 읽고 이해·분석·추론하는 능력.
- **Writing (W)** — 의견·설명·서사·논증을 글로 구성하는 능력.
- **Speaking & Listening (SL)** — 토의·발화·청취하는 능력.
- **Language (L)** — 문법·문장 구조·어휘·관습.

추가로 우리 시스템은 **Sentence complexity / Vocabulary range / Reasoning structure** 세 차원을 학년별 평균치로 추적한다. 이 차원이 학생 답변을 평가할 때 점수 calibration의 1차 신호다.

## 점수 calibration 규칙

- 학년 기대치를 **충족**하면 평균 **70/100**.
- 명확히 **상회**하면 80+ (구조 정돈, 정확성, 논리 발달).
- **미달**이면 60- (과제 빗나감, 기본 오류 다수).
- 개별 rubric metric 점수는 overall score의 ±5 안.

## Grade-by-grade summary

각 학년 섹션은 한국어로 작성, 영역명/CCSS 코드는 영어 유지.

---

### Grade 1 — Pre-A1 / 미국 초등학교 1학년 수준

- **One-line**: 한두 문장으로 친숙한 사실·감정을 전한다. 평균 3–6 단어 문장.
- **Reading**: 그림책에서 인물·배경·핵심 사건을 한 문장으로 짚는다. 친숙한 단어를 그림 단서로 해독한다. (anchor: RL.1.1)
- **Writing**: 그림 + 한두 단어 라벨, 한두 문장으로 의견·정보·이야기를 쓴다. (W.1.1)
- **Speaking & Listening**: 한 차례 주고받기로 자기 경험을 짧게 말한다.
- **Language**: 명사·동사 기본, 마침표·대문자, 단순 현재 시제.
- **Sentence complexity**: 3–6 단어 단문.
- **Vocabulary range**: 일상 명사, 색·숫자·가족.
- **Reasoning structure**: 사실 진술 + 단일 이유(because …).
- **학습자 기대**: 모델 문장을 따라 발화/필사 완성, 자기 한 문장 추가.

---

### Grade 2 — A1 / 미국 초등학교 2학년 수준

- **One-line**: 두세 문장으로 사건의 순서를 짚고 짧은 이유를 덧붙인다. 평균 5–7 단어.
- **Reading**: 짧은 글의 누가·언제·왜를 문장으로 답한다. (anchor: RL.2.1)
- **Writing**: 두세 문장으로 사건의 순서나 의견을 쓴다 (beginning–middle–end 감각).
- **Speaking & Listening**: 짧은 토의에서 한 차례 응답한다.
- **Language**: 단순 과거형, 복수형, 형용사 1개.
- **Sentence complexity**: 5–7 단어, and로 묶은 단순 복문 가능.
- **Vocabulary range**: 일상 + 학교·동네 어휘.
- **Reasoning structure**: 사실/의견 + 이유 1–2개.
- **학습자 기대**: 두세 문장 짧은 의견·이야기 한 단락.

---

### Grade 3 — A1+ / 미국 초등학교 3학년 수준

- **One-line**: 주장과 이유 한두 개로 짧은 단락을 만든다. 평균 6–9 단어, 단순 복문 시도.
- **Reading**: 글의 main idea를 한 문장으로 요약, 단어 의미 추론. (anchor: RL.3.2)
- **Writing**: 주장 + 이유 1–2개 + 마무리로 짧은 단락을 쓴다. (W.3.1)
- **Speaking & Listening**: 한 차례 발화 + 한 차례 응답.
- **Language**: because/and/but, 단수·복수 일치, 단순 시제.
- **Sentence complexity**: 6–9 단어, 단순 복문 1개.
- **Vocabulary range**: 학년 sight word + 주제별 핵심 명사.
- **Reasoning structure**: 주장 + 이유 + 결론(3단).
- **학습자 기대**: 의견 또는 짧은 정보 단락 1개.

---

### Grade 4 — A2 / 미국 초등학교 4학년 수준

- **One-line**: 이유 두 개와 결론을 갖춘 짧은 단락. 평균 7–10 단어, 인과·대조 접속사 사용.
- **Reading**: 핵심 아이디어와 supporting detail을 구분한다. (anchor: RI.4.2)
- **Writing**: 주장 + 이유 2개 + 결론을 갖춘 한 단락. 인과·대조 접속사. (W.4.1)
- **Speaking & Listening**: 다른 학생의 의견에 한 차례 빌드업하여 응답한다.
- **Language**: 동사 시제 일관성, 부사, 콤마 enumeration.
- **Sentence complexity**: 7–10 단어, 종속절 1개 (because/when/if).
- **Vocabulary range**: 일상 + 학년 academic 일부.
- **Reasoning structure**: 의견-이유-예시-결론 시도.
- **학습자 기대**: 한 단락 의견 글에서 두 이유와 결론을 분명히 잇는다.

---

### Grade 5 — A2+ / 미국 초등학교 5학년 수준

- **One-line**: 의견-이유-예시-결론 4단 구조의 한 단락. 평균 7–12 단어, 단순 복문 1–2개.
- **Reading**: 핵심 아이디어를 두세 문장으로 요약, 인물의 변화 추적. (anchor: RL.5.2)
- **Writing**: 의견 글에서 주장 + 이유 2–3개 + 예시 + 결론을 한 단락으로 쓴다. (W.5.1)
- **Speaking & Listening**: 토론에서 한 차례 발화 후 동료 의견에 응답한다.
- **Language**: 시제 일관성, because/although 등 접속사, 콤마·세미콜론.
- **Sentence complexity**: 7–12 단어, 복문 1–2개 포함.
- **Vocabulary range**: 일상 + 학년 academic word list 일부.
- **Reasoning structure**: 의견-이유-예시-결론(4단).
- **학습자 기대**: 4단 구조 한 단락을 자기 입장과 사례로 채운다.

---

### Grade 6 — B1 / 미국 중학교 1학년 수준

- **One-line**: 두 단락에 걸쳐 의견을 정돈한다. 평균 8–13 단어, 종속절·예시·반대 관점 1개.
- **Reading**: 글쓴이의 관점·근거 구조를 분석한다. (anchor: RI.6.6)
- **Writing**: 두 단락 이상으로 의견을 정돈한다. 주장 + 이유 2–3개 + 예시 + 반대 관점 1개 인지. (W.6.1)
- **Speaking & Listening**: 토론에서 동료 의견을 paraphrase하며 응답한다.
- **Language**: 종속절·예시 신호어(for example, however), 시제 변환 정확.
- **Sentence complexity**: 8–13 단어, 종속절 1–2개.
- **Vocabulary range**: 학년 academic word list 사용.
- **Reasoning structure**: 주장 + 근거 + 사례 + 반대 관점 인정.
- **학습자 기대**: 의견 글에서 반대 관점을 한 번 짚고 자기 입장을 옹호한다.

---

### Grade 7 — B1+ / 미국 중학교 2학년 수준

- **One-line**: 근거 2–3개로 입장을 옹호하는 다단락. 평균 10–15 단어, 학년 academic 어휘 일부.
- **Reading**: 텍스트 근거를 들어 추론한다. (anchor: RI.7.1)
- **Writing**: 다단락 글에서 근거 2–3개로 입장을 옹호. 인용·재진술·반대 관점 일부 다룸. (W.7.1)
- **Speaking & Listening**: 토론에서 동료 근거를 인정·재반박.
- **Language**: 명사화, 다양한 종속절, semicolon.
- **Sentence complexity**: 10–15 단어, 종속·등위 결합.
- **Vocabulary range**: 학년 academic + 분야 어휘 일부.
- **Reasoning structure**: 주장 + 근거 + 예시 + 반대 관점 인정 + 결론.
- **학습자 기대**: 인용·재진술을 한 차례 시도한 다단락 의견 글.

---

### Grade 8 — B2 / 미국 중학교 3학년 수준

- **One-line**: 반론 한 차례 인정 후 재반박하는 짧은 논증. 평균 11–16 단어, 종속·등위 결합.
- **Reading**: 글의 논증 구조와 수사 장치를 분석한다. (anchor: RI.8.6)
- **Writing**: 반론을 한 차례 인정한 뒤 재반박하는 짧은 논증을 쓴다. (W.8.1)
- **Speaking & Listening**: 토론에서 반론을 paraphrase한 뒤 재반박.
- **Language**: 능동·수동 전환, 명사화, 정밀한 수식어.
- **Sentence complexity**: 11–16 단어, 다중 종속절 가능.
- **Vocabulary range**: academic + 주제 분야 어휘.
- **Reasoning structure**: 주장-근거-예시-반론 인정-재반박-결론.
- **학습자 기대**: 반론을 정직히 인정하고 자기 근거로 재반박하는 짧은 논증.

---

### Grade 9 — B2 / 미국 고등학교 1학년 수준

- **One-line**: 근거-반론-반박 구조의 다단락 글. 평균 12–18 단어, 추상 어휘·정밀한 동사 선택.
- **Reading**: 복합 텍스트에서 글쓴이의 주장과 근거의 적절성을 평가. (anchor: RI.9-10.8)
- **Writing**: 다단락 글에서 근거-반론-재반박을 갖춘 정돈된 논증. (W.9-10.1)
- **Speaking & Listening**: 토론에서 동료의 추론 약점을 짚어 응답.
- **Language**: 추상 어휘·정밀한 동사 선택, 다양한 종속/등위 결합.
- **Sentence complexity**: 12–18 단어, 다층 종속절.
- **Vocabulary range**: 추상·academic 어휘 안정.
- **Reasoning structure**: 다단락 논증의 구조와 흐름 일관.
- **학습자 기대**: 다단락 논증에서 근거의 적절성을 스스로 점검한다.

---

### Grade 10 — B2+ / 미국 고등학교 2학년 수준

- **One-line**: 텍스트 근거를 인용·재진술하며 입장을 옹호. 평균 13–19 단어, 명사화·수동태 적절히.
- **Reading**: 글쓴이의 가정·전제를 식별한다. (anchor: RI.9-10.6)
- **Writing**: 텍스트 근거를 인용·재진술하며 입장을 옹호. 결론에서 더 넓은 함의를 짚는다. (W.9-10.1)
- **Speaking & Listening**: 인용·재진술로 동료 의견을 활용한 토론.
- **Language**: 명사화·수동태를 의도적으로 적절히 사용.
- **Sentence complexity**: 13–19 단어, 다층 종속절.
- **Vocabulary range**: 학문 분야 어휘 일부 안정.
- **Reasoning structure**: 인용 + 분석 + 자기 입장 + 함의.
- **학습자 기대**: 인용을 활용한 다단락 글에서 함의를 결론에 포함한다.

---

### Grade 11 — C1 / 미국 고등학교 3학년 수준

- **One-line**: 추상 주제에 대해 정교한 논증과 reframe. 평균 14–20 단어, academic register 안정.
- **Reading**: 글쓴이의 수사·언어 선택의 효과를 평가. (anchor: RI.11-12.6)
- **Writing**: 추상 주제에 대해 정교한 논증과 reframe을 시도. 다중 관점의 한계 명시. (W.11-12.1)
- **Speaking & Listening**: 학술적 톤으로 분석적 토론을 이끈다.
- **Language**: academic register 안정, 정밀한 연결사·수식어.
- **Sentence complexity**: 14–20 단어, 다층 종속절.
- **Vocabulary range**: 학문·추상 어휘 능숙.
- **Reasoning structure**: 다중 관점 비교 + reframe + 자기 입장의 한계 명시.
- **학습자 기대**: 다중 관점을 reframe하고 자기 입장의 한계를 명시하는 다단락 글.

---

### Grade 12 — C1 / 미국 고등학교 4학년 수준

- **One-line**: 복합 추상 논제를 학술적 톤과 정밀한 논리로 다룬다. 평균 15–22 단어, 다층 종속절.
- **Reading**: 복수 텍스트를 종합·비교하여 자기 입장을 형성. (anchor: RI.11-12.7)
- **Writing**: 복합 추상 논제를 학술적 톤과 정밀한 논리로 다룬다. 명확한 논증 구조 + 다중 관점 평가. (W.11-12.1)
- **Speaking & Listening**: 학술 발표 수준의 정돈된 토론·발화.
- **Language**: 다층 종속절, 정밀한 연결사·수식어, 학술 register 일관.
- **Sentence complexity**: 15–22 단어, 다층 종속절.
- **Vocabulary range**: 학문·추상 어휘 능숙, 분야 전문 용어 일부.
- **Reasoning structure**: 다중 관점 비교 + 종합 + 자기 입장 + 한계 + 함의.
- **학습자 기대**: 학술 register에서 다중 관점을 종합하고 함의를 명시한다.

---

## Token budget

- 전체 문서를 한 prompt에 통째로 임베드하지 않는다.
- `curriculumSnippet(grade, mode)`로 학년+mode 1개 섹션(~10줄, ~250 토큰)만 inject한다.
- task generation prompt와 evaluation prompt 양쪽에 동일한 snippet을 inject하여 생성과 평가 기준을 한 줄로 맞춘다.

## 한국 학습자에 대한 보조 노트

- 두 자녀(중1·고1 등) 가족용 사적 서비스. 학년 단위는 **목표치**(현재 수준이 아닐 수 있음).
- 학습자가 **현재** 학년 미달이면 평가가 60-로 떨어져 부모에게 신호가 됨.
- `levelDescription` 자유 텍스트(예: "글쓰기보다 말하기 선호")는 학년 표준의 **보조** 신호일 뿐. 학년이 우선순위.
- companion voice charter는 학생 화면 한국어 톤에 절대적 — calibration이 톤을 침범하지 않도록 prompt instruction에서 명시한다.

## 파서 계약 (실수 방지용)

이 문서를 편집할 때 다음을 지키지 않으면 `lib/curriculum.ts`의 파서가 **즉시 에러를 던지고 빌드/요청이 실패**한다. 사일런트 회귀를 피하기 위함.

- 학년 헤더는 정확히 `### Grade N — CEFR / 한국어 스테이지`. `—`(em dash, U+2014)와 `/`는 그대로 유지. CEFR 토큰은 공백 없음(예: `A1+`, `B1+`, `Pre-A1`).
- 각 학년 섹션에 다음 8개 bullet이 **모두 존재**해야 한다: `One-line`, `Reading`, `Writing`, `Speaking & Listening`, `Language`, `Sentence complexity`, `Vocabulary range`, `Reasoning structure`. 순서는 자유. (`학습자 기대`는 인간용 메모로, parser는 무시.)
- 라벨은 정확히 `- **{Label}**: {내용}` 형식. bold(`**`) 누락 금지.
- 한국어 스테이지에서 `초등학교|중학교|고등학교` 중 하나가 들어가 schoolBand가 결정된다.
- bullet 내용 끝의 CCSS 코드 괄호(예: `(W.5.1)`, `(anchor: RL.1.1)`, `(RI.9-10.6)`)는 자동으로 strip된 후 prompt에 inject된다.
