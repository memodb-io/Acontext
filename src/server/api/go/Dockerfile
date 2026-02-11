FROM --platform=$BUILDPLATFORM golang:1.25.7 AS build-stage

ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM" 

WORKDIR /app

ARG TARGETOS
ARG TARGETARCH

RUN --mount=target=. \
    --mount=type=cache,target=/root/.cache/go-build \
    --mount=type=cache,target=/go/pkg \
    GOOS=${TARGETOS} GOARCH=${TARGETARCH} CGO_ENABLED=0 go build -o /acontext-api ./cmd/server/main.go

FROM build-stage AS run-test-stage
RUN go test -v ./...

FROM alpine:3.23 AS build-release-stage

WORKDIR /

COPY --from=build-stage /acontext-api /acontext-api
COPY ./configs/config.yaml /configs/config.yaml


# TODO: use non-root user

EXPOSE 8029

ENTRYPOINT ["/acontext-api"]
