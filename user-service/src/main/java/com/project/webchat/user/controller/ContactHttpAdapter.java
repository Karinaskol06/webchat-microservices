package com.project.webchat.user.controller;

import com.project.webchat.shared.dto.ContactRequestCreateDTO;
import com.project.webchat.shared.dto.ContactStatusDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.dto.ContactRequestDTO;
import com.project.webchat.user.dto.IncomingContactRequestDTO;
import com.project.webchat.user.entity.FriendRequest;
import com.project.webchat.user.service.ContactService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HTTP adapter for contact list and contact-prompt routes.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class ContactHttpAdapter {

    private final ContactService contactService;

    @PostMapping("/contacts/requests")
    public ResponseEntity<ContactRequestDTO> createContactRequest(
            @RequestHeader("X-User-Id") Long currentUserId,
            @RequestBody ContactRequestCreateDTO requestDTO) {
        FriendRequest request = contactService.createPendingRequestIfEligible(
                currentUserId, requestDTO.getToUserId());
        if (request == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(ContactRequestDTO.fromEntity(request));
    }

    @PostMapping("/internal/contacts/requests")
    public ResponseEntity<ContactRequestDTO> createContactRequestInternal(
            @RequestBody ContactRequestCreateDTO requestDTO) {
        FriendRequest request = contactService.createPendingRequestIfEligible(
                requestDTO.getFromUserId(), requestDTO.getToUserId());
        if (request == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(ContactRequestDTO.fromEntity(request));
    }

    @GetMapping("/contacts")
    public ResponseEntity<List<UserDTO>> getContacts(
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.getContacts(currentUserId));
    }

    /** One-sided add to current user's contact list (e.g. from profile). */
    @PostMapping("/contacts/{contactUserId}")
    public ResponseEntity<ContactStatusDTO> addContact(
            @PathVariable Long contactUserId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.addDirectContact(currentUserId, contactUserId));
    }

    @DeleteMapping("/contacts/{contactUserId}")
    public ResponseEntity<Void> removeContact(
            @PathVariable Long contactUserId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        contactService.removeContact(currentUserId, contactUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/contacts/requests/incoming")
    public ResponseEntity<List<IncomingContactRequestDTO>> getIncomingRequests(
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.getIncomingPendingRequestViews(currentUserId));
    }

    @PostMapping("/contacts/requests/{id}/accept")
    public ResponseEntity<ContactStatusDTO> acceptRequest(
            @PathVariable("id") Long requestId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.addFromPrompt(requestId, currentUserId));
    }

    /** Same as accept: add other user to my contacts and close my prompt. */
    @PostMapping("/contacts/requests/{id}/add-sender")
    public ResponseEntity<ContactStatusDTO> addSenderContact(
            @PathVariable("id") Long requestId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.addFromPrompt(requestId, currentUserId));
    }

    @PostMapping("/contacts/requests/{id}/decline")
    public ResponseEntity<ContactStatusDTO> declineRequest(
            @PathVariable("id") Long requestId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.dismissPrompt(requestId, currentUserId));
    }

    @GetMapping("/contacts/status/{otherUserId}")
    public ResponseEntity<ContactStatusDTO> getContactStatus(
            @PathVariable Long otherUserId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.getContactStatus(currentUserId, otherUserId));
    }
}
