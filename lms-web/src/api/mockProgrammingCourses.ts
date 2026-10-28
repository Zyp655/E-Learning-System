import type {
  CodingChallengeItem,
  CourseGradebook,
  CourseItem,
  LessonItem,
  QuizItem,
  VideoSegment,
  VideoSegmentQuiz,
} from './types';

// Programming courses (Python, JavaScript) for beginners. Video lessons have no recorded video yet
// (videoUrl ''): SmartVideoPlayer renders each segment as a code slide on its timeline.

type LessonInput = Pick<LessonItem, 'id' | 'moduleId' | 'courseId' | 'title' | 'type' | 'durationMinutes' | 'orderIndex' | 'summary'> &
  Partial<LessonItem>;

function lesson(l: LessonInput): LessonItem {
  return {
    durationSeconds: l.durationMinutes * 60,
    isFreePreview: false,
    transcriptStatus: l.type === 'video' ? 'ready' : 'none',
    videoUrl: '',
    attachments: [],
    segments: [],
    completed: false,
    ...l,
  };
}

function segment(
  lessonId: number,
  segmentIndex: number,
  startTimestamp: number,
  endTimestamp: number,
  s: { title: string; transcript: string; summary: string; keyFormulas: string[]; codeSnippet: string; quiz: VideoSegmentQuiz },
): VideoSegment {
  return {
    id: lessonId * 10 + segmentIndex,
    lessonId,
    segmentIndex,
    startTimestamp,
    endTimestamp,
    title: s.title,
    transcript: s.transcript,
    summary: s.summary,
    keyFormulas: s.keyFormulas,
    codeSnippet: s.codeSnippet,
    quizQuestion: s.quiz,
  };
}

const PYTHON_INSTRUCTOR = {
  id: 511,
  name: 'ThS. Nguyễn Thu Hà',
  title: 'Giảng viên Bộ môn Công nghệ Phần mềm',
  department: 'Khoa Công nghệ Thông tin',
  verified: true,
};

const JS_INSTRUCTOR = {
  id: 512,
  name: 'ThS. Lê Hoàng Nam',
  title: 'Giảng viên Bộ môn Phát triển Ứng dụng Web',
  department: 'Khoa Công nghệ Thông tin',
  verified: true,
};

/* ------------------------------------------------------------------ */
/* Course 5: Lập trình Python Cơ bản                                   */
/* ------------------------------------------------------------------ */

const pythonLessons1: LessonItem[] = [
  lesson({
    id: 501,
    moduleId: 51,
    courseId: 5,
    title: 'Bài 1.1: Biến, kiểu dữ liệu và nhập/xuất trong Python',
    type: 'video',
    durationMinutes: 12,
    orderIndex: 1,
    isFreePreview: true,
    summary: 'Khai báo biến, bốn kiểu dữ liệu cơ bản (int, float, str, bool), các toán tử số học và cách đọc dữ liệu từ bàn phím bằng input().',
    segments: [
      segment(501, 1, 0, 240, {
        title: 'Phân đoạn 1 (00:00 – 04:00): Biến và các kiểu dữ liệu cơ bản',
        transcript:
          '[00:00] Trong Python, biến được tạo ngay khi ta gán giá trị cho nó, không cần khai báo kiểu. [01:10] Python tự suy ra kiểu từ giá trị: số nguyên là int, số thực là float, chuỗi là str, đúng/sai là bool. [02:30] Hàm type() cho biết kiểu của một giá trị. Một biến có thể được gán lại sang giá trị kiểu khác, vì kiểu gắn với giá trị chứ không gắn với tên biến.',
        summary: 'Biến được tạo khi gán; kiểu do giá trị quyết định; dùng type() để kiểm tra kiểu.',
        keyFormulas: ['ten_bien = gia_tri', 'type(x) -> int | float | str | bool'],
        codeSnippet: `name = "An"
age = 19
height = 1.68
print(type(age), type(height), type(name))`,
        quiz: {
          question: 'Trong Python 3, biểu thức type(3 / 2) trả về kiểu nào?',
          options: ['float', 'int', 'str', 'bool'],
          correctIndex: 0,
          explanation: 'Phép chia / trong Python 3 luôn trả về float (3 / 2 = 1.5), kể cả khi chia hết như 4 / 2 = 2.0.',
        },
      }),
      segment(501, 2, 240, 480, {
        title: 'Phân đoạn 2 (04:00 – 08:00): Toán tử số học và chuyển đổi kiểu',
        transcript:
          '[04:00] Ngoài + - * /, Python có // là chia lấy phần nguyên, % là chia lấy dư và ** là lũy thừa. [05:20] Khi cần đổi kiểu, ta dùng int(), float(), str(). int("42") cho số 42, nhưng int("4.2") sẽ báo lỗi ValueError. [06:40] Chú ý: int(3.9) cắt bỏ phần thập phân thành 3 chứ không làm tròn.',
        summary: '// chia nguyên, % chia dư, ** lũy thừa; int(), float(), str() để chuyển kiểu; int() cắt bỏ phần thập phân.',
        keyFormulas: ['7 // 2 = 3    7 % 2 = 1    2 ** 10 = 1024', 'int("42") + 1 = 43'],
        codeSnippet: `print(7 // 2, 7 % 2, 2 ** 10)
x = int("42") + 1
print(int(3.9), float("2.5"))
print("x = " + str(x))`,
        quiz: {
          question: 'Kết quả của biểu thức 17 // 5 là bao nhiêu?',
          options: ['3', '3.4', '2', '4'],
          correctIndex: 0,
          explanation: '// là phép chia lấy phần nguyên: 17 chia 5 được 3 dư 2, nên 17 // 5 = 3 (và 17 % 5 = 2).',
        },
      }),
      segment(501, 3, 480, 720, {
        title: 'Phân đoạn 3 (08:00 – 12:00): Nhập dữ liệu với input() và in bằng f-string',
        transcript:
          '[08:00] Hàm input() dừng chương trình, chờ người dùng gõ và trả về chuỗi họ nhập. [09:10] Vì input() luôn trả về str, muốn tính toán ta phải đổi sang int hoặc float. [10:30] f-string, tức chuỗi có tiền tố f, cho phép chèn biểu thức vào trong cặp ngoặc nhọn, giúp in kết quả gọn gàng.',
        summary: 'input() luôn trả về chuỗi; cần int()/float() trước khi tính; f-string chèn biểu thức vào chuỗi.',
        keyFormulas: ['input() -> str', 'f"Chào {name}, bạn {2026 - year} tuổi"'],
        codeSnippet: `name = input("Tên bạn: ")
year = int(input("Năm sinh: "))
print(f"Chào {name}, bạn {2026 - year} tuổi")`,
        quiz: {
          question: 'Người dùng gõ 5 khi chạy x = input(). Biểu thức x * 2 cho kết quả gì?',
          options: ['"55"', '10', '"10"', 'Báo lỗi TypeError'],
          correctIndex: 0,
          explanation: 'input() trả về chuỗi "5"; nhân chuỗi với số nguyên lặp chuỗi, nên "5" * 2 = "55". Muốn được 10 phải viết int(x) * 2.',
        },
      }),
    ],
  }),
  lesson({
    id: 502,
    moduleId: 51,
    courseId: 5,
    title: 'Bài 1.2 [Bài đọc]: Câu lệnh điều kiện if / elif / else',
    type: 'reading',
    durationMinutes: 8,
    orderIndex: 2,
    summary: 'Rẽ nhánh chương trình bằng if / elif / else, các toán tử so sánh, toán tử logic and / or / not và quy tắc thụt lề.',
    readingContent: {
      estimatedMinutes: 8,
      sections: [
        {
          heading: '1. Cú pháp if / elif / else',
          body: 'Câu lệnh if kiểm tra một điều kiện; nếu đúng thì chạy khối lệnh thụt lề bên dưới. elif (viết tắt của else if) kiểm tra tiếp điều kiện khác khi các điều kiện trước đều sai, còn else chạy khi không điều kiện nào đúng. Python xét các nhánh từ trên xuống và chỉ chạy nhánh đúng đầu tiên, vì vậy thứ tự các điều kiện rất quan trọng.',
          codeSnippet: `score = 7.5
if score >= 8.5:
    print("Giỏi")
elif score >= 7:
    print("Khá")
else:
    print("Cần cố gắng")`,
        },
        {
          heading: '2. Toán tử so sánh và toán tử logic',
          body: 'Các toán tử so sánh gồm ==, !=, <, <=, >, >= và luôn trả về True hoặc False. Để ghép nhiều điều kiện, dùng and (cả hai cùng đúng), or (ít nhất một đúng) và not (đảo ngược). Python cho phép viết so sánh liên tiếp như 0 <= x <= 10, tương đương với 0 <= x and x <= 10.',
          formula: '0 <= x <= 10  ⇔  (0 <= x) and (x <= 10)',
        },
        {
          heading: '3. Thụt lề là một phần của cú pháp',
          body: 'Khác với nhiều ngôn ngữ dùng dấu ngoặc nhọn, Python dùng thụt lề để xác định khối lệnh. Mọi dòng trong cùng một khối phải thụt lề giống nhau, quy ước là 4 dấu cách. Trộn lẫn tab và dấu cách hoặc thụt lề không đều sẽ gây lỗi IndentationError ngay khi chạy.',
        },
      ],
      keyTakeaways: [
        'Python chỉ chạy nhánh đúng đầu tiên trong chuỗi if / elif / else, nên hãy đặt điều kiện chặt nhất lên trước.',
        'Dùng and, or, not để ghép điều kiện; có thể viết gọn 0 <= x <= 10.',
        'Thụt lề 4 dấu cách là bắt buộc để xác định khối lệnh.',
      ],
    },
  }),
  lesson({
    id: 503,
    moduleId: 51,
    courseId: 5,
    title: 'Bài 1.3 [Coding Lab]: Xếp loại học lực theo điểm trung bình',
    type: 'coding',
    durationMinutes: 15,
    orderIndex: 3,
    codingChallengeId: 11,
    summary: 'Viết hàm xếp loại học lực từ điểm trung bình hệ 10, xử lý cả trường hợp điểm không hợp lệ.',
  }),
];

