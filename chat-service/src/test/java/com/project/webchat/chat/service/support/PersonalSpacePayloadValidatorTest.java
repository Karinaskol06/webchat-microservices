package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.MessageType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PersonalSpacePayloadValidatorTest {

    private final PollPayloadHelper pollPayloadHelper = new PollPayloadHelper();
    private final PersonalSpacePayloadValidator validator =
            new PersonalSpacePayloadValidator(pollPayloadHelper);

    @Test
    void validate_acceptsValidTodoPayload() {
        String json = """
                {"tasks":[{"id":"t1","text":"Buy milk","done":false}]}
                """;
        validator.validate(MessageType.TODO, json);
    }

    @Test
    void validate_rejectsInvalidJson() {
        assertThatThrownBy(() -> validator.validate(MessageType.TODO, "not-json"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("valid JSON");
    }

    @Test
    void validate_rejectsTodoWithoutTasksArray() {
        assertThatThrownBy(() -> validator.validate(MessageType.TODO, "{}"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("tasks array");
    }

    @Test
    void validate_acceptsValidPollPayload() {
        String json = """
                {"question":"Pick one","mode":"poll","anonymous":false,"multipleChoice":false,
                "options":[{"id":"o1","text":"A","correct":false},{"id":"o2","text":"B","correct":false}],
                "votes":{}}
                """;
        validator.validate(MessageType.POLL, json);
    }

    @Test
    void assertTodoDoneOnlyChange_allowsDoneToggle() {
        String before = """
                {"tasks":[{"id":"t1","text":"Buy milk","done":false}]}
                """;
        String after = """
                {"tasks":[{"id":"t1","text":"Buy milk","done":true}]}
                """;
        validator.assertTodoDoneOnlyChange(before, after);
    }

    @Test
    void assertTodoDoneOnlyChange_rejectsTextChange() {
        String before = """
                {"tasks":[{"id":"t1","text":"Buy milk","done":false}]}
                """;
        String after = """
                {"tasks":[{"id":"t1","text":"Buy bread","done":false}]}
                """;
        assertThatThrownBy(() -> validator.assertTodoDoneOnlyChange(before, after))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("complete or incomplete");
    }

    @Test
    void assertTodoDoneOnlyChange_rejectsAddedTask() {
        String before = """
                {"tasks":[{"id":"t1","text":"Buy milk","done":false}]}
                """;
        String after = """
                {"tasks":[{"id":"t1","text":"Buy milk","done":false},{"id":"t2","text":"Eggs","done":false}]}
                """;
        assertThatThrownBy(() -> validator.assertTodoDoneOnlyChange(before, after))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("complete or incomplete");
    }

    @Test
    void isRichMessageType_identifiesRichTypes() {
        assertThat(PersonalSpacePayloadValidator.isRichMessageType(MessageType.TODO)).isTrue();
        assertThat(PersonalSpacePayloadValidator.isRichMessageType(MessageType.POLL)).isTrue();
        assertThat(PersonalSpacePayloadValidator.isRichMessageType(MessageType.TEXT)).isFalse();
    }
}
