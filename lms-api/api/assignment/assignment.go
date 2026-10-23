package assignment

import (
	"context"

	v1 "github.com/hieu/lms-confusion/lms-api/api/assignment/v1"
)

type IAssignmentV1 interface {
	ListAssignments(ctx context.Context, req *v1.ListAssignmentsReq) (res *v1.ListAssignmentsRes, err error)
	CreateAssignment(ctx context.Context, req *v1.CreateAssignmentReq) (res *v1.CreateAssignmentRes, err error)
	UpdateAssignment(ctx context.Context, req *v1.UpdateAssignmentReq) (res *v1.UpdateAssignmentRes, err error)
	DeleteAssignment(ctx context.Context, req *v1.DeleteAssignmentReq) (res *v1.DeleteAssignmentRes, err error)
	ListStudentSubmissions(ctx context.Context, req *v1.ListStudentSubmissionsReq) (res *v1.ListStudentSubmissionsRes, err error)
	CreateSubmission(ctx context.Context, req *v1.CreateSubmissionReq) (res *v1.CreateSubmissionRes, err error)
	ManualGradeSubmission(ctx context.Context, req *v1.ManualGradeSubmissionReq) (res *v1.ManualGradeSubmissionRes, err error)
	AutoGradeSubmission(ctx context.Context, req *v1.AutoGradeSubmissionReq) (res *v1.AutoGradeSubmissionRes, err error)
	ListTasks(ctx context.Context, req *v1.ListTasksReq) (res *v1.ListTasksRes, err error)
	CreateTask(ctx context.Context, req *v1.CreateTaskReq) (res *v1.CreateTaskRes, err error)
	UpdateTask(ctx context.Context, req *v1.UpdateTaskReq) (res *v1.UpdateTaskRes, err error)
	DeleteTask(ctx context.Context, req *v1.DeleteTaskReq) (res *v1.DeleteTaskRes, err error)
}
