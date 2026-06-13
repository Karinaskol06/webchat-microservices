package com.project.webchat.chat.service.support;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PollPayloadHelperTest {

    private final PollPayloadHelper helper = new PollPayloadHelper();

    @Test
    void applyVote_appendsTestAttemptHistory() {
        String initial = """
                {"question":"Q","mode":"test","multipleChoice":false,"maxAttempts":3,
                "options":[{"id":"a","text":"A","correct":true},{"id":"b","text":"B","correct":false}],
                "votes":{}}
                """;

        String afterWrong = helper.applyVote(initial, 7L, "Tester", List.of("b"));
        assertThat(afterWrong).contains("\"attempts\":1");
        assertThat(afterWrong).contains("\"lastCorrect\":false");
        assertThat(afterWrong).contains("\"history\"");

        String afterCorrect = helper.applyVote(afterWrong, 7L, "Tester", List.of("a"));
        assertThat(afterCorrect).contains("\"attempts\":2");
        assertThat(afterCorrect).contains("\"lastCorrect\":true");
        assertThat(afterCorrect).contains("\"completed\":true");
        assertThat(afterCorrect.split("\"history\"").length).isGreaterThan(1);
    }

    @Test
    void ensurePollId_addsStableIdWhenMissing() {
        String raw = """
                {"question":"Q","mode":"poll","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],"votes":{}}
                """;
        String withId = helper.ensurePollId(raw, "msg-1");
        assertThat(withId).contains("\"pollId\":\"msg-1\"");
        assertThat(helper.extractPollId(withId)).isEqualTo("msg-1");
    }

    @Test
    void resetVotes_clearsVotesOnly() {
        String withVotes = """
                {"question":"Q","mode":"poll","options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],
                "votes":{"1":{"optionIds":["a"]}}}
                """;
        String reset = helper.resetVotes(withVotes);
        assertThat(reset).contains("\"votes\":{}");
        assertThat(reset).contains("\"question\":\"Q\"");
    }
}
