package dev.nobodyasked.whosefault.common;

import java.util.List;
import java.util.regex.Pattern;

/** 차량 번호, 전화번호, 욕설이 들어간 글을 막는다. 프론트의 checkText와 같은 규칙. */
public final class TextFilter {

    private static final Pattern PLATE = Pattern.compile("\\d{2,3}[가-힣]\\d{4}");
    private static final Pattern PHONE = Pattern.compile("01[016789]-?\\d{3,4}-?\\d{4}");
    private static final List<String> BAD = List.of(
            "시발", "씨발", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "개새", "좆", "지랄", "니애미", "느금", "썅", "미친놈", "미친년", "꺼져");

    private TextFilter() {}

    /** 문제가 있으면 사용자에게 보여줄 메시지, 없으면 null. */
    public static String check(String text) {
        if (text == null) return null;
        String s = text.replaceAll("\\s+", "");
        if (PLATE.matcher(s).find()) return "차량 번호로 보이는 내용은 올릴 수 없어요.";
        if (PHONE.matcher(s).find()) return "전화번호로 보이는 내용은 올릴 수 없어요.";
        for (String w : BAD) if (s.contains(w)) return "욕설이 포함된 글은 올릴 수 없어요.";
        return null;
    }

    public static void require(String text) {
        String msg = check(text);
        if (msg != null) throw ApiException.badRequest("text_blocked", msg);
    }
}
