package mq

import (
	"context"
	"github.com/segmentio/kafka-go"
	log "github.com/sirupsen/logrus"
)

// 生产者发送消息到 Kafka
func SendMessage(writer *kafka.Writer, message string) error {
	err := writer.WriteMessages(context.Background(),
		kafka.Message{
			Value: []byte(message),
		},
	)
	if err != nil {
		log.Error("Error sending message to Kafka: %v", err)
		return err
	}
	log.Debugf("Message sent: %s", message)
	return nil
}