const pythonLessons2: LessonItem[] = [
  lesson({
    id: 504,
    moduleId: 52,
    courseId: 5,
    title: 'Bài 2.1: Vòng lặp for, while và hàm range()',
    type: 'video',
    durationMinutes: 13,
    orderIndex: 1,
    summary: 'Lặp qua dãy số bằng for và range(), lặp theo điều kiện bằng while, điều khiển vòng lặp với break / continue và duyệt kèm chỉ số bằng enumerate().',
    segments: [
      segment(504, 1, 0, 260, {
        title: 'Phân đoạn 1 (00:00 – 04:20): Vòng lặp for và range()',
        transcript:
          '[00:00] Vòng lặp for duyệt lần lượt từng phần tử của một dãy. [01:00] range(stop) sinh các số từ 0 đến stop - 1; range(start, stop, step) cho phép chọn điểm bắt đầu và bước nhảy. [02:40] Điểm cần nhớ: giá trị stop không bao giờ nằm trong dãy, nên range(1, 6) cho 1, 2, 3, 4, 5.',
        summary: 'for duyệt từng phần tử; range(start, stop, step) không bao gồm stop.',
        keyFormulas: ['range(stop)  range(start, stop)  range(start, stop, step)', 'list(range(1, 6)) = [1, 2, 3, 4, 5]'],
        codeSnippet: `total = 0
for i in range(1, 6):
    total += i
print(total)  # 15`,
        quiz: {
          question: 'list(range(2, 10, 3)) cho kết quả nào?',
          options: ['[2, 5, 8]', '[2, 5, 8, 11]', '[3, 6, 9]', '[2, 3, 4, 5, 6, 7, 8, 9]'],
          correctIndex: 0,
          explanation: 'Bắt đầu từ 2, mỗi lần cộng 3: 2, 5, 8. Số tiếp theo là 11 đã vượt quá stop = 10 nên dừng.',
        },
      }),
      segment(504, 2, 260, 520, {
        title: 'Phân đoạn 2 (04:20 – 08:40): Vòng lặp while, break và continue',
        transcript:
          '[04:20] while lặp chừng nào điều kiện còn đúng, thích hợp khi chưa biết trước số lần lặp. [05:40] Nếu điều kiện không bao giờ sai, chương trình rơi vào vòng lặp vô hạn, vì vậy trong thân vòng lặp phải có lệnh làm thay đổi điều kiện. [07:00] break thoát ngay khỏi vòng lặp, còn continue bỏ qua phần còn lại của lượt hiện tại để sang lượt kế tiếp.',
        summary: 'while lặp theo điều kiện; luôn cập nhật biến điều kiện; break thoát vòng lặp, continue sang lượt kế.',
        keyFormulas: ['while dieu_kien: ...', 'break -> thoát vòng lặp    continue -> sang lượt kế'],
        codeSnippet: `n = 10
count = 0
while n > 1:
    n //= 2
    count += 1`,
        quiz: {
          question: 'Sau khi chạy đoạn code trên slide (n = 10, lặp while n > 1: n //= 2; count += 1), count bằng bao nhiêu?',
          options: ['3', '4', '5', '2'],
          correctIndex: 0,
          explanation: 'n lần lượt là 10 → 5 → 2 → 1. Có 3 lần chia, đến khi n = 1 thì điều kiện n > 1 sai nên dừng, count = 3.',
        },
      }),
      segment(504, 3, 520, 780, {
        title: 'Phân đoạn 3 (08:40 – 13:00): Vòng lặp lồng nhau và enumerate()',
        transcript:
          '[08:40] Vòng lặp có thể lồng vào nhau, ví dụ in bảng cửu chương cần một vòng cho số bị nhân và một vòng cho số nhân. [10:20] Khi cần cả chỉ số lẫn giá trị, thay vì tự đếm, hãy dùng enumerate(). Tham số start cho phép bắt đầu đếm từ 1 thay vì 0.',
        summary: 'Vòng lặp lồng cho dữ liệu hai chiều; enumerate() trả về cặp (chỉ số, giá trị).',
        keyFormulas: ['for i, value in enumerate(items, start=1): ...'],
        codeSnippet: `fruits = ["cam", "táo", "xoài"]
for i, fruit in enumerate(fruits, start=1):
    print(i, fruit)`,
        quiz: {
          question: 'list(enumerate(["a", "b"], start=1)) cho kết quả nào?',
          options: ["[(1, 'a'), (2, 'b')]", "[(0, 'a'), (1, 'b')]", "[('a', 1), ('b', 2)]", "[1, 2]"],
          correctIndex: 0,
          explanation: 'enumerate trả về các cặp (chỉ số, phần tử); với start=1 chỉ số bắt đầu từ 1.',
        },
      }),
    ],
  }),
  lesson({
    id: 505,
    moduleId: 52,
    courseId: 5,
    title: 'Bài 2.2 [Bài đọc]: Hàm, tham số mặc định và phạm vi biến',
    type: 'reading',
    durationMinutes: 10,
    orderIndex: 2,
    summary: 'Định nghĩa hàm với def, giá trị trả về, tham số mặc định, truyền tham số theo tên và phạm vi biến cục bộ / toàn cục.',
    readingContent: {
      estimatedMinutes: 10,
      sections: [
        {
          heading: '1. Định nghĩa hàm và giá trị trả về',
          body: 'Hàm giúp đặt tên cho một đoạn xử lý để dùng lại nhiều lần. Ta định nghĩa hàm bằng từ khóa def, liệt kê tham số trong ngoặc và dùng return để trả kết quả. Nếu hàm không có lệnh return, nó vẫn trả về một giá trị đặc biệt là None.',
          codeSnippet: `def area(width, height):
    return width * height

print(area(3, 4))  # 12`,
        },
        {
          heading: '2. Tham số mặc định và truyền theo tên',
          body: 'Tham số có thể có giá trị mặc định, khi gọi hàm có thể bỏ qua tham số đó. Khi gọi, có thể truyền theo tên như greet(name="An", greeting="Xin chào") để code dễ đọc và không phụ thuộc thứ tự. Cần tránh dùng đối tượng thay đổi được như list làm giá trị mặc định, vì giá trị mặc định chỉ được tạo một lần và bị dùng chung giữa các lần gọi; hãy dùng None rồi tạo list mới bên trong hàm.',
          codeSnippet: `def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items`,
        },
        {
          heading: '3. Phạm vi biến: cục bộ và toàn cục',
          body: 'Biến được gán bên trong hàm là biến cục bộ, chỉ tồn tại trong lần gọi hàm đó. Hàm có thể đọc biến toàn cục, nhưng nếu gán giá trị cho một tên bên trong hàm thì Python coi đó là biến cục bộ mới. Thay vì sửa biến toàn cục bằng từ khóa global, nên truyền dữ liệu vào qua tham số và nhận kết quả qua return.',
        },
      ],
      keyTakeaways: [
        'Hàm không có return sẽ trả về None.',
        'Không dùng list hoặc dict làm giá trị mặc định của tham số; dùng None.',
        'Ưu tiên truyền dữ liệu qua tham số và return thay vì dùng biến toàn cục.',
      ],
    },
  }),
  lesson({
    id: 506,
    moduleId: 52,
    courseId: 5,
    title: 'Bài 2.3 [Coding Lab]: Đếm số nguyên tố không vượt quá n',
    type: 'coding',
    durationMinutes: 20,
    orderIndex: 3,
    codingChallengeId: 12,
    summary: 'Cài đặt sàng Eratosthenes để đếm số nguyên tố ≤ n với n tới 1 000 000.',
  }),
  lesson({
    id: 507,
    moduleId: 52,
    courseId: 5,
    title: 'Bài 2.4 [Kiểm tra]: Tổng kết Chương 1 – 2',
    type: 'quiz',
    durationMinutes: 10,
    orderIndex: 4,
    quizId: 311,
    summary: 'Bài kiểm tra trắc nghiệm về kiểu dữ liệu, điều kiện, vòng lặp và hàm.',
  }),
];

