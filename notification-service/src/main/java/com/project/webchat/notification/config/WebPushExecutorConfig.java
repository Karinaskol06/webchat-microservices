package com.project.webchat.notification.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class WebPushExecutorConfig {

    @Bean(destroyMethod = "shutdown")
    public ExecutorService webPushExecutor() {
        return Executors.newFixedThreadPool(
                Math.max(4, Runtime.getRuntime().availableProcessors()),
                runnable -> {
                    Thread thread = new Thread(runnable, "web-push-delivery");
                    thread.setDaemon(true);
                    return thread;
                });
    }
}
