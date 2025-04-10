package mq

import (
	"context"
	"github.com/segmentio/kafka-go"
	log "github.com/sirupsen/logrus"
)

// 配置 Kafka 连接的函数
func NewKafkaWriter(address, topic string) *kafka.Writer {
	return &kafka.Writer{
		Addr:     kafka.TCP(address),  // Kafka 服务地址
		Topic:    topic,               // 主题名称
		Balancer: &kafka.LeastBytes{}, // 消息分发策略
	}
}

func NewKafkaReader(brokers []string, groupID, topic string) *kafka.Reader {
	return kafka.NewReader(kafka.ReaderConfig{
		Brokers:  []string{"localhost:9092"},
		GroupID:  groupID,
		Topic:    topic,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})
}

func InitKafkaConsumer(brokers []string, groupID, topic string) {

	reader := NewKafkaReader(brokers, groupID, topic)
	// 启动消费者协程，确保在后台消费消息
	go func() {
		for {
			msg, err := reader.ReadMessage(context.Background())
			if err != nil {
				log.Error("Error reading message", err)
				continue // 继续处理下一个消息，或退出根据你的需求
			}
			log.Debug("收到消息: ", string(msg.Value))

			// 处理收到的消息
			// 根据需求处理业务逻辑，如触发某些事件、调用其他服务等
			// 例如：
			// someFunction(msg.Value)
		}
	}()

	// 如果需要根据某些条件退出，可以使用 select 来等待退出信号
	//select {
	//case <-time.After(time.Hour): // 或者其他退出条件
	//	log.Info("Kafka consumer finished after timeout")
	//	return
	//}
}
