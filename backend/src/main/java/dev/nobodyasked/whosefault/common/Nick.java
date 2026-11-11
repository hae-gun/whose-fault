package dev.nobodyasked.whosefault.common;

/** uid를 밖에 드러내지 않고 댓글 작성자를 구분하기 위한 익명 닉네임. */
public final class Nick {
    private static final String[] WORDS = {
            "초보", "양보왕", "깜빡이", "칼치기", "방어운전", "브레이크", "엑셀", "주차왕", "후진", "과속카메라", "블랙박스", "신호대기"};

    private Nick() {}

    public static String of(String uid) {
        long h = 0;
        for (int i = 0; i < uid.length(); i++) h = (h * 31 + uid.charAt(i)) & 0xffffffffL;
        return WORDS[(int) (h % WORDS.length)] + " 운전자 " + (10 + h % 90);
    }
}