const pythonLessons3: LessonItem[] = [
  lesson({
    id: 508,
    moduleId: 53,
    courseId: 5,
    title: 'Bài 3.1: List, dict, tuple và set',
    type: 'video',
    durationMinutes: 14,
    orderIndex: 1,
    summary: 'Bốn cấu trúc dữ liệu có sẵn của Python: khi nào dùng list, dict, tuple, set và các thao tác thường gặp.',
    segments: [
      segment(508, 1, 0, 280, {
        title: 'Phân đoạn 1 (00:00 – 04:40): List, chỉ số và cắt lát',
        transcript:
          '[00:00] list là dãy có thứ tự và thay đổi được. Phần tử đầu có chỉ số 0, chỉ số âm đếm từ cuối với -1 là phần tử cuối. [01:50] Cắt lát a[start:stop] lấy các phần tử từ start đến trước stop. [03:10] append() thêm vào cuối, pop() lấy ra phần tử cuối, len() cho số phần tử.',
        summary: 'list có thứ tự, thay đổi được; chỉ số từ 0, -1 là cuối; a[start:stop] không gồm stop.',
        keyFormulas: ['a[0] đầu tiên    a[-1] cuối cùng', 'a[start:stop] -> từ start đến stop - 1'],
        codeSnippet: `a = [1, 2, 3, 4, 5]
print(a[1:4], a[-1])  # [2, 3, 4] 5
a.append(6)
print(len(a))  # 6`,
        quiz: {
          question: 'Với a = [10, 20, 30, 40, 50], a[-2:] cho kết quả nào?',
          options: ['[40, 50]', '[50]', '[30, 40]', '[10, 20]'],
          correctIndex: 0,
          explanation: 'a[-2:] lấy từ phần tử thứ hai tính từ cuối (40) đến hết danh sách: [40, 50].',
        },
      }),
      segment(508, 2, 280, 560, {
        title: 'Phân đoạn 2 (04:40 – 09:20): Dictionary — tra cứu theo khóa',
        transcript:
          '[04:40] dict lưu các cặp khóa và giá trị, cho phép tra cứu rất nhanh theo khóa. [06:00] Truy cập d[key] với khóa không tồn tại gây lỗi KeyError; dùng d.get(key, mặc_định) để lấy giá trị an toàn. [07:40] Duyệt d.items() cho từng cặp (khóa, giá trị).',
        summary: 'dict ánh xạ khóa → giá trị; d.get(k, default) tránh KeyError; duyệt bằng items().',
        keyFormulas: ['d[key]  (KeyError nếu thiếu)', 'd.get(key, default)'],
        codeSnippet: `scores = {"An": 8, "Bình": 6}
scores["Chi"] = 9
print(scores.get("Dũng", 0))  # 0
for name, s in scores.items(): print(name, s)`,
        quiz: {
          question: 'd = {"a": 1}. Biểu thức d.get("b", 0) + d["a"] bằng bao nhiêu?',
          options: ['1', '0', '2', 'Báo lỗi KeyError'],
          correctIndex: 0,
          explanation: 'Khóa "b" không có nên d.get("b", 0) trả về 0; d["a"] = 1; tổng là 1.',
        },
      }),
      segment(508, 3, 560, 840, {
        title: 'Phân đoạn 3 (09:20 – 14:00): Tuple và set',
        transcript:
          '[09:20] tuple giống list nhưng không thay đổi được sau khi tạo, hợp để biểu diễn một bản ghi cố định như tọa độ (x, y). [11:00] set là tập hợp không có thứ tự và không có phần tử trùng, rất tiện để loại trùng hoặc kiểm tra một phần tử có thuộc tập hay không. [12:30] Phép & cho giao, | cho hợp, - cho hiệu hai tập.',
        summary: 'tuple bất biến; set không trùng lặp, hỗ trợ giao (&), hợp (|), hiệu (-).',
        keyFormulas: ['point = (3, 4)  # tuple bất biến', 'set(a) & set(b)   set(a) | set(b)'],
        codeSnippet: `tags = {"python", "web", "python"}
print(len(tags))  # 2
a, b = {1, 2, 3}, {2, 3, 4}
print(a & b, a | b)`,
        quiz: {
          question: 'len({1, 2, 2, 3, 3, 3}) bằng bao nhiêu?',
          options: ['3', '6', '4', '1'],
          correctIndex: 0,
          explanation: 'set tự loại phần tử trùng nên chỉ còn {1, 2, 3}, có 3 phần tử.',
        },
      }),
    ],
  }),
  lesson({
    id: 509,
    moduleId: 53,
    courseId: 5,
    title: 'Bài 3.2 [Bài đọc]: List comprehension và xử lý chuỗi',
    type: 'reading',
    durationMinutes: 9,
    orderIndex: 2,
    summary: 'Viết gọn vòng lặp tạo list bằng list comprehension và các phương thức xử lý chuỗi thường dùng.',
    readingContent: {
      estimatedMinutes: 9,
      sections: [
        {
          heading: '1. List comprehension',
          body: 'List comprehension tạo một list mới từ một dãy có sẵn trong một dòng: biểu thức cho từng phần tử, vòng for và tùy chọn một điều kiện lọc. Cách viết này ngắn và thường nhanh hơn vòng for với append, nhưng khi logic phức tạp thì vòng for thường dễ đọc hơn.',
          codeSnippet: `squares = [x * x for x in range(1, 6)]          # [1, 4, 9, 16, 25]
evens = [x for x in range(10) if x % 2 == 0]   # [0, 2, 4, 6, 8]`,
        },
        {
          heading: '2. Các phương thức chuỗi thường dùng',
          body: 'Chuỗi trong Python là bất biến: các phương thức như lower(), upper(), strip(), replace() đều trả về chuỗi mới chứ không sửa chuỗi gốc. split() tách chuỗi thành list theo dấu cách hoặc theo ký tự chỉ định, còn "ký_tự".join(list) ghép list chuỗi lại thành một chuỗi.',
          codeSnippet: `text = "  Học Python  "
words = text.strip().lower().split()   # ['học', 'python']
print("-".join(words))                  # học-python`,
        },
        {
          heading: '3. Kết hợp: chuẩn hóa dữ liệu văn bản',
          body: 'Bài toán thực tế thường kết hợp cả hai: tách văn bản thành từ, chuẩn hóa chữ thường, bỏ dấu câu rồi lọc các từ cần thiết. Ví dụ, để lấy các từ dài hơn ba ký tự, ta có thể viết [w for w in text.lower().split() if len(w) > 3]. Đây cũng là bước chuẩn bị cho Coding Lab thống kê tần suất từ ở bài tiếp theo.',
        },
      ],
      keyTakeaways: [
        '[biểu_thức for x in dãy if điều_kiện] tạo list mới trong một dòng.',
        'Chuỗi bất biến: lower(), strip(), replace() trả về chuỗi mới.',
        'split() tách chuỗi thành list, "sep".join(list) ghép lại.',
      ],
    },
  }),
  lesson({
    id: 510,
    moduleId: 53,
    courseId: 5,
    title: 'Bài 3.3 [Coding Lab]: Thống kê tần suất từ trong văn bản',
    type: 'coding',
    durationMinutes: 20,
    orderIndex: 3,
    codingChallengeId: 13,
    summary: 'Dùng dict để đếm số lần xuất hiện của từng từ và trả về k từ xuất hiện nhiều nhất.',
  }),
  lesson({
    id: 511,
    moduleId: 53,
    courseId: 5,
    title: 'Bài 3.4 [Kiểm tra]: Cấu trúc dữ liệu trong Python',
    type: 'quiz',
    durationMinutes: 10,
    orderIndex: 4,
    quizId: 312,
    summary: 'Bài kiểm tra trắc nghiệm về list, dict, tuple, set và list comprehension.',
  }),
];

/* ------------------------------------------------------------------ */
/* Course 6: Lập trình Web với JavaScript                              */
/* ------------------------------------------------------------------ */

const jsLessons1: LessonItem[] = [
  lesson({
    id: 601,
    moduleId: 61,
    courseId: 6,
    title: 'Bài 1.1: Biến, kiểu dữ liệu và hàm trong JavaScript',
    type: 'video',
    durationMinutes: 12,
    orderIndex: 1,
    isFreePreview: true,
    summary: 'let và const, các kiểu dữ liệu nguyên thủy, so sánh == và ===, hàm thường và hàm mũi tên.',
    segments: [
      segment(601, 1, 0, 240, {
        title: 'Phân đoạn 1 (00:00 – 04:00): let, const và các kiểu dữ liệu',
        transcript:
          '[00:00] JavaScript hiện đại dùng let cho biến có thể gán lại và const cho biến không gán lại; nên tránh var vì phạm vi của nó khó lường. [01:30] const chỉ cấm gán lại tên biến, nội dung của một mảng hay object khai báo bằng const vẫn sửa được. [02:40] Các kiểu nguyên thủy gồm number, string, boolean, undefined, null, bigint và symbol; toán tử typeof cho biết kiểu.',
        summary: 'Ưu tiên const, dùng let khi cần gán lại; const không làm object bất biến; typeof để xem kiểu.',
        keyFormulas: ['const -> không gán lại    let -> gán lại được', 'typeof 42 === "number"'],
        codeSnippet: `const scores = [8, 9];
scores.push(10);      // hợp lệ
let total = 0;
total = scores.length; // hợp lệ`,
        quiz: {
          question: 'Đoạn code const a = [1]; a.push(2); có chạy được không?',
          options: [
            'Có, const chỉ cấm gán lại biến a, vẫn được sửa nội dung mảng',
            'Không, const cấm mọi thay đổi trên mảng',
            'Không, phải dùng var',
            'Có, nhưng a vẫn là [1]',
          ],
          correctIndex: 0,
          explanation: 'const ngăn câu lệnh a = ... nhưng không đóng băng mảng; a.push(2) làm a thành [1, 2]. Muốn bất biến hoàn toàn phải dùng Object.freeze.',
        },
      }),
      segment(601, 2, 240, 480, {
        title: 'Phân đoạn 2 (04:00 – 08:00): So sánh == và ===, ép kiểu ngầm',
        transcript:
          '[04:00] Toán tử == so sánh sau khi tự ép kiểu, nên 0 == "" cho true, gây nhiều lỗi khó thấy. [05:30] Toán tử === so sánh cả kiểu lẫn giá trị, nên 0 === "" là false. Quy tắc: luôn dùng === và !==. [06:40] Phép cộng với chuỗi sẽ nối chuỗi: "5" + 1 cho "51", trong khi "5" - 1 lại cho 4 vì phép trừ ép về số.',
        summary: 'Luôn dùng ===; + với chuỗi là nối chuỗi; -, *, / ép về số.',
        keyFormulas: ['0 == ""  -> true     0 === ""  -> false', '"5" + 1 -> "51"     "5" - 1 -> 4'],
        codeSnippet: `console.log(0 == "");   // true
console.log(0 === "");  // false
console.log("5" + 1);   // "51"
console.log("5" - 1);   // 4`,
        quiz: {
          question: 'Giá trị của biểu thức "3" + 4 + 5 trong JavaScript là gì?',
          options: ['"345"', '12', '"39"', '"75"'],
          correctIndex: 0,
          explanation: 'Phép + tính từ trái sang phải: "3" + 4 = "34" (nối chuỗi), rồi "34" + 5 = "345".',
        },
      }),
      segment(601, 3, 480, 720, {
        title: 'Phân đoạn 3 (08:00 – 12:00): Hàm thường và hàm mũi tên',
        transcript:
          '[08:00] Hàm có thể khai báo bằng từ khóa function hoặc viết dạng mũi tên. [09:20] Hàm mũi tên một biểu thức tự trả về giá trị của biểu thức đó mà không cần return. [10:40] Tham số có thể có giá trị mặc định như function greet(name = "bạn"), giống Python.',
        summary: 'Hàm mũi tên gọn hơn; dạng một biểu thức tự return; tham số có giá trị mặc định.',
        keyFormulas: ['const square = (x) => x * x;', 'function greet(name = "bạn") { ... }'],
        codeSnippet: `function add(a, b) {
  return a + b;
}
const square = (x) => x * x;
console.log(add(2, 3), square(4)); // 5 16`,
        quiz: {
          question: 'Với const f = (x) => { x * 2 }; thì f(3) trả về gì?',
          options: ['undefined', '6', '"6"', 'Báo lỗi cú pháp'],
          correctIndex: 0,
          explanation: 'Khi thân hàm mũi tên nằm trong { }, phải viết return tường minh. Không có return nên f(3) trả về undefined; viết (x) => x * 2 mới trả về 6.',
        },
      }),
    ],
  }),
  lesson({
    id: 602,
    moduleId: 61,
    courseId: 6,
    title: 'Bài 1.2 [Bài đọc]: Mảng và các phương thức map, filter, reduce',
    type: 'reading',
    durationMinutes: 9,
    orderIndex: 2,
    summary: 'Xử lý mảng theo phong cách khai báo với map, filter, reduce thay cho vòng lặp for.',
    readingContent: {
      estimatedMinutes: 9,
      sections: [
        {
          heading: '1. map: biến đổi từng phần tử',
          body: 'map gọi một hàm cho từng phần tử và trả về một mảng mới cùng độ dài chứa kết quả. Mảng gốc không bị thay đổi. Ví dụ để nhân đôi mọi số trong mảng, ta viết numbers.map((n) => n * 2).',
          codeSnippet: `const prices = [100, 250, 80];
const withVat = prices.map((p) => p * 1.1);`,
        },
        {
          heading: '2. filter: giữ lại phần tử thỏa điều kiện',
          body: 'filter trả về mảng mới chỉ gồm các phần tử mà hàm điều kiện trả về true. Kết hợp map và filter cho phép viết chuỗi xử lý ngắn gọn, đọc từ trên xuống như mô tả các bước.',
          codeSnippet: `const passed = students
  .filter((s) => s.score >= 5)
  .map((s) => s.name);`,
        },
        {
          heading: '3. reduce: gộp mảng thành một giá trị',
          body: 'reduce duyệt mảng và tích lũy dần vào một giá trị, ví dụ tổng, tích hoặc một object thống kê. Hàm truyền vào nhận giá trị tích lũy và phần tử hiện tại. Luôn truyền giá trị khởi tạo làm tham số thứ hai; nếu bỏ qua, reduce trên mảng rỗng sẽ báo lỗi TypeError.',
          formula: 'arr.reduce((acc, x) => acc + x, 0)',
        },
      ],
      keyTakeaways: [
        'map, filter, reduce trả về giá trị mới và không sửa mảng gốc.',
        'filter rồi map giúp diễn đạt chuỗi xử lý rõ ràng.',
        'Luôn truyền giá trị khởi tạo cho reduce.',
      ],
    },
  }),
  lesson({
    id: 603,
    moduleId: 61,
    courseId: 6,
    title: 'Bài 1.3 [Coding Lab]: Tính tổng tiền giỏ hàng có mã giảm giá',
    type: 'coding',
    durationMinutes: 15,
    orderIndex: 3,
    codingChallengeId: 14,
    summary: 'Dùng filter và reduce để tính tổng giỏ hàng, bỏ qua mặt hàng không hợp lệ và áp dụng phần trăm giảm giá.',
  }),
];

const jsLessons2: LessonItem[] = [
  lesson({
    id: 604,
    moduleId: 62,
    courseId: 6,
    title: 'Bài 2.1: DOM và xử lý sự kiện',
    type: 'video',
    durationMinutes: 13,
    orderIndex: 1,
    summary: 'Chọn phần tử bằng querySelector, thay đổi nội dung an toàn, lắng nghe sự kiện và kỹ thuật ủy quyền sự kiện.',
    segments: [
      segment(604, 1, 0, 260, {
        title: 'Phân đoạn 1 (00:00 – 04:20): Chọn phần tử với querySelector',
        transcript:
          '[00:00] DOM là cây các đối tượng mà trình duyệt tạo ra từ HTML, JavaScript đọc và sửa trang thông qua cây này. [01:20] document.querySelector nhận một CSS selector và trả về phần tử khớp đầu tiên, hoặc null nếu không có. [02:50] querySelectorAll trả về mọi phần tử khớp dưới dạng NodeList, có thể duyệt bằng forEach.',
        summary: 'querySelector trả về phần tử đầu tiên hoặc null; querySelectorAll trả về NodeList.',
        keyFormulas: ['document.querySelector("#id .class")', 'document.querySelectorAll("li")'],
        codeSnippet: `const title = document.querySelector("#title");
const items = document.querySelectorAll("li");
items.forEach((li) => li.classList.add("done"));`,
        quiz: {
          question: 'document.querySelector(".missing") trả về gì khi không có phần tử nào khớp?',
          options: ['null', 'undefined', 'Một NodeList rỗng', 'Báo lỗi'],
          correctIndex: 0,
          explanation: 'querySelector trả về null khi không tìm thấy; querySelectorAll mới trả về NodeList (có thể rỗng).',
        },
      }),
      segment(604, 2, 260, 520, {
        title: 'Phân đoạn 2 (04:20 – 08:40): textContent, innerHTML và an toàn XSS',
        transcript:
          '[04:20] textContent đặt nội dung dạng văn bản thuần, còn innerHTML sẽ phân tích chuỗi thành HTML. [05:50] Nếu đưa dữ liệu người dùng nhập vào innerHTML, kẻ xấu có thể chèn mã độc, gọi là tấn công XSS. [07:20] Quy tắc: hiển thị dữ liệu người dùng bằng textContent; chỉ dùng innerHTML với nội dung do chính bạn kiểm soát.',
        summary: 'textContent không phân tích HTML nên an toàn với dữ liệu người dùng; innerHTML có nguy cơ XSS.',
        keyFormulas: ['el.textContent = userInput   // an toàn', 'el.innerHTML = userInput     // nguy cơ XSS'],
        codeSnippet: `const comment = "<img src=x onerror=alert(1)>";
box.textContent = comment; // hiển thị đúng chuỗi
// box.innerHTML = comment; // sẽ chạy mã độc!`,
        quiz: {
          question: 'Vì sao nên dùng textContent thay vì innerHTML để hiển thị bình luận người dùng nhập?',
          options: [
            'textContent không phân tích chuỗi thành HTML nên mã chèn vào không thể chạy',
            'textContent chạy nhanh hơn nên an toàn hơn',
            'innerHTML không hiển thị được tiếng Việt',
            'textContent tự xóa các thẻ HTML trong chuỗi',
          ],
          correctIndex: 0,
          explanation: 'textContent coi toàn bộ chuỗi là văn bản thuần, nên thẻ <img onerror=...> chỉ hiện ra dưới dạng chữ thay vì thành phần tử HTML có thể chạy mã.',
        },
      }),
      segment(604, 3, 520, 780, {
        title: 'Phân đoạn 3 (08:40 – 13:00): addEventListener và ủy quyền sự kiện',
        transcript:
          '[08:40] addEventListener gắn một hàm xử lý vào sự kiện như click hay input. [10:00] Sự kiện nổi bọt từ phần tử con lên phần tử cha, nên thay vì gắn sự kiện cho từng nút trong danh sách dài, ta gắn một lần ở phần tử cha rồi xem event.target là phần tử nào. [11:40] Kỹ thuật này gọi là ủy quyền sự kiện, nó vẫn hoạt động với các phần tử thêm vào sau.',
        summary: 'addEventListener gắn xử lý sự kiện; ủy quyền sự kiện dùng nổi bọt để xử lý ở phần tử cha.',
        keyFormulas: ['el.addEventListener("click", handler)', 'event.target.closest("button")'],
        codeSnippet: `list.addEventListener("click", (event) => {
  const btn = event.target.closest("button.delete");
  if (btn) btn.closest("li").remove();
});`,
        quiz: {
          question: 'Ưu điểm chính của ủy quyền sự kiện (gắn listener ở phần tử cha) là gì?',
          options: [
            'Một listener xử lý được cả các phần tử con thêm vào sau',
            'Sự kiện không còn nổi bọt lên phần tử cha',
            'Trình duyệt bỏ qua event.target',
            'Chỉ hoạt động với sự kiện bàn phím',
          ],
          correctIndex: 0,
          explanation: 'Vì sự kiện nổi bọt lên cha, một listener ở cha bắt được click của mọi phần tử con, kể cả phần tử được thêm vào DOM sau khi gắn listener.',
        },
      }),
    ],
  }),
  lesson({
    id: 605,
    moduleId: 62,
    courseId: 6,
    title: 'Bài 2.2 [Bài đọc]: Promise và async / await',
    type: 'reading',
    durationMinutes: 10,
    orderIndex: 2,
    summary: 'Lập trình bất đồng bộ: Promise, async / await, xử lý lỗi và chạy song song với Promise.all.',
    readingContent: {
      estimatedMinutes: 10,
      sections: [
        {
          heading: '1. Promise là gì',
          body: 'Promise đại diện cho một kết quả sẽ có trong tương lai, ví dụ dữ liệu trả về từ một lời gọi mạng. Một Promise ở một trong ba trạng thái: đang chờ, đã hoàn thành với một giá trị, hoặc bị từ chối với một lỗi. Hàm fetch trả về một Promise, nên chương trình không bị đứng trong lúc chờ máy chủ.',
        },
        {
          heading: '2. async / await và xử lý lỗi',
          body: 'Hàm khai báo async luôn trả về Promise. Bên trong nó, await tạm dừng hàm cho đến khi Promise hoàn thành, giúp code bất đồng bộ đọc giống code tuần tự. Lỗi của Promise bị từ chối được bắt bằng try / catch như lỗi thông thường. Lưu ý fetch không coi mã HTTP 404 hay 500 là lỗi, cần tự kiểm tra response.ok.',
          codeSnippet: `async function loadUser(id) {
  try {
    const res = await fetch(\`/api/users/\${id}\`);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return await res.json();
  } catch (err) {
    console.error("Không tải được người dùng", err);
    return null;
  }
}`,
        },
        {
          heading: '3. Chạy song song với Promise.all và Promise.allSettled',
          body: 'Nếu viết await cho từng lời gọi lần lượt, tổng thời gian bằng tổng thời gian các lời gọi. Khi các lời gọi độc lập, hãy khởi động tất cả rồi chờ chung bằng Promise.all; tổng thời gian chỉ bằng lời gọi chậm nhất. Promise.all bị từ chối ngay khi một Promise lỗi, còn Promise.allSettled chờ tất cả và cho biết từng cái thành công hay thất bại.',
          formula: 'const [a, b] = await Promise.all([fetchA(), fetchB()]);',
        },
      ],
      keyTakeaways: [
        'Hàm async luôn trả về Promise; dùng await bên trong để chờ kết quả.',
        'fetch không ném lỗi với 404/500, phải kiểm tra response.ok.',
        'Lời gọi độc lập nên chạy song song bằng Promise.all hoặc Promise.allSettled.',
      ],
    },
  }),
  lesson({
    id: 606,
    moduleId: 62,
    courseId: 6,
    title: 'Bài 2.3 [Coding Lab]: Gộp kết quả từ nhiều nguồn dữ liệu bất đồng bộ',
    type: 'coding',
    durationMinutes: 20,
    orderIndex: 3,
    codingChallengeId: 15,
    summary: 'Chạy song song nhiều tác vụ bất đồng bộ, bỏ qua tác vụ lỗi và cộng dồn kết quả thành công.',
  }),
  lesson({
    id: 607,
    moduleId: 62,
    courseId: 6,
    title: 'Bài 2.4 [Kiểm tra]: JavaScript căn bản và DOM',
    type: 'quiz',
    durationMinutes: 10,
    orderIndex: 4,
    quizId: 313,
    summary: 'Bài kiểm tra trắc nghiệm về kiểu dữ liệu, hàm, mảng, DOM và bất đồng bộ.',
  }),
];

function totalMinutes(lessons: LessonItem[]): number {
  return lessons.reduce((a, l) => a + l.durationMinutes, 0);
}

const pythonAll = [...pythonLessons1, ...pythonLessons2, ...pythonLessons3];
const jsAll = [...jsLessons1, ...jsLessons2];

export const PROGRAMMING_COURSES: CourseItem[] = [
  {
    id: 5,
    title: 'Lập trình Python Cơ bản',
    slug: 'lap-trinh-python-co-ban',
    code: 'IT1110',
    credits: 3,
    description:
      'Khóa nhập môn lập trình với Python cho người mới bắt đầu: biến và kiểu dữ liệu, điều kiện, vòng lặp, hàm và các cấu trúc dữ liệu list, dict, tuple, set, kèm bài thực hành viết code trên trình duyệt.',
    category: 'Lập trình',
    department: 'Khoa Công nghệ Thông tin',
    major: 'Công nghệ Thông tin',
    level: 'beginner',
    durationMinutes: totalMinutes(pythonAll),
    lessonsCount: pythonAll.length,
    studentsCount: 1240,
    rating: 4.8,
    reviewsCount: 0,
    progressPercent: 0,
    lastLessonId: 501,
    deadlineStatus: 'on_track',
    nextDeadlineDate: '2026-11-15 23:59',
    tags: ['Python', 'Nhập môn lập trình', 'Vòng lặp', 'Hàm', 'Cấu trúc dữ liệu'],
    instructor: PYTHON_INSTRUCTOR,
    modules: [
      {
        id: 51,
        courseId: 5,
        title: 'Chương 1: Làm quen với Python',
        description: 'Biến, kiểu dữ liệu, nhập/xuất và câu lệnh điều kiện.',
        orderIndex: 1,
        dueDate: '2026-11-08 23:59',
        lessons: pythonLessons1,
      },
      {
        id: 52,
        courseId: 5,
        title: 'Chương 2: Vòng lặp và hàm',
        description: 'for, while, range(), định nghĩa hàm, tham số và phạm vi biến.',
        orderIndex: 2,
        dueDate: '2026-11-15 23:59',
        lessons: pythonLessons2,
      },
      {
        id: 53,
        courseId: 5,
        title: 'Chương 3: Cấu trúc dữ liệu',
        description: 'list, dict, tuple, set, list comprehension và xử lý chuỗi.',
        orderIndex: 3,
        dueDate: '2026-11-22 23:59',
        lessons: pythonLessons3,
      },
    ],
    reviews: [],
  },
  {
    id: 6,
    title: 'Lập trình Web với JavaScript',
    slug: 'lap-trinh-web-voi-javascript',
    code: 'IT3080',
    credits: 3,
    description:
      'Nền tảng JavaScript cho lập trình web: kiểu dữ liệu, hàm, xử lý mảng, thao tác DOM an toàn, sự kiện và lập trình bất đồng bộ với Promise, async / await.',
    category: 'Lập trình',
    department: 'Khoa Công nghệ Thông tin',
    major: 'Công nghệ Thông tin',
    level: 'beginner',
    durationMinutes: totalMinutes(jsAll),
    lessonsCount: jsAll.length,
    studentsCount: 860,
    rating: 4.7,
    reviewsCount: 0,
    progressPercent: 0,
    lastLessonId: 601,
    deadlineStatus: 'on_track',
    nextDeadlineDate: '2026-11-20 23:59',
    tags: ['JavaScript', 'DOM', 'async/await', 'Lập trình Web'],
    instructor: JS_INSTRUCTOR,
    modules: [
      {
        id: 61,
        courseId: 6,
        title: 'Chương 1: JavaScript căn bản',
        description: 'Biến, kiểu dữ liệu, so sánh, hàm và xử lý mảng.',
        orderIndex: 1,
        dueDate: '2026-11-13 23:59',
        lessons: jsLessons1,
      },
      {
        id: 62,
        courseId: 6,
        title: 'Chương 2: DOM và lập trình bất đồng bộ',
        description: 'Thao tác DOM, sự kiện, Promise và async / await.',
        orderIndex: 2,
        dueDate: '2026-11-20 23:59',
        lessons: jsLessons2,
      },
    ],
    reviews: [],
  },
];

/* ------------------------------------------------------------------ */
/* Module quizzes                                                       */
/* ------------------------------------------------------------------ */

export const PROGRAMMING_QUIZZES: QuizItem[] = [
  {
    id: 311,
    title: 'Kiểm tra Chương 1 – 2: Kiểu dữ liệu, điều kiện, vòng lặp và hàm',
    topic: 'Python cơ bản',
    subjectContext: 'IT1110 - Lập trình Python Cơ bản',
    difficulty: 'easy',
    questionCount: 4,
    timeLimitSeconds: 600,
    questions: [
      {
        id: 1,
        questionType: 'multiple_choice',
        question: 'Đoạn code x = 7; y = 2; print(x // y, x % y) in ra gì?',
        options: ['3 1', '3.5 1', '3 0', '4 1'],
        correctIndex: 0,
        explanation: '7 // 2 = 3 (chia lấy phần nguyên) và 7 % 2 = 1 (số dư).',
      },
      {
        id: 2,
        questionType: 'multiple_choice',
        question: 'Với score = 85, chuỗi if score >= 50: ... elif score >= 80: ... sẽ chạy nhánh nào?',
        options: [
          'Nhánh score >= 50, vì Python chỉ chạy nhánh đúng đầu tiên',
          'Nhánh score >= 80, vì điều kiện chặt hơn',
          'Cả hai nhánh',
          'Không nhánh nào',
        ],
        correctIndex: 0,
        explanation: 'Các nhánh được xét từ trên xuống; score >= 50 đúng trước nên nhánh elif không bao giờ được xét. Điều kiện chặt hơn phải đặt lên trước.',
      },
      {
        id: 3,
        questionType: 'multiple_choice',
        question: 'Vòng lặp for i in range(5, 0, -2): print(i) in ra các số nào?',
        options: ['5 3 1', '5 4 3 2 1', '5 3 1 -1', '0 2 4'],
        correctIndex: 0,
        explanation: 'Bắt đầu từ 5, mỗi lần trừ 2 và dừng trước khi đạt 0: 5, 3, 1.',
      },
      {
        id: 4,
        questionType: 'multiple_choice',
        question: 'Hàm def f(x): x * 2 (không có return). Giá trị của f(4) là gì?',
        options: ['None', '8', '4', 'Báo lỗi'],
        correctIndex: 0,
        explanation: 'Hàm không có lệnh return sẽ trả về None; phép nhân được tính nhưng kết quả bị bỏ đi.',
      },
    ],
  },
  {
    id: 312,
    title: 'Kiểm tra Chương 3: Cấu trúc dữ liệu trong Python',
    topic: 'Python cơ bản',
    subjectContext: 'IT1110 - Lập trình Python Cơ bản',
    difficulty: 'medium',
    questionCount: 4,
    timeLimitSeconds: 600,
    questions: [
      {
        id: 1,
        questionType: 'multiple_choice',
        question: '[x * 2 for x in range(4) if x % 2 == 1] cho kết quả nào?',
        options: ['[2, 6]', '[0, 4]', '[1, 3]', '[2, 4, 6]'],
        correctIndex: 0,
        explanation: 'Các x lẻ trong 0..3 là 1 và 3; nhân đôi được [2, 6].',
      },
      {
        id: 2,
        questionType: 'multiple_choice',
        question: 'Cấu trúc nào phù hợp nhất để tra điểm của sinh viên theo mã số sinh viên?',
        options: ['dict', 'list', 'tuple', 'set'],
        correctIndex: 0,
        explanation: 'dict ánh xạ khóa (mã sinh viên) sang giá trị (điểm) và tra cứu theo khóa rất nhanh.',
      },
      {
        id: 3,
        questionType: 'multiple_choice',
        question: 'Lệnh nào gây lỗi với t = (1, 2, 3)?',
        options: ['t[0] = 10', 'len(t)', 't[1:]', 'x, y, z = t'],
        correctIndex: 0,
        explanation: 'tuple bất biến nên không gán lại phần tử được (TypeError); đọc, cắt lát và giải nén đều hợp lệ.',
      },
      {
        id: 4,
        questionType: 'multiple_choice',
        question: '"-".join("Học Python".lower().split()) trả về gì?',
        options: ['"học-python"', '"Học-Python"', '"h-ọ-c- -p-y-t-h-o-n"', '"học python"'],
        correctIndex: 0,
        explanation: 'lower() đổi thành "học python", split() tách thành ["học", "python"], join ghép lại bằng dấu "-".',
      },
    ],
  },
  {
    id: 313,
    title: 'Kiểm tra Chương 1 – 2: JavaScript căn bản và DOM',
    topic: 'JavaScript',
    subjectContext: 'IT3080 - Lập trình Web với JavaScript',
    difficulty: 'medium',
    questionCount: 4,
    timeLimitSeconds: 600,
    questions: [
      {
        id: 1,
        questionType: 'multiple_choice',
        question: 'Kết quả của [1, 2, 3, 4].filter((n) => n % 2 === 0).map((n) => n * 10) là gì?',
        options: ['[20, 40]', '[10, 30]', '[10, 20, 30, 40]', '60'],
        correctIndex: 0,
        explanation: 'filter giữ các số chẵn [2, 4], map nhân 10 được [20, 40].',
      },
      {
        id: 2,
        questionType: 'multiple_choice',
        question: '[].reduce((a, b) => a + b) cho kết quả gì?',
        options: ['Báo lỗi TypeError', '0', 'undefined', '[]'],
        correctIndex: 0,
        explanation: 'reduce trên mảng rỗng mà không có giá trị khởi tạo sẽ ném TypeError; viết [].reduce((a, b) => a + b, 0) để được 0.',
      },
      {
        id: 3,
        questionType: 'multiple_choice',
        question: 'Trong một hàm async, fetch trả về phản hồi HTTP 404. Điều gì xảy ra?',
        options: [
          'Promise vẫn hoàn thành; cần tự kiểm tra response.ok',
          'fetch tự ném lỗi và nhảy vào catch',
          'Trình duyệt tự tải lại trang',
          'await trả về null',
        ],
        correctIndex: 0,
        explanation: 'fetch chỉ bị từ chối khi lỗi mạng; với 404/500 Promise vẫn hoàn thành và response.ok là false.',
      },
      {
        id: 4,
        questionType: 'multiple_choice',
        question: 'Ba lời gọi API độc lập mỗi cái mất 1 giây. Dùng await Promise.all([...]) thì tổng thời gian khoảng bao nhiêu?',
        options: ['Khoảng 1 giây', 'Khoảng 3 giây', 'Khoảng 0 giây', 'Khoảng 2 giây'],
        correctIndex: 0,
        explanation: 'Các lời gọi chạy song song nên tổng thời gian bằng lời gọi chậm nhất, khoảng 1 giây; await lần lượt từng cái mới mất 3 giây.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Coding labs                                                          */
/* ------------------------------------------------------------------ */

export const PROGRAMMING_CODING_CHALLENGES: CodingChallengeItem[] = [
  {
    id: 11,
    courseId: 5,
    lessonId: 503,
    title: 'Lab: Xếp loại học lực theo điểm trung bình',
    difficulty: 'easy',
    problemStatement:
      'Viết hàm nhận điểm trung bình hệ 10 và trả về xếp loại: "Giỏi" nếu điểm >= 8.5, "Khá" nếu >= 7.0, "Trung bình" nếu >= 5.0, "Yếu" nếu nhỏ hơn 5.0. Nếu điểm nằm ngoài đoạn [0, 10] thì trả về "Không hợp lệ".',
    constraints: ['score là số thực bất kỳ', 'Kiểm tra trường hợp không hợp lệ trước khi xếp loại'],
    keyFormula: 'score < 0 or score > 10 -> "Không hợp lệ"; >= 8.5 Giỏi; >= 7 Khá; >= 5 Trung bình; còn lại Yếu',
    starterCode: {
      python: `def classify(score: float) -> str:
    # TODO: kiểm tra điểm hợp lệ trong [0, 10]
    # TODO: xếp loại theo thứ tự từ ngưỡng cao xuống thấp
    pass`,
      typescript: `export function classify(score: number): string {
  // TODO: kiểm tra điểm hợp lệ trong [0, 10]
  // TODO: xếp loại theo thứ tự từ ngưỡng cao xuống thấp
  return '';
}`,
      go: `package grading

func Classify(score float64) string {
	// TODO: kiểm tra điểm hợp lệ trong [0, 10]
	// TODO: xếp loại theo thứ tự từ ngưỡng cao xuống thấp
	return ""
}`,
    },
    testCases: [
      { id: 1, name: 'Test Case #1: Điểm giỏi', input: 'score=9.0', expectedOutput: '"Giỏi"', isPublic: true },
      { id: 2, name: 'Test Case #2: Đúng ngưỡng Khá', input: 'score=7.0', expectedOutput: '"Khá"', isPublic: true },
      { id: 3, name: 'Test Case #3: Điểm yếu', input: 'score=4.9', expectedOutput: '"Yếu"', isPublic: true },
      { id: 4, name: 'Test Case #4 (Hidden): Điểm âm', input: 'score=-1', expectedOutput: '"Không hợp lệ"', isPublic: false },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: Kiểm tra điểm không hợp lệ trước, sau đó xét các ngưỡng từ cao xuống thấp (8.5 → 7 → 5). Nếu xét ngưỡng 5 trước, mọi điểm từ 5 trở lên sẽ rơi vào "Trung bình".',
  },
  {
    id: 12,
    courseId: 5,
    lessonId: 506,
    title: 'Lab: Đếm số nguyên tố không vượt quá n',
    difficulty: 'medium',
    problemStatement:
      'Viết hàm count_primes(n) trả về số lượng số nguyên tố p thỏa 2 <= p <= n. Với n < 2 trả về 0. Chương trình phải chạy nhanh với n tới 1 000 000, vì vậy hãy dùng sàng Eratosthenes thay vì kiểm tra từng số.',
    constraints: ['0 <= n <= 1 000 000', 'Thời gian chạy mỗi Test Case <= 1 giây', 'Độ phức tạp gợi ý O(n log log n)'],
    keyFormula: 'Sàng Eratosthenes: với mỗi p từ 2 đến √n còn đánh dấu nguyên tố, gạch bỏ p², p² + p, p² + 2p, ...',
    starterCode: {
      python: `def count_primes(n: int) -> int:
    if n < 2:
        return 0
    is_prime = [True] * (n + 1)
    is_prime[0] = is_prime[1] = False
    # TODO: với p từ 2 đến căn bậc hai của n, gạch bỏ các bội của p bắt đầu từ p * p
    return sum(is_prime)`,
      typescript: `export function countPrimes(n: number): number {
  if (n < 2) return 0;
  const isPrime = new Array<boolean>(n + 1).fill(true);
  isPrime[0] = isPrime[1] = false;
  // TODO: với p từ 2 đến căn bậc hai của n, gạch bỏ các bội của p bắt đầu từ p * p
  return isPrime.filter(Boolean).length;
}`,
      go: `package primes

func CountPrimes(n int) int {
	if n < 2 {
		return 0
	}
	isComposite := make([]bool, n+1)
	// TODO: với p từ 2 đến căn bậc hai của n, đánh dấu các bội của p bắt đầu từ p * p
	count := 0
	for i := 2; i <= n; i++ {
		if !isComposite[i] {
			count++
		}
	}
	return count
}`,
    },
    testCases: [
      { id: 1, name: 'Test Case #1: n = 10', input: 'n=10', expectedOutput: '4', isPublic: true },
      { id: 2, name: 'Test Case #2: n nhỏ hơn 2', input: 'n=1', expectedOutput: '0', isPublic: true },
      { id: 3, name: 'Test Case #3: n = 100', input: 'n=100', expectedOutput: '25', isPublic: true },
      { id: 4, name: 'Test Case #4 (Hidden): n = 1 000 000', input: 'n=1000000', expectedOutput: '78498', isPublic: false },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: Chỉ cần sàng với p * p <= n. Với mỗi p còn là nguyên tố, bắt đầu gạch từ p * p vì các bội nhỏ hơn đã bị gạch bởi các số nguyên tố nhỏ hơn.',
  },
  {
    id: 13,
    courseId: 5,
    lessonId: 510,
    title: 'Lab: Thống kê tần suất từ trong văn bản',
    difficulty: 'medium',
    problemStatement:
      'Viết hàm top_words(text, k) trả về danh sách k cặp (từ, số lần xuất hiện) phổ biến nhất. Không phân biệt chữ hoa chữ thường, bỏ các dấu câu . , ! ? và tách từ theo khoảng trắng. Sắp xếp theo số lần giảm dần; nếu bằng nhau thì theo thứ tự bảng chữ cái tăng dần.',
    constraints: ['0 <= len(text) <= 100 000', '1 <= k', 'Nếu số từ khác nhau ít hơn k thì trả về tất cả'],
    keyFormula: 'counts[w] = counts.get(w, 0) + 1; sắp xếp theo khóa (-count, word)',
    starterCode: {
      python: `def top_words(text: str, k: int) -> list[tuple[str, int]]:
    for ch in ".,!?":
        text = text.replace(ch, " ")
    counts: dict[str, int] = {}
    # TODO: đếm từng từ (chữ thường) vào counts
    # TODO: sắp xếp theo số lần giảm dần rồi theo từ tăng dần, lấy k phần tử đầu
    return []`,
      typescript: `export function topWords(text: string, k: number): [string, number][] {
  const words = text.toLowerCase().replace(/[.,!?]/g, ' ').split(/\\s+/).filter(Boolean);
  const counts = new Map<string, number>();
  // TODO: đếm từng từ vào counts
  // TODO: sắp xếp theo số lần giảm dần rồi theo từ tăng dần, lấy k phần tử đầu
  return [];
}`,
      go: `package words

type WordCount struct {
	Word  string
	Count int
}

func TopWords(text string, k int) []WordCount {
	// TODO: chuẩn hóa chữ thường, bỏ dấu câu . , ! ? và tách theo khoảng trắng
	// TODO: đếm bằng map[string]int, sắp xếp bằng sort.Slice, lấy k phần tử đầu
	return nil
}`,
    },
    testCases: [
      { id: 1, name: 'Test Case #1: Văn bản ngắn', input: 'text="a b a", k=1', expectedOutput: '[("a", 2)]', isPublic: true },
      {
        id: 2,
        name: 'Test Case #2: Không phân biệt hoa thường và dấu câu',
        input: 'text="Học, học nữa, học mãi!", k=2',
        expectedOutput: '[("học", 3), ("mãi", 1)]',
        isPublic: true,
      },
      { id: 3, name: 'Test Case #3: Bằng số lần thì xếp theo bảng chữ cái', input: 'text="b a c", k=2', expectedOutput: '[("a", 1), ("b", 1)]', isPublic: true },
      { id: 4, name: 'Test Case #4 (Hidden): Văn bản rỗng', input: 'text="", k=3', expectedOutput: '[]', isPublic: false },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: Sau khi đếm, dùng sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])) để sắp xếp theo số lần giảm dần và từ tăng dần trong một lần.',
  },
  {
    id: 14,
    courseId: 6,
    lessonId: 603,
    title: 'Lab: Tính tổng tiền giỏ hàng có mã giảm giá',
    difficulty: 'easy',
    problemStatement:
      'Cho danh sách mặt hàng, mỗi mặt hàng có price (đơn giá) và qty (số lượng), cùng phần trăm giảm giá couponPercent. Bỏ qua mặt hàng có qty <= 0 hoặc price < 0. Tính tổng price * qty, trừ đi couponPercent phần trăm và làm tròn 2 chữ số thập phân. couponPercent ngoài đoạn [0, 100] được coi là 0.',
    constraints: ['0 <= số mặt hàng <= 1000', 'Kết quả làm tròn 2 chữ số thập phân'],
    keyFormula: 'total = Σ price × qty (mặt hàng hợp lệ); result = round(total × (1 − couponPercent / 100), 2)',
    starterCode: {
      python: `def cart_total(items: list[dict], coupon_percent: float) -> float:
    # TODO: bỏ qua mặt hàng có qty <= 0 hoặc price < 0
    # TODO: coupon ngoài [0, 100] coi như 0
    return 0.0`,
      typescript: `interface CartItem {
  price: number;
  qty: number;
}

export function cartTotal(items: CartItem[], couponPercent: number): number {
  // TODO: dùng filter để bỏ mặt hàng không hợp lệ, reduce để cộng tổng
  // TODO: coupon ngoài [0, 100] coi như 0, làm tròn 2 chữ số
  return 0;
}`,
      go: `package cart

type Item struct {
	Price float64
	Qty   int
}

func CartTotal(items []Item, couponPercent float64) float64 {
	// TODO: bỏ qua mặt hàng không hợp lệ, áp dụng giảm giá, làm tròn 2 chữ số
	return 0
}`,
    },
    testCases: [
      {
        id: 1,
        name: 'Test Case #1: Không có giảm giá',
        input: 'items=[{price: 100, qty: 2}, {price: 50, qty: 1}], couponPercent=0',
        expectedOutput: '250',
        isPublic: true,
      },
      {
        id: 2,
        name: 'Test Case #2: Giảm 10%',
        input: 'items=[{price: 19.99, qty: 3}], couponPercent=10',
        expectedOutput: '53.97',
        isPublic: true,
      },
      {
        id: 3,
        name: 'Test Case #3: Bỏ qua mặt hàng số lượng 0',
        input: 'items=[{price: 100, qty: 0}, {price: 30, qty: 1}], couponPercent=0',
        expectedOutput: '30',
        isPublic: true,
      },
      {
        id: 4,
        name: 'Test Case #4 (Hidden): Mã giảm giá không hợp lệ',
        input: 'items=[{price: 10, qty: 1}], couponPercent=150',
        expectedOutput: '10',
        isPublic: false,
      },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: items.filter((i) => i.qty > 0 && i.price >= 0).reduce((sum, i) => sum + i.price * i.qty, 0), sau đó nhân với (1 - coupon / 100) và dùng Math.round(x * 100) / 100 để làm tròn.',
  },
  {
    id: 15,
    courseId: 6,
    lessonId: 606,
    title: 'Lab: Gộp kết quả từ nhiều nguồn dữ liệu bất đồng bộ',
    difficulty: 'medium',
    problemStatement:
      'Cho một mảng các hàm tasks, mỗi hàm khi gọi trả về một Promise của một số (ví dụ điểm lấy từ một API). Viết hàm sumSettled(tasks) chạy tất cả tác vụ song song, bỏ qua những tác vụ bị lỗi và trả về object { total, failed } gồm tổng các kết quả thành công và số tác vụ thất bại.',
    constraints: ['0 <= số tác vụ <= 100', 'Các tác vụ phải chạy song song, không await lần lượt từng cái'],
    keyFormula: 'const results = await Promise.allSettled(tasks.map((t) => t())); total = Σ value của các kết quả "fulfilled"',
    starterCode: {
      python: `import asyncio

async def sum_settled(tasks) -> dict:
    results = await asyncio.gather(*(t() for t in tasks), return_exceptions=True)
    # TODO: cộng các kết quả không phải Exception, đếm số kết quả là Exception
    return {"total": 0, "failed": 0}`,
      typescript: `export async function sumSettled(
  tasks: Array<() => Promise<number>>,
): Promise<{ total: number; failed: number }> {
  // TODO: dùng Promise.allSettled để chạy song song
  // TODO: cộng value của kết quả "fulfilled", đếm kết quả "rejected"
  return { total: 0, failed: 0 };
}`,
      go: `package settle

import "sync"

func SumSettled(tasks []func() (float64, error)) (total float64, failed int) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	// TODO: chạy mỗi task trong một goroutine, dùng mu để cộng total / tăng failed an toàn
	wg.Wait()
	return total, failed
}`,
    },
    testCases: [
      { id: 1, name: 'Test Case #1: Tất cả thành công', input: 'tasks=[resolve(3), resolve(4)]', expectedOutput: '{ total: 7, failed: 0 }', isPublic: true },
      { id: 2, name: 'Test Case #2: Có tác vụ lỗi', input: 'tasks=[resolve(5), reject("timeout"), resolve(1)]', expectedOutput: '{ total: 6, failed: 1 }', isPublic: true },
      { id: 3, name: 'Test Case #3: Không có tác vụ', input: 'tasks=[]', expectedOutput: '{ total: 0, failed: 0 }', isPublic: true },
      {
        id: 4,
        name: 'Test Case #4 (Hidden): Chạy song song',
        input: 'tasks=[delay(500, 1), delay(500, 2), delay(500, 3)]',
        expectedOutput: '{ total: 6, failed: 0 } trong < 700 ms',
        isPublic: false,
      },
    ],
    aiHint:
      'Gợi ý từ AI Tutor: Gọi tasks.map((t) => t()) để khởi động mọi tác vụ cùng lúc, rồi await Promise.allSettled(...). Mỗi kết quả có status là "fulfilled" (dùng value) hoặc "rejected" (dùng reason).',
  },
];

/* ------------------------------------------------------------------ */
/* Gradebooks (no grades yet: the student has just enrolled)            */
/* ------------------------------------------------------------------ */

function emptyGradebook(course: CourseItem): CourseGradebook {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const firstOf = (type: LessonItem['type']) => lessons.find((l) => l.type === type)?.id;
  const due = course.nextDeadlineDate ?? '';
  const item = (
    suffix: string,
    title: string,
    category: CourseGradebook['items'][number]['category'],
    categoryLabel: string,
    weightPercent: number,
    lessonId?: number,
  ): CourseGradebook['items'][number] => ({
    id: `gb-${course.id}-${suffix}`,
    title,
    category,
    categoryLabel,
    weightPercent,
    score: null,
    maxScore: 100,
    status: 'in_progress',
    dueDate: due,
    lessonId,
  });
  return {
    courseId: course.id,
    passingThreshold: 75,
    overallWeightedScore: 0,
    categoryWeights: { segment_quiz: 20, module_quiz: 30, coding_lab: 25, final_assignment: 25 },
    items: [
      item('1', 'Câu hỏi giữa video (In-Video Segment Quizzes)', 'segment_quiz', 'In-Video Segment Quizzes (20%)', 20, firstOf('video')),
      item('2', 'Bài kiểm tra cuối chương', 'module_quiz', 'Module Quizzes (30%)', 30, firstOf('quiz')),
      item('3', 'Coding Lab', 'coding_lab', 'Coding Labs (25%)', 25, firstOf('coding')),
      item('4', 'Bài tập lớn cuối khóa', 'final_assignment', 'Final Assignment (25%)', 25),
    ],
  };
}

export const PROGRAMMING_GRADEBOOKS: Record<number, CourseGradebook> = Object.fromEntries(
  PROGRAMMING_COURSES.map((c) => [c.id, emptyGradebook(c)]),
);
