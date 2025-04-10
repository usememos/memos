package store

import (
	"context"
	"github.com/segmentio/kafka-go"
	"log"
	"time"
)

var KafkaWriter *kafka.Writer

func InitKafka(brokerAddr, topic string) {
	KafkaWriter = &kafka.Writer{
		Addr:         kafka.TCP(brokerAddr),
		Topic:        topic,
		Balancer:     &kafka.LeastBytes{},
		WriteTimeout: 10 * time.Second,
	}

	log.Println("Kafka writer initialized")
}

func SendKafkaMessage(message string) {
	err := KafkaWriter.WriteMessages(context.Background(), kafka.Message{
		Key:   []byte("key"),
		Value: []byte(message),
	})
	if err != nil {
		log.Printf("failed to write kafka message: %v", err)
	}
}
