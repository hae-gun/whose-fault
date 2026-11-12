"""문제 하나 공유 페이지(q/q01.html ~)를 만든다. 실행: python3 tools/og/gen_question_pages.py
카톡 미리보기용 정적 페이지이고, 사람이 열면 바로 앱의 그 문제(?q=)로 넘어간다.
정답은 페이지에 넣지 않는다. 문제를 고치면 이 스크립트와 render_og.py를 다시 돌릴 것."""
import html,os
from questions import load,ROOT
BASE='https://whose-fault.nobody-asked.dev/'
T='''<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t} | 몇 대 몇?</title>
<meta name="description" content="{s} 이 사고, 몇 대 몇인지 맞혀 보세요.">
<meta property="og:type" content="website">
<meta property="og:site_name" content="몇 대 몇?">
<meta property="og:title" content="이 사고 몇 대 몇? &quot;{t}&quot;">
<meta property="og:description" content="{s} 너는 맞힐 수 있어?">
<meta property="og:image" content="{base}og/q/{id}.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="{base}q/{id}.html">
<meta name="twitter:card" content="summary_large_image">
<script>
(function(){{var f=parseInt(new URLSearchParams(location.search).get('f'),10);
location.replace('../?q={id}'+(f>=0&&f<=100&&f%10===0?'&f='+f:''));}})();
</script>
<style>
body{{margin:0;background:#f3f1ec;color:#1c1f24;font-family:system-ui,sans-serif}}
.wrap{{max-width:560px;margin:0 auto;padding:20px 16px}}
img{{display:block;width:100%;height:auto;border-radius:18px}}
a{{display:block;text-align:center;text-decoration:none;border-radius:14px;padding:16px;font-weight:700;background:#1c1f24;color:#fff;margin-top:12px}}
</style></head>
<body><div class="wrap">
<img src="../og/q/{id}.png" alt="{t}" width="1200" height="630">
<h1 style="font-size:22px">{t}</h1>
<p>{s}</p>
<a href="../?q={id}">몇 대 몇인지 맞혀 보기</a>
</div></body></html>
'''
os.makedirs(os.path.join(ROOT,'q'),exist_ok=True)
qs=load()
for q in qs:
    out=T.format(base=BASE,id=q['id'],t=html.escape(q['t']),s=html.escape(q['s']))
    open(os.path.join(ROOT,'q',q['id']+'.html'),'w',encoding='utf-8').write(out)
print(len(qs),'pages')
