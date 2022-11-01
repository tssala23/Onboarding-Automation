#!/usr/bin/env bash
echo "Copying Payload to Shared volume /mnt/shared/data.yaml..."
echo $(params.PAYLOAD) >> /mnt/shared/data.yaml
echo "Printing contents of shared data.yaml ..."
cat /mnt/shared/data.yaml
