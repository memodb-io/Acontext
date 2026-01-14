package mq

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/bytedance/sonic"
	"github.com/memodb-io/Acontext/internal/config"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

// injectTraceContext injects trace context into AMQP headers
func injectTraceContext(ctx context.Context, headers amqp.Table) {
	carrier := propagation.MapCarrier{}
	otel.GetTextMapPropagator().Inject(ctx, carrier)
	for k, v := range carrier {
		headers[k] = v
	}
}

// extractTraceContext extracts trace context from AMQP headers
func extractTraceContext(ctx context.Context, headers amqp.Table) context.Context {
	if headers == nil {
		return ctx
	}
	carrier := propagation.MapCarrier{}
	for k, v := range headers {
		if str, ok := v.(string); ok {
			carrier[k] = str
		}
	}
	return otel.GetTextMapPropagator().Extract(ctx, carrier)
}

// DialFunc is a function type for establishing RabbitMQ connections
type DialFunc func() (*amqp.Connection, error)

type Publisher struct {
	conn   *amqp.Connection
	ch     *amqp.Channel
	log    *zap.Logger
	cfg    *config.Config
	dialFn DialFunc
	mu     sync.RWMutex
	closed bool
}

type Consumer struct {
	ch  *amqp.Channel
	q   amqp.Queue
	log *zap.Logger
	cfg *config.Config
}

func NewPublisher(conn *amqp.Connection, log *zap.Logger, cfg *config.Config, dialFn DialFunc) (*Publisher, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}
	if err := ch.Qos(0, 0, false); err != nil {
		return nil, err
	}

	p := &Publisher{
		conn:   conn,
		ch:     ch,
		log:    log,
		cfg:    cfg,
		dialFn: dialFn,
	}

	// Start connection watcher for auto-reconnection
	go p.watchConnection()

	return p, nil
}

// watchConnection monitors the connection and triggers reconnection when closed
func (p *Publisher) watchConnection() {
	for {
		p.mu.RLock()
		if p.closed {
			p.mu.RUnlock()
			return
		}
		conn := p.conn
		p.mu.RUnlock()

		if conn == nil {
			time.Sleep(time.Second)
			continue
		}

		// Wait for connection close notification
		notifyClose := conn.NotifyClose(make(chan *amqp.Error, 1))
		amqpErr := <-notifyClose

		p.mu.RLock()
		if p.closed {
			p.mu.RUnlock()
			return
		}
		p.mu.RUnlock()

		if amqpErr != nil {
			p.log.Warn("RabbitMQ connection closed", zap.Error(amqpErr))
		} else {
			p.log.Warn("RabbitMQ connection closed gracefully")
		}

		// Attempt to reconnect
		p.reconnect()
	}
}

// reconnect attempts to re-establish the RabbitMQ connection with exponential backoff
func (p *Publisher) reconnect() {
	backoff := time.Second
	maxBackoff := 30 * time.Second

	for {
		p.mu.RLock()
		if p.closed {
			p.mu.RUnlock()
			return
		}
		p.mu.RUnlock()

		p.log.Info("Attempting to reconnect to RabbitMQ", zap.Duration("backoff", backoff))

		conn, err := p.dialFn()
		if err != nil {
			p.log.Error("Failed to reconnect to RabbitMQ", zap.Error(err))
			time.Sleep(backoff)
			backoff = min(backoff*2, maxBackoff)
			continue
		}

		ch, err := conn.Channel()
		if err != nil {
			p.log.Error("Failed to create channel after reconnect", zap.Error(err))
			conn.Close()
			time.Sleep(backoff)
			backoff = min(backoff*2, maxBackoff)
			continue
		}

		if err := ch.Qos(0, 0, false); err != nil {
			p.log.Error("Failed to set QoS after reconnect", zap.Error(err))
			ch.Close()
			conn.Close()
			time.Sleep(backoff)
			backoff = min(backoff*2, maxBackoff)
			continue
		}

		p.mu.Lock()
		p.conn = conn
		p.ch = ch
		p.mu.Unlock()

		p.log.Info("Successfully reconnected to RabbitMQ")
		return
	}
}

