#!/usr/bin/env bash
# 배포용 js 난독화: 사이트로 나가는 _site/js/*.js만 바꾸고 레포의 원본은 그대로 둔다.
# 사용: tools/obfuscate.sh _site
# 가벼운 설정만 쓴다. 흐름 꼬기(controlFlowFlattening)와 가짜 코드(deadCodeInjection)는
# 매 프레임 도는 애니메이션을 느리게 해서 끈다.
set -euo pipefail
SITE="${1:?site dir}"
# 테스트용 훅은 배포본에서 뺀다
sed -i '/^window.__fs=/d' "$SITE/js/app.js"
for f in $(ls "$SITE"/js/*.js | grep -v "\.obf\.js$"); do
  npx --yes javascript-obfuscator@4.2.2 "$f" --output "${f%.js}.obf.js" \
    --compact true --simplify true \
    --identifier-names-generator hexadecimal --rename-globals false \
    --string-array true --string-array-encoding base64 --string-array-threshold 0.75 \
    --string-array-rotate true --string-array-shuffle true \
    --split-strings false --control-flow-flattening false --dead-code-injection false \
    --self-defending false --debug-protection false --unicode-escape-sequence false \
    --source-map false --log false
  mv "${f%.js}.obf.js" "$f"
done
ls -l "$SITE"/js
