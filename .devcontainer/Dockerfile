FROM ubuntu:22.04

ARG USERNAME=dev
ARG UID=1000
ARG GID=1000

# basic setup
RUN groupadd --gid $GID $USERNAME && \
    useradd --uid $UID --gid $GID -m $USERNAME && \
    apt-get update && apt-get install -y sudo curl git make gcc && \
    echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME && \
    chmod 0440 /etc/sudoers.d/$USERNAME

# install Go
RUN curl -OL https://go.dev/dl/go1.22.2.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.22.2.linux-amd64.tar.gz && \
    rm go1.22.2.linux-amd64.tar.gz

# install Node.js + pnpm
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm

# set paths
ENV PATH="/usr/local/go/bin:${PATH}"
RUN echo 'export PATH=$PATH:/usr/local/go/bin' >> /home/${USERNAME}/.bashrc

USER ${USERNAME}
WORKDIR /workspaces/memos