// getChannel safely returns the current channel
func (p *Publisher) getChannel() (*amqp.Channel, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if p.closed {
		return nil, errors.New("publisher is closed")
	}
	if p.ch == nil {
		return nil, errors.New("channel is not available")
	}
	return p.ch, nil
}

func (p *Publisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.closed = true
	var err error
	if p.ch != nil {
		err = p.ch.Close()
	}
	return err
}

func (p *Publisher) PublishJSON(ctx context.Context, exchangeName string, routingKey string, body any) error {
	b, err := sonic.Marshal(body)
	if err != nil {
		return err
	}

	// Create producer span using semantic conventions
	tracer := otel.Tracer(p.cfg.App.Name)
	ctx, span := tracer.Start(ctx, fmt.Sprintf("%s publish", exchangeName),
		trace.WithSpanKind(trace.SpanKindProducer),
		trace.WithAttributes(
			semconv.MessagingSystemRabbitmq,
			semconv.MessagingDestinationName(exchangeName),
			semconv.MessagingRabbitmqDestinationRoutingKey(routingKey),
			semconv.MessagingOperationPublish,
			semconv.MessagingMessageBodySize(len(b)),
		))
	defer span.End()

	// Inject trace context into message headers
	headers := make(amqp.Table)
	injectTraceContext(ctx, headers)

	publishing := amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
		Body:         b,
		Headers:      headers,
	}

	// Get channel safely
	ch, err := p.getChannel()
	if err != nil {
		span.RecordError(err)
		return fmt.Errorf("failed to get channel: %w", err)
	}

	if err := ch.PublishWithContext(ctx, exchangeName, routingKey, false, false, publishing); err != nil {
		span.RecordError(err)
		return err
	}

	return nil
}

func NewConsumer(conn *amqp.Connection, queueName string, prefetch int, log *zap.Logger, cfg *config.Config) (*Consumer, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}
	if prefetch <= 0 {
		prefetch = 10
	}
	if err := ch.Qos(prefetch, 0, false); err != nil {
		return nil, err
	}
	q, err := ch.QueueDeclare(queueName, true, false, false, false, nil)
	if err != nil {
		return nil, err
	}
	return &Consumer{ch: ch, q: q, log: log, cfg: cfg}, nil
}

func (c *Consumer) Close() error { return c.ch.Close() }

// Handle is a consumption helper function that will Nack and requeue when the handler returns an error.
func (c *Consumer) Handle(ctx context.Context, handler func([]byte) error) error {
	msgs, err := c.ch.Consume(c.q.Name, "", false, false, false, false, nil)
	if err != nil {
		return err
	}

	tracer := otel.Tracer(c.cfg.App.Name)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case m, ok := <-msgs:
			if !ok {
				return errors.New("consumer channel closed")
			}

			c.handleMessage(ctx, m, tracer, handler)
		}
	}
}

// handleMessage processes a single message with tracing
func (c *Consumer) handleMessage(
	ctx context.Context,
	m amqp.Delivery,
	tracer trace.Tracer,
	handler func([]byte) error,
) {
	// Extract trace context from message headers
	msgCtx := extractTraceContext(ctx, m.Headers)

	// Create consumer span using semantic conventions
	_, span := tracer.Start(msgCtx, fmt.Sprintf("%s receive", c.q.Name),
		trace.WithSpanKind(trace.SpanKindConsumer),
		trace.WithAttributes(
			semconv.MessagingSystemRabbitmq,
			semconv.MessagingDestinationName(c.q.Name),
			semconv.MessagingOperationReceive,
			semconv.MessagingMessageBodySize(len(m.Body)),
		))
	defer span.End()

	// Execute handler
	if err := handler(m.Body); err != nil {
		span.RecordError(err)
		_ = m.Nack(false, true) // Processing failed, requeue.
		c.log.Sugar().Errorw("consume error", "err", err)
		return
	}

	_ = m.Ack(false)
}
