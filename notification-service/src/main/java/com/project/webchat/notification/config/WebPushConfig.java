package com.project.webchat.notification.config;

import lombok.RequiredArgsConstructor;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.security.GeneralSecurityException;
import java.security.PublicKey;
import java.security.Security;

@Configuration
@RequiredArgsConstructor
public class WebPushConfig {

    private final VapidProperties vapidProperties;

    @Bean
    public PushService pushService() throws GeneralSecurityException {
        if (Security.getProvider("BC") == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        PublicKey publicKey = Utils.loadPublicKey(vapidProperties.getPublicKey());
        return new PushService()
                .setSubject(vapidProperties.getSubject())
                .setPublicKey(publicKey)
                .setPrivateKey(Utils.loadPrivateKey(vapidProperties.getPrivateKey()));
    }
}
