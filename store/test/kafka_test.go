package teststore

import (
	"github.com/segmentio/kafka-go"
	"log"
	"testing"
	"time"
)

func TestKafka(t *testing.T) {
	conn, err := kafka.Dial("tcp", "localhost:9092")
	broker := conn.Broker()
	//if err != nil {
	//	log.Println("Error dialing brokers:", err)
	//}
	log.Printf("Brokers %+v", broker)
	if err != nil {
		log.Fatal("❌ 连接 Kafka 失败:", err)
	}
	log.Println("✅ 成功连接到 Kafka!")
	defer conn.Close()

	// 继续跑你的 memos 项目逻辑
	time.Sleep(time.Second * 3)
}
