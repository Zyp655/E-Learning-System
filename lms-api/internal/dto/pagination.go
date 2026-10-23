package dto

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/gogf/gf/v2/net/ghttp"
	"gorm.io/gorm"
)

type WithinParam struct {
	Name string  `json:"name"`
	From string  `json:"from"`
	To   *string `json:"to,omitempty"`
}

type Filter struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type PaginationDto struct {
	Page         int           `json:"page"`
	Limit        int           `json:"limit"`
	Keyword      string        `json:"keyword"`
	OrderDir     string        `json:"order_dir,omitempty"`
	OrderBy      string        `json:"order_by"`
	Filters      []Filter      `json:"filters,omitempty"`
	CatIDs       []int         `json:"cat_id,omitempty"`
	WithinParams []WithinParam `json:"within_params,omitempty"`
}

func NewPaginationDto(r ghttp.Request) *PaginationDto {
	q := r.Request.URL.Query()
	dto := &PaginationDto{
		Keyword:  q.Get("keyword"),
		OrderBy:  firstNonEmpty(q.Get("order_by"), "id"),
		OrderDir: strings.ToUpper(firstNonEmpty(q.Get("order_dir"), "DESC")),
	}
	if page, err := strconv.Atoi(q.Get("page")); err == nil && page > 0 {
		dto.Page = page
	} else {
		dto.Page = 1
	}
	if limit, err := strconv.Atoi(q.Get("limit")); err == nil && limit > 0 {
		dto.Limit = limit
	} else {
		dto.Limit = 20
	}
	if len(q["filter_names"]) > 0 && len(q["filter_values"]) > 0 {
		filterNames := strings.Split(q.Get("filter_names"), ",")
		filterValues := strings.Split(q.Get("filter_values"), ",")
		for i, name := range filterNames {
			if i < len(filterValues) {
				dto.PushFilter(name, filterValues[i])
			}
		}
	}
	return dto
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func (p *PaginationDto) PushFilter(name, value string) {
	p.Filters = append(p.Filters, Filter{Name: name, Value: value})
}

func (p *PaginationDto) GetValue(name string) (interface{}, bool) {
	for _, f := range p.Filters {
		if f.Name == name {
			var out interface{}
			if err := json.Unmarshal([]byte(f.Value), &out); err == nil {
				return out, true
			}
			return f.Value, true
		}
	}
	return nil, false
}

func BuildWhere(db *gorm.DB, dto PaginationDto, table string, searchFields []string) *gorm.DB {
	for _, filter := range dto.Filters {
		if filter.Name == "" || filter.Value == "" {
			continue
		}
		col := filter.Name
		if !strings.Contains(filter.Name, ".") && table != "" {
			col = fmt.Sprintf("%s.%s", table, filter.Name)
		}
		db = db.Where(fmt.Sprintf("%s = ?", col), filter.Value)
	}

	keyword := strings.TrimSpace(dto.Keyword)
	if keyword != "" && len(searchFields) > 0 {
		keyword = strings.ToLower(keyword)
		var clauses []string
		var args []interface{}
		for _, field := range searchFields {
			col := field
			if !strings.Contains(field, ".") && table != "" {
				col = fmt.Sprintf("%s.%s", table, field)
			}
			clauses = append(clauses, fmt.Sprintf("LOWER(%s) LIKE ?", col))
			args = append(args, "%"+keyword+"%")
		}
		db = db.Where("("+strings.Join(clauses, " OR ")+")", args...)
	}

	for _, param := range dto.WithinParams {
		if param.Name == "" || param.From == "" {
			continue
		}
		col := param.Name
		if !strings.Contains(param.Name, ".") && table != "" {
			col = fmt.Sprintf("%s.%s", table, param.Name)
		}
		if param.To != nil {
			db = db.Where(fmt.Sprintf("%s BETWEEN ? AND ?", col), param.From, *param.To)
		} else {
			db = db.Where(fmt.Sprintf("%s >= ?", col), param.From)
		}
	}

	orderDir := strings.ToUpper(dto.OrderDir)
	if orderDir != "ASC" && orderDir != "DESC" {
		orderDir = "DESC"
	}
	orderBy := dto.OrderBy
	if orderBy == "" {
		orderBy = "id"
	}
	if !strings.Contains(orderBy, ".") && table != "" {
		orderBy = fmt.Sprintf("%s.%s", table, orderBy)
	}
	db = db.Order(fmt.Sprintf("%s %s", orderBy, orderDir))
	return db
}

func Paginate(page, limit int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if page <= 0 {
			page = 1
		}
		if limit <= 0 {
			limit = 20
		}
		offset := (page - 1) * limit
		return db.Offset(offset).Limit(limit)
	}
}
