#!/usr/bin/env bash
echo "Copying Payload to Shared volume /mnt/shared/data.yaml..."
echo ${PAYLOAD} | yq eval - -P | yq eval - >> /mnt/shared/data.yaml
echo "Printing contents of shared data.yaml ..."
echo "---------------------------------------------"
yq e /mnt/shared/data.yaml -P
echo "---------------------------------------------"
echo "Done"
