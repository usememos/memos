package mq

import (
	"context"
	"github.com/segmentio/kafka-go"
	log "github.com/sirupsen/logrus"
)

// 消费者从 Kafka 消息队列中消费消息
func StartConsumer(reader *kafka.Reader, processMessage func(message string)) {
	for {
		msg, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Error("Error reading message: %v", err)
		}
		log.Debugf("Consumed message: %s", string(msg.Value))
		processMessage(string(msg.Value)) // 处理消息
	}
}
