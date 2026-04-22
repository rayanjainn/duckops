FROM jenkins/jenkins:lts

USER root

# Install DNS lookup tools and other utilities
RUN apt-get update && apt-get install -y dnsutils iproute2 && rm -rf /var/lib/apt/lists/*

# Install Docker CLI (uses host Docker socket via volume mount)
RUN apt-get update && apt-get install -y \
    ca-certificates curl gnupg lsb-release && \
  install -m 0755 -d /etc/apt/keyrings && \
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
  chmod a+r /etc/apt/keyrings/docker.asc && \
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list && \
  apt-get update && apt-get install -y docker-ce-cli && \
  rm -rf /var/lib/apt/lists/*

# Install kubectl
RUN curl -fsSL "https://dl.k8s.io/release/$(curl -sL https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    -o /usr/local/bin/kubectl && \
  chmod +x /usr/local/bin/kubectl

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
  apt-get install -y nodejs && \
  rm -rf /var/lib/apt/lists/*

# Skip setup wizard
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"

# Install Jenkins plugins (configuration-as-code enables global build discarder)
RUN jenkins-plugin-cli --plugins \
  workflow-aggregator \
  git \
  github \
  pipeline-stage-view \
  configuration-as-code \
  build-discarder \
  ws-cleanup

# JCasC config — sets global build discarder (keep 5 builds) to prevent volume bloat
COPY casc_configs /var/jenkins_home/casc_configs
ENV CASC_JENKINS_CONFIG=/var/jenkins_home/casc_configs

# Startup Groovy scripts
COPY disable-csrf.groovy /usr/share/jenkins/ref/init.groovy.d/disable-csrf.groovy
COPY casc_configs/cleanup-workspaces.groovy /usr/share/jenkins/ref/init.groovy.d/cleanup-workspaces.groovy

# Kubeconfig setup script — patches 0.0.0.0 to k3d's Docker network IP at startup
COPY setup-kubeconfig.sh /usr/local/bin/setup-kubeconfig.sh
RUN chmod +x /usr/local/bin/setup-kubeconfig.sh

# Entrypoint wrapper that runs kubeconfig setup then starts Jenkins
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER jenkins
ENTRYPOINT ["/entrypoint.sh"]
