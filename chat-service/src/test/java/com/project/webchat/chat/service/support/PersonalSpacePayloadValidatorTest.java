package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.MessageType;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PersonalSpacePayloadValidatorTest {

    private final PersonalSpacePayloadValidator validator = new PersonalSpacePayloadValidator();

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
    void isRichMessageType_identifiesRichTypes() {
        assertThat(PersonalSpacePayloadValidator.isRichMessageType(MessageType.TODO)).isTrue();
        assertThat(PersonalSpacePayloadValidator.isRichMessageType(MessageType.TEXT)).isFalse();
    }
}
