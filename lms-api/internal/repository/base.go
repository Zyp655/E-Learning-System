package repository

import "gorm.io/gorm"

type BaseRepository[T any] struct {
	db *gorm.DB
}

func NewBaseRepository[T any](db *gorm.DB) *BaseRepository[T] {
	return &BaseRepository[T]{db: db}
}

func (r *BaseRepository[T]) DB() *gorm.DB {
	return r.db
}

func (r *BaseRepository[T]) Create(entity *T) error {
	return r.db.Create(entity).Error
}

func (r *BaseRepository[T]) FindByID(id interface{}) (*T, error) {
	var entity T
	if err := r.db.First(&entity, id).Error; err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *BaseRepository[T]) Update(entity *T) error {
	return r.db.Save(entity).Error
}

func (r *BaseRepository[T]) Delete(id interface{}) error {
	return r.db.Delete(new(T), id).Error
}
