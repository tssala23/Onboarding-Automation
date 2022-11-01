#!/usr/bin/env bash
echo "Copying Payload to Shared volume ${WORKING_DIR}/data.yaml..."
echo ${PAYLOAD} | yq eval - -P | yq eval - >> ${WORKING_DIR}/data.yaml
echo "Printing contents of shared data.yaml ..."
echo "---------------------------------------------"
yq e ${WORKING_DIR}/data.yaml -P
echo "---------------------------------------------"
echo "Done"
