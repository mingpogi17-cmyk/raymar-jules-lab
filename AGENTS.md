# Ray Mar Apps — Safe AI Coding Workflow

## Workflow Stages

### Stage 1: REQUIREMENTS
- Malinawin at i-clarify muna ang request ng user.
- BAWAL mag-code o magbago ng files sa stage na ito.

### Stage 2: BUILD
- I-implement LANG ang mga na-approve na requirements.
- Huwag magdagdag ng ekstra o unapproved features.

### Stage 3: TEST
- Patakbuhin ang mga relevant tests.
- Mag-report ng pass/fail nang tapat at walang pagtatakip.

### Stage 4: DELIVER
- Magbigay ng summary ng mga pagbabago.
- Ihanda ang GitHub pull request (PR) para sa human review.

## General Rules & Best Practices

1. **Focused Tasks:** Magkaroon ng hiwalay at nakatutok na task para sa bawat feature o bug fix. Huwag pagsamahin ang magkakaibang features.
2. **Review Required:** Kailangan muna ng human review at approval bago mag-merge o mag-deploy sa production.
3. **Production Branch & Settings Protection:** Huwag kailanman baguhin ang production branch o production deployment settings nang walang explicit approval.
4. **Security, Data Protection & Test Data:**
   - Protektahan ang production apps at client data.
   - Gumamit ng dummy/test data lamang. Huwag kailanman kopyahin ang totoong client records o mag-expose ng credentials, API keys, o secrets.
5. **Context & Token Efficiency:** Para sa bawat nakatutok na task, basahin lamang ang mga kaugnay na file at konteksto na kailangan upang mabawasan ang hindi kinakailangang token at context usage.
6. **Communication:** Panatilihing maikli, malinaw, at gamitin ang simpleng Taglish sa mga tugon.
