package dev.nobodyasked.whosefault.cases;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import dev.nobodyasked.whosefault.common.ApiException;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 사용자가 올린 사고 스펙(도로, 두 차의 궤적, 신호, 속력, 수정요소)을 검증하고
 * 알려진 필드만 남긴 정규화본을 만든다. 프론트의 sanitizeSpec과 같은 규칙.
 * 서버는 과실을 계산하지 않는다. 계산은 프론트 룰 엔진이 한다.
 */
@Component
public class SpecValidator {

    private static final Map<String, String> MAP_KIND = Map.ofEntries(
            Map.entry("sig", "cross"), Map.entry("sig4", "cross"), Map.entry("flash", "cross"),
            Map.entry("nosig_eq", "cross"), Map.entry("nosig_main", "cross"), Map.entry("tee", "cross"),
            Map.entry("round", "round"), Map.entry("road2", "road"), Map.entry("road3", "road"),
            Map.entry("two", "two"), Map.entry("park", "park"));
    private static final Set<String> SIGNAL_LIGHTS = Set.of("G", "Y", "L", "R");
    private static final Set<String> FLASH_LIGHTS = Set.of("YF", "RF");
    private static final Set<String> ARMS = Set.of("N", "S", "E", "W");
    private static final Set<String> MANEUVERS = Set.of("straight", "left", "right", "uturn");
    private static final Set<String> UTURN = Set.of("signal", "always", "illegal");
    private static final Set<String> MODS = Set.of("careless", "drunk", "first", "noBlink", "suddenStop");
    private static final int MAX_POINTS = 400;
    static final int MAX_JSON_CHARS = 30_000;

    private final ObjectMapper mapper;

    public SpecValidator(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public ObjectNode normalize(JsonNode spec) {
        if (spec == null || !spec.isObject()) throw bad("사고 정보가 비어 있어요.");
        if (spec.toString().length() > MAX_JSON_CHARS) throw bad("사고 정보가 너무 커요.");
        String map = spec.path("map").asText("");
        if ("road".equals(map)) map = "road2";
        String kind = MAP_KIND.get(map);
        if (kind == null) throw bad("알 수 없는 도로예요.");

        ObjectNode out = mapper.createObjectNode();
        out.put("map", map);
        for (String k : new String[]{"A", "B"}) {
            out.set(k, car(spec.path(k), map, kind));
        }
        String rear = spec.path("rear").asText("");
        if ("A".equals(rear) || "B".equals(rear)) out.put("rear", rear);
        out.set("mods", mods(spec.path("mods")));
        return out;
    }

    private ObjectNode car(JsonNode c, String map, String kind) {
        if (!c.isObject()) throw bad("차 정보가 비어 있어요.");
        ObjectNode o = mapper.createObjectNode();
        JsonNode pts = c.path("pts");
        if (pts.isArray()) {
            if (pts.size() < 4 || pts.size() > MAX_POINTS) throw bad("경로 점 개수가 올바르지 않아요.");
            ArrayNode arr = o.putArray("pts");
            for (JsonNode p : pts) {
                if (!p.isArray() || p.size() < 2 || !p.get(0).isNumber() || !p.get(1).isNumber()) throw bad("경로 좌표가 올바르지 않아요.");
                double x = p.get(0).asDouble(), y = p.get(1).asDouble();
                if (!Double.isFinite(x) || !Double.isFinite(y) || x < -300 || x > 1300 || y < -300 || y > 1300) {
                    throw bad("경로가 지도 밖으로 너무 벗어났어요.");
                }
                arr.addArray().add(Math.round(x)).add(Math.round(y));
            }
        } else if ("cross".equals(kind)) {
            String arm = c.path("arm").asText(""), man = c.path("man").asText("");
            if (!ARMS.contains(arm) || !MANEUVERS.contains(man)) throw bad("교차로 진행 방향이 올바르지 않아요.");
            o.put("arm", arm);
            o.put("man", man);
        } else if ("road".equals(kind)) {
            int lanes = "road3".equals(map) ? 3 : 2;
            int lane = c.path("lane").asInt(0), to = c.path("to").asInt(0);
            if (lane < 1 || lane > lanes || to < 1 || to > lanes) throw bad("차로 정보가 올바르지 않아요.");
            o.put("lane", lane);
            o.put("to", to);
        } else {
            throw bad("경로가 없어요.");
        }
        String light = c.path("light").asText("");
        boolean signal = "sig".equals(map) || "sig4".equals(map);
        if ((signal && SIGNAL_LIGHTS.contains(light)) || ("flash".equals(map) && FLASH_LIGHTS.contains(light))) {
            o.put("light", light);
        }
        String ut = c.path("ut").asText("");
        if (UTURN.contains(ut)) o.put("ut", ut);
        int speed = c.path("speed").asInt(0);
        if (speed > 0) o.put("speed", Math.max(5, Math.min(150, speed)));
        return o;
    }

    private ObjectNode mods(JsonNode m) {
        ObjectNode o = mapper.createObjectNode();
        for (String k : new String[]{"A", "B"}) {
            ArrayNode arr = o.putArray(k);
            Set<String> seen = new LinkedHashSet<>();
            JsonNode list = m.path(k);
            if (list.isArray()) for (JsonNode v : list) if (v.isTextual() && MODS.contains(v.asText())) seen.add(v.asText());
            seen.stream().limit(5).forEach(arr::add);
        }
        return o;
    }

    private static ApiException bad(String message) {
        return ApiException.badRequest("invalid_spec", message);
    }
}
