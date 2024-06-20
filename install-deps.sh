#!/bin/bash

architecture=""
machine=$(uname -m)

case $machine in
  x86_64) architecture="amd64" ;;
  aarch64) architecture="arm64" ;;
  *) echo "$machine Unsupported platform"
esac

echo "Install ejsonkms.."
curl -sLo ejsonkms.tar.gz https://github.com/envato/ejsonkms/releases/download/v0.2.2/ejsonkms_0.2.2_linux_$architecture.tar.gz && \
  tar xfvz ejsonkms.tar.gz &>/dev/null && \
  mv ejsonkms /usr/local/bin/ && \
  chmod +x /usr/local/bin/ejsonkms && \
  rm ejsonkms.tar.gz

echo "Install ejson2env.."
curl -sLo ejson2env.tar.gz https://github.com/Shopify/ejson2env/releases/download/v2.0.6/ejson2env_2.0.6_linux_$architecture.tar.gz && \
  tar xfvz ejson2env.tar.gz &>/dev/null && \
  mv ejson2env /usr/local/bin/ && \
  chmod +x /usr/local/bin/ejson2env && \
  rm ejson2env.tar.gz
