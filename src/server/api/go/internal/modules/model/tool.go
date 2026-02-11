package model

import (
	"database/sql/driver"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// Vector is a minimal pgvector-compatible type for GORM schema/migrations.
// It implements sql.Scanner / driver.Valuer so GORM treats it as a scalar column.
//
// Note: The API does not currently read/write embeddings directly; Core owns
// embedding generation and semantic search. This type exists primarily to keep
// the shared DB schema in sync.
type Vector []float32

func (Vector) GormDataType() string {
	return "vector"
}

func (Vector) GormDBDataType(_ *gorm.DB, _ *schema.Field) string {
	dim := strings.TrimSpace(os.Getenv("BLOCK_EMBEDDING_DIM"))
	if dim == "" {
		dim = "1536"
	}
	parsed, err := strconv.Atoi(dim)
	if err != nil || parsed <= 0 {
		dim = "1536"
	}
	return fmt.Sprintf("vector(%s)", dim)
}

func (v Vector) Value() (driver.Value, error) {
	if v == nil {
		return nil, nil
	}
	parts := make([]string, 0, len(v))
	for _, f := range v {
		parts = append(parts, strconv.FormatFloat(float64(f), 'f', -1, 32))
	}
	return fmt.Sprintf("[%s]", strings.Join(parts, ",")), nil
}

func (v *Vector) Scan(value interface{}) error {
	if v == nil {
		return fmt.Errorf("Vector.Scan: nil receiver")
	}
	if value == nil {
		*v = nil
		return nil
	}
	var s string
	switch x := value.(type) {
	case string:
		s = x
	case []byte:
		s = string(x)
	default:
		return fmt.Errorf("Vector.Scan: unsupported type %T", value)
	}
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "[")
	s = strings.TrimSuffix(s, "]")
	if s == "" {
		*v = Vector{}
		return nil
	}
	raw := strings.Split(s, ",")
	out := make([]float32, 0, len(raw))
	for _, part := range raw {
		part = strings.TrimSpace(part)
		f, err := strconv.ParseFloat(part, 32)
		if err != nil {
			return fmt.Errorf("Vector.Scan: parse float: %w", err)
		}
		out = append(out, float32(f))
	}
	*v = out
	return nil
}

type Tool struct {
	ID        uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID  `gorm:"type:uuid;not null;index" json:"project_id"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"user_id"`

	Name        string            `gorm:"type:text;not null;index" json:"name"`
	Description string            `gorm:"type:text;not null;default:''" json:"description"`
	Parameters  datatypes.JSONMap `gorm:"type:jsonb;not null" swaggertype:"object" json:"parameters"`
	Config      datatypes.JSONMap `gorm:"type:jsonb" swaggertype:"object" json:"config"`
	Embedding   Vector            `json:"-"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// Tool <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// Tool <-> User
	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (Tool) TableName() string { return "tools" }
