package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
)

// Memo holds the schema definition for the Memo entity.
type Memo struct {
	ent.Schema
}

// Fields of the Memo.
func (Memo) Fields() []ent.Field {
	return []ent.Field{
		field.Int("id").Positive(),
		field.String("resource_name").MaxLen(256).NotEmpty().Unique(),
		field.Int("creator_id").Positive(),
		field.Time("created_ts"),
		field.Time("updated_ts"),
		field.String("row_status").MaxLen(256).NotEmpty(),
		field.Text("content").Default(""),
		field.String("visibility").MaxLen(256).NotEmpty(),
	}
}

// Edges of the Memo.
func (Memo) Edges() []ent.Edge {
	return []ent.Edge{
		edge.To("related_memo", Memo.Type).
			Through("memo_relation", MemoRelation.Type),
	}
}
