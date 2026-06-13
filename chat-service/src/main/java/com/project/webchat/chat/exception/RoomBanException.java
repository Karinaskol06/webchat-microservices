package com.project.webchat.chat.exception;

import com.project.webchat.chat.entity.ChatType;
import lombok.Getter;

@Getter
public class RoomBanException extends RuntimeException {

    public static final String CODE = "ROOM_BANNED";

    private final String roomName;
    private final String roomType;

    public RoomBanException(ChatType roomType, String roomName) {
        super(buildMessage(roomType, roomName));
        this.roomType = roomType != null ? roomType.name() : "ROOM";
        this.roomName = roomName != null && !roomName.isBlank() ? roomName.trim() : "this room";
    }

    private static String buildMessage(ChatType roomType, String roomName) {
        String label = roomType == ChatType.CHANNEL ? "channel" : "group";
        String name = roomName != null && !roomName.isBlank() ? roomName.trim() : "this room";
        return "You have been banned from the " + label + " \"" + name + "\".";
    }
}
