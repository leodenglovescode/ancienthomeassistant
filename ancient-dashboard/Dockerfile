# Multi-platform upstream image: linux/arm64 (Pi 5) and linux/amd64.
# Source commit: 77c998fc988795e6647160bced029f0f750152b4
FROM ghcr.io/leodenglovescode/ancienthomeassistant@sha256:c3aa8fa5f2012779c41114a09ca5275ec2df37c4334b22f48fe02dfb5c12b011

USER root
COPY run.py /addon/run.py
# Supervisor mounts /data owned by root. Prepare a dedicated subdirectory,
# then drop privileges before starting the unchanged upstream application.
ENTRYPOINT ["python", "/addon/run.py"]
CMD []
