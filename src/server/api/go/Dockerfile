FROM scratch
ARG TARGETPLATFORM
COPY $TARGETPLATFORM/acontext-api /acontext-api
COPY ./configs/config.yaml /configs/config.yaml 
ENTRYPOINT ["/acontext-api"]