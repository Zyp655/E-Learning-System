package postgres

import (
	"errors"
	"log"
	"time"

	"github.com/hieu/lms-confusion/lms-api/internal/entity"
	"github.com/hieu/lms-confusion/lms-api/utility/helper"
	"gorm.io/gorm"
)

func (d *Database) Seed(password string) error {
	if d == nil || d.Connection == nil {
		return nil
	}
	return SeedDatabase(d.Connection, password)
}

// SeedDatabase inserts the demo dataset into an empty database. Every seeded account uses password; callers
// obtain it from config.DemoSeedPlan, which refuses weak passwords outside local development.
func SeedDatabase(db *gorm.DB, password string) error {
	if db == nil {
		return nil
	}
	if password == "" {
		return errors.New("SeedDatabase: empty demo password")
	}

	var userCount int64
	db.Model(&entity.User{}).Count(&userCount)
	if userCount > 0 {
		return nil
	}

	log.Println("Seeding comprehensive LMS Confusion & AI Tutor demo dataset...")

	// 1. Confusion Settings
	setting := entity.ConfusionSetting{
		MLThreshold:             0.60,
		RuleThreshold:           35.0,
		SlidingWindowSize:       3,
		CooldownSeconds:         300,
		FaceSimilarityThreshold: 0.55,
		MaxAbsentChecks:         6,
	}
	db.Create(&setting)

	// 2. Departments, Majors, Semesters
	deptIT := entity.Department{
		Name:        "Khoa Công nghệ Thông tin",
		Code:        "CNTT",
		Description: "Đào tạo Kỹ sư Trí tuệ nhân tạo, Thị giác máy tính và Kỹ thuật phần mềm",
		DeanName:    "PGS.TS. Trần Quang Minh",
		IsActive:    true,
	}
	deptEE := entity.Department{
		Name:        "Khoa Điện tử Viễn thông",
		Code:        "DTVT",
		Description: "Đào tạo Hệ thống nhúng, IoT và Mạng viễn thông",
		DeanName:    "TS. Lê Văn Hùng",
		IsActive:    true,
	}
	db.Create(&deptIT)
	db.Create(&deptEE)

	majorAI := entity.Major{
		DepartmentID: deptIT.ID,
		Name:         "Trí tuệ Nhân tạo & Thị giác Máy tính",
		Code:         "AI-CV",
		Description:  "Chuyên ngành Học sâu, Thị giác máy tính, Xử lý ngôn ngữ tự nhiên & Hệ thống thông minh",
		TotalCredits: 132,
		IsActive:     true,
	}
	majorSE := entity.Major{
		DepartmentID: deptIT.ID,
		Name:         "Kỹ thuật Phần mềm",
		Code:         "SE",
		Description:  "Chuyên ngành Kiến trúc phần mềm, Cloud-Native & Full-Stack",
		TotalCredits: 130,
		IsActive:     true,
	}
	db.Create(&majorAI)
	db.Create(&majorSE)

	now := time.Now()
	semActive := entity.Semester{
		Code:         "HK1-2026",
		Name:         "Học kỳ 1 Năm học 2026-2027",
		AcademicYear: "2026-2027",
		StartDate:    now.AddDate(0, -1, 0),
		EndDate:      now.AddDate(0, 3, 0),
		IsCurrent:    true,
		Status:       "active",
	}
	semPrev := entity.Semester{
		Code:         "HK2-2025",
		Name:         "Học kỳ 2 Năm học 2025-2026",
		AcademicYear: "2025-2026",
		StartDate:    now.AddDate(0, -6, 0),
		EndDate:      now.AddDate(0, -2, 0),
		IsCurrent:    false,
		Status:       "completed",
	}
	db.Create(&semActive)
	db.Create(&semPrev)

	// 3. Users (Admin ID=1, Teacher ID=2, Student ID=3 + extra students)
	pwdHash, err := helper.HashPassword(password)
	if err != nil {
		return err
	}

	admin := entity.User{
		Email:         "admin@lms.edu.vn",
		PasswordHash:  pwdHash,
		FullName:      "Quản trị viên Hệ thống",
		Role:          "admin",
		Status:        "active",
		DepartmentID:  deptIT.ID,
		Locale:        "vi",
		CameraConsent: true,
	}
	teacher := entity.User{
		Email:         "teacher@lms.edu.vn",
		PasswordHash:  pwdHash,
		FullName:      "PGS.TS. Trần Quang Minh",
		Role:          "teacher",
		Status:        "active",
		DepartmentID:  deptIT.ID,
		Bio:           "Giảng viên cao cấp chuyên ngành Trí tuệ Nhân tạo, Thị giác Máy tính & Cấu trúc Dữ liệu.",
		Locale:        "vi",
		CameraConsent: true,
	}
	student := entity.User{
		Email:         "student@lms.edu.vn",
		PasswordHash:  pwdHash,
		FullName:      "Nguyễn Minh Hiếu",
		Role:          "student",
		Status:        "active",
		StudentCode:   "B21DCCN001",
		DepartmentID:  deptIT.ID,
		MajorID:       majorAI.ID,
		Locale:        "vi",
		CameraConsent: true,
	}
	student2 := entity.User{
		Email:         "lan.anh@lms.edu.vn",
		PasswordHash:  pwdHash,
		FullName:      "Lê Ngọc Lan Anh",
		Role:          "student",
		Status:        "active",
		StudentCode:   "B21DCCN042",
		DepartmentID:  deptIT.ID,
		MajorID:       majorAI.ID,
		Locale:        "vi",
		CameraConsent: true,
	}
	student3 := entity.User{
		Email:         "hoang.nam@lms.edu.vn",
		PasswordHash:  pwdHash,
		FullName:      "Phạm Hoàng Nam",
		Role:          "student",
		Status:        "active",
		StudentCode:   "B21DCCN089",
		DepartmentID:  deptIT.ID,
		MajorID:       majorSE.ID,
		Locale:        "vi",
		CameraConsent: true,
	}
	db.Create(&admin)
	db.Create(&teacher)
	db.Create(&student)
	db.Create(&student2)
	db.Create(&student3)

	// Student Profiles
	db.Create(&entity.StudentProfile{
		UserID:           student.ID,
		FullName:         student.FullName,
		StudentCode:      "B21DCCN001",
		Major:            majorAI.Name,
		DepartmentID:     deptIT.ID,
		StudentClass:     "D21CQCN01-B",
		AcademicYear:     3,
		Level:            "intermediate",
		CareerGoal:       "Kỹ sư AI & Thị giác Máy tính (Computer Vision Engineer)",
		PreferredPersona: "coach",
		CurrentGPA:       3.42,
		TargetGPA:        3.70,
	})
	db.Create(&entity.StudentProfile{
		UserID:           student2.ID,
		FullName:         student2.FullName,
		StudentCode:      "B21DCCN042",
		Major:            majorAI.Name,
		DepartmentID:     deptIT.ID,
		StudentClass:     "D21CQCN01-B",
		AcademicYear:     3,
		Level:            "advanced",
		CareerGoal:       "Nghiên cứu viên Học sâu & Mô hình Ngôn ngữ Lớn",
		PreferredPersona: "expert",
		CurrentGPA:       3.85,
		TargetGPA:        3.90,
	})
	db.Create(&entity.StudentProfile{
		UserID:           student3.ID,
		FullName:         student3.FullName,
		StudentCode:      "B21DCCN089",
		Major:            majorSE.Name,
		DepartmentID:     deptIT.ID,
		StudentClass:     "D21CQCN02-B",
		AcademicYear:     2,
		Level:            "beginner",
		CareerGoal:       "Kỹ sư Backend Cloud-Native",
		PreferredPersona: "socrates",
		CurrentGPA:       2.75,
		TargetGPA:        3.20,
	})

	// Pending Teacher Application for Admin demo
	db.Create(&entity.TeacherApplication{
		UserID:            student2.ID,
		FullName:          "TS. Vũ Đức Thắng",
		Email:             "duc.thang.ai@lms.edu.vn",
		Specialization:    "Thị giác máy tính & Học sâu (Deep Learning)",
		Degree:            "Tiến sĩ Khoa học Máy tính",
		YearsOfExperience: 6,
		Bio:               "6 năm giảng dạy Đại học Bách Khoa & nghiên cứu viên AI Lab, 12 bài báo Q1 về Computer Vision.",
		Status:            "pending",
	})

	// 4. Academic Courses & Course Classes
	ac1 := entity.AcademicCourse{
		DepartmentID:        deptIT.ID,
		MajorID:             majorAI.ID,
		CourseCode:          "INT3412",
		Title:               "Thị giác Máy tính & Học sâu (Computer Vision)",
		Credits:             3,
		TheoryHours:         30,
		PracticeHours:       15,
		RecommendedSemester: 5,
		IsCompulsory:        true,
		Description:         "Xử lý ảnh số, trích xuất đặc trưng MediaPipe Landmarks, CNN, BiLSTM & Nhận diện cảm xúc khuôn mặt",
	}
	ac2 := entity.AcademicCourse{
		DepartmentID:        deptIT.ID,
		MajorID:             majorAI.ID,
		CourseCode:          "INT2204",
		Title:               "Cấu trúc Dữ liệu & Giải thuật Nâng cao",
		Credits:             4,
		TheoryHours:         45,
		PracticeHours:       15,
		RecommendedSemester: 3,
		IsCompulsory:        true,
		Description:         "Cây cân bằng AVL, Đồ thị DAG, Quy hoạch động và Phân tích độ phức tạp thuật toán",
	}
	ac3 := entity.AcademicCourse{
		DepartmentID:        deptIT.ID,
		MajorID:             majorAI.ID,
		CourseCode:          "INT3508",
		Title:               "Xử lý Ngôn ngữ Tự nhiên & Hệ thống RAG",
		Credits:             3,
		TheoryHours:         30,
		PracticeHours:       15,
		RecommendedSemester: 6,
		IsCompulsory:        false,
		Description:         "Transformer, Vector Database pgvector, Multi-Modal RAG và Xây dựng Trợ lý Ảo Thông minh",
	}
	db.Create(&ac1)
	db.Create(&ac2)
	db.Create(&ac3)

	// 5. Courses, Modules, Lessons & VideoSegments (5-7 min segments with Quiz!)
	course1 := entity.Course{
		TeacherID:        teacher.ID,
		AcademicCourseID: ac1.ID,
		MajorID:          majorAI.ID,
		Title:            "Thị giác Máy tính & Phát hiện Cảm xúc Đa phương thức (Computer Vision & Deep Learning)",
		Slug:             "thi-giac-may-tinh-phat-hien-cam-xuc-da-phuong-thuc",
		Description:      "Khóa học chuyên sâu về trích xuất 478 điểm mốc 3D MediaPipe Face Landmarks, tính toán Eye Aspect Ratio (EAR), mạng CNN-BiLSTM kết hợp cơ chế Attention và mô hình hợp nhất đa phương thức 12 đặc trưng.",
		ShortDesc:        "Trích xuất 478 điểm mốc 3D MediaPipe, EAR, BiLSTM-Attention & AI Tutor 3-Tier RAG.",
		Category:         "Computer Vision & AI",
		Level:            "intermediate",
		ThumbnailURL:     "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&auto=format&fit=crop&q=80",
		TagsJSON:         `["Computer Vision","MediaPipe","BiLSTM","Deep Learning","AI Tutor"]`,
		IsPublished:      true,
		TotalStudents:    42,
		TotalLessons:     4,
		TotalDurationSec: 3600,
		RatingAvg:        4.9,
		RatingCount:      28,
	}
	course2 := entity.Course{
		TeacherID:        teacher.ID,
		AcademicCourseID: ac2.ID,
		MajorID:          majorAI.ID,
		Title:            "Cấu trúc Dữ liệu, Cây Cân bằng AVL, Đồ thị DAG & Quy hoạch Động",
		Slug:             "cau-truc-du-lieu-do-thi-dag-quy-hoach-dong",
		Description:      "Nắm vững cây tìm kiếm nhị phân tự cân bằng AVL, các phép quay LL/RR/LR/RL, thuật toán Dijkstra, sắp xếp Topo trên đồ thị DAG và kỹ thuật tối ưu hóa bộ nhớ trong Quy hoạch động.",
		ShortDesc:        "Cây AVL, Đồ thị DAG, Dijkstra & Quy hoạch động thực chiến.",
		Category:         "Algorithms",
		Level:            "intermediate",
		ThumbnailURL:     "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&auto=format&fit=crop&q=80",
		TagsJSON:         `["Algorithms","AVL Tree","Graph DAG","Dynamic Programming"]`,
		IsPublished:      true,
		TotalStudents:    65,
		TotalLessons:     6,
		TotalDurationSec: 5400,
		RatingAvg:        4.8,
		RatingCount:      35,
	}
	course3 := entity.Course{
		TeacherID:        teacher.ID,
		AcademicCourseID: ac3.ID,
		MajorID:          majorAI.ID,
		Title:            "Xây dựng Trợ lý Ảo Thông minh với Multi-Modal RAG & pgvector",
		Slug:             "xay-dung-tro-ly-ao-thong-minh-multi-modal-rag-pgvector",
		Description:      "Thiết kế kiến trúc 3-Tier Retrieval Augmented Generation trên PostgreSQL pgvector, tích hợp GPT-4o Vision đọc slide bài giảng và tổng hợp giọng nói thời gian thực.",
		ShortDesc:        "Kiến trúc 3-Tier Video RAG, pgvector, GPT-4o Vision & Streaming Voice.",
		Category:         "Generative AI & LLM",
		Level:            "advanced",
		ThumbnailURL:     "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=80",
		TagsJSON:         `["RAG","pgvector","LLM","OpenAI","Golang"]`,
		IsPublished:      true,
		TotalStudents:    38,
		TotalLessons:     5,
		TotalDurationSec: 4500,
		RatingAvg:        4.9,
		RatingCount:      19,
	}
	db.Create(&course1)
	db.Create(&course2)
	db.Create(&course3)

	cc1 := entity.CourseClass{
		AcademicCourseID: ac1.ID,
		SemesterID:       semActive.ID,
		TeacherID:        teacher.ID,
		OnlineCourseID:   course1.ID,
		ClassCode:        "INT3412-01",
		Name:             "Lớp Thị giác Máy tính & Học sâu 01",
		Room:             "A2-304",
		DayOfWeek:        2,
		StartPeriod:      1,
		EndPeriod:        3,
		MaxStudents:      50,
		EnrolledCount:    35,
		Status:           "open",
	}
	db.Create(&cc1)
	db.Create(&entity.CourseClassEnrollment{
		CourseClassID:   cc1.ID,
		StudentID:       student.ID,
		Status:          "enrolled",
		Source:          "import",
		ProgressPercent: 68.0,
	})

	mod1 := entity.Module{
		CourseID:      course1.ID,
		Title:         "Chương 1: Trích xuất Đặc trưng Khuôn mặt 3D & Chỉ số Ánh nhìn (MediaPipe & EAR)",
		Description:   "Nguyên lý hoạt động của lưới 478 điểm mốc 3D, chuẩn hóa tọa độ gốc đỉnh mũi và phát hiện trạng thái đờ mắt khi bối rối.",
		OrderIndex:    1,
		DueDaysOffset: 7,
		IsPublished:   true,
	}
	mod2 := entity.Module{
		CourseID:      course1.ID,
		Title:         "Chương 2: Mạng Chuỗi Thời gian BiLSTM, SEBlock & Hợp nhất Đa phương thức 12 Đặc trưng",
		Description:   "Mô hình hóa chuỗi biến đổi biểu cảm theo thời gian với Squeeze-and-Excitation, 2-layer BiLSTM, Temporal Attention và MLP 3 lớp.",
		OrderIndex:    2,
		DueDaysOffset: 14,
		IsPublished:   true,
	}
	db.Create(&mod1)
	db.Create(&mod2)

	transcriptLesson1 := `[00:00] Chào mừng các bạn sinh viên đến với bài giảng đầu tiên: Trích xuất đặc trưng khuôn mặt 3D với MediaPipe Face Landmarker và ứng dụng trong phát hiện sự bối rối khi học trực tuyến.
[01:15] Khác với các bộ phát hiện khuôn mặt truyền thống chỉ trả về khung hình chữ nhật (bounding box), MediaPipe Face Mesh ước lượng tới 478 điểm mốc 3D (3D landmarks) ngay trên trình duyệt với tốc độ thời gian thực.
[03:10] Để đảm bảo mô hình bất biến với khoảng cách xa gần và vị trí ngồi của học sinh, chúng ta thực hiện chuẩn hóa lấy đỉnh mũi (landmark số 1) làm gốc tọa độ: x' = (x - x_nose) / d_interocular.
[05:30] Tiếp theo, làm thế nào để phân biệt học sinh đang chăm chú đọc công thức khó với học sinh đang bối rối? Chúng ta kết hợp chỉ số Mở mắt EAR (Eye Aspect Ratio) và Độ đứng yên ánh nhìn (Gaze Stillness).
[07:45] Công thức tính EAR dựa trên tỷ lệ khoảng cách dọc giữa mí mắt trên - dưới chia cho hai lần chiều ngang khóe mắt: EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||). Khi học sinh nhíu mày (AU4) kết hợp mở to mắt không chớp (EAR > 0.22 và phương sai EAR < 0.002) cùng đỉnh mũi dịch chuyển dưới 3.5 pixel qua 5 khung hình, hệ thống kích hoạt hệ số khuếch đại bối rối gazeBoost = 1.6.
[11:20] Trong phần cuối của bài học, chúng ta tìm hiểu cơ chế Định danh Khuôn mặt Liên tục bằng mạng MobileFaceNet 192 chiều trên 3 góc mặt: Chính diện, Nghiêng trái và Nghiêng phải. Độ tương đồng Cosine (Cosine Similarity) >= 0.55 đảm bảo đúng sinh viên đăng ký đang theo học mà không cần lưu bất kỳ hình ảnh webcam nào lên máy chủ.`

	lesson1 := entity.Lesson{
		CourseID:            course1.ID,
		ModuleID:            mod1.ID,
		Title:               "Bài 1: Mạng Lưới 478 Điểm mốc 3D MediaPipe, Chỉ số Mở mắt EAR & Định danh MobileFaceNet",
		LessonType:          "video",
		VideoURL:            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
		VideoDuration:       1080,
		TextContent:         transcriptLesson1,
		Summary:             "Trích xuất 478 điểm mốc 3D MediaPipe, chuẩn hóa đỉnh mũi, công thức Eye Aspect Ratio (EAR) và định danh MobileFaceNet 192 chiều.",
		CachedTranscript:    transcriptLesson1,
		TranscriptionStatus: "completed",
		OrderIndex:          1,
		AllowSkip:           false,
		IsPublished:         true,
	}

	readingCourse1 := `### Tài liệu Đọc Chuyên sâu: Chuẩn hóa Hình học 3D Landmarks & Công thức EAR Thích ứng

#### 1. Chuẩn hóa Bất biến Tịnh tiến & Tỷ lệ (Translation & Scale Invariance)
Khi học sinh ngồi trước webcam, khoảng cách từ khuôn mặt tới ống kính có thể dao động từ **40cm đến 90cm**. Để vector đặc trưng không bị biến dạng:
- Gốc tọa độ được đặt tại **Đỉnh mũi** ($\text{landmark}[1] = (x_{\text{nose}}, y_{\text{nose}}, z_{\text{nose}})$).
- Khoảng cách chuẩn hóa $d_{\text{eye}}$ là khoảng cách Euclid giữa khóe mắt ngoài bên trái ($\text{landmark}[33]$) và khóe mắt ngoài bên phải ($\text{landmark}[263]$):
  $$p'_i = \frac{p_i - p_{\text{nose}}}{d_{\text{eye}} + \epsilon}$$

#### 2. Chỉ số Mở mắt EAR (Eye Aspect Ratio) & Hiện tượng Đờ mắt (Cognitive Eye-Lock)
Chỉ số EAR được tính từ 6 điểm mốc quanh viền mí mắt $(p_1, p_2, p_3, p_4, p_5, p_6)$:
$$\text{EAR} = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2 \cdot \|p_1 - p_4\|}$$
- **Trạng thái bình thường**: $\text{EAR} \approx 0.25 - 0.30$, chớp mắt định kỳ mỗi 3–4 giây khiến $\text{Var}(\text{EAR}) \ge 0.005$.
- **Trạng thái Đờ mắt khi Bối rối (Eye-Lock & Gaze Stillness)**: Mắt mở căng không chớp ($\text{EAR} > 0.22$, $\text{Var}(\text{EAR}) < 0.002$) kết hợp đầu giữ bất động ($\Delta_{\text{nose}} < 3.5\text{px}$), kích hoạt hệ số khuếch đại bối rối ` + "`gazeBoost = 1.6`" + `.`

	lesson1Reading := entity.Lesson{
		CourseID:            course1.ID,
		ModuleID:            mod1.ID,
		Title:               "Bài 2 (Reading): Biến đổi Hình học 3D Landmarks, Bộ lọc EMA & Ngưỡng EAR Thích ứng",
		LessonType:          "reading",
		VideoDuration:       420,
		TextContent:         readingCourse1,
		Summary:             "Tài liệu đọc chuyên sâu về chuẩn hóa tọa độ 3D bất biến khoảng cách, bộ lọc mượt EMA và toán học đằng sau hiện tượng Cognitive Eye-Lock.",
		CachedTranscript:    readingCourse1,
		TranscriptionStatus: "completed",
		OrderIndex:          2,
		AllowSkip:           true,
		IsPublished:         true,
	}

	transcriptLesson2 := `[00:00] Trong bài học thứ ba này, chúng ta đi sâu vào kiến trúc mạng học sâu chuỗi thời gian BiLSTM kết hợp Attention và bộ phân loại Đa phương thức 12 đặc trưng.
[02:30] Biểu cảm bối rối không xuất hiện trong một khung hình đơn lẻ mà là một quá trình chuyển trạng thái: từ tập trung (focused) sang nhíu mày suy nghĩ (confused) và có thể dẫn tới nản lòng (frustrated). Do đó, cửa sổ trượt 30 khung hình được đưa qua khối Squeeze-and-Excitation (SEBlock) để trọng số hóa các kênh đặc trưng quan trọng trước khi vào 2 lớp BiLSTM hai chiều.
[06:15] Bên cạnh tín hiệu hình ảnh từ camera, hành vi tương tác với trình phát video mang lại tín hiệu cực kỳ tin cậy: số lần tạm dừng (pause_count), thời lượng dừng trung bình (avg_pause_duration), số lần tua lại cùng một đoạn kiến thức (rewind_same_spot) và việc giảm tốc độ phát xuống 0.75x.
[10:40] Khi hợp nhất 6 đặc trưng hành vi video, 4 đặc trưng cảm xúc camera và 2 đặc trưng kết quả Quiz phân đoạn thành vector 12 chiều, mạng MLP 3 lớp (64 -> 32 -> 16 -> 1) đạt độ chính xác vượt trội và cho phép kích hoạt Trợ lý Ảo AI can thiệp đúng thời điểm học sinh cần nhất.`

	lesson2 := entity.Lesson{
		CourseID:            course1.ID,
		ModuleID:            mod2.ID,
		Title:               "Bài 3: Kiến trúc BiLSTM-Attention & Hợp nhất Đa phương thức 12 Đặc trưng (MLP Predictor)",
		LessonType:          "video",
		VideoURL:            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
		VideoDuration:       900,
		TextContent:         transcriptLesson2,
		Summary:             "Mô hình chuỗi thời gian SEBlock + BiLSTM + Temporal Attention và bộ phân loại MLP 12 đặc trưng.",
		CachedTranscript:    transcriptLesson2,
		TranscriptionStatus: "completed",
		OrderIndex:          3,
		AllowSkip:           false,
		IsPublished:         true,
	}

	lesson1Coding := entity.Lesson{
		CourseID:            course1.ID,
		ModuleID:            mod2.ID,
		Title:               "Bài 4 (Coding Lab): Cài đặt Thuật toán Tính Eye Aspect Ratio (EAR) & Phát hiện Đờ mắt (Eye-Lock)",
		LessonType:          "coding",
		VideoDuration:       900,
		TextContent:         "Thực hành lập trình trực tiếp trên trình duyệt: Viết hàm `detect_eye_lock(ear_values, nose_deltas)` kiểm tra điều kiện EAR trung bình > 0.22, phương sai < 0.002 và độ lệch mũi trung bình < 3.5px.",
		Summary:             "Bài thực hành lập trình tự động chấm điểm với bộ Test Cases công khai và ẩn về phát hiện trạng thái Eye-Lock.",
		CachedTranscript:    "Coding Lab: Cài đặt hàm detect_eye_lock tính trung bình EAR, phương sai EAR và kiểm tra ngưỡng Gaze Stillness.",
		TranscriptionStatus: "completed",
		OrderIndex:          4,
		AllowSkip:           true,
		IsPublished:         true,
	}

	db.Create(&lesson1)
	db.Create(&lesson1Reading)
	db.Create(&lesson2)
	db.Create(&lesson1Coding)

	// VideoSegments (5-7 minutes each) for Course 1 Lesson 1 & Lesson 2
	seg1 := entity.VideoSegment{
		LessonID:         lesson1.ID,
		SegmentOrder:     1,
		StartTimestamp:   0,
		EndTimestamp:     330,
		Title:            "Phân đoạn 1: Lưới 478 Điểm mốc 3D MediaPipe & Chuẩn hóa Tọa độ",
		Summary:          "Nguyên lý lưới 478 điểm mốc 3D MediaPipe và chuẩn hóa tọa độ lấy đỉnh mũi làm gốc",
		Transcript:       "Chào mừng các bạn sinh viên đến với bài giảng: Trích xuất đặc trưng khuôn mặt 3D với MediaPipe Face Landmarker. MediaPipe ước lượng 478 điểm mốc 3D ngay trên trình duyệt. Để bất biến với khoảng cách và vị trí ngồi, ta chuẩn hóa lấy đỉnh mũi (landmark số 1) làm gốc tọa độ.",
		KeyConceptsJSON:  `["MediaPipe Face Landmarker","478 3D Landmarks","Nose-tip Normalization"]`,
		QuizQuestionJSON: `{"question":"Tại sao cần chuẩn hóa tọa độ 478 điểm mốc MediaPipe lấy đỉnh mũi (landmark[1]) làm gốc tọa độ?","options":["Để bất biến với vị trí ngồi và khoảng cách xa gần của học sinh trước camera","Để giảm số lượng điểm mốc từ 478 xuống 68 điểm","Để chuyển ảnh màu RGB sang ảnh đa mức xám","Để tăng tốc độ phát video bài giảng"],"correctAnswer":0,"explanation":"Chuẩn hóa tọa độ theo đỉnh mũi và khoảng cách hai mắt giúp vector đặc trưng hình học không bị phụ thuộc vào vị trí dịch chuyển hay khoảng cách xa gần của khuôn mặt."}`,
	}
	seg2 := entity.VideoSegment{
		LessonID:         lesson1.ID,
		SegmentOrder:     2,
		StartTimestamp:   330,
		EndTimestamp:     680,
		Title:            "Phân đoạn 2: Chỉ số Mở mắt EAR & Hiện tượng Đờ mắt (Gaze Stillness)",
		Summary:          "Công thức Eye Aspect Ratio (EAR) và phát hiện hiện tượng đờ mắt (Gaze Stillness & Eye-Lock)",
		Transcript:       "Để phân biệt học sinh đang đọc công thức khó hay đang bối rối, hệ thống kết hợp chỉ số Mở mắt EAR (Eye Aspect Ratio) và Độ đứng yên ánh nhìn (Gaze Stillness). Khi EAR > 0.22, phương sai EAR < 0.002 (eyeLocked) và đỉnh mũi dịch chuyển < 3.5px qua 5 khung hình (gazeStill), hệ số gazeBoost = 1.6 được kích hoạt.",
		KeyConceptsJSON:  `["Eye Aspect Ratio (EAR)","Gaze Stillness","Eye-Lock Boost 1.6x"]`,
		QuizQuestionJSON: `{"question":"Điều kiện nào kích hoạt trạng thái Eye-Lock & Gaze Stillness (khuếch đại bối rối gazeBoost = 1.6)?","options":["EAR > 0.22, phương sai EAR < 0.002 và độ lệch đỉnh mũi < 3.5px qua 5 khung hình","Học sinh nhắm mắt liên tục trên 10 giây","Tốc độ phát video được chỉnh lên 2.0x","Điểm bài kiểm tra cuối kỳ đạt 10/10"],"correctAnswer":0,"explanation":"Khi học sinh căng thẳng nhìn chằm chằm vào công thức khó, mắt mở to ít chớp (EAR > 0.22, phương sai thấp) và đầu giữ bất động (< 3.5px)."}`,
	}
	seg3 := entity.VideoSegment{
		LessonID:         lesson1.ID,
		SegmentOrder:     3,
		StartTimestamp:   680,
		EndTimestamp:     1080,
		Title:            "Phân đoạn 3: Định danh Sinh trắc học 3 Góc mặt MobileFaceNet 192 chiều",
		Summary:          "Định danh sinh trắc học 3 góc mặt bằng MobileFaceNet 192 chiều & Chống gian lận",
		Transcript:       "Trong phần cuối, hệ thống sử dụng mạng MobileFaceNet trích xuất vector 192 chiều đã chuẩn hóa L2 trên 3 tư thế mặt (Thẳng, Trái, Phải). Mỗi 5 giây, độ tương đồng Cosine được so khớp với ngưỡng 0.55 để phát hiện vắng mặt quá 30 giây hoặc người lạ học hộ.",
		KeyConceptsJSON:  `["MobileFaceNet 192-d","3-Pose Biometrics","Cosine Similarity >= 0.55"]`,
		QuizQuestionJSON: `{"question":"Hệ thống bảo vệ quyền riêng tư của học sinh khi định danh khuôn mặt như thế nào?","options":["Chạy MobileFaceNet ngay trong Web Worker trình duyệt và chỉ lưu 3 vector số 192 chiều, tuyệt đối không gửi ảnh webcam lên server","Tải toàn bộ video webcam lên đám mây mỗi giây","Yêu cầu chụp ảnh chứng minh thư mỗi phút","Tắt hoàn toàn chức năng kiểm tra"],"correctAnswer":0,"explanation":"Toàn bộ xử lý thị giác máy tính diễn ra phía trình duyệt (Client-Side Web Worker) và chỉ lưu vector đặc trưng 192 chiều đã chuẩn hóa L2."}`,
	}
	seg1_4 := entity.VideoSegment{
		LessonID:         lesson2.ID,
		SegmentOrder:     1,
		StartTimestamp:   0,
		EndTimestamp:     450,
		Title:            "Phân đoạn 1: Khối SEBlock & Mạng Chuỗi thời gian 2-Layer BiLSTM",
		Summary:          "Trọng số hóa kênh đặc trưng bằng Squeeze-and-Excitation và mô hình hóa chuỗi 30 khung hình với BiLSTM",
		Transcript:       "Biểu cảm bối rối là một quá trình động theo thời gian. Cửa sổ trượt 30 khung hình đi qua khối Squeeze-and-Excitation (SEBlock) để nhấn mạnh các vùng mắt và lông mày trước khi đưa vào 2 tầng BiLSTM hai chiều kết hợp cơ chế Attention.",
		KeyConceptsJSON:  `["Squeeze-and-Excitation (SEBlock)","2-Layer BiLSTM","Temporal Attention"]`,
		QuizQuestionJSON: `{"question":"Vai trò của khối Squeeze-and-Excitation (SEBlock) trước tầng BiLSTM là gì?","options":["Tự động học trọng số quan trọng cho từng kênh đặc trưng hình học (như vùng lông mày nhíu và mí mắt)","Giảm độ phân giải video xuống 144p","Tắt thu âm micro","Thay thế hoàn toàn trình phát video"],"correctAnswer":0,"explanation":"SEBlock thực hiện Global Average Pooling và mạng FC 2 lớp để cấp trọng số ưu tiên cho các kênh đặc trưng nhạy với biểu cảm bối rối."}`,
	}
	seg1_5 := entity.VideoSegment{
		LessonID:         lesson2.ID,
		SegmentOrder:     2,
		StartTimestamp:   300,
		EndTimestamp:     600,
		Title:            "Phân đoạn 2: Hợp nhất Đa phương thức 12 Đặc trưng & Mạng MLP 3 Tầng ẩn",
		Summary:          "Kết hợp 6 đặc trưng hành vi video, 4 đặc trưng cảm xúc camera và 2 đặc trưng Quiz vào mạng MLP (64->32->16->1)",
		Transcript:       "Mạng MLP nhận đầu vào gồm 12 đặc trưng chuẩn hóa Z-score: 6 đặc trưng hành vi xem video (pause_count, avg_pause_duration, long_pause_count, rewind_count, rewind_same_spot, speed_decrease), 4 đặc trưng cảm xúc và 2 đặc trưng điểm Quiz phân đoạn.",
		KeyConceptsJSON:  `["12 Multimodal Features","Z-Score Normalization","MLP 64-32-16-1"]`,
		QuizQuestionJSON: `{"question":"Bộ 12 đặc trưng đa phương thức của mạng MLP bao gồm những nhóm tín hiệu nào?","options":["6 đặc trưng hành vi tương tác video + 4 đặc trưng cảm xúc khuôn mặt + 2 đặc trưng kết quả Quiz","Chỉ sử dụng duy nhất điểm thi cuối kỳ","Chỉ sử dụng tốc độ gõ bàn phím","Chỉ đếm số lần đăng nhập"],"correctAnswer":0,"explanation":"Sự kết hợp đa phương thức giữa hành vi tua/dừng video, cảm xúc webcam và kết quả Quiz giúp hạn chế báo động giả và đạt độ chính xác cao."}`,
	}
	seg1_6 := entity.VideoSegment{
		LessonID:         lesson2.ID,
		SegmentOrder:     3,
		StartTimestamp:   600,
		EndTimestamp:     900,
		Title:            "Phân đoạn 3: Cơ chế Can thiệp Tự động Có Kiểm soát (Cooldown 180s & Rule Fallback)",
		Summary:          "Kết hợp xác suất ML P >= 0.72 và điểm luật lai RuleScore >= 65 với thời gian chờ Cooldown 180 giây",
		Transcript:       "Để tránh làm phiền học sinh liên tục, bộ kích hoạt can thiệp tự động áp dụng ngưỡng kép: xác suất MLP P(confused) >= 0.72 hoặc điểm luật chuyên gia RuleScore >= 65, đi kèm thời gian Cooldown 180 giây giữa hai lần gợi ý liên tiếp từ AI Tutor.",
		KeyConceptsJSON:  `["Dual-Threshold Trigger","Hybrid Rule Fallback","180s Cooldown Guard"]`,
		QuizQuestionJSON: `{"question":"Tại sao hệ thống áp dụng thời gian chờ Cooldown 180 giây sau mỗi lần AI Tutor tự động can thiệp?","options":["Để học sinh có thời gian đọc hiểu lời giải thích và tránh gây gián đoạn quá dày đặc","Để tắt máy chủ cơ sở dữ liệu","Để xóa toàn bộ lịch sử bài học","Để khóa tài khoản sinh viên"],"correctAnswer":0,"explanation":"Cooldown 180 giây đảm bảo trải nghiệm học tập mượt mà, chỉ can thiệp đúng lúc cần thiết mà không gây quá tải thông báo."}`,
	}
	db.Create(&seg1)
	db.Create(&seg2)
	db.Create(&seg3)
	db.Create(&seg1_4)
	db.Create(&seg1_5)
	db.Create(&seg1_6)

	// =========================================================================
	// COURSE 2: Cấu trúc Dữ liệu, Cây Cân bằng AVL, Đồ thị DAG & Quy hoạch Động
	// (2 Modules, 4 Lessons including Reading on AVL Rotation & Coding Lab on DAG Topological Sort, 6 VideoSegments)
	// =========================================================================
	course2.TotalLessons = 4
	db.Save(&course2)

	mod2_1 := entity.Module{
		CourseID:      course2.ID,
		Title:         "Chương 1: Cây Tìm kiếm Nhị phân Tự cân bằng AVL & Các Phép quay Cân bằng (LL, RR, LR, RL)",
		Description:   "Phân tích hệ số cân bằng Balance Factor, bảo toàn chiều cao O(log n) và cài đặt 4 phép quay đơn/kép trên cây AVL.",
		OrderIndex:    1,
		DueDaysOffset: 7,
		IsPublished:   true,
	}
	mod2_2 := entity.Module{
		CourseID:      course2.ID,
		Title:         "Chương 2: Đồ thị Có hướng Không chu trình (DAG), Sắp xếp Topo & Quy hoạch Động",
		Description:   "Thuật toán Kahn (BFS In-degree) và DFS sắp xếp Topo trên đồ thị DAG kết hợp Quy hoạch động tối ưu đường đi.",
		OrderIndex:    2,
		DueDaysOffset: 14,
		IsPublished:   true,
	}
	db.Create(&mod2_1)
	db.Create(&mod2_2)

	transcriptC2L1 := `[00:00] Chào mừng các bạn đến với khóa học Cấu trúc Dữ liệu & Giải thuật Nâng cao. Trong Bài 1, chúng ta nghiên cứu Cây tìm kiếm nhị phân tự cân bằng AVL (Adelson-Velsky và Landis).
[04:10] Trên cây BST thông thường, nếu dữ liệu chèn vào theo thứ tự tăng dần, cây sẽ bị suy biến thành danh sách liên kết đơn với chiều cao O(n). Cây AVL khắc phục triệt để bằng cách duy trì điều kiện cân bằng tại mọi nút: hệ số cân bằng BF(u) = height(left) - height(right) luôn thuộc tập {-1, 0, 1}.
[09:20] Khi chèn hoặc xóa làm |BF(u)| == 2, ta thực hiện phép quay đơn (Left-Left hoặc Right-Right) khi nút cháu nằm cùng phía, hoặc phép quay kép (Left-Right hoặc Right-Left) khi nút cháu nằm lệch phía chữ Z để khôi phục cân bằng trong thời gian O(1).`

	lesson2_1 := entity.Lesson{
		CourseID:            course2.ID,
		ModuleID:            mod2_1.ID,
		Title:               "Bài 1: Nguyên lý Cây Tự cân bằng AVL, Hệ số Balance Factor & Phép quay Cân bằng",
		LessonType:          "video",
		VideoURL:            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
		VideoDuration:       1050,
		TextContent:         transcriptC2L1,
		Summary:             "Điều kiện cân bằng AVL |BF| <= 1, chứng minh chiều cao O(log n) và 4 trường hợp mất cân bằng LL, RR, LR, RL.",
		CachedTranscript:    transcriptC2L1,
		TranscriptionStatus: "completed",
		OrderIndex:          1,
		AllowSkip:           false,
		IsPublished:         true,
	}

	readingAVL := `### Bài Đọc Chuyên sâu: Cài đặt Chi tiết 4 Phép quay Cây AVL (LL, RR, LR, RL)

#### 1. Định nghĩa Hệ số Cân bằng (Balance Factor)
Tại mỗi nút $u$ trong cây AVL, hệ số cân bằng được định nghĩa:
$$\text{BF}(u) = \text{height}(u.\text{left}) - \text{height}(u.\text{right}) \in \{-1, 0, +1\}$$
Nhờ bất biến này, số nút tối thiểu trên cây AVL chiều cao $h$ thỏa mãn dãy truy hồi tương tự Fibonacci: $N(h) = N(h-1) + N(h-2) + 1$, suy ra $h < 1.44 \log_2(n + 2)$.

#### 2. Bảng Tổng hợp 4 Phép Quay Cân bằng
| Trường hợp | Điều kiện tại nút $z$ và con $y$ | Thao tác Khôi phục Cân bằng | Độ phức tạp |
| :--- | :--- | :--- | :--- |
| **Left-Left (LL)** | $\text{BF}(z) = +2$ và $\text{BF}(z.\text{left}) \ge 0$ | Quay phải đơn ` + "`rightRotate(z)`" + ` | $\mathcal{O}(1)$ |
| **Right-Right (RR)** | $\text{BF}(z) = -2$ và $\text{BF}(z.\text{right}) \le 0$ | Quay trái đơn ` + "`leftRotate(z)`" + ` | $\mathcal{O}(1)$ |
| **Left-Right (LR)** | $\text{BF}(z) = +2$ và $\text{BF}(z.\text{left}) < 0$ | Quay trái tại $y = z.\text{left}$, sau đó quay phải tại $z$ | $\mathcal{O}(1)$ |
| **Right-Left (RL)** | $\text{BF}(z) = -2$ và $\text{BF}(z.\text{right}) > 0$ | Quay phải tại $y = z.\text{right}$, sau đó quay trái tại $z$ | $\mathcal{O}(1)$ |`

	lesson2_2 := entity.Lesson{
		CourseID:            course2.ID,
		ModuleID:            mod2_1.ID,
		Title:               "Bài 2 (Reading): Phân tích Toán học Chiều cao Cây AVL & Minh họa Từng bước Phép quay LL/RR/LR/RL",
		LessonType:          "reading",
		VideoDuration:       480,
		TextContent:         readingAVL,
		Summary:             "Tài liệu đọc kèm công thức chứng minh chiều cao 1.44 log2(n) và bảng tra cứu nhanh 4 phép quay AVL.",
		CachedTranscript:    readingAVL,
		TranscriptionStatus: "completed",
		OrderIndex:          2,
		AllowSkip:           true,
		IsPublished:         true,
	}

	transcriptC2L3 := `[00:00] Trong Bài 3, chúng ta chuyển sang Đồ thị có hướng không chu trình (DAG - Directed Acyclic Graph) và Quy hoạch động trên đồ thị.
[03:45] Sắp xếp Topo (Topological Sort) biến đổi một đồ thị DAG thành một thứ tự tuyến tính các đỉnh sao cho với mọi cạnh có hướng u -> v, đỉnh u luôn đứng trước đỉnh v. Thuật toán Kahn sử dụng hàng đợi (Queue) lưu các đỉnh có bán bậc vào (in-degree) bằng 0, đạt độ phức tạp tuyến tính O(V + E).
[08:15] Khi đã có thứ tự Topo, bài toán tìm đường đi dài nhất hoặc ngắn nhất trên DAG, cũng như bài toán lập lịch lộ trình môn học tiên quyết, được giải quyết dễ dàng bằng Quy hoạch động chỉ trong một lần duyệt O(V + E).`

	lesson2_3 := entity.Lesson{
		CourseID:            course2.ID,
		ModuleID:            mod2_2.ID,
		Title:               "Bài 3: Đồ thị DAG, Thuật toán Kahn Sắp xếp Topo & Quy hoạch Động Đường đi Tối ưu",
		LessonType:          "video",
		VideoURL:            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
		VideoDuration:       1080,
		TextContent:         transcriptC2L3,
		Summary:             "Biểu diễn đồ thị DAG, thuật toán Kahn BFS In-degree phát hiện chu trình và Quy hoạch động trên thứ tự Topo.",
		CachedTranscript:    transcriptC2L3,
		TranscriptionStatus: "completed",
		OrderIndex:          3,
		AllowSkip:           false,
		IsPublished:         true,
	}

	lesson2_4 := entity.Lesson{
		CourseID:            course2.ID,
		ModuleID:            mod2_2.ID,
		Title:               "Bài 4 (Coding Lab): Cài đặt Thuật toán Sắp xếp Topo (DAG Topological Sort) & Phát hiện Chu trình",
		LessonType:          "coding",
		VideoDuration:       900,
		TextContent:         "Thực hành Coding Lab: Viết hàm `topological_sort_dag(num_nodes, edges)` trả về danh sách thứ tự các đỉnh theo thuật toán Kahn (ưu tiên đỉnh chỉ số nhỏ hơn trước) hoặc trả về mảng rỗng `[]` nếu đồ thị có chu trình.",
		Summary:             "Bài tập lập trình tự động chấm điểm kiểm tra cài đặt thuật toán Kahn (In-degree Queue) trên đồ thị DAG.",
		CachedTranscript:    "Coding Lab: Cài đặt thuật toán Kahn sắp xếp Topo và kiểm tra chu trình trên đồ thị có hướng.",
		TranscriptionStatus: "completed",
		OrderIndex:          4,
		AllowSkip:           true,
		IsPublished:         true,
	}
	db.Create(&lesson2_1)
	db.Create(&lesson2_2)
	db.Create(&lesson2_3)
	db.Create(&lesson2_4)

	// 6 VideoSegments for Course 2 (3 in lesson2_1, 3 in lesson2_3)
	c2Segments := []entity.VideoSegment{
		{
			LessonID:         lesson2_1.ID,
			SegmentOrder:     1,
			StartTimestamp:   0,
			EndTimestamp:     350,
			Title:            "Phân đoạn 1: Sự suy biến của BST & Điều kiện Cân bằng Hệ số Balance Factor",
			Summary:          "Tại sao BST thường suy biến thành O(n) và bất biến |BF(u)| <= 1 của cây AVL",
			Transcript:       "Khi chèn dãy khóa đã sắp xếp vào cây nhị phân tìm kiếm thường, cây suy biến thành danh sách liên kết chiều cao O(n). Cây AVL giữ hiệu chiều cao cây con trái và phải không vượt quá 1.",
			KeyConceptsJSON:  `["BST Degeneration","Balance Factor","Height Invariant O(log n)"]`,
			QuizQuestionJSON: `{"question":"Điều kiện cân bằng chuẩn của hệ số Balance Factor BF(u) tại mọi nút trên cây AVL là gì?","options":["BF(u) thuộc {-1, 0, 1}","BF(u) luôn bằng 0","BF(u) >= 2","Chiều cao cây con trái luôn gấp đôi cây con phải"],"correctAnswer":0,"explanation":"Cây AVL cho phép độ lệch chiều cao giữa cây con trái và cây con phải tại mọi nút tối đa là 1."}`,
		},
		{
			LessonID:         lesson2_1.ID,
			SegmentOrder:     2,
			StartTimestamp:   350,
			EndTimestamp:     700,
			Title:            "Phân đoạn 2: Phép Quay Đơn Left-Left (LL) và Right-Right (RR)",
			Summary:          "Khôi phục cân bằng trong thời gian O(1) bằng phép quay phải đơn và quay trái đơn",
			Transcript:       "Khi nút mới được chèn vào nhánh trái của con trái (trường hợp Left-Left), ta thực hiện một phép quay phải đơn (Right Rotation) quanh nút mất cân bằng thấp nhất để giảm chiều cao đi 1.",
			KeyConceptsJSON:  `["Right Rotation (LL)","Left Rotation (RR)","O(1) Pointer Update"]`,
			QuizQuestionJSON: `{"question":"Khi nút z có BF(z) = +2 và con trái y có BF(y) = +1 (trường hợp Left-Left), ta cần thực hiện phép quay nào?","options":["Một phép quay phải đơn (Right Rotation) tại nút z","Một phép quay trái đơn tại nút z","Hai phép quay liên tiếp","Xóa toàn bộ cây con trái"],"correctAnswer":0,"explanation":"Trường hợp Left-Left nằm thẳng hàng bên trái nên chỉ cần một phép quay phải đơn tại nút mất cân bằng z."}`,
		},
		{
			LessonID:         lesson2_1.ID,
			SegmentOrder:     3,
			StartTimestamp:   700,
			EndTimestamp:     1050,
			Title:            "Phân đoạn 3: Phép Quay Kép Left-Right (LR) & Right-Left (RL)",
			Summary:          "Xử lý cấu hình gấp khúc chữ Z bằng tổ hợp 2 phép quay liên tiếp",
			Transcript:       "Khi nút mất cân bằng z có BF(z) = +2 nhưng con trái y lại lệch phải BF(y) = -1 (hình chữ Z), một phép quay đơn không đủ. Ta phải quay trái tại y trước để đưa về dạng LL, sau đó quay phải tại z.",
			KeyConceptsJSON:  `["Left-Right (LR) Double Rotation","Right-Left (RL) Double Rotation","Zig-Zag Rebalancing"]`,
			QuizQuestionJSON: `{"question":"Trình tự chính xác của phép quay kép Left-Right (LR) tại nút mất cân bằng z (với con trái y) là gì?","options":["Quay trái tại con trái y, sau đó quay phải tại nút z","Quay phải tại z rồi xóa nút y","Quay trái hai lần tại nút z","Đổi giá trị khóa mà không đổi con trỏ"],"correctAnswer":0,"explanation":"Quay trái tại y biến cấu trúc gấp khúc LR thành thẳng hàng LL, sau đó quay phải tại z sẽ đưa nút cháu x lên làm gốc mới cân bằng."}`,
		},
		{
			LessonID:         lesson2_3.ID,
			SegmentOrder:     1,
			StartTimestamp:   0,
			EndTimestamp:     360,
			Title:            "Phân đoạn 1: Đồ thị DAG & Bài toán Thứ tự Tiên quyết",
			Summary:          "Đặc trưng của đồ thị có hướng không chu trình (DAG) và ứng dụng lập lịch",
			Transcript:       "Đồ thị có hướng không chu trình (DAG) biểu diễn mối quan hệ phụ thuộc một chiều như môn học tiên quyết hay pipeline biên dịch phần mềm. Một đồ thị có hướng có thứ tự Topo khi và chỉ khi nó không chứa chu trình có hướng.",
			KeyConceptsJSON:  `["Directed Acyclic Graph (DAG)","Prerequisite Graph","Cycle Detection"]`,
			QuizQuestionJSON: `{"question":"Điều kiện cần và đủ để một đồ thị có hướng G tồn tại thứ tự sắp xếp Topo là gì?","options":["Đồ thị G không chứa chu trình có hướng (G là một DAG)","Đồ thị G phải là đồ thị đầy đủ","Mọi đỉnh đều có bậc bằng 2","Số cạnh phải nhiều gấp đôi số đỉnh"],"correctAnswer":0,"explanation":"Nếu đồ thị có chu trình u -> v -> u thì không thể xếp u đứng trước v đồng thời v đứng trước u."}`,
		},
		{
			LessonID:         lesson2_3.ID,
			SegmentOrder:     2,
			StartTimestamp:   360,
			EndTimestamp:     720,
			Title:            "Phân đoạn 2: Thuật toán Kahn (BFS In-degree) Độ phức tạp O(V + E)",
			Summary:          "Sử dụng mảng bán bậc vào in-degree và hàng đợi để sinh thứ tự Topo và phát hiện chu trình",
			Transcript:       "Thuật toán Kahn khởi tạo hàng đợi với tất cả các đỉnh có in-degree bằng 0. Mỗi bước lấy đỉnh u ra khỏi hàng đợi, đưa vào kết quả Topo và giảm in-degree của các đỉnh kề v đi 1; nếu in-degree(v) == 0 thì đẩy v vào hàng đợi.",
			KeyConceptsJSON:  `["Kahn's Algorithm","In-Degree Array","O(V + E) Time Complexity"]`,
			QuizQuestionJSON: `{"question":"Trong thuật toán Kahn, làm thế nào để phát hiện đồ thị đầu vào có chứa chu trình?","options":["Số lượng đỉnh lấy ra trong danh sách kết quả Topo nhỏ hơn tổng số đỉnh V của đồ thị","Hàng đợi ban đầu có nhiều hơn 1 đỉnh","Thời gian chạy vượt quá O(V)","Tất cả các cạnh đều có trọng số dương"],"correctAnswer":0,"explanation":"Các đỉnh nằm trong chu trình luôn có in-degree >= 1 nên không bao giờ được đưa vào hàng đợi, khiến số đỉnh thu được < V."}`,
		},
		{
			LessonID:         lesson2_3.ID,
			SegmentOrder:     3,
			StartTimestamp:   720,
			EndTimestamp:     1080,
			Title:            "Phân đoạn 3: Quy hoạch Động Đường đi Ngắn nhất & Đường Găng (Critical Path) trên DAG",
			Summary:          "Tính dp[v] theo thứ tự Topo trong thời gian tuyến tính O(V + E)",
			Transcript:       "Nhờ thứ tự Topo đảm bảo mọi đỉnh tiền nhiệm u đã được tính xong trước khi xét đỉnh v, công thức quy hoạch động dp[v] = min/max(dp[u] + w(u, v)) giải quyết bài toán Đường găng (Critical Path) chỉ trong O(V + E).",
			KeyConceptsJSON:  `["DP on DAG","Critical Path Method (CPM)","Topological Relaxation"]`,
			QuizQuestionJSON: `{"question":"Độ phức tạp thời gian tìm đường đi ngắn nhất từ một nguồn trên đồ thị DAG (kể cả có trọng số âm) bằng Quy hoạch động theo thứ tự Topo là bao nhiêu?","options":["O(V + E)","O(V^3)","O(2^V)","O(V^2 log V)"],"correctAnswer":0,"explanation":"Sắp xếp Topo tốn O(V + E) và bước nới lỏng (relax) qua từng cạnh theo thứ tự Topo tốn thêm O(V + E)."}`,
		},
	}
	for i := range c2Segments {
		db.Create(&c2Segments[i])
	}

	// =========================================================================
	// COURSE 3: Xây dựng Trợ lý Ảo Thông minh với Multi-Modal RAG & pgvector
	// (2 Modules, 4 Lessons including Reading on HNSW Vector Index & Coding Lab on 3-Tier RAG Cosine Retrieval, 6 VideoSegments)
	// =========================================================================
	course3.TotalLessons = 4
	db.Save(&course3)

	mod3_1 := entity.Module{
		CourseID:      course3.ID,
		Title:         "Chương 1: Cơ sở Dữ liệu Vector PostgreSQL pgvector, Chỉ mục HNSW & Không gian Nhúng 1536 Chiều",
		Description:   "Biểu diễn ngữ nghĩa văn bản bằng OpenAI text-embedding-3-small, toán học Cosine Similarity và cấu trúc đồ thị HNSW.",
		OrderIndex:    1,
		DueDaysOffset: 7,
		IsPublished:   true,
	}
	mod3_2 := entity.Module{
		CourseID:      course3.ID,
		Title:         "Chương 2: Kiến trúc 3-Tier Multi-Modal Video RAG, GPT-4o Vision & Trợ lý Ảo Thời gian thực",
		Description:   "Tích hợp tìm kiếm ngữ nghĩa 3 tầng (Vector Semantic -> Timestamp Match -> Transcript Slice) với GPT-4o Vision đọc slide video.",
		OrderIndex:    2,
		DueDaysOffset: 14,
		IsPublished:   true,
	}
	db.Create(&mod3_1)
	db.Create(&mod3_2)

	transcriptC3L1 := `[00:00] Chào mừng các bạn đến với khóa học Xây dựng Trợ lý Ảo Thông minh với Multi-Modal RAG và pgvector. Trong Bài 1, chúng ta khám phá cách chuyển đổi nội dung bài giảng thành vector 1536 chiều.
[03:30] Thay vì chỉ tìm kiếm khớp từ khóa chính xác (exact keyword match), mô hình nhúng (Embedding Model) ánh xạ các đoạn văn bản có cùng ý nghĩa học thuật về gần nhau trong không gian vector 1536 chiều. Khoảng cách Cosine trên pgvector được truy vấn bằng toán tử <=>.
[07:50] Khi số lượng phân đoạn video và tài liệu lên tới hàng trăm nghìn bản ghi, quét tuần tự (Sequential Scan) trở nên chậm chạp. Chỉ mục HNSW (Hierarchical Navigable Small World) xây dựng đồ thị nhiều tầng giúp tra cứu láng giềng gần nhất (ANN) với độ trễ dưới 5 mili-giây.`

	lesson3_1 := entity.Lesson{
		CourseID:            course3.ID,
		ModuleID:            mod3_1.ID,
		Title:               "Bài 1: Không gian Vector Nhúng 1536 Chiều, Độ tương đồng Cosine & Tối ưu Truy vấn pgvector",
		LessonType:          "video",
		VideoURL:            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
		VideoDuration:       1020,
		TextContent:         transcriptC3L1,
		Summary:             "Biểu diễn ngữ nghĩa 1536 chiều, toán tử khoảng cách Cosine (<=>) trong PostgreSQL pgvector và chuẩn hóa vector L2.",
		CachedTranscript:    transcriptC3L1,
		TranscriptionStatus: "completed",
		OrderIndex:          1,
		AllowSkip:           false,
		IsPublished:         true,
	}

	readingHNSW := `### Bài Đọc Chuyên sâu: Chỉ mục Đồ thị Phân tầng HNSW (Hierarchical Navigable Small World) trên pgvector

#### 1. Bài toán Tìm kiếm Láng giềng Gần nhất Xấp xỉ (ANN)
Với tập $N$ vector nhúng $\mathbf{v} \in \mathbb{R}^{1536}$, độ tương đồng Cosine giữa câu hỏi $\mathbf{q}$ và phân đoạn bài giảng $\mathbf{v}$ là:
$$\text{sim}(\mathbf{q}, \mathbf{v}) = \frac{\mathbf{q} \cdot \mathbf{v}}{\|\mathbf{q}\|_2 \|\mathbf{v}\|_2} = 1 - (\mathbf{q} \Leftrightarrow \mathbf{v})$$

#### 2. Cấu trúc Đồ thị Phân tầng HNSW
Tương tự ý tưởng của **Skip List** kết hợp đồ thị **Navigable Small World**:
- **Tầng trên cùng (Layer $L$)**: Chứa rất ít nút với các cạnh nối dài (long-range links) giúp nhảy nhanh qua không gian vector.
- **Tầng dưới cùng (Layer $0$)**: Chứa toàn bộ các vector dữ liệu để tinh chỉnh cục bộ chính xác.
- **Tham số cấu hình trên PostgreSQL**:
  ` + "```sql\nCREATE INDEX ON video_segments USING hnsw (embedding vector_cosine_ops)\nWITH (m = 16, ef_construction = 64);\n```" + `
  Trong đó ` + "`m`" + ` là số cạnh tối đa mỗi nút và ` + "`ef_construction`" + ` kiểm soát độ rộng danh sách ứng viên khi dựng đồ thị.`

	lesson3_2 := entity.Lesson{
		CourseID:            course3.ID,
		ModuleID:            mod3_1.ID,
		Title:               "Bài 2 (Reading): Kiến trúc Đồ thị Phân tầng HNSWVector Index & Tinh chỉnh Tham số m, ef_construction",
		LessonType:          "reading",
		VideoDuration:       480,
		TextContent:         readingHNSW,
		Summary:             "Phân tích cấu trúc Skip-Graph nhiều tầng của HNSW, công thức khoảng cách Cosine và câu lệnh tạo chỉ mục trên PostgreSQL.",
		CachedTranscript:    readingHNSW,
		TranscriptionStatus: "completed",
		OrderIndex:          2,
		AllowSkip:           true,
		IsPublished:         true,
	}

	transcriptC3L3 := `[00:00] Trong Bài 3, chúng ta thiết kế kiến trúc 3-Tier Video RAG độc quyền cho Trợ lý Ảo AI chống bối rối.
[04:00] Tại sao RAG truyền thống thất bại khi hỗ trợ sinh viên xem video bài giảng? Bởi vì câu hỏi của sinh viên thường gắn liền với đúng giây video đang tạm dừng và hình ảnh công thức trên slide! Do đó, Tier 1 truy vấn ngữ nghĩa pgvector có ưu tiên phân đoạn chứa timestamp hiện tại; Tier 2 khớp trực tiếp phân đoạn 5-7 phút theo mốc thời gian; và Tier 3 cắt cửa sổ phụ đề ±90 giây quanh điểm dừng.
[08:30] Hơn thế nữa, khung hình canvas tại giây học sinh bối rối được mã hóa Base64 gửi kèm ngữ cảnh RAG vào GPT-4o Vision, kết hợp 3 phong cách sư phạm (Socrates, Coach, Expert) để giải đáp trúng đích ngay lập tức.`

	lesson3_3 := entity.Lesson{
		CourseID:            course3.ID,
		ModuleID:            mod3_2.ID,
		Title:               "Bài 3: Thiết kế Kiến trúc 3-Tier Multi-Modal Video RAG, GPT-4o Vision & Sư phạm Đa phong cách",
		LessonType:          "video",
		VideoURL:            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoy.mp4",
		VideoDuration:       1080,
		TextContent:         transcriptC3L3,
		Summary:             "Cơ chế chuyển tầng tự động 3-Tier RAG (Vector Semantic -> Timestamp Segment -> Transcript Slice) và đồng bộ GPT-4o Vision.",
		CachedTranscript:    transcriptC3L3,
		TranscriptionStatus: "completed",
		OrderIndex:          3,
		AllowSkip:           false,
		IsPublished:         true,
	}

	lesson3_4 := entity.Lesson{
		CourseID:            course3.ID,
		ModuleID:            mod3_2.ID,
		Title:               "Bài 4 (Coding Lab): Cài đặt Thuật toán Truy xuất 3-Tier RAG Cosine Retrieval & Temporal Boost",
		LessonType:          "coding",
		VideoDuration:       900,
		TextContent:         "Thực hành Coding Lab: Cài đặt hàm `rank_rag_segments(query_vec, segments, current_timestamp)` tính điểm Cosine Similarity kết hợp hệ số thưởng thời gian (+0.15 nếu `start <= current_timestamp <= end`) và trả về ID phân đoạn tốt nhất.",
		Summary:             "Bài tập lập trình tự động chấm điểm kiểm tra thuật toán xếp hạng phân đoạn 3-Tier Video RAG.",
		CachedTranscript:    "Coding Lab: Cài đặt hàm rank_rag_segments kết hợp Cosine Similarity và Temporal Timestamp Boost.",
		TranscriptionStatus: "completed",
		OrderIndex:          4,
		AllowSkip:           true,
		IsPublished:         true,
	}
	db.Create(&lesson3_1)
	db.Create(&lesson3_2)
	db.Create(&lesson3_3)
	db.Create(&lesson3_4)

	// 6 VideoSegments for Course 3 (3 in lesson3_1, 3 in lesson3_3)
	c3Segments := []entity.VideoSegment{
		{
			LessonID:         lesson3_1.ID,
			SegmentOrder:     1,
			StartTimestamp:   0,
			EndTimestamp:     340,
			Title:            "Phân đoạn 1: Mô hình Nhúng (Embedding Model) & Không gian Ngữ nghĩa 1536 Chiều",
			Summary:          "Cách OpenAI text-embedding-3-small biến đổi khái niệm học thuật thành vector thực 1536 chiều",
			Transcript:       "Mô hình nhúng ánh xạ mỗi đoạn transcript bài giảng thành một vector 1536 số thực đã chuẩn hóa L2. Các khái niệm đồng nghĩa dù khác từ vựng vẫn có góc Cosine rất nhỏ trong không gian này.",
			KeyConceptsJSON:  `["Text Embeddings","1536 Dimensions","L2 Normalization"]`,
			QuizQuestionJSON: `{"question":"Ưu điểm lớn nhất của tìm kiếm ngữ nghĩa bằng Vector Embedding so với tìm kiếm từ khóa LIKE '%...%' truyền thống là gì?","options":["Tìm được đúng đoạn bài giảng giải thích khái niệm ngay cả khi học sinh diễn đạt bằng từ vựng khác","Không cần lưu dữ liệu vào cơ sở dữ liệu","Chỉ hoạt động với các từ tiếng Anh dài dưới 3 ký tự","Giảm dung lượng ổ cứng về 0 byte"],"correctAnswer":0,"explanation":"Vector Embedding nắm bắt ý nghĩa ngữ nghĩa sâu của câu hỏi thay vì chỉ so khớp ký tự bề mặt."}`,
		},
		{
			LessonID:         lesson3_1.ID,
			SegmentOrder:     2,
			StartTimestamp:   340,
			EndTimestamp:     680,
			Title:            "Phân đoạn 2: Toán tử Khoảng cách Cosine (<=>) trong PostgreSQL pgvector",
			Summary:          "Truy vấn SQL kết hợp lọc khóa học/bài giảng và sắp xếp theo khoảng cách Cosine",
			Transcript:       "Trong PostgreSQL pgvector, toán tử <=> tính khoảng cách Cosine (1 - Cosine Similarity). Do đó, để lấy các phân đoạn tương đồng nhất, ta sắp xếp ORDER BY embedding <=> $1 ASC LIMIT 5.",
			KeyConceptsJSON:  `["pgvector <=> Operator","Cosine Distance vs Similarity","Hybrid SQL Filtering"]`,
			QuizQuestionJSON: `{"question":"Trong tiện ích mở rộng pgvector của PostgreSQL, toán tử nào dùng để tính Khoảng cách Cosine (Cosine Distance)?","options":["<=>","<->","<#>","=="],"correctAnswer":0,"explanation":"Trong pgvector, <=> là khoảng cách Cosine, <-> là khoảng cách Euclid L2, và <#> là tích vô hướng âm."}`,
		},
		{
			LessonID:         lesson3_1.ID,
			SegmentOrder:     3,
			StartTimestamp:   680,
			EndTimestamp:     1020,
			Title:            "Phân đoạn 3: Chỉ mục Đồ thị Phân tầng HNSW Tăng tốc Truy vấn Thời gian thực",
			Summary:          "Cơ chế duyệt đồ thị từ tầng thưa xuống tầng dày của HNSW",
			Transcript:       "Chỉ mục HNSW xây dựng nhiều tầng đồ thị láng giềng. Khi truy vấn, thuật toán bắt đầu từ tầng cao nhất với bước nhảy lớn rồi hạ dần xuống tầng 0 để tìm ra top-K vector gần nhất chỉ trong vài mili-giây.",
			KeyConceptsJSON:  `["HNSW Index","Multi-layer Navigable Graph","Sub-5ms ANN Search"]`,
			QuizQuestionJSON: `{"question":"Tại sao chỉ mục HNSW lại đạt tốc độ truy vấn nhanh vượt trội so với quét tuần tự toàn bảng (Sequential Scan)?","options":["Nhờ cấu trúc đồ thị phân tầng giúp nhảy bước dài ở tầng trên và thu hẹp vùng tìm kiếm logarit ở tầng dưới","Vì HNSW xóa bỏ 90% dữ liệu trong bảng","Vì HNSW chỉ kiểm tra vector đầu tiên trong bảng","Vì HNSW giảm số chiều từ 1536 xuống 1 chiều"],"correctAnswer":0,"explanation":"Cấu trúc đồ thị phân tầng HNSW cho phép độ phức tạp tìm kiếm trung bình đạt O(log N)."}`,
		},
		{
			LessonID:         lesson3_3.ID,
			SegmentOrder:     1,
			StartTimestamp:   0,
			EndTimestamp:     360,
			Title:            "Phân đoạn 1: Kiến trúc 3-Tier Video RAG Chống Suy giảm Ngữ cảnh",
			Summary:          "Sự phối hợp giữa Tier 1 (pgvector), Tier 2 (Timestamp Segment) và Tier 3 (Transcript Window)",
			Transcript:       "Kiến trúc 3-Tier RAG đảm bảo Trợ lý Ảo luôn có ngữ cảnh chính xác: Tier 1 tìm kiếm vector kết hợp ưu tiên phân đoạn hiện tại; nếu không có vector thì Tier 2 khớp theo khoảng [startTimestamp, endTimestamp] và Tier 3 trích xuất cửa sổ phụ đề quanh giây tạm dừng.",
			KeyConceptsJSON:  `["Tier 1 Vector Semantic","Tier 2 Timestamp Match","Tier 3 Transcript Window"]`,
			QuizQuestionJSON: `{"question":"Trong kiến trúc 3-Tier Video RAG, khi nào hệ thống tự động chuyển sang Tier 2 (Timestamp Segment Match)?","options":["Khi tìm kiếm vector ở Tier 1 không khả dụng hoặc không vượt ngưỡng tương đồng, hệ thống lấy phân đoạn chứa mốc thời gian hiện tại của video","Khi học sinh đóng trình duyệt","Khi video chưa có tiêu đề","Khi học sinh đạt 100 điểm"],"correctAnswer":0,"explanation":"Cơ chế fallback 3 tầng đảm bảo AI Tutor luôn trích xuất đúng nội dung tại giây video học sinh đang xem."}`,
		},
		{
			LessonID:         lesson3_3.ID,
			SegmentOrder:     2,
			StartTimestamp:   360,
			EndTimestamp:     720,
			Title:            "Phân đoạn 2: Đồng bộ Khung hình Slide Video với GPT-4o Vision",
			Summary:          "Giải mã công thức toán học và sơ đồ trực quan ngay trên khung hình video đang dừng",
			Transcript:       "Nhiều công thức hoặc biểu đồ chỉ xuất hiện trên slide hình ảnh mà không được đọc chi tiết trong lời giảng. Việc chụp khung hình HTML5 Canvas tại giây học sinh bối rối và gửi vào GPT-4o Vision giúp giải thích trọn vẹn cả hình ảnh lẫn âm thanh.",
			KeyConceptsJSON:  `["GPT-4o Vision","HTML5 Canvas Frame Capture","Multimodal Slide Understanding"]`,
			QuizQuestionJSON: `{"question":"Việc kết hợp chụp khung hình video (Frame Capture) đưa vào GPT-4o Vision cùng với Transcript RAG giải quyết vấn đề gì?","options":["Giúp AI đọc hiểu được cả sơ đồ, biểu đồ và công thức toán trên slide mà giảng viên chỉ trỏ tới nhưng không đọc thành lời","Để giảm dung lượng bộ nhớ RAM","Để thay đổi màu sắc giao diện web","Để tắt phụ đề tiếng Việt"],"correctAnswer":0,"explanation":"Multi-Modal RAG kết hợp kênh thị giác (slide frame) và kênh ngôn ngữ (transcript/tài liệu PDF) để hiểu đầy đủ ngữ cảnh bài giảng."}`,
		},
		{
			LessonID:         lesson3_3.ID,
			SegmentOrder:     3,
			StartTimestamp:   720,
			EndTimestamp:     1080,
			Title:            "Phân đoạn 3: Trợ lý Ảo 3 Phong cách Sư phạm (Socrates, Coach, Expert) & Streaming SSE",
			Summary:          "Cá nhân hóa phản hồi theo tâm lý học tập và truyền phát token thời gian thực qua Server-Sent Events",
			Transcript:       "Mỗi sinh viên có nhu cầu hỗ trợ khác nhau: chế độ Socrates đặt câu hỏi gợi mở tư duy, chế độ Coach động viên và chia nhỏ từng bước dễ hiểu, còn chế độ Expert phân tích sâu bản chất toán học và độ phức tạp.",
			KeyConceptsJSON:  `["Socratic Persona","Coach & Expert Personas","SSE Token Streaming"]`,
			QuizQuestionJSON: `{"question":"Phong cách sư phạm (Persona) nào của AI Tutor chuyên đặt câu hỏi gợi mở để dẫn dắt sinh viên tự tìm ra lời giải thay vì đưa ngay đáp án?","options":["Socrates (Nhà triết học gợi mở)","Expert (Giáo sư học thuật)","Coach (Huấn luyện viên thân thiện)","Compiler (Trình biên dịch)"],"correctAnswer":0,"explanation":"Phương pháp Socratic 유도 sinh viên suy luận qua các câu hỏi định hướng từng bước."}`,
		},
	}
	for i := range c3Segments {
		db.Create(&c3Segments[i])
	}

	// =========================================================================
	// CODING PROBLEMS (Coursera #5 — In-Browser Coding Lab for Course 1, 2, 3)
	// =========================================================================
	cp1 := entity.CodingProblem{
		CourseID:     course1.ID,
		ModuleID:     mod2.ID,
		LessonID:     lesson1Coding.ID,
		Title:        "Lab 1: Phát hiện Trạng thái Đờ mắt (Cognitive Eye-Lock) từ Chuỗi EAR & Đỉnh Mũi",
		Description:  "Viết hàm `detect_eye_lock(ear_values, nose_deltas)` nhận vào danh sách chỉ số mở mắt `ear_values` (5 khung hình liên tiếp) và độ dịch chuyển đỉnh mũi `nose_deltas` (pixel). Hàm trả về `True` nếu trung bình EAR > 0.22, phương sai EAR < 0.002 và trung bình độ dịch chuyển mũi < 3.5; ngược lại trả về `False`.",
		Difficulty:   "medium",
		Language:     "python",
		FunctionName: "detect_eye_lock",
		StarterCode: `def detect_eye_lock(ear_values, nose_deltas):
    # TODO: 1. Tính trung bình (mean) và phương sai (variance) của ear_values
    # TODO: 2. Tính trung bình độ lệch đỉnh mũi (mean_nose) từ nose_deltas
    # TODO: 3. Trả về True nếu mean_ear > 0.22 và var_ear < 0.002 và mean_nose < 3.5
    mean_ear = sum(ear_values) / len(ear_values)
    var_ear = sum((x - mean_ear) ** 2 for x in ear_values) / len(ear_values)
    mean_nose = sum(nose_deltas) / len(nose_deltas)
    return mean_ear > 0.22 and var_ear < 0.002 and mean_nose < 3.5
`,
		SolutionCode:    `mean_ear > 0.22 and var_ear < 0.002 and mean_nose < 3.5`,
		PublicTestsJSON: `[{"name":"Test 1: Học sinh đờ mắt nhìn chằm chằm vào công thức (Eye-Lock)","input":"ear=[0.25, 0.25, 0.26, 0.25, 0.24], nose=[1.2, 1.5, 1.1, 1.4, 1.3]","expected":"True"},{"name":"Test 2: Học sinh chớp mắt bình thường (Phương sai EAR lớn)","input":"ear=[0.28, 0.08, 0.29, 0.10, 0.27], nose=[1.5, 1.6, 1.4, 1.5, 1.2]","expected":"False"},{"name":"Test 3: Học sinh quay đầu sang chỗ khác (Nose delta >= 3.5px)","input":"ear=[0.25, 0.25, 0.25, 0.25, 0.25], nose=[6.2, 7.5, 5.8, 6.0, 7.1]","expected":"False"}]`,
		HiddenTestsJSON: `[{"name":"Hidden Test 4: Ngưỡng biên EAR thấp (Nhắm mắt/Buồn ngủ)","input":"ear=[0.18, 0.18, 0.19, 0.18, 0.18], nose=[1.0, 1.1, 1.0, 1.2, 1.0]","expected":"False"},{"name":"Hidden Test 5: Tập trung cao kèm đờ mắt (Kích hoạt gazeBoost 1.6x)","input":"ear=[0.23, 0.24, 0.23, 0.24, 0.23], nose=[2.1, 2.0, 2.2, 1.9, 2.1]","expected":"True"}]`,
		SolutionHint:    "Gợi ý từ AI Tutor: Phương sai tổng thể được tính bằng `sum((x - mean_ear)**2 for x in ear_values) / len(ear_values)`. Đừng quên kiểm tra đồng thời cả 3 điều kiện: `mean_ear > 0.22`, `var_ear < 0.002`, và `mean_nose < 3.5`.",
		MaxScore:        100.0,
		TimeLimitMs:     2000,
	}
	cp2 := entity.CodingProblem{
		CourseID:     course2.ID,
		ModuleID:     mod2_2.ID,
		LessonID:     lesson2_4.ID,
		Title:        "Lab 2: Thuật toán Kahn Sắp xếp Topo (DAG Topological Sort) & Kiểm tra Chu trình",
		Description:  "Viết hàm `topological_sort_dag(num_nodes, edges)` nhận vào số đỉnh `num_nodes` (đánh số từ `0` đến `num_nodes - 1`) và danh sách cạnh có hướng `[u, v]` (u tiên quyết của v). Sử dụng thuật toán Kahn (mảng `in_degree` và hàng đợi) để trả về danh sách thứ tự Topo. Nếu đồ thị có chu trình, trả về danh sách rỗng `[]`.",
		Difficulty:   "medium",
		Language:     "python",
		FunctionName: "topological_sort_dag",
		StarterCode: `from collections import deque

def topological_sort_dag(num_nodes, edges):
    in_degree = [0] * num_nodes
    adj = [[] for _ in range(num_nodes)]
    for u, v in edges:
        adj[u].append(v)
        in_degree[v] += 1

    queue = deque([i for i in range(num_nodes) if in_degree[i] == 0])
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in adj[u]:
            in_degree[v] -= 1
            if in_degree[v] == 0:
                queue.append(v)

    return order if len(order) == num_nodes else []
`,
		SolutionCode:    `in_degree`,
		PublicTestsJSON: `[{"name":"Test 1: Đồ thị DAG 4 môn học tiên quyết tuyến tính","input":"num_nodes=4, edges=[[0,1],[1,2],[2,3]]","expected":"[0, 1, 2, 3]"},{"name":"Test 2: Đồ thị DAG rẽ nhánh hình thoi","input":"num_nodes=4, edges=[[0,1],[0,2],[1,3],[2,3]]","expected":"[0, 1, 2, 3]"},{"name":"Test 3: Đồ thị có chu trình 0 -> 1 -> 2 -> 0","input":"num_nodes=3, edges=[[0,1],[1,2],[2,0]]","expected":"[]"}]`,
		HiddenTestsJSON: `[{"name":"Hidden Test 4: Đồ thị 2 thành phần liên thông độc lập","input":"num_nodes=4, edges=[[0,2],[1,3]]","expected":"[0, 1, 2, 3]"},{"name":"Hidden Test 5: Chu trình cục bộ ở nhánh phụ","input":"num_nodes=4, edges=[[0,1],[1,2],[2,1],[2,3]]","expected":"[]"}]`,
		SolutionHint:    "Gợi ý từ AI Tutor: Hãy khởi tạo mảng `in_degree = [0] * num_nodes`, tăng `in_degree[v] += 1` cho mỗi cạnh `(u, v)`. Sau khi duyệt BFS, nếu `len(order) < num_nodes` thì đồ thị chắc chắn chứa chu trình và phải trả về `[]`!",
		MaxScore:        100.0,
		TimeLimitMs:     2000,
	}
	cp3 := entity.CodingProblem{
		CourseID:     course3.ID,
		ModuleID:     mod3_2.ID,
		LessonID:     lesson3_4.ID,
		Title:        "Lab 3: Bộ Truy xuất Ngữ nghĩa 3-Tier Video RAG (Cosine Similarity & Temporal Boost)",
		Description:  "Viết hàm `rank_rag_segments(query_vec, segments, current_ts)` tính điểm tương đồng Cosine giữa `query_vec` và mỗi phân đoạn trong `segments`. Nếu `start <= current_ts <= end`, cộng thêm hệ số ưu tiên thời gian `temporal_boost = 0.15`. Trả về `id` của phân đoạn có tổng điểm cao nhất.",
		Difficulty:   "hard",
		Language:     "python",
		FunctionName: "rank_rag_segments",
		StarterCode: `import math

def cosine_sim(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return dot / (norm_a * norm_b + 1e-9)

def rank_rag_segments(query_vec, segments, current_ts):
    best_id = -1
    best_score = -1.0
    for seg in segments:
        score = cosine_sim(query_vec, seg["vec"])
        if seg["start"] <= current_ts <= seg["end"]:
            score += 0.15
        if score > best_score:
            best_score = score
            best_id = seg["id"]
    return best_id
`,
		SolutionCode:    `cosine_sim`,
		PublicTestsJSON: `[{"name":"Test 1: Khớp ngữ nghĩa kết hợp ưu tiên phân đoạn tại giây 465","input":"query=[1.0, 0.0], segments=[{id:1, start:0, end:330, vec:[0.9, 0.1]}, {id:2, start:330, end:680, vec:[0.88, 0.12]}], current_ts=465","expected":"2"},{"name":"Test 2: Truy xuất ngữ nghĩa thuần túy khi câu hỏi thuộc phân đoạn khác","input":"query=[0.0, 1.0], segments=[{id:1, start:0, end:330, vec:[0.1, 0.99]}, {id:2, start:330, end:680, vec:[0.9, 0.1]}], current_ts=465","expected":"1"}]`,
		HiddenTestsJSON: `[{"name":"Hidden Test 3: Chuẩn hóa L2 với vector độ dài khác nhau","input":"query=[2.0, 2.0], segments=[{id:10, start:0, end:300, vec:[1.0, 1.0]}, {id:20, start:300, end:600, vec:[1.0, 0.0]}], current_ts=150","expected":"10"}]`,
		SolutionHint:    "Gợi ý từ AI Tutor: Công thức Cosine Similarity cần chia tích vô hướng `dot` cho tích độ dài chuẩn L2 `norm_a * norm_b`. Đừng quên cộng `+ 0.15` khi `seg['start'] <= current_ts <= seg['end']` để ưu tiên phân đoạn học sinh đang dừng video!",
		MaxScore:        100.0,
		TimeLimitMs:     2000,
	}
	db.Create(&cp1)
	db.Create(&cp2)
	db.Create(&cp3)

	// Seed a passed CodingSubmission for student on Course 1 Lab 1
	db.Create(&entity.CodingSubmission{
		ProblemID:       cp1.ID,
		CourseID:        course1.ID,
		LessonID:        lesson1Coding.ID,
		UserID:          student.ID,
		Language:        "python",
		Code:            cp1.StarterCode,
		PassedTests:     5,
		TotalTests:      5,
		Score:           100.0,
		Status:          "passed",
		TestResultsJSON: `[{"name":"Test 1: Học sinh đờ mắt nhìn chằm chằm vào công thức (Eye-Lock)","passed":true,"runtimeMs":8},{"name":"Test 2: Học sinh chớp mắt bình thường","passed":true,"runtimeMs":7},{"name":"Test 3: Học sinh quay đầu sang chỗ khác","passed":true,"runtimeMs":9}]`,
		RuntimeMs:       24,
	})

	// Seed SegmentQuizAttempts for student on Course 1 so Gradebook shows Segment Quiz progress
	db.Create(&entity.SegmentQuizAttempt{
		UserID:          student.ID,
		LessonID:        lesson1.ID,
		SegmentID:       seg1.ID,
		SelectedAnswer:  0,
		IsCorrect:       true,
		AttemptCount:    1,
		TriggeredRewind: false,
	})
	db.Create(&entity.SegmentQuizAttempt{
		UserID:          student.ID,
		LessonID:        lesson1.ID,
		SegmentID:       seg2.ID,
		SelectedAnswer:  0,
		IsCorrect:       true,
		AttemptCount:    1,
		TriggeredRewind: false,
	})

	// =========================================================================
	// SPECIALIZATIONS (Coursera #4 — Multi-Course Specialization + Capstone)
	// =========================================================================
	spec1 := entity.Specialization{
		Title:           "Chuyên ngành AI & Thị giác Máy tính Toàn diện (3 Khóa học + Capstone Project)",
		Slug:            "chuyen-nganh-ai-thi-giac-may-tinh-toan-dien",
		Subtitle:        "Lộ trình chuẩn Coursera từ Nền tảng Thuật toán (AVL, DAG), Thị giác Máy tính 3D MediaPipe đến Đồ án Tốt nghiệp Multi-Modal RAG & pgvector",
		Description:     "Chương trình đào tạo chuyên sâu gồm 3 khóa học liên thông giúp sinh viên làm chủ trọn vẹn chuỗi công nghệ: (1) Thị giác Máy tính & Phát hiện Cảm xúc Đa phương thức bằng MediaPipe/BiLSTM, (2) Cấu trúc Dữ liệu Nâng cao Cây AVL & Đồ thị DAG, và (3) Đồ án Capstone xây dựng Trợ lý Ảo Thông minh Multi-Modal 3-Tier RAG trên PostgreSQL pgvector.",
		ShortDesc:       "Chuỗi 3 khóa học cốt lõi + Capstone Project đào tạo Kỹ sư AI & Computer Vision toàn diện.",
		Category:        "AI & Computer Vision",
		Level:           "intermediate",
		ThumbnailURL:    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80",
		SkillsJSON:      `["MediaPipe 478 Landmarks","BiLSTM & Attention","AVL Tree & DAG Topological Sort","PostgreSQL pgvector HNSW","3-Tier Multi-Modal RAG","GPT-4o Vision"]`,
		TotalCourses:    3,
		EstimatedMonths: 4,
		TotalLearners:   145,
		RatingAvg:       4.9,
		IsPublished:     true,
	}
	db.Create(&spec1)
	db.Create(&entity.SpecializationCourse{
		SpecializationID: spec1.ID,
		CourseID:         course1.ID,
		OrderIndex:       1,
		IsCapstone:       false,
	})
	db.Create(&entity.SpecializationCourse{
		SpecializationID: spec1.ID,
		CourseID:         course2.ID,
		OrderIndex:       2,
		IsCapstone:       false,
	})
	db.Create(&entity.SpecializationCourse{
		SpecializationID: spec1.ID,
		CourseID:         course3.ID,
		OrderIndex:       3,
		IsCapstone:       true,
	})
	db.Create(&entity.SpecializationEnrollment{
		UserID:           student.ID,
		SpecializationID: spec1.ID,
		ProgressPercent:  54.0,
		CompletedCourses: 1,
		Status:           "active",
	})

	// Enrollments & Lesson Progress & Notes
	targetEnd1 := now.AddDate(0, 0, 14)
	targetEnd2 := now.AddDate(0, 0, 21)
	db.Create(&entity.Enrollment{
		UserID:             student.ID,
		CourseID:           course1.ID,
		ProgressPercent:    75.0,
		CompletedLessons:   3,
		LastWatchedLesson:  lesson1.ID,
		Status:             "active",
		DeadlineOffsetDays: 0,
		TargetEndDate:      &targetEnd1,
	})
	db.Create(&entity.Enrollment{
		UserID:             student.ID,
		CourseID:           course2.ID,
		ProgressPercent:    50.0,
		CompletedLessons:   2,
		LastWatchedLesson:  lesson2_1.ID,
		Status:             "active",
		DeadlineOffsetDays: 0,
		TargetEndDate:      &targetEnd2,
	})
	db.Create(&entity.Enrollment{
		UserID:             student.ID,
		CourseID:           course3.ID,
		ProgressPercent:    25.0,
		CompletedLessons:   1,
		LastWatchedLesson:  lesson3_1.ID,
		Status:             "active",
		DeadlineOffsetDays: 0,
		TargetEndDate:      &targetEnd2,
	})
	db.Create(&entity.Enrollment{
		UserID:            student2.ID,
		CourseID:          course1.ID,
		ProgressPercent:   92.0,
		CompletedLessons:  3,
		LastWatchedLesson: lesson2.ID,
		Status:            "active",
	})
	db.Create(&entity.Enrollment{
		UserID:            student3.ID,
		CourseID:          course1.ID,
		ProgressPercent:   22.0,
		CompletedLessons:  0,
		LastWatchedLesson: lesson1.ID,
		Status:            "active",
	})

	db.Create(&entity.LessonProgress{
		UserID:              student.ID,
		CourseID:            course1.ID,
		LessonID:            lesson1.ID,
		LastWatchedPosition: 1080,
		MaxReachedPosition:  1080,
		WatchedSeconds:      1080,
		WatchedRangesJSON:   `[[0, 1080]]`,
		IsCompleted:         true,
		CompletedAt:         &now,
	})
	db.Create(&entity.LessonProgress{
		UserID:              student.ID,
		CourseID:            course1.ID,
		LessonID:            lesson1Reading.ID,
		LastWatchedPosition: 420,
		MaxReachedPosition:  420,
		WatchedSeconds:      420,
		WatchedRangesJSON:   `[[0, 420]]`,
		IsCompleted:         true,
		CompletedAt:         &now,
	})
	db.Create(&entity.LessonProgress{
		UserID:              student.ID,
		CourseID:            course1.ID,
		LessonID:            lesson1Coding.ID,
		LastWatchedPosition: 900,
		MaxReachedPosition:  900,
		WatchedSeconds:      900,
		WatchedRangesJSON:   `[[0, 900]]`,
		IsCompleted:         true,
		CompletedAt:         &now,
	})
	db.Create(&entity.LessonProgress{
		UserID:              student.ID,
		CourseID:            course2.ID,
		LessonID:            lesson2_1.ID,
		LastWatchedPosition: 1050,
		MaxReachedPosition:  1050,
		WatchedSeconds:      1050,
		WatchedRangesJSON:   `[[0, 1050]]`,
		IsCompleted:         true,
		CompletedAt:         &now,
	})

	db.Create(&entity.LessonNote{
		UserID:         student.ID,
		LessonID:       lesson1.ID,
		VideoTimestamp: 190,
		Content:        "Công thức chuẩn hóa tọa độ 3D theo đỉnh mũi landmark[1]: giúp loại bỏ sai số khoảng cách ngồi.",
		ColorTag:       "yellow",
	})
	db.Create(&entity.LessonNote{
		UserID:         student.ID,
		LessonID:       lesson1.ID,
		VideoTimestamp: 465,
		Content:        "Lưu ý ngưỡng EAR > 0.22 và Var(EAR) < 0.002 dùng để phát hiện trạng thái mắt nhìn bất động khi đọc công thức.",
		ColorTag:       "blue",
	})

	db.Create(&entity.CourseReview{
		CourseID:     course1.ID,
		UserID:       student2.ID,
		Rating:       5,
		Comment:      "Khóa học giải thích rất trực quan về MediaPipe và BiLSTM. Tính năng Trợ lý Ảo AI tự động hiện giải thích ngay khi mình tua lại đoạn công thức EAR thực sự cực kỳ hữu ích!",
		TeacherReply: "Cảm ơn Lan Anh! Hãy thử chuyển sang chế độ Giáo sư (Expert) hoặc Socrates trong khung AI Tutor để đào sâu hơn nhé.",
		RepliedAt:    &now,
		HelpfulCount: 14,
	})

	// Proctoring Violations (both face_absent_30s and identity_mismatch) for Admin & Teacher inspection
	db.Create(&entity.ProctoringViolation{
		UserID:          student3.ID,
		LessonID:        lesson1.ID,
		CourseID:        course1.ID,
		ViolationType:   "face_absent_30s",
		VideoTimestamp:  410,
		DurationSeconds: 35,
		SimilarityScore: 0.0,
		Details:         "Không phát hiện khuôn mặt trước camera liên tục trong 35 giây (6 chu kỳ kiểm tra 5s liên tiếp) khi đang phát Phân đoạn 2.",
		Status:          "pending",
		Severity:        "medium",
	})
	db.Create(&entity.ProctoringViolation{
		UserID:          student3.ID,
		LessonID:        lesson1.ID,
		CourseID:        course1.ID,
		ViolationType:   "identity_mismatch",
		VideoTimestamp:  740,
		DurationSeconds: 15,
		SimilarityScore: 0.34,
		Details:         "Độ tương đồng Cosine MobileFaceNet 192-d đạt 0.34 (thấp hơn ngưỡng an toàn 0.55 trên cả 3 góc mặt: Chính diện, Trái, Phải). Nghi vấn người lạ ngồi thay trước camera.",
		Status:          "flagged",
		Severity:        "high",
		AdminNote:       "Cần giảng viên nhắc nhở và kiểm tra lại dữ liệu điểm danh buổi học.",
	})
	db.Create(&entity.ProctoringViolation{
		UserID:          student.ID,
		LessonID:        lesson2_1.ID,
		CourseID:        course2.ID,
		ViolationType:   "face_absent_30s",
		VideoTimestamp:  520,
		DurationSeconds: 30,
		SimilarityScore: 0.0,
		Details:         "Sinh viên rời khỏi khung hình camera 30 giây khi xem bài giảng Cây Cân bằng AVL.",
		Status:          "resolved",
		Severity:        "low",
		AdminNote:       "Sinh viên đã xác nhận cúi xuống ghi chép công thức phép quay LR.",
		ResolvedByID:    admin.ID,
		ResolvedAt:      &now,
	})

	// 6. Confusion Logs & Episodes (for Student & Teacher Analytics Hotspots!)
	db.Create(&entity.ConfusionLog{
		UserID:              student.ID,
		CourseID:            course1.ID,
		LessonID:            lesson1.ID,
		SegmentID:           seg2.ID,
		VideoTimestamp:      465,
		WindowStartSec:      330,
		WindowEndSec:        680,
		PauseCount:          4,
		AvgPauseDuration:    14.5,
		LongPauseCount:      2,
		RewindCount:         3,
		RewindSameSpot:      2,
		SpeedDecrease:       1,
		ConfusedRatio:       0.58,
		FrustratedRatio:     0.25,
		EmotionTransitions:  4,
		NegEmotionStreak:    3,
		QuizScore:           40,
		QuizTime:            52,
		DominantEmotion:     "confused",
		EmotionConfidence:   0.86,
		GazeStillness:       true,
		EyeLockedEAR:        true,
		EARValue:            0.23,
		RuleScore:           75.0,
		MLProbability:       0.87,
		ConfusionLevel:      "high",
		IsConfused:          true,
		SelfReportLevel:     3,
		EmotionTimelineJSON: `[{"t":420,"emotion":"focused","confidence":0.82,"ear":0.26,"gazeStill":false},{"t":450,"emotion":"confused","confidence":0.79,"ear":0.24,"gazeStill":true},{"t":465,"emotion":"confused","confidence":0.86,"ear":0.23,"gazeStill":true}]`,
	})
	db.Create(&entity.ConfusionLog{
		UserID:             student3.ID,
		CourseID:           course1.ID,
		LessonID:           lesson1.ID,
		SegmentID:          seg2.ID,
		VideoTimestamp:     470,
		WindowStartSec:     330,
		WindowEndSec:       680,
		PauseCount:         5,
		AvgPauseDuration:   19.0,
		LongPauseCount:     3,
		RewindCount:        4,
		RewindSameSpot:     3,
		SpeedDecrease:      1,
		ConfusedRatio:      0.65,
		FrustratedRatio:    0.32,
		EmotionTransitions: 5,
		NegEmotionStreak:   4,
		QuizScore:          30,
		QuizTime:           65,
		DominantEmotion:    "confused",
		EmotionConfidence:  0.84,
		GazeStillness:      true,
		EyeLockedEAR:       true,
		EARValue:           0.23,
		RuleScore:          82.0,
		MLProbability:      0.91,
		ConfusionLevel:     "high",
		IsConfused:         true,
	})

	db.Create(&entity.ConfusionEpisode{
		UserID:            student.ID,
		CourseID:          course1.ID,
		LessonID:          lesson1.ID,
		SegmentID:         seg2.ID,
		VideoTimestamp:    465,
		TriggerSource:     "ml_model",
		MLProbability:     0.87,
		RuleScore:         75.0,
		DominantEmotion:   "confused",
		RetrievalTier:     "vector_semantic",
		SummaryText:       "Chỉ số Mở mắt EAR (Eye Aspect Ratio) đo tỷ lệ độ mở dọc của mí mắt so với chiều ngang mắt. Khi bạn tập trung đọc công thức phức tạp và gặp bối rối, mắt thường mở căng không chớp (EAR > 0.22, phương sai < 0.002) kết hợp với ánh nhìn đứng yên.",
		ContentPointsJSON: `["1. Ý nghĩa tử số và mẫu số trong công thức tính EAR từ 6 điểm mốc quanh mắt","2. Cách phân biệt trạng thái tập trung bình thường với trạng thái đờ mắt (Eye-Lock) do bối rối","3. Cơ chế kết hợp EAR với nhíu mày (AU4) để kích hoạt trợ lý ảo"]`,
		Resolved:          true,
		StudentFeedback:   "understood",
	})

	// 7. Subjects, Classes, Schedules, Attendance & DailyLearningLogs
	subj := entity.Subject{
		TeacherID: teacher.ID,
		Name:      "Thị giác Máy tính & Học sâu",
		Code:      "INT3412",
		Credits:   3,
	}
	db.Create(&subj)

	cls := entity.Class{
		SubjectID:   subj.ID,
		CourseID:    course1.ID,
		TeacherID:   teacher.ID,
		Name:        "Lớp Thị giác Máy tính INT3412-01",
		Code:        "CV2026",
		Room:        "A2-304",
		MaxStudents: 50,
	}
	db.Create(&cls)
	db.Create(&entity.ClassStudent{
		ClassID:   cls.ID,
		StudentID: student.ID,
		Status:    "active",
	})
	db.Create(&entity.ClassStudent{
		ClassID:   cls.ID,
		StudentID: student2.ID,
		Status:    "active",
	})
	db.Create(&entity.ClassStudent{
		ClassID:   cls.ID,
		StudentID: student3.ID,
		Status:    "active",
	})

	sched1 := entity.Schedule{
		UserID:            student.ID,
		ClassID:           cls.ID,
		CourseID:          course1.ID,
		Title:             "Thị giác Máy tính & Học sâu (INT3412)",
		EventType:         "lecture",
		Room:              "Phòng Lab AI A2-304",
		DayOfWeek:         2,
		StartTime:         "07:30",
		EndTime:           "10:30",
		Credits:           3,
		CurrentAbsences:   1,
		MaxAbsences:       6,
		AttendanceScore:   9.0,
		PracticeScore:     8.8,
		MidtermScore:      8.5,
		TargetScore:       3.8,
		RequiredExamScore: 8.2,
		Notes:             "Mang theo laptop chạy thực hành MediaPipe & ONNX Runtime",
	}
	sched2 := entity.Schedule{
		UserID:            student.ID,
		ClassID:           cls.ID,
		CourseID:          course3.ID,
		Title:             "Xử lý Ngôn ngữ Tự nhiên & Hệ thống RAG (INT3508)",
		EventType:         "lecture",
		Room:              "Giảng đường B1-202",
		DayOfWeek:         4,
		StartTime:         "13:30",
		EndTime:           "16:30",
		Credits:           3,
		CurrentAbsences:   0,
		MaxAbsences:       6,
		AttendanceScore:   10.0,
		PracticeScore:     9.0,
		MidtermScore:      8.5,
		TargetScore:       3.8,
		RequiredExamScore: 8.0,
		Notes:             "Thuyết trình đồ án nhóm về pgvector RAG",
	}
	db.Create(&sched1)
	db.Create(&sched2)

	todayStr := now.Format("2006-01-02")
	db.Create(&entity.DailyLearningLog{
		UserID:              student.ID,
		CourseID:            course1.ID,
		LessonID:            lesson1.ID,
		ClassID:             cls.ID,
		LogDate:             todayStr,
		TotalWatchSeconds:   980,
		VideoTotalSeconds:   1080,
		WatchPercentage:     90.7,
		QuizCompleted:       true,
		QuizScore:           90.0,
		FaceVerified:        true,
		ViolationCount:      0,
		AttendanceFinalized: true,
		FinalStatus:         "present",
	})
	db.Create(&entity.Attendance{
		ClassID:         cls.ID,
		CourseID:        course1.ID,
		LessonID:        lesson1.ID,
		StudentID:       student.ID,
		SessionDate:     todayStr,
		Status:          "present",
		Method:          "ai_auto",
		WatchPercentage: 90.7,
		QuizCompleted:   true,
		AbsenceReason:   "Điểm danh AI tự động: Xem >= 80% thời lượng bài giảng & hoàn thành Quiz phân đoạn",
	})
	db.Create(&entity.Attendance{
		ClassID:         cls.ID,
		CourseID:        course1.ID,
		LessonID:        lesson1.ID,
		StudentID:       student3.ID,
		SessionDate:     todayStr,
		Status:          "absent",
		Method:          "ai_auto",
		WatchPercentage: 22.0,
		QuizCompleted:   false,
		AbsenceReason:   "Chỉ xem 22% thời lượng bài giảng (yêu cầu >= 80%); Chưa hoàn thành bài kiểm tra cuối buổi",
	})

	// 8. Quizzes, Questions, Statistics, Leaderboard, Streaks & Achievements
	quiz1 := entity.Quiz{
		CourseID:         course1.ID,
		ModuleID:         mod1.ID,
		LessonID:         lesson1.ID,
		CreatorID:        teacher.ID,
		Title:            "Đề Kiểm tra Thích ứng: Thị giác Máy tính MediaPipe & Phát hiện Bối rối Đa phương thức",
		Description:      "Đánh giá kiến thức về lưới 478 điểm mốc 3D, công thức EAR và kiến trúc MLP 12 đặc trưng",
		Difficulty:       "medium",
		TimeLimitMinutes: 15,
		PassingScore:     70.0,
		IsAdaptive:       true,
		GenerationSource: "ai_topic",
		QuestionsCount:   4,
		IsPublished:      true,
	}
	db.Create(&quiz1)

	questions := []entity.Question{
		{
			QuizID:        quiz1.ID,
			QuestionType:  "multiple_choice",
			Content:       "MediaPipe Face Landmarker trích xuất bao nhiêu điểm mốc 3D (3D landmarks) trên khuôn mặt?",
			OptionsJSON:   `["478 điểm mốc 3D","68 điểm mốc 2D","128 điểm mốc","192 điểm mốc"]`,
			CorrectAnswer: "0",
			Explanation:   "MediaPipe Face Landmarker cung cấp lưới 478 điểm mốc 3D bao phủ toàn bộ khuôn mặt, mắt, lông mày, môi và mống mắt.",
			Points:        25,
			Difficulty:    "easy",
			TopicTag:      "MediaPipe",
			OrderIndex:    1,
		},
		{
			QuizID:        quiz1.ID,
			QuestionType:  "multiple_choice",
			Content:       "Trong bộ 12 đặc trưng đa phương thức phát hiện sự bối rối, đặc trưng nào phản ánh hành vi tua lại cùng một vị trí kiến thức nhiều lần?",
			OptionsJSON:   `["pause_count","rewind_same_spot","emotion_transitions","quiz_time"]`,
			CorrectAnswer: "1",
			Explanation:   "rewind_same_spot đếm số lần tối đa học sinh tua đi tua lại cùng một đoạn kiến thức (sai số ±10 giây).",
			Points:        25,
			Difficulty:    "medium",
			TopicTag:      "Multimodal Fusion",
			OrderIndex:    2,
		},
		{
			QuizID:        quiz1.ID,
			QuestionType:  "multiple_choice",
			Content:       "Kiến trúc mạng MLP trong ConfusionPredictor trên Backend Go có cấu trúc các tầng ẩn như thế nào?",
			OptionsJSON:   `["128 -> 64 -> 1","32 -> 16 -> 1","64 -> 32 -> 16 -> 1","256 -> 128 -> 64 -> 1"]`,
			CorrectAnswer: "2",
			Explanation:   "Mạng nơ-ron đa tầng MLP gồm 3 tầng ẩn (64 -> 32 -> 16) dùng hàm kích hoạt ReLU và tầng đầu ra Sigmoid.",
			Points:        25,
			Difficulty:    "medium",
			TopicTag:      "MLP Architecture",
			OrderIndex:    3,
		},
		{
			QuizID:        quiz1.ID,
			QuestionType:  "multiple_choice",
			Content:       "Khi học sinh trả lời sai câu hỏi kiểm tra phân đoạn (Segment Quiz) 3 lần liên tiếp, trình phát thông minh sẽ xử lý ra sao?",
			OptionsJSON:   `["Tự động tua ngược video về đầu phân đoạn 5-7 phút đó (mustRewind = true) để học sinh xem lại","Khóa tài khoản học sinh vĩnh viễn","Tự động bỏ qua bài học","Chuyển sang bài học tiếp theo"]`,
			CorrectAnswer: "0",
			Explanation:   "Quy tắc chống học lướt bắt buộc tua lại về đầu phân đoạn (startTimestamp) khi sai 3 lần liên tiếp.",
			Points:        25,
			Difficulty:    "easy",
			TopicTag:      "Anti-Skip Quiz",
			OrderIndex:    4,
		},
	}
	for i := range questions {
		db.Create(&questions[i])
	}

	quiz2 := entity.Quiz{
		CourseID:         course2.ID,
		ModuleID:         mod2_1.ID,
		LessonID:         lesson2_1.ID,
		CreatorID:        teacher.ID,
		Title:            "Đề Kiểm tra Thích ứng: Cây Cân bằng AVL, Sắp xếp Topo DAG & Quy hoạch Động",
		Description:      "Đánh giá kiến thức về hệ số cân bằng Balance Factor, 4 phép quay LL/RR/LR/RL và thuật toán Kahn trên DAG",
		Difficulty:       "medium",
		TimeLimitMinutes: 15,
		PassingScore:     70.0,
		IsAdaptive:       true,
		GenerationSource: "ai_module",
		QuestionsCount:   4,
		IsPublished:      true,
	}
	db.Create(&quiz2)

	qCourse2 := []entity.Question{
		{
			QuizID:        quiz2.ID,
			QuestionType:  "multiple_choice",
			Content:       "Chiều cao tối đa h của một cây tìm kiếm nhị phân tự cân bằng AVL gồm n nút được chặn trên bởi biểu thức nào?",
			OptionsJSON:   `["h < 1.44 * log2(n + 2)","h = n / 2","h = n","h = 2^n"]`,
			CorrectAnswer: "0",
			Explanation:   "Nhờ điều kiện |BF(u)| <= 1, số nút tối thiểu theo chiều cao tăng theo dãy Fibonacci, đảm bảo h < 1.44 log2(n + 2) = O(log n).",
			Points:        25,
			Difficulty:    "medium",
			TopicTag:      "AVL Tree",
			OrderIndex:    1,
		},
		{
			QuizID:        quiz2.ID,
			QuestionType:  "multiple_choice",
			Content:       "Khi chèn khóa 25 vào cây AVL có gốc 30 (con trái 20), làm nút 30 có BF = +2 và nút 20 có BF = -1, phép quay nào khôi phục cân bằng?",
			OptionsJSON:   `["Phép quay kép Left-Right (LR): quay trái tại 20 rồi quay phải tại 30","Phép quay phải đơn tại 30","Phép quay trái đơn tại 30","Phép quay kép Right-Left (RL)"]`,
			CorrectAnswer: "0",
			Explanation:   "Cấu trúc 30 -> trái 20 -> phải 25 tạo hình chữ Z lệch Left-Right (LR), cần quay trái tại 20 rồi quay phải tại 30.",
			Points:        25,
			Difficulty:    "medium",
			TopicTag:      "AVL Rotations",
			OrderIndex:    2,
		},
		{
			QuizID:        quiz2.ID,
			QuestionType:  "multiple_choice",
			Content:       "Độ phức tạp thời gian của thuật toán Kahn (BFS dùng mảng bán bậc vào in-degree) để sắp xếp Topo đồ thị G(V, E) là bao nhiêu?",
			OptionsJSON:   `["O(V + E)","O(V^2)","O(V * E)","O(E log V)"]`,
			CorrectAnswer: "0",
			Explanation:   "Mỗi đỉnh được đưa vào và lấy ra khỏi hàng đợi tối đa 1 lần O(V), và mỗi cạnh được duyệt đúng 1 lần khi giảm in-degree O(E).",
			Points:        25,
			Difficulty:    "easy",
			TopicTag:      "DAG Topological Sort",
			OrderIndex:    3,
		},
		{
			QuizID:        quiz2.ID,
			QuestionType:  "multiple_choice",
			Content:       "Tại sao có thể tìm đường đi ngắn nhất trên đồ thị DAG (kể cả khi có trọng số âm) trong thời gian tuyến tính O(V + E)?",
			OptionsJSON:   `["Vì DAG không có chu trình nên ta có thể nới lỏng (relax) các cạnh một lần duy nhất theo thứ tự Topo","Vì mọi đồ thị DAG đều chỉ có trọng số bằng 1","Vì thuật toán Dijkstra chạy trong O(1)","Vì DAG là cây nhị phân"]`,
			CorrectAnswer: "0",
			Explanation:   "Thứ tự Topo đảm bảo khi xét đỉnh u, khoảng cách ngắn nhất tới u đã được chốt xong nên chỉ cần 1 lượt duyệt quy hoạch động.",
			Points:        25,
			Difficulty:    "hard",
			TopicTag:      "Dynamic Programming on DAG",
			OrderIndex:    4,
		},
	}
	for i := range qCourse2 {
		db.Create(&qCourse2[i])
	}

	quiz3 := entity.Quiz{
		CourseID:         course3.ID,
		ModuleID:         mod3_1.ID,
		LessonID:         lesson3_1.ID,
		CreatorID:        teacher.ID,
		Title:            "Đề Kiểm tra Thích ứng: Kiến trúc 3-Tier Video RAG, pgvector HNSW & GPT-4o Vision",
		Description:      "Đánh giá kiến thức về vector nhúng 1536 chiều, chỉ mục HNSW và cơ chế chuyển tầng tự động 3-Tier RAG",
		Difficulty:       "hard",
		TimeLimitMinutes: 15,
		PassingScore:     70.0,
		IsAdaptive:       true,
		GenerationSource: "ai_module",
		QuestionsCount:   4,
		IsPublished:      true,
	}
	db.Create(&quiz3)

	qCourse3 := []entity.Question{
		{
			QuizID:        quiz3.ID,
			QuestionType:  "multiple_choice",
			Content:       "Mô hình nhúng OpenAI text-embedding-3-small sinh ra vector đặc trưng ngữ nghĩa có số chiều mặc định là bao nhiêu?",
			OptionsJSON:   `["1536 chiều","12 chiều","192 chiều","478 chiều"]`,
			CorrectAnswer: "0",
			Explanation:   "text-embedding-3-small biểu diễn văn bản thành vector 1536 chiều chuẩn hóa L2 dùng trong bảng PostgreSQL pgvector.",
			Points:        25,
			Difficulty:    "easy",
			TopicTag:      "Vector Embeddings",
			OrderIndex:    1,
		},
		{
			QuizID:        quiz3.ID,
			QuestionType:  "multiple_choice",
			Content:       "Trong PostgreSQL pgvector, biểu thức `1 - (embedding <=> query_vec)` trả về đại lượng nào?",
			OptionsJSON:   `["Độ tương đồng Cosine (Cosine Similarity) thuộc đoạn [-1, 1]","Khoảng cách Manhattan","Tích có hướng 3 chiều","Số lượng từ khóa trùng khớp"]`,
			CorrectAnswer: "0",
			Explanation:   "Toán tử <=> trả về khoảng cách Cosine (Cosine Distance = 1 - Cosine Similarity), do đó 1 - (a <=> b) chính là Cosine Similarity.",
			Points:        25,
			Difficulty:    "medium",
			TopicTag:      "pgvector Cosine",
			OrderIndex:    2,
		},
		{
			QuizID:        quiz3.ID,
			QuestionType:  "multiple_choice",
			Content:       "Thứ tự ưu tiên truy xuất ngữ cảnh của kiến trúc 3-Tier Video RAG khi học sinh gặp bối rối tại giây t là gì?",
			OptionsJSON:   `["Tier 1: pgvector Semantic Search (+Temporal Boost) -> Tier 2: Timestamp Segment Match -> Tier 3: Transcript Window Slice","Chỉ cắt 10 ký tự đầu tiên của tiêu đề khóa học","Tìm kiếm ngẫu nhiên một bài học khác","Chờ giảng viên nhập tay toàn bộ câu trả lời"]`,
			CorrectAnswer: "0",
			Explanation:   "Kiến trúc 3 tầng đảm bảo độ chính xác ngữ nghĩa cao nhất ở Tier 1 và khả năng chịu lỗi 100% ở Tier 2 & Tier 3.",
			Points:        25,
			Difficulty:    "hard",
			TopicTag:      "3-Tier Video RAG",
			OrderIndex:    3,
		},
		{
			QuizID:        quiz3.ID,
			QuestionType:  "multiple_choice",
			Content:       "Tham số `ef_construction` khi khởi tạo chỉ mục `USING hnsw` trên PostgreSQL pgvector có ý nghĩa gì?",
			OptionsJSON:   `["Kích thước danh sách ứng viên động trong quá trình xây dựng đồ thị HNSW (càng lớn độ chính xác Recall càng cao)","Số lượng bảng tối đa trong cơ sở dữ liệu","Thời gian hết hạn của JWT token","Tốc độ khung hình của webcam"]`,
			CorrectAnswer: "0",
			Explanation:   "ef_construction kiểm soát độ rộng tìm kiếm khi chèn nút vào đồ thị HNSW, đánh đổi giữa thời gian tạo index và chất lượng Recall.",
			Points:        25,
			Difficulty:    "hard",
			TopicTag:      "HNSW Index",
			OrderIndex:    4,
		},
	}
	for i := range qCourse3 {
		db.Create(&qCourse3[i])
	}

	// Seed a QuizSubmission for student on Course 1 & Course 2
	db.Create(&entity.QuizSubmission{
		QuizID:               quiz1.ID,
		UserID:               student.ID,
		Score:                100.0,
		CorrectCount:         4,
		TotalQuestions:       4,
		TimeSpentSeconds:     210,
		Passed:               true,
		DifficultyTaken:      "medium",
		AnswersJSON:          `[{"questionId":1,"selectedAnswer":"0"},{"questionId":2,"selectedAnswer":"1"},{"questionId":3,"selectedAnswer":"2"},{"questionId":4,"selectedAnswer":"0"}]`,
		HonorCodeAccepted:    true,
		SimilarityScore:      4.2,
		SimilarityReportJSON: `{"similarityScore":4.2,"status":"clean","matchedSourcesCount":0,"checkedAt":"2026-10-23T07:00:00Z"}`,
	})
	db.Create(&entity.QuizSubmission{
		QuizID:               quiz2.ID,
		UserID:               student.ID,
		Score:                75.0,
		CorrectCount:         3,
		TotalQuestions:       4,
		TimeSpentSeconds:     285,
		Passed:               true,
		DifficultyTaken:      "medium",
		AnswersJSON:          `[{"questionId":5,"selectedAnswer":"0"},{"questionId":6,"selectedAnswer":"0"},{"questionId":7,"selectedAnswer":"0"},{"questionId":8,"selectedAnswer":"1"}]`,
		HonorCodeAccepted:    true,
		SimilarityScore:      6.5,
		SimilarityReportJSON: `{"similarityScore":6.5,"status":"clean","matchedSourcesCount":0,"checkedAt":"2026-10-23T07:00:00Z"}`,
	})

	db.Create(&entity.QuizStatistic{
		UserID:                student.ID,
		CourseID:              course1.ID,
		Topic:                 "Computer Vision & Deep Learning",
		TotalAttempts:         6,
		AvgScore:              87.5,
		SkillLevel:            0.72,
		RecommendedDifficulty: "hard",
	})
	db.Create(&entity.QuizStatistic{
		UserID:                student.ID,
		CourseID:              course2.ID,
		Topic:                 "AVL Tree & DAG Algorithms",
		TotalAttempts:         3,
		AvgScore:              81.0,
		SkillLevel:            0.64,
		RecommendedDifficulty: "medium",
	})

	db.Create(&entity.LeaderboardEntry{
		UserID:       student2.ID,
		TotalXP:      2450,
		QuizzesWon:   15,
		CurrentLevel: 8,
		Rank:         1,
		BadgeTitle:   "Quán Quân Thị Giác Máy Tính",
	})
	db.Create(&entity.LeaderboardEntry{
		UserID:       student.ID,
		TotalXP:      1980,
		QuizzesWon:   12,
		CurrentLevel: 7,
		Rank:         2,
		BadgeTitle:   "Chiến Binh AI Đa Phương Thức",
	})
	db.Create(&entity.LeaderboardEntry{
		UserID:       student3.ID,
		TotalXP:      820,
		QuizzesWon:   4,
		CurrentLevel: 3,
		Rank:         3,
		BadgeTitle:   "Tân Binh Thuật Toán",
	})

	db.Create(&entity.UserStreak{
		UserID:           student.ID,
		CurrentStreak:    7,
		LongestStreak:    14,
		LastActivityDate: todayStr,
		TotalActiveDays:  38,
	})

	ach1 := entity.Achievement{
		Code:        "STREAK_7_DAYS",
		Title:       "Chuỗi 7 Ngày Học Liên Tiếp",
		Description: "Duy trì thói quen học tập và hoàn thành bài giảng suốt 7 ngày liên tục",
		Icon:        "fire",
		XPReward:    50,
	}
	ach2 := entity.Achievement{
		Code:        "OVERCOME_CONFUSION",
		Title:       "Bứt Phá Khỏi Điểm Nghẽn",
		Description: "Sử dụng Trợ lý Ảo AI giải quyết thành công 5 đoạn kiến thức khó trong video",
		Icon:        "sparkles",
		XPReward:    100,
	}
	db.Create(&ach1)
	db.Create(&ach2)
	db.Create(&entity.UserAchievement{
		UserID:        student.ID,
		AchievementID: ach1.ID,
		UnlockedAt:    now.AddDate(0, 0, -2),
	})
	db.Create(&entity.UserAchievement{
		UserID:        student.ID,
		AchievementID: ach2.ID,
		UnlockedAt:    now.AddDate(0, 0, -1),
	})

	// 9. Assignments, Submissions & Tasks
	due := now.AddDate(0, 0, 7)
	due2 := now.AddDate(0, 0, 10)
	due3 := now.AddDate(0, 0, 14)
	asgn := entity.Assignment{
		CourseID:     course1.ID,
		ClassID:      cls.ID,
		ModuleID:     mod1.ID,
		LessonID:     lesson1.ID,
		TeacherID:    teacher.ID,
		Title:        "Bài tập Lớn 1: Cài đặt thuật toán tính Eye Aspect Ratio (EAR) & Phân tích Bối rối từ Landmarks",
		Description:  "Viết chương trình trích xuất 6 điểm mốc mắt từ MediaPipe 478 Landmarks, tính chỉ số EAR và phát hiện chuỗi khung hình đờ mắt (Eye-Lock).",
		DueDate:      &due,
		MaxScore:     100.0,
		RewardPoints: 100,
		RubricJSON:   `[{"criterion":"Độ chính xác công thức toán học EAR & Chuẩn hóa tọa độ","maxPoints":40},{"criterion":"Xử lý cửa sổ trượt thời gian & lọc nhiễu thiếu sáng","maxPoints":30},{"criterion":"Chất lượng mã nguồn, tài liệu giải thích & thực nghiệm","maxPoints":30}]`,
		IsPublished:  true,
	}
	asgn2 := entity.Assignment{
		CourseID:     course2.ID,
		ClassID:      cls.ID,
		ModuleID:     mod2_2.ID,
		LessonID:     lesson2_3.ID,
		TeacherID:    teacher.ID,
		Title:        "Bài tập Lớn 2: Thiết kế Cây Cân bằng AVL & Bộ Kiểm tra Tiên quyết Môn học bằng Đồ thị DAG",
		Description:  "Cài đặt đầy đủ 4 phép quay cân bằng cây AVL (LL, RR, LR, RL) và thuật toán Kahn phát hiện xung đột môn học tiên quyết trên đồ thị DAG.",
		DueDate:      &due2,
		MaxScore:     100.0,
		RewardPoints: 120,
		RubricJSON:   `[{"criterion":"Cài đặt đúng 4 phép quay LL, RR, LR, RL trong O(1)","maxPoints":40},{"criterion":"Thuật toán Kahn sắp xếp Topo & phát hiện chu trình O(V+E)","maxPoints":35},{"criterion":"Kiểm thử biên & phân tích độ phức tạp thực nghiệm","maxPoints":25}]`,
		IsPublished:  true,
	}
	asgn3 := entity.Assignment{
		CourseID:     course3.ID,
		ClassID:      cls.ID,
		ModuleID:     mod3_2.ID,
		LessonID:     lesson3_3.ID,
		TeacherID:    teacher.ID,
		Title:        "Đồ án Capstone: Xây dựng Pipeline 3-Tier Multi-Modal Video RAG với PostgreSQL pgvector & GPT-4o Vision",
		Description:  "Xây dựng dịch vụ truy xuất ngữ nghĩa 3 tầng kết hợp chỉ mục HNSW trên pgvector, ưu tiên phân đoạn theo timestamp và đồng bộ ảnh chụp khung hình slide bài giảng.",
		DueDate:      &due3,
		MaxScore:     100.0,
		RewardPoints: 150,
		RubricJSON:   `[{"criterion":"Thiết kế bảng pgvector & chỉ mục HNSW tối ưu truy vấn","maxPoints":35},{"criterion":"Logic chuyển tầng tự động 3-Tier Video RAG & Temporal Boost","maxPoints":40},{"criterion":"Tích hợp đa phương thức GPT-4o Vision & chất lượng giải thích","maxPoints":25}]`,
		IsPublished:  true,
	}
	db.Create(&asgn)
	db.Create(&asgn2)
	db.Create(&asgn3)

	sub := entity.Submission{
		AssignmentID:         asgn.ID,
		StudentID:            student.ID,
		Version:              1,
		TextContent:          "Em đã cài đặt hàm computeEAR(landmarks) lấy trung bình khoảng cách dọc p2-p6 và p3-p5 chia cho 2 lần khoảng cách ngang p1-p4, kết hợp bộ lọc EMA alpha=0.15 và kiểm tra phương sai Var(EAR) < 0.002 trên cửa sổ 5 khung hình.",
		LinkURL:              "https://github.com/hieu/lms-confusion",
		IsLate:               false,
		HonorCodeAccepted:    true,
		SimilarityScore:      8.4,
		SimilarityReportJSON: `{"similarityScore":8.4,"status":"clean","matchedSourcesCount":1,"topMatchPct":8.4,"analysisSummary":"Bài làm độc lập (91.6% nội dung nguyên bản), chỉ trùng khớp thuật ngữ công thức toán học chuẩn.","checkedAt":"2026-10-23T07:00:00Z"}`,
		Status:               "graded",
		FinalGrade:           92.0,
		AutoGrade:            92.0,
		AutoGradeConfidence:  0.94,
		TeacherFeedback:      "Bài làm xuất sắc! Công thức EAR và cơ chế lọc EMA rất chuẩn xác.",
		RubricEvaluationJSON: `[{"criterion":"Độ chính xác công thức toán học EAR & Chuẩn hóa tọa độ","score":40,"maxPoints":40,"comment":"Chính xác tuyệt đối"},{"criterion":"Xử lý cửa sổ trượt thời gian & lọc nhiễu thiếu sáng","score":28,"maxPoints":30,"comment":"Có áp dụng EMA mượt mà"},{"criterion":"Chất lượng mã nguồn, tài liệu giải thích & thực nghiệm","score":24,"maxPoints":30,"comment":"Rõ ràng, dễ đọc"}]`,
		GradedByID:           teacher.ID,
		GradedAt:             &now,
	}
	db.Create(&sub)

	taskDue1 := now.AddDate(0, 0, 2)
	taskDue2 := now.AddDate(0, 0, 1)
	db.Create(&entity.Task{
		UserID:       student.ID,
		CourseID:     course1.ID,
		AssignmentID: asgn.ID,
		Title:        "Hoàn thành Bài 2: Kiến trúc BiLSTM-Attention & Hợp nhất 12 đặc trưng",
		Description:  "Xem hết 3 phân đoạn video và hoàn thành câu hỏi kiểm tra cuối mỗi phân đoạn",
		Status:       "in_progress",
		Priority:     "high",
		DueDate:      &taskDue1,
	})
	db.Create(&entity.Task{
		UserID:      student.ID,
		CourseID:    course1.ID,
		Title:       "Đăng ký mẫu sinh trắc học 3 góc mặt tại /student/face-setup",
		Description: "Quét góc chính diện, nghiêng trái và nghiêng phải bằng MobileFaceNet",
		Status:      "done",
		Priority:    "medium",
		DueDate:     &taskDue2,
		CompletedAt: &now,
	})

	// 10. Comments (Materialized Path) & Direct Chat
	c1 := entity.Comment{
		CourseID:          course1.ID,
		LessonID:          lesson1.ID,
		UserID:            student.ID,
		Content:           "Thưa thầy, ở phút [07:45], tại sao phương sai của EAR nhỏ hơn 0.002 lại phản ánh trạng thái học sinh đang bối rối hoặc căng thẳng đọc công thức ạ?",
		VideoTimestamp:    465,
		IsTeacherResponse: false,
		Upvotes:           8,
		IsPinned:          true,
		IsResolved:        true,
		Depth:             0,
		Path:              "000001",
	}
	db.Create(&c1)

	c2 := entity.Comment{
		CourseID:          course1.ID,
		LessonID:          lesson1.ID,
		UserID:            teacher.ID,
		ParentID:          c1.ID,
		Content:           "Câu hỏi rất hay Minh Hiếu! Khi gặp một công thức toán hoặc đoạn code phức tạp gây bối rối, phản xạ tự nhiên của hệ thần kinh thị giác là giảm tần suất chớp mắt để tập trung thu nhận thông tin (hiện tượng Cognitive Load Eye-Lock). Vì mắt giữ mở gần như cố định nên phương sai EAR tiến về 0 (< 0.002).",
		VideoTimestamp:    465,
		IsTeacherResponse: true,
		Upvotes:           12,
		Depth:             1,
		Path:              "000001/000002",
	}
	db.Create(&c2)

	conv := entity.ChatConversation{
		UserOneID:       student.ID,
		UserTwoID:       teacher.ID,
		CourseID:        course1.ID,
		LastMessageText: "Chào Minh Hiếu, thầy thấy kết quả bài tập tính chỉ số EAR và mô hình phát hiện bối rối của em rất tốt!",
		LastMessageAt:   &now,
	}
	db.Create(&conv)
	db.Create(&entity.ChatMessage{
		ConversationID: conv.ID,
		SenderID:       teacher.ID,
		Content:        "Chào Minh Hiếu, thầy thấy kết quả bài tập tính chỉ số EAR và mô hình phát hiện bối rối của em rất tốt. Nếu cần trao đổi thêm về phần tích hợp pgvector RAG thì nhắn thầy nhé!",
		MessageType:    "text",
		IsRead:         false,
	})

	// 11. Course Roadmap (DAG) & Personal Semester Roadmap & Study Plan
	rm := entity.Roadmap{
		CourseID:    course1.ID,
		Title:       "Lộ trình Chinh phục Thị giác Máy tính & Trợ lý AI Đa phương thức",
		Description: "Đồ thị lộ trình học tập từng bước từ xử lý ảnh cơ bản đến triển khai mô hình ONNX & RAG",
		IsPublished: true,
	}
	db.Create(&rm)

	n1 := entity.RoadmapNode{
		RoadmapID:        rm.ID,
		NodeKey:          "node-1",
		Title:            "1. Tiền xử lý Ảnh & Lưới 478 Điểm mốc 3D MediaPipe",
		Description:      "Chuẩn hóa tọa độ gốc đỉnh mũi và cân bằng sáng",
		NodeType:         "lesson",
		LessonID:         lesson1.ID,
		PositionX:        100,
		PositionY:        120,
		EstimatedMinutes: 45,
	}
	n2 := entity.RoadmapNode{
		RoadmapID:        rm.ID,
		NodeKey:          "node-2",
		Title:            "2. Chỉ số Mở mắt EAR & Định danh MobileFaceNet 192-d",
		Description:      "Phát hiện đờ mắt và chống gian lận 3 góc mặt",
		NodeType:         "quiz",
		LessonID:         lesson1.ID,
		PositionX:        380,
		PositionY:        120,
		EstimatedMinutes: 30,
	}
	n3 := entity.RoadmapNode{
		RoadmapID:        rm.ID,
		NodeKey:          "node-3",
		Title:            "3. Mạng Chuỗi Thời gian BiLSTM-Attention & 12 Đặc trưng",
		Description:      "Hợp nhất hành vi xem video, cảm xúc khuôn mặt và kết quả Quiz",
		NodeType:         "milestone",
		LessonID:         lesson2.ID,
		PositionX:        660,
		PositionY:        120,
		EstimatedMinutes: 60,
	}
	db.Create(&n1)
	db.Create(&n2)
	db.Create(&n3)
	db.Create(&entity.RoadmapEdge{RoadmapID: rm.ID, SourceNodeID: n1.ID, TargetNodeID: n2.ID, EdgeType: "prerequisite"})
	db.Create(&entity.RoadmapEdge{RoadmapID: rm.ID, SourceNodeID: n2.ID, TargetNodeID: n3.ID, EdgeType: "prerequisite"})
	db.Create(&entity.UserRoadmapProgress{
		UserID:      student.ID,
		RoadmapID:   rm.ID,
		NodeID:      n1.ID,
		Status:      "completed",
		CompletedAt: &now,
	})

	prm := entity.PersonalRoadmap{
		UserID:     student.ID,
		MajorID:    majorAI.ID,
		Title:      "Lộ trình Học tập Cá nhân — Chuyên ngành Trí tuệ Nhân tạo & Thị giác Máy tính",
		CareerGoal: "Kỹ sư AI & Thị giác Máy tính (Computer Vision Engineer)",
		TargetGPA:  3.70,
	}
	db.Create(&prm)
	db.Create(&entity.PersonalRoadmapCourse{
		PersonalRoadmapID: prm.ID,
		AcademicCourseID:  ac2.ID,
		PlannedSemester:   3,
		Status:            "completed",
		Grade:             3.8,
	})
	db.Create(&entity.PersonalRoadmapCourse{
		PersonalRoadmapID: prm.ID,
		AcademicCourseID:  ac1.ID,
		PlannedSemester:   5,
		Status:            "in_progress",
	})
	db.Create(&entity.PersonalRoadmapCourse{
		PersonalRoadmapID: prm.ID,
		AcademicCourseID:  ac3.ID,
		PlannedSemester:   6,
		Status:            "planned",
		Notes:             "Học phần tự chọn được AI gợi ý dựa trên định hướng nghiên cứu Computer Vision & LLM",
	})

	targetComp := now.AddDate(0, 1, 0)
	sp := entity.StudyPlan{
		UserID:               student.ID,
		CourseID:             course1.ID,
		TargetCompletionDate: &targetComp,
		DailyStudyMinutes:    45,
		PreferredDaysJSON:    `["Mon","Wed","Fri"]`,
		ReminderTime:         "20:00",
		Status:               "active",
	}
	db.Create(&sp)
	db.Create(&entity.ScheduledLesson{
		StudyPlanID:     sp.ID,
		LessonID:        lesson1.ID,
		ScheduledDate:   todayStr,
		DurationMinutes: 45,
		IsCompleted:     true,
	})
	db.Create(&entity.ScheduledLesson{
		StudyPlanID:     sp.ID,
		LessonID:        lesson2.ID,
		ScheduledDate:   now.AddDate(0, 0, 2).Format("2006-01-02"),
		DurationMinutes: 45,
		IsCompleted:     false,
	})

	// 12. Notifications & Learning Activities
	db.Create(&entity.Notification{
		UserID:           student.ID,
		NotificationType: "grade",
		Title:            "Đã có điểm Bài tập Lớn 1 (AI Rubric)",
		Message:          "Bài nộp 'Cài đặt thuật toán tính Eye Aspect Ratio (EAR)' của bạn đạt 92/100 điểm.",
		IsRead:           false,
		ActionURL:        "/student/tasks",
	})
	db.Create(&entity.Notification{
		UserID:           student.ID,
		NotificationType: "discussion",
		Title:            "Giảng viên đã phản hồi câu hỏi của bạn",
		Message:          "PGS.TS. Trần Quang Minh đã trả lời thảo luận của bạn trong Bài 1.",
		IsRead:           false,
		ActionURL:        "/learn/1",
	})

	for dIdx := 0; dIdx < 7; dIdx++ {
		db.Create(&entity.LearningActivity{
			UserID:          student.ID,
			CourseID:        course1.ID,
			LessonID:        lesson1.ID,
			ActivityType:    "video_watch",
			DurationMinutes: 25 + (dIdx*7)%30,
		})
	}

	log.Println("Seed completed successfully!")
	return nil
}
