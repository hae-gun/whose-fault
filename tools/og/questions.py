"""js/app.js의 퀴즈 문제(id, 제목, 상황)를 읽는다. 문제 공유 페이지와 이미지가 앱과 항상 같게."""
import os,re
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
def load():
    src=open(os.path.join(ROOT,'js','app.js'),encoding='utf-8').read()
    qs=[{'id':m[0],'t':m[1],'s':m[2]} for m in re.findall(r"\{id:'(q\d\d)',t:'([^']*)',s:'([^']*)'",src)]
    assert qs and len({q['id'] for q in qs})==len(qs), '문제를 읽지 못했어요'
    return qs
