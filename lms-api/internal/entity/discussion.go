package entity

import "time"

type Comment struct {
	BaseEntity
	CourseID          int64     `json:"courseId" gorm:"index"`
	LessonID          int64     `json:"lessonId" gorm:"index;not null"`
	UserID            int64     `json:"userId" gorm:"index;not null"`
	User              *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
	ParentID          int64     `json:"parentId" gorm:"index;default:0"`
	Path              string    `json:"path" gorm:"type:varchar(255);index"` // Materialized Path e.g. "000001/000005"
	Depth             int       `json:"depth" gorm:"not null;default:0"`
	Content           string    `json:"content" gorm:"type:text;not null"`
	VideoTimestamp    int       `json:"videoTimestamp" gorm:"default:0"`
	Upvotes           int       `json:"upvotes" gorm:"not null;default:0"`
	Downvotes         int       `json:"downvotes" gorm:"not null;default:0"`
	UpvoteCount       int       `json:"upvoteCount" gorm:"not null;default:0"`
	DownvoteCount     int       `json:"downvoteCount" gorm:"not null;default:0"`
	IsPinned          bool      `json:"isPinned" gorm:"not null;default:false"`
	IsResolved        bool      `json:"isResolved" gorm:"not null;default:false"`
	IsAnswered        bool      `json:"isAnswered" gorm:"not null;default:false"`
	IsTeacherResponse bool      `json:"isTeacherResponse" gorm:"not null;default:false"`
	Replies           []Comment `json:"replies,omitempty" gorm:"-"`
}

func (Comment) TableName() string { return "comments" }

type CommentVote struct {
	BaseEntity
	CommentID int64 `json:"commentId" gorm:"index:idx_comment_user_vote,unique;not null"`
	UserID    int64 `json:"userId" gorm:"index:idx_comment_user_vote,unique;not null"`
	VoteType  int   `json:"voteType" gorm:"not null;default:1"` // 1 = up, -1 = down
}

func (CommentVote) TableName() string { return "comment_votes" }

type CommentMention struct {
	BaseEntity
	CommentID       int64 `json:"commentId" gorm:"index;not null"`
	MentionedUserID int64 `json:"mentionedUserId" gorm:"index;not null"`
	IsRead          bool  `json:"isRead" gorm:"not null;default:false"`
}

func (CommentMention) TableName() string { return "comment_mentions" }

type ChatConversation struct {
	BaseEntity
	UserOneID       int64         `json:"userOneId" gorm:"column:user_one_id;index;not null"`
	UserOne         *User         `json:"userOne,omitempty" gorm:"foreignKey:UserOneID"`
	UserTwoID       int64         `json:"userTwoId" gorm:"column:user_two_id;index;not null"`
	UserTwo         *User         `json:"userTwo,omitempty" gorm:"foreignKey:UserTwoID"`
	CourseID        int64         `json:"courseId" gorm:"index"`
	LastMessageText string        `json:"lastMessageText" gorm:"type:text"`
	LastMessageAt   *time.Time    `json:"lastMessageAt"`
	Messages        []ChatMessage `json:"messages,omitempty" gorm:"foreignKey:ConversationID"`
}

func (ChatConversation) TableName() string { return "chat_conversations" }

type ChatMessage struct {
	BaseEntity
	ConversationID int64  `json:"conversationId" gorm:"index;not null"`
	SenderID       int64  `json:"senderId" gorm:"index;not null"`
	Sender         *User  `json:"sender,omitempty" gorm:"foreignKey:SenderID"`
	Content        string `json:"content" gorm:"type:text;not null"`
	MessageType    string `json:"messageType" gorm:"type:varchar(32);default:'text'"`
	AttachmentURL  string `json:"attachmentUrl" gorm:"column:attachment_url;type:text"`
	IsRead         bool   `json:"isRead" gorm:"not null;default:false"`
}

func (ChatMessage) TableName() string { return "chat_messages" }

type TutorChatMessage struct {
	BaseEntity
	UserID         int64  `json:"userId" gorm:"index;not null"`
	CourseID       int64  `json:"courseId" gorm:"index"`
	LessonID       int64  `json:"lessonId" gorm:"index;not null"`
	Persona        string `json:"persona" gorm:"type:varchar(32);default:'coach'"` // socrates | coach | expert
	Role           string `json:"role" gorm:"type:varchar(32);not null"`           // user | assistant
	Content        string `json:"content" gorm:"type:text;not null"`
	VideoTimestamp int    `json:"videoTimestamp" gorm:"default:0"`
	CitationsJSON  string `json:"citationsJson" gorm:"column:citations_json;type:text"`
	HasImage       bool   `json:"hasImage" gorm:"default:false"`
}

func (TutorChatMessage) TableName() string { return "tutor_chat_messages" }
