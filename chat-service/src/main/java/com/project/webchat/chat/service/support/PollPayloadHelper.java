package com.project.webchat.chat.service.support;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.project.webchat.chat.entity.MessageType;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class PollPayloadHelper {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public void validatePollPayload(JsonNode root) {
        if (!root.hasNonNull("question") || root.get("question").asText().isBlank()) {
            throw new IllegalArgumentException("Poll requires a non-empty question.");
        }
        if (root.has("pollId") && !root.get("pollId").isTextual()) {
            throw new IllegalArgumentException("Poll pollId must be a string when present.");
        }
        if (root.has("pollId") && root.get("pollId").asText().isBlank()) {
            throw new IllegalArgumentException("Poll pollId cannot be blank.");
        }
        String mode = root.has("mode") ? root.get("mode").asText("poll") : "poll";
        if (root.has("anonymous") && !root.get("anonymous").isBoolean()) {
            throw new IllegalArgumentException("Poll anonymous must be a boolean.");
        }
        if (root.has("multipleChoice") && !root.get("multipleChoice").isBoolean()) {
            throw new IllegalArgumentException("Poll multipleChoice must be a boolean.");
        }
        if (root.has("maxAttempts")) {
            if (!root.get("maxAttempts").isInt() || root.get("maxAttempts").asInt() < 1) {
                throw new IllegalArgumentException("Poll maxAttempts must be at least 1.");
            }
        }
        if (root.has("showCorrectAfterAnswer") && !root.get("showCorrectAfterAnswer").isBoolean()) {
            throw new IllegalArgumentException("Poll showCorrectAfterAnswer must be a boolean.");
        }
        JsonNode options = root.get("options");
        if (options == null || !options.isArray() || options.size() < 2) {
            throw new IllegalArgumentException("Poll requires at least two options.");
        }
        Set<String> optionIds = new HashSet<>();
        boolean anyCorrect = false;
        for (JsonNode option : options) {
            if (!option.isObject()) {
                throw new IllegalArgumentException("Each poll option must be an object.");
            }
            if (!option.hasNonNull("id") || option.get("id").asText().isBlank()) {
                throw new IllegalArgumentException("Each poll option requires a non-empty id.");
            }
            String id = option.get("id").asText();
            if (!optionIds.add(id)) {
                throw new IllegalArgumentException("Poll option ids must be unique.");
            }
            if (!option.has("text")) {
                throw new IllegalArgumentException("Each poll option requires text.");
            }
            if ("test".equals(mode)) {
                if (!option.has("correct") || !option.get("correct").isBoolean()) {
                    throw new IllegalArgumentException("Test options require a boolean correct field.");
                }
                if (option.get("correct").asBoolean()) {
                    anyCorrect = true;
                }
            } else if (option.has("correct") && !option.get("correct").isBoolean()) {
                throw new IllegalArgumentException("Poll option correct must be a boolean when present.");
            }
        }
        if ("test".equals(mode) && !anyCorrect) {
            throw new IllegalArgumentException("Test requires at least one correct option.");
        }
        JsonNode votes = root.get("votes");
        if (votes != null && !votes.isObject()) {
            throw new IllegalArgumentException("Poll votes must be an object.");
        }
    }

    public String ensurePollId(String content, String fallbackId) {
        try {
            ObjectNode root = (ObjectNode) MAPPER.readTree(content);
            if (root.hasNonNull("pollId") && !root.get("pollId").asText().isBlank()) {
                return MAPPER.writeValueAsString(root);
            }
            String pollId = fallbackId != null && !fallbackId.isBlank()
                    ? fallbackId.trim()
                    : UUID.randomUUID().toString();
            root.put("pollId", pollId);
            if (!root.has("votes") || !root.get("votes").isObject()) {
                root.set("votes", MAPPER.createObjectNode());
            }
            return MAPPER.writeValueAsString(root);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid poll payload.");
        }
    }

    public String extractPollId(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        try {
            JsonNode root = MAPPER.readTree(content);
            if (root.hasNonNull("pollId") && root.get("pollId").isTextual()) {
                String pollId = root.get("pollId").asText().trim();
                return pollId.isEmpty() ? null : pollId;
            }
        } catch (Exception ignored) {
            return null;
        }
        return null;
    }

    public int countVotes(String content) {
        try {
            JsonNode votes = MAPPER.readTree(content).get("votes");
            if (votes == null || !votes.isObject()) {
                return 0;
            }
            return votes.size();
        } catch (Exception e) {
            return 0;
        }
    }

    public String mergeVotesFrom(String targetContent, String sourceContent) {
        try {
            ObjectNode target = (ObjectNode) MAPPER.readTree(targetContent);
            JsonNode sourceVotes = MAPPER.readTree(sourceContent).get("votes");
            if (sourceVotes != null && sourceVotes.isObject()) {
                target.set("votes", sourceVotes.deepCopy());
            }
            return MAPPER.writeValueAsString(target);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid poll payload.");
        }
    }

    public String resetVotes(String content) {
        try {
            JsonNode root = MAPPER.readTree(content);
            if (!root.isObject()) {
                return content;
            }
            ObjectNode copy = root.deepCopy();
            copy.set("votes", MAPPER.createObjectNode());
            return MAPPER.writeValueAsString(copy);
        } catch (Exception e) {
            return content;
        }
    }

    public String applyVote(String content, Long userId, String voterName, List<String> optionIds) {
        try {
            ObjectNode root = (ObjectNode) MAPPER.readTree(content);
            validateVoteAgainstPayload(root, optionIds);

            String mode = root.has("mode") ? root.get("mode").asText("poll") : "poll";
            boolean multipleChoice = root.has("multipleChoice") && root.get("multipleChoice").asBoolean();
            int maxAttempts = root.has("maxAttempts") ? root.get("maxAttempts").asInt(1) : 1;

            ObjectNode votes = root.has("votes") && root.get("votes").isObject()
                    ? (ObjectNode) root.get("votes")
                    : MAPPER.createObjectNode();
            root.set("votes", votes);

            String userKey = String.valueOf(userId);
            ObjectNode existing = votes.has(userKey) && votes.get(userKey).isObject()
                    ? (ObjectNode) votes.get(userKey)
                    : null;

            if ("test".equals(mode)) {
                if (existing != null && existing.has("completed") && existing.get("completed").asBoolean()) {
                    throw new IllegalArgumentException("You have already completed this test.");
                }
                int attempts = existing != null && existing.has("attempts")
                        ? existing.get("attempts").asInt(0) + 1
                        : 1;
                boolean correct = evaluateTestAnswer(root, optionIds, multipleChoice);
                boolean completed = correct || attempts >= maxAttempts;

                ObjectNode voteNode = MAPPER.createObjectNode();
                ArrayNode selected = voteNode.putArray("optionIds");
                optionIds.forEach(selected::add);
                voteNode.put("name", voterName != null ? voterName : "");
                voteNode.put("attempts", attempts);
                voteNode.put("completed", completed);
                voteNode.put("lastCorrect", correct);

                ArrayNode history = existing != null && existing.has("history") && existing.get("history").isArray()
                        ? (ArrayNode) existing.get("history").deepCopy()
                        : MAPPER.createArrayNode();
                ObjectNode attemptRecord = MAPPER.createObjectNode();
                ArrayNode attemptOptions = attemptRecord.putArray("optionIds");
                optionIds.forEach(attemptOptions::add);
                attemptRecord.put("correct", correct);
                attemptRecord.put("at", Instant.now().toString());
                history.add(attemptRecord);
                voteNode.set("history", history);

                votes.set(userKey, voteNode);
            } else {
                ObjectNode voteNode = MAPPER.createObjectNode();
                ArrayNode selected = voteNode.putArray("optionIds");
                optionIds.forEach(selected::add);
                voteNode.put("name", voterName != null ? voterName : "");
                voteNode.put("attempts", 1);
                voteNode.put("completed", true);
                votes.set(userKey, voteNode);
            }

            return MAPPER.writeValueAsString(root);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid poll payload.");
        }
    }

    private void validateVoteAgainstPayload(ObjectNode root, List<String> optionIds) {
        if (optionIds == null || optionIds.isEmpty()) {
            throw new IllegalArgumentException("Select at least one option.");
        }
        boolean multipleChoice = root.has("multipleChoice") && root.get("multipleChoice").asBoolean();
        if (!multipleChoice && optionIds.size() > 1) {
            throw new IllegalArgumentException("This poll allows only one choice.");
        }
        Set<String> validIds = new HashSet<>();
        JsonNode options = root.get("options");
        if (options != null && options.isArray()) {
            for (JsonNode option : options) {
                if (option.has("id")) {
                    validIds.add(option.get("id").asText());
                }
            }
        }
        for (String optionId : optionIds) {
            if (optionId == null || optionId.isBlank() || !validIds.contains(optionId)) {
                throw new IllegalArgumentException("Invalid poll option selected.");
            }
        }
    }

    private boolean evaluateTestAnswer(ObjectNode root, List<String> optionIds, boolean multipleChoice) {
        List<String> correctIds = new ArrayList<>();
        JsonNode options = root.get("options");
        if (options != null && options.isArray()) {
            for (JsonNode option : options) {
                if (option.has("correct") && option.get("correct").asBoolean() && option.has("id")) {
                    correctIds.add(option.get("id").asText());
                }
            }
        }
        correctIds.sort(Comparator.naturalOrder());
        List<String> selected = new ArrayList<>(optionIds);
        selected.sort(Comparator.naturalOrder());

        if (multipleChoice) {
            return correctIds.equals(selected);
        }
        return selected.size() == 1 && correctIds.contains(selected.getFirst());
    }

    public static boolean isPollMessageType(MessageType type) {
        return type == MessageType.POLL;
    }
}
