package mq

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

type Publisher struct {
	ch  *amqp.Channel
	log *zap.Logger
}

type Consumer struct {
	ch  *amqp.Channel
	q   amqp.Queue
	log *zap.Logger
}

func NewPublisher(conn *amqp.Connection, log *zap.Logger) (*Publisher, error) {
	ch, err := conn.Channel()
	if err != nil {
		return nil, err
	}
	if err := ch.Qos(0, 0, false); err != nil {
		return nil, err
	}
	return &Publisher{ch: ch, log: log}, nil
}

func (p *Publisher) Close() error { return p.ch.Close() }

func (p *Publisher) PublishJSON(ctx context.Context, exchangeName string, routingKey string, body any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	return p.ch.PublishWithContext(ctx, exchangeName, routingKey, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    time.Now(),
		Body:         b,
	})
}

func NewConsumer(conn *amqp.Connection, queueName string, prefetch int, log *zap.Logger) (*Consumer, error) {
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
	return &Consumer{ch: ch, q: q, log: log}, nil
}

func (c *Consumer) Close() error { return c.ch.Close() }

// Handle is a consumption helper function that will Nack and requeue when the handler returns an error.
func (c *Consumer) Handle(ctx context.Context, handler func([]byte) error) error {
	msgs, err := c.ch.Consume(c.q.Name, "", false, false, false, false, nil)
	if err != nil {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case m, ok := <-msgs:
			if !ok {
				return errors.New("consumer channel closed")
			}
			if err := handler(m.Body); err != nil {
				_ = m.Nack(false, true) // Processing failed, requeue.
				c.log.Sugar().Errorw("consume error", "err", err)
				continue
			}
			_ = m.Ack(false)
		}
	}
}
