# Adds Docker CLI (talk to host daemon via mounted socket) and kubectl (deploy to Docker Desktop K8s)
FROM jenkins/jenkins:lts-jdk21

USER root

# Update package lists, install tools to add docker apt repo
# Download docker signing keys so apt trusts docker packages
# Add docker apt repo, install CLI only (not a second daemon)
# Clean apt cache
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/debian bookworm stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-buildx-plugin \
    && rm -rf /var/lib/apt/lists/*

# Download kubectl binary so Jenkins can talk to the cluster
ARG KUBECTL_VERSION=v1.31.0
RUN curl -fsSLo /usr/local/bin/kubectl \
        "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    && chmod +x /usr/local/bin/kubectl

# Maven + Node for pipeline test stages (Java 21 image already has a JDK).
RUN apt-get update \
    && apt-get install -y --no-install-recommends maven \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && mvn -version \
    && node -v \
    && npm -v

# Put jenkins user in group docker so it can use the mounted socket (permissions)
RUN groupadd -f docker \
    && usermod -aG docker jenkins

USER jenkins
