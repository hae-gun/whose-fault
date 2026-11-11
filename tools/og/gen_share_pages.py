"""등급별 공유 페이지(r/*.html)를 만든다. 실행: python3 tools/og/gen_share_pages.py
주소를 바꾸면 BASE와 index.html의 SHARE_BASE, og 태그를 같이 바꿀 것."""
import json,html,os
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
BASE='https://whose-fault.nobody-asked.dev/'
G=json.load(open(os.path.join(HERE,'grades.json'),encoding='utf-8'))
T='''<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>나는 "{name}" | 몇 대 몇?</title>
<meta name="description" content="{tag}. 사고 영상을 보고 몇 대 몇인지 맞혀보세요!">
<meta property="og:type" content="website">
<meta property="og:site_name" content="몇 대 몇?">
<meta property="og:title" content="내 과실 판단력은 &quot;{name}&quot; ({badge})">
<meta property="og:description" content="{tag}. 사고 영상 보고 몇 대 몇인지 맞혀보세요!">
<meta property="og:image" content="{base}og/{slug}.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="{base}r/{slug}.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box}}
body{{margin:0;background:#f3f1ec;color:#1c1f24;font-family:'Noto Sans KR',system-ui,sans-serif;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:560px;margin:0 auto;padding:20px 16px 40px}}
.brand{{font-size:22px;font-weight:900;letter-spacing:-.5px}}.brand em{{font-style:normal;color:#ff4a4f}}
.card{{background:#fff;border-radius:22px;overflow:hidden;margin-top:14px;box-shadow:0 2px 14px rgba(0,0,0,.06)}}
.card img{{display:block;width:100%;height:auto}}
.body{{padding:20px}}
.who{{font-size:13px;color:#6b7079;font-weight:700}}
.score{{font-size:52px;font-weight:900;letter-spacing:-2px;line-height:1.1}}
.score small{{font-size:20px;color:#6b7079;letter-spacing:0}}
.badge{{display:inline-block;background:{c};color:#fff;font-weight:900;font-size:13px;padding:4px 12px;border-radius:999px;margin-top:6px}}
.name{{font-size:24px;font-weight:900;margin-top:8px;letter-spacing:-.5px}}
.tag{{color:#3d4148;margin-top:4px;font-size:15px}}
.btn{{display:block;width:100%;text-align:center;text-decoration:none;border:0;border-radius:14px;padding:16px;font:700 16px 'Noto Sans KR',sans-serif;background:#1c1f24;color:#fff;margin-top:12px;cursor:pointer}}
.btn.ghost{{background:#fff;color:#1c1f24;border:1px solid #e7e3da}}
.msg{{font-size:13px;color:#3d4148;background:#fff;border-radius:12px;padding:12px;margin-top:10px;word-break:break-all}}
.grades{{margin-top:22px;background:#fff;border-radius:18px;padding:16px}}
.grades h3{{margin:0 0 8px;font-size:14px}}
.g{{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:14px;border-bottom:1px solid #f3f1ec}}
.g:last-child{{border:0}}.g b{{width:46px}}.g.me{{font-weight:900}}
.foot{{font-size:11px;color:#6b7079;line-height:1.6;margin-top:18px}}
</style></head>
<body><div class="wrap">
<div class="brand">몇 대 <em>몇?</em></div>
<div class="card"><img src="../og/{slug}.png" alt="{name} 등급 카드" width="1200" height="630">
<div class="body">
<div class="who" id="who">친구의 과실 판단력 결과</div>
<div class="score" id="score" hidden></div>
<div class="badge">{badge}</div>
<div class="name">{name}</div>
<div class="tag">{tag}</div>
</div></div>
<a class="btn" href="../?from=share&amp;g={slug}">나도 몇 대 몇 맞혀보기</a>
<button class="btn ghost" id="share">이 결과 공유하기</button>
<div id="msg"></div>
<div class="grades"><h3>전체 등급표</h3>{table}</div>
<p class="foot">손해보험협회 "자동차사고 과실비율 인정기준"의 대표 유형을 단순화한 학습과 놀이용 퀴즈예요. 실제 과실은 블랙박스, 도로 상황, 보험사 협의에 따라 달라져요.</p>
</div>
<script>
(function(){{
  var s=parseInt(new URLSearchParams(location.search).get('s'),10);
  if(s>=0&&s<=100){{var el=document.getElementById('score');el.hidden=false;el.innerHTML='';el.appendChild(document.createTextNode(s));var sm=document.createElement('small');sm.textContent=' / 100점';el.appendChild(sm);}}
  var url=location.href,text='내 과실 판단력은 "{name}" ({badge})! 당신은 몇 대 몇인지 맞힐 수 있어요?';
  document.getElementById('share').onclick=function(){{
    if(navigator.share){{navigator.share({{title:'몇 대 몇?',text:text,url:url}}).catch(function(){{}});return;}}
    var done=function(){{show('링크를 복사했어요. 카톡에 붙여넣으면 등급 카드가 함께 보여요.');}};
    if(navigator.clipboard)navigator.clipboard.writeText(text+'\\n'+url).then(done,function(){{show(text+' '+url);}});else show(text+' '+url);
  }};
  function show(t){{var m=document.getElementById('msg');m.innerHTML='';var d=document.createElement('div');d.className='msg';d.textContent=t;m.appendChild(d);}}
}})();
</script>
</body></html>
'''
mins={g['slug']:g['min'] for g in G}
for g in G:
    rows=''.join(f'<div class="g{" me" if x["slug"]==g["slug"] else ""}"><b style="color:{x["c"]}">{x["badge"][0]}</b><span>{html.escape(x["grade"])}</span><span style="margin-left:auto;color:#6b7079;font-size:12px">{x["min"]}점 이상</span></div>' for x in G)
    out=T.format(base=BASE,slug=g['slug'],name=html.escape(g["grade"]),tag=html.escape(g['tag']),badge=g['badge'],c=g['c'],table=rows)
    open(os.path.join(ROOT,'r',g['slug']+'.html'),'w',encoding='utf-8').write(out)
print('r/*.html 생성 완료')
