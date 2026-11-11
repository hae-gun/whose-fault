package dev.nobodyasked.whosefault.cases;

import java.util.LinkedHashMap;
import java.util.Map;

/** 5지선다 투표. 값은 A의 과실(%). */
public final class Choices {
    public static final Map<String, Integer> A_FAULT;
    static {
        Map<String, Integer> m = new LinkedHashMap<>();
        m.put("A100", 100);
        m.put("Amore", 70);
        m.put("half", 50);
        m.put("Bmore", 30);
        m.put("B100", 0);
        A_FAULT = java.util.Collections.unmodifiableMap(m);
    }

    private Choices() {}
}
