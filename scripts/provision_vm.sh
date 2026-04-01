#!/bin/bash

GITHUB_RUNNER_TOKEN="${1}"

function main() {
    update_and_upgrade_packages
    enable_firewall
    install_docker_compose
    create_self_hosted_runner
}

function upgrade_packages() {
    echo "[INFO] Upgrading system packages..."
    apt update && apt upgrade -y -o Dpkg::Options::="--force-confold"
}

function enable_firewall() {
    echo "[INFO] Only allowing SSH connections on port 22 intially.."
    ufw allow ssh && ufw --force enable
}

function install_docker_compose() {
    echo "[INFO] Installing docker (compose).."
    mkdir -p /etc/apt/keyrings && chmod 0755 /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update
    apt-cache policy docker-ce
    apt install docker-ce -y
}

function create_self_hosted_runner() {
    adduser --disabled-password --gecos "" github
    usermod -aG docker github

    su - github

    mkdir actions-runner && cd actions-runner
    curl -o actions-runner-linux-x64-2.333.1.tar.gz -L https://github.com/actions/runner/releases/download/v2.333.1/actions-runner-linux-x64-2.333.1.tar.gz
    tar xzf ./actions-runner-linux-x64-2.333.1.tar.gz
    ./config.sh --url https://github.com/radodim/drone-grid --token "${GITHUB_RUNNER_TOKEN}" --unattended

    exit && cd /home/github/actions-runner

    bash svc.sh install github
    bash svc.sh start
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi
