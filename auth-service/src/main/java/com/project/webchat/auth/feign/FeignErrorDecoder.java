package com.project.webchat.auth.feign;

import feign.FeignException;
import feign.Response;
import feign.codec.ErrorDecoder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

@Component
public class FeignErrorDecoder implements ErrorDecoder {

    private final ErrorDecoder defaultErrorDecoder = new Default();

    @Override
    public Exception decode(String methodKey, Response response) {
        String responseBody = "";
        if (response.body() != null) {
            try {
                responseBody = new String(response.body().asInputStream().readAllBytes(), StandardCharsets.UTF_8);
            } catch (Exception e) {
                responseBody = "Unable to read response body";
            }
        }

        FeignException exception = FeignException.errorStatus(methodKey, response);

        switch (response.status()) {
            case 400:
                return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Bad Request from user-service"
                + responseBody, exception);
                case 404:
                    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Resource Not Found" +
                            responseBody, exception);
                    case 500:
                        return new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                "Internal Server Error", exception);
                        default:
                            return defaultErrorDecoder.decode(methodKey, response);
        }
    }
}
