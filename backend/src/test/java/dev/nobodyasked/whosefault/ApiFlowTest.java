package dev.nobodyasked.whosefault;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.nobodyasked.whosefault.cases.SpecValidator;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiFlowTest {

    private static final String ADMIN = "test-admin-token";
    private static final String SPEC = """
            {"map":"sig","A":{"pts":[[535,950],[535,700],[535,500],[535,50]],"light":"G","speed":50},
             "B":{"pts":[[950,465],[700,465],[500,465],[50,465]],"light":"R","speed":50},
             "mods":{"A":[],"B":["careless","hack"]},"evil":"<script>"}""";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @Autowired SpecValidator validator;

    private String session() throws Exception {
        String body = mvc.perform(post("/api/session")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return om.readTree(body).get("token").asText();
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder b, String token) {
        return b.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private JsonNode json(MockHttpServletRequestBuilder b) throws Exception {
        return om.readTree(mvc.perform(b).andReturn().getResponse().getContentAsString());
    }

    @Test
    void fullFlow() throws Exception {
        String alice = session(), bob = session(), carol = session(), dave = session();

        // 사고 올리기: 로그인 없이는 401, 차량 번호는 400
        mvc.perform(post("/api/cases").contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"t\",\"spec\":" + SPEC + "}")).andExpect(status().isUnauthorized());
        mvc.perform(as(post("/api/cases"), alice).content("{\"title\":\"12가3456 사고\",\"spec\":" + SPEC + "}"))
                .andExpect(status().isBadRequest());
        JsonNode created = json(as(post("/api/cases"), alice).content("{\"title\":\"퇴근길 교차로\",\"desc\":\"설명\",\"spec\":" + SPEC + "}"));
        String caseId = created.get("id").asText();

        // 목록에는 정규화된 스펙만 남는다
        JsonNode list = json(get("/api/cases"));
        JsonNode item = list.get(0);
        assertThat(item.get("id").asText()).isEqualTo(caseId);
        assertThat(item.get("spec").has("evil")).isFalse();
        assertThat(item.get("spec").get("mods").get("B").size()).isEqualTo(1);

        // 투표 전에는 결과와 댓글이 가려진다
        JsonNode before = json(as(get("/api/cases/" + caseId + "/state"), bob));
        assertThat(before.has("votes")).isFalse();
        assertThat(before.has("comments")).isFalse();

        // 투표하지 않고 댓글을 쓰면 403
        mvc.perform(as(post("/api/cases/" + caseId + "/comments"), bob).content("{\"text\":\"의견\"}")).andExpect(status().isForbidden());

        mvc.perform(as(put("/api/cases/" + caseId + "/vote"), bob).content("{\"choice\":\"B100\"}")).andExpect(status().isNoContent());
        mvc.perform(as(put("/api/cases/" + caseId + "/vote"), carol).content("{\"choice\":\"Bmore\",\"disagree\":true}")).andExpect(status().isNoContent());
        mvc.perform(as(put("/api/cases/" + caseId + "/vote"), dave).content("{\"choice\":\"nope\"}")).andExpect(status().isBadRequest());
        // 표 바꾸기
        mvc.perform(as(put("/api/cases/" + caseId + "/vote"), bob).content("{\"choice\":\"B100\",\"disagree\":true}")).andExpect(status().isNoContent());

        JsonNode c1 = json(as(post("/api/cases/" + caseId + "/comments"), bob).content("{\"text\":\"빨간불이면 무조건이지\"}"));
        String commentId = c1.get("id").asText();
        // 15초 안에 또 쓰면 429
        mvc.perform(as(post("/api/cases/" + caseId + "/comments"), bob).content("{\"text\":\"하나 더\"}")).andExpect(status().isTooManyRequests());

        mvc.perform(as(put("/api/comments/" + commentId + "/like"), carol)).andExpect(status().isNoContent());
        mvc.perform(as(put("/api/comments/" + commentId + "/like"), carol)).andExpect(status().isNoContent());

        JsonNode state = json(as(get("/api/cases/" + caseId + "/state"), carol));
        assertThat(state.get("total").asInt()).isEqualTo(2);
        assertThat(state.get("votes").get("counts").get("B100").asInt()).isEqualTo(1);
        assertThat(state.get("votes").get("disagree").asInt()).isEqualTo(2);
        assertThat(state.get("votes").get("median").asInt()).isEqualTo(0);
        JsonNode cm = state.get("comments").get(0);
        assertThat(cm.get("likes").asInt()).isEqualTo(1);
        assertThat(cm.get("liked").asBoolean()).isTrue();
        assertThat(cm.get("mine").asBoolean()).isFalse();
        assertThat(cm.get("choice").asText()).isEqualTo("B100");
        assertThat(cm.has("uid")).isFalse();

        // 남의 댓글은 못 지운다
        mvc.perform(as(delete("/api/comments/" + commentId), carol)).andExpect(status().isForbidden());

        // 신고 3건이면 일반 사용자에게 가려지고, 관리자에게는 보인다
        for (String who : new String[]{alice, carol, dave}) {
            mvc.perform(as(post("/api/reports"), who)
                    .content("{\"type\":\"comment\",\"targetId\":\"" + commentId + "\",\"reason\":\"기타\"}")).andExpect(status().isNoContent());
        }
        JsonNode hidden = json(as(get("/api/cases/" + caseId + "/state"), carol)).get("comments").get(0);
        assertThat(hidden.get("hidden").asBoolean()).isTrue();
        assertThat(hidden.has("text")).isFalse();
        JsonNode adminView = json(get("/api/cases/" + caseId + "/state").header("X-Admin-Token", ADMIN)).get("comments").get(0);
        assertThat(adminView.get("text").asText()).isEqualTo("빨간불이면 무조건이지");
        assertThat(adminView.get("reports").asInt()).isEqualTo(3);

        // 관리자 기능: 토큰 없으면 403
        mvc.perform(get("/api/admin/reports")).andExpect(status().isForbidden());
        JsonNode groups = json(get("/api/admin/reports").header("X-Admin-Token", ADMIN));
        assertThat(groups.get(0).get("count").asInt()).isEqualTo(3);
        assertThat(groups.get(0).get("preview").asText()).isEqualTo("빨간불이면 무조건이지");

        mvc.perform(delete("/api/comments/" + commentId).header("X-Admin-Token", ADMIN)).andExpect(status().isNoContent());
        assertThat(json(get("/api/admin/reports").header("X-Admin-Token", ADMIN)).size()).isZero();

        // 퀴즈 최고점
        mvc.perform(as(put("/api/players/me"), bob).content("{\"best\":80}")).andExpect(status().isNoContent());
        mvc.perform(as(put("/api/players/me"), bob).content("{\"best\":40}")).andExpect(status().isNoContent());

        // 사고 삭제
        mvc.perform(delete("/api/admin/cases/" + caseId).header("X-Admin-Token", ADMIN)).andExpect(status().isNoContent());
        mvc.perform(get("/api/cases/" + caseId + "/state")).andExpect(status().isNotFound());
    }

    @Test
    void quizStats() throws Exception {
        String t = session();
        mvc.perform(as(post("/api/events"), t).content("{\"kind\":\"quiz_start\"}")).andExpect(status().isNoContent());
        mvc.perform(as(post("/api/events"), t).content("{\"kind\":\"hack\"}")).andExpect(status().isBadRequest());
        mvc.perform(as(post("/api/quiz/results"), t).content("""
                {"score":76,"grade":"veteran","answers":[{"qid":"q01","guess":0,"answer":0},{"qid":"q02","guess":50,"answer":20}]}"""))
                .andExpect(status().isNoContent());
        // 10초 안에 또 보내면 429, 잘못된 답 형식은 400
        mvc.perform(as(post("/api/quiz/results"), t).content("{\"score\":10,\"grade\":\"newbie\"}")).andExpect(status().isTooManyRequests());
        mvc.perform(as(post("/api/quiz/results"), session()).content("""
                {"score":50,"grade":"otaku","answers":[{"qid":"Q 1","guess":55,"answer":0}]}""")).andExpect(status().isBadRequest());
        mvc.perform(as(post("/api/events"), t).content("{\"kind\":\"share_click\",\"grade\":\"veteran\"}")).andExpect(status().isNoContent());

        mvc.perform(get("/api/admin/quiz-stats")).andExpect(status().isForbidden());
        JsonNode st = json(get("/api/admin/quiz-stats").header("X-Admin-Token", ADMIN));
        assertThat(st.get("totals").get("completions").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(st.get("totals").get("starts").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(st.get("totals").get("shareClicks").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(st.get("grades").get("veteran").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(st.get("daily").size()).isEqualTo(14);
        assertThat(st.get("daily").get(13).get("completions").asLong()).isGreaterThanOrEqualTo(1);
        // 가장 많이 어긋난 문제가 맨 앞
        assertThat(st.get("questions").get(0).get("qid").asText()).isEqualTo("q02");
    }

    @Test
    void badSpecIsRejected() throws Exception {
        String t = session();
        mvc.perform(as(post("/api/cases"), t).content("{\"title\":\"x\",\"spec\":{\"map\":\"moon\"}}")).andExpect(status().isBadRequest());
        mvc.perform(as(post("/api/cases"), t).content("{\"title\":\"x\",\"spec\":{\"map\":\"sig\",\"A\":{\"pts\":[[0,0],[1,1],[2,2],[99999,3]]},\"B\":{\"arm\":\"S\",\"man\":\"left\"}}}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void seedCasesAreNormalized() throws Exception {
        // V3 마이그레이션의 예시 사고 5건: 목록에 보이고, 스펙이 정규화 결과와 같아야 한다
        Set<String> seeds = new HashSet<>(Set.of("seedYellowLeft01", "seedRoundEnter02", "seedAlleyLeft03",
                "seedCutIn110km04", "seedParkExit05"));
        for (JsonNode item : json(get("/api/cases"))) {
            if (seeds.remove(item.get("id").asText())) {
                assertThat(validator.normalize(item.get("spec")).toString()).isEqualTo(item.get("spec").toString());
            }
        }
        assertThat(seeds).isEmpty();
    }
}
