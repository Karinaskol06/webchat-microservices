package com.project.webchat.chat.service.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.chat.entity.MessageType;
import org.springframework.stereotype.Component;

@Component
public class PersonalSpacePayloadValidator {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private final PollPayloadHelper pollPayloadHelper;

    public PersonalSpacePayloadValidator(PollPayloadHelper pollPayloadHelper) {
        this.pollPayloadHelper = pollPayloadHelper;
    }

    public void validate(MessageType type, String content) {
        if (type == null || !isRichMessageType(type)) {
            throw new IllegalArgumentException("Unsupported rich message type.");
        }
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("Rich message content is required.");
        }
        JsonNode root;
        try {
            root = MAPPER.readTree(content);
        } catch (Exception e) {
            throw new IllegalArgumentException("Rich message content must be valid JSON.");
        }
        if (!root.isObject()) {
            throw new IllegalArgumentException("Rich message content must be a JSON object.");
        }
        switch (type) {
            case TODO -> validateTodo(root);
            case STICKY_NOTE -> validateSticky(root);
            case CALLOUT -> validateCallout(root);
            case POLL -> pollPayloadHelper.validatePollPayload(root);
            default -> throw new IllegalArgumentException("Unsupported rich message type.");
        }
    }

    public static boolean isRichMessageType(MessageType type) {
        return type == MessageType.TODO
                || type == MessageType.STICKY_NOTE
                || type == MessageType.CALLOUT
                || type == MessageType.POLL;
    }

    /**
     * Ensures a todo edit only toggles {@code done} flags — same tasks, ids, and text.
     */
    public void assertTodoDoneOnlyChange(String oldContent, String newContent) {
        JsonNode oldRoot = readObject(oldContent, "Existing todo content");
        JsonNode newRoot = readObject(newContent, "Updated todo content");
        validateTodo(newRoot);

        JsonNode oldTasks = oldRoot.get("tasks");
        JsonNode newTasks = newRoot.get("tasks");
        if (oldTasks.size() != newTasks.size()) {
            throw new IllegalArgumentException("You can only mark tasks complete or incomplete.");
        }
        for (int i = 0; i < oldTasks.size(); i++) {
            JsonNode oldTask = oldTasks.get(i);
            JsonNode newTask = newTasks.get(i);
            if (!oldTask.get("id").asText().equals(newTask.get("id").asText())) {
                throw new IllegalArgumentException("You can only mark tasks complete or incomplete.");
            }
            if (!oldTask.get("text").asText().equals(newTask.get("text").asText())) {
                throw new IllegalArgumentException("You can only mark tasks complete or incomplete.");
            }
        }
    }

    private JsonNode readObject(String content, String label) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException(label + " is required.");
        }
        try {
            JsonNode root = MAPPER.readTree(content);
            if (!root.isObject()) {
                throw new IllegalArgumentException(label + " must be a JSON object.");
            }
            return root;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException(label + " must be valid JSON.");
        }
    }

    private void validateTodo(JsonNode root) {
        JsonNode tasks = root.get("tasks");
        if (tasks == null || !tasks.isArray()) {
            throw new IllegalArgumentException("Todo payload requires a tasks array.");
        }
        for (JsonNode task : tasks) {
            if (!task.isObject()) {
                throw new IllegalArgumentException("Each todo task must be an object.");
            }
            if (!task.hasNonNull("id") || task.get("id").asText().isBlank()) {
                throw new IllegalArgumentException("Each todo task requires a non-empty id.");
            }
            if (!task.has("text")) {
                throw new IllegalArgumentException("Each todo task requires text.");
            }
            if (!task.has("done") || !task.get("done").isBoolean()) {
                throw new IllegalArgumentException("Each todo task requires a boolean done field.");
            }
        }
    }

    private void validateSticky(JsonNode root) {
        if (!root.has("text")) {
            throw new IllegalArgumentException("Sticky note requires text.");
        }
        if (root.has("x") && !root.get("x").isNumber()) {
            throw new IllegalArgumentException("Sticky note x must be a number.");
        }
        if (root.has("y") && !root.get("y").isNumber()) {
            throw new IllegalArgumentException("Sticky note y must be a number.");
        }
    }

    private void validateCallout(JsonNode root) {
        if (!root.has("text")) {
            throw new IllegalArgumentException("Callout requires text.");
        }
    }
}
