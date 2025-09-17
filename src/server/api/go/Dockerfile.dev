FROM golang:1.25 AS build-stage

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 go build -o /acontext-api ./cmd/server/main.go

FROM build-stage AS run-test-stage
RUN go test -v ./...

FROM gcr.io/distroless/static-debian12 AS build-release-stage

WORKDIR /

COPY --from=build-stage /acontext-api /acontext-api
COPY ./configs/config.yaml /configs/config.yaml 

EXPOSE 8029

USER nonroot:nonroot

ENTRYPOINT ["/acontext-api"]