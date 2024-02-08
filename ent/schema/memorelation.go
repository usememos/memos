package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// MemoRelation holds the schema definition for the MemoRelation entity.
type MemoRelation struct {
	ent.Schema
}

// Fields of the MemoRelation.
func (MemoRelation) Fields() []ent.Field {
	return []ent.Field{
		field.String("type"),
		field.Int("memo_id"),
		field.Int("related_memo_id"),
	}
}

// Edges of the MemoRelation.
func (MemoRelation) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("memo", Memo.Type).
			Required().
			Unique().
			Field("memo_id"),
		edge.To("related_memo", Memo.Type).
			Required().
			Unique().
			Field("related_memo_id"),
	}
}
