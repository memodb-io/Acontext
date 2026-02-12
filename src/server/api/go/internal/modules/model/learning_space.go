package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type LearningSpace struct {
	ID        uuid.UUID         `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID uuid.UUID         `gorm:"type:uuid;not null;index" json:"-"`
	UserID    *uuid.UUID        `gorm:"type:uuid;index" json:"user_id"`
	Meta      datatypes.JSONMap `gorm:"type:jsonb;index:idx_ls_meta,type:gin" swaggertype:"object" json:"meta"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// LearningSpace <-> Project
	Project *Project `gorm:"foreignKey:ProjectID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// LearningSpace <-> User
	User *User `gorm:"foreignKey:UserID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (LearningSpace) TableName() string { return "learning_spaces" }

type LearningSpaceSkill struct {
	ID              uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	LearningSpaceID uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_ls_skill_unique" json:"learning_space_id"`
	SkillID         uuid.UUID `gorm:"type:uuid;not null;index;uniqueIndex:idx_ls_skill_unique" json:"skill_id"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`

	// LearningSpaceSkill <-> LearningSpace
	LearningSpace *LearningSpace `gorm:"foreignKey:LearningSpaceID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// LearningSpaceSkill <-> AgentSkills
	Skill *AgentSkills `gorm:"foreignKey:SkillID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (LearningSpaceSkill) TableName() string { return "learning_space_skills" }

type LearningSpaceSession struct {
	ID              uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	LearningSpaceID uuid.UUID `gorm:"type:uuid;not null;index" json:"learning_space_id"`
	SessionID       uuid.UUID `gorm:"type:uuid;not null;uniqueIndex" json:"session_id"`
	Status          string    `gorm:"type:text;not null;default:'pending'" json:"status"`

	CreatedAt time.Time `gorm:"autoCreateTime;not null;default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;not null;default:CURRENT_TIMESTAMP" json:"updated_at"`

	// LearningSpaceSession <-> LearningSpace
	LearningSpace *LearningSpace `gorm:"foreignKey:LearningSpaceID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`

	// LearningSpaceSession <-> Session
	Session *Session `gorm:"foreignKey:SessionID;references:ID;constraint:OnDelete:CASCADE,OnUpdate:CASCADE;" json:"-"`
}

func (LearningSpaceSession) TableName() string { return "learning_space_sessions" }
