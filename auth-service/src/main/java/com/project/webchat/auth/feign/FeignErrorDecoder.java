package com.project.webchat.auth.feign;

import feign.Response;
import feign.codec.ErrorDecoder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
public class FeignErrorDecoder implements ErrorDecoder {

    @Override
    public Exception decode(String methodKey, Response response) {
        log.error("Error occurred while calling API. Method: {}, Status: {}",
                methodKey, response.status());

        switch (response.status()) {
            case 400:
                return new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Bad request to user service");
            case 401:
                return new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Unauthorized access to user service");
            case 403:
                return new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Forbidden access to user service");
            case 404:
                return new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Resource not found in user service");
            case 500:
                return new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Internal server error in user service");
            default:
                return new ResponseStatusException(HttpStatus.valueOf(response.status()),
                        "Error calling user service");
        }
    }
}