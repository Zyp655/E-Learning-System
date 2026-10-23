# StrongBody Design System — quy tắc giao diện bắt buộc (`lms-web`)

> Áp dụng cho **mọi** thay đổi giao diện. Bắt buộc 100% với các trang trong `src/app/[locale]/(HOME_CATEGORY)/`.
> Kiểm tra tự động: `npm run lint:ds` (chạy cả ở pre-commit và CI trên Pull Request).
> Nguồn sự thật của token: `src/styles/tokens.css` · UI kit: `src/app/[locale]/(HOME_CATEGORY)/_components/ui/`.

---

## 1. Nguyên tắc chung

1. **Không tự viết style lẻ.** Màu, cỡ chữ, bo góc, bóng đổ… đều lấy từ token / UI kit. Cấm giá trị tuỳ ý: `text-[#…]`, `bg-[#…]`, `text-[15px]`, `leading-[22px]`, `rounded-[10px]`, `style={{ color/fontSize/fontFamily }}`.
2. **Một font duy nhất: Plus Jakarta Sans** (`font-sans`, đã đặt sẵn). Không `font-['…']`, `font-serif`, `font-mono`, không import Google Fonts khác.
3. **Một bộ icon duy nhất: Heroicons** qua `<Icon name="…" />` (`(HOME_CATEGORY)/_components/primitives`) hoặc `ShellIcon` cho menu. Không `lucide-react`, `react-icons`, emoji, ký tự (★ ✓) hay SVG tự vẽ làm icon. Thiếu icon → thêm 1 dòng vào `_components/iconMap.ts`.
4. **Trang trong `(HOME_CATEGORY)` dùng UI kit** — không tự viết class cho nút, card, badge, tab, ô nhập.
5. **Luôn nền sáng.** `dark:` không hoạt động (chỉ chạy khi có class `.dark`, không bao giờ gắn).

## 2. Bố cục nền — "nền xám + card trắng"

- Cả cột nội dung (phần đệm lẫn bên trong) là **một nền xám** `bg-muted` (#f9fafb) — đã đặt trên `<body>` cho mọi trang có App Shell.
- **Tiêu đề trang, mô tả, thanh tab, ô tìm kiếm** nằm thẳng trên nền xám.
- **Mọi khối nội dung là card trắng** (`cardVariants`): danh sách, form, trạng thái trống, thông báo, trình phát video, khung chat trợ lý AI…
- Section / hero / wrapper **không tự tô nền** (`bg-white`, `bg-muted`, gradient) và **không kẻ viền ngang** giữa các section — tách nhau bằng khoảng trống.
- **Không lồng card có viền trong card.** Nhóm con bên trong card: `rounded-xl bg-muted p-4` (không viền).
- Thanh sticky: `bg-muted/95 backdrop-blur`.

## 3. Typography

| Utility | Mobile | Desktop (≥728px) | Dùng cho |
|---|---|---|---|
| `text-display` | 36 / 700 | 60 | Hero lớn |
| `text-h1` | 30 / 700 | 48 | Tiêu đề trang |
| `text-h2` | 24 / 700 | 36 | Tiêu đề section |
| `text-h3` | 20 / 600 | 24 | Tiêu đề card/khối |
| `text-h4` | 18 / 600 | 20 | Tiêu đề nhỏ |
| `text-body-lg` | 16 | 18 | Đoạn dẫn |
| `text-body` | 14 | 16 | **Nội dung mặc định** |
| `text-caption` | 12 / 500 | 12 | Badge, label — không dùng cho nội dung đọc |

- Trong UI kit dùng sẵn: `headingText.pageTitle / heroTitle / sectionTitle / panelTitle`, `cardText.title / titleSm / description / meta / price / stat / eyebrow`.
- **Cỡ chữ tối thiểu:** mobile ≥ 14px, desktop ≥ 16px cho nội dung đọc. `text-xs` chỉ cho badge/meta.
- **Khu tài khoản (`/student/*`, `/teacher/*`)**: trên desktop (≥ 984px) **mọi chữ ≥ 16px** — tự động nhờ thuộc tính `data-desktop-min-text` ở layout (đừng gỡ).
- Weight: 3 mức đậm: `font-normal` (nội dung) · `font-medium` (nút, tab, badge, nhãn, link, tên người, nhấn mạnh trong câu) · `font-semibold` (tiêu đề trang/section/card, giá, số liệu). **Không dùng `font-bold`** ở trang `(HOME_CATEGORY)`.

## 4. Màu theo Vai trò & Ngữ cảnh

| Nhóm | Token |
|---|---|
| Chữ | `text-primary` #111827 · `text-secondary` #586474 (mô tả, chữ phụ) · `text-tertiary` #727B8A (meta, placeholder) · `text-disabled` |
| Student / Học sinh (đỏ) | `brand`, `brand-25…900` (#DA1F27) |
| Teacher Studio / Giảng viên (xanh) | `seller`, `seller-25…900` (#1C906C) |
| AI Tutor / Can thiệp chủ động / Tin nhắn | `chat`, `chat-25…800` (#0866FF) |
| Navy | `navy`, `navy-50…900` |
| Nền | `bg-muted` (canvas) · `bg-white` (card) · `bg-subtle` (khối nhấn, track tab) · `bg-page` (trang ngoài App Shell) |
| Viền | `border` = `border-line` · `border-line-strong` (ô nhập) · `border-line-subtle` (ngăn cách trong card) |
| Trạng thái & Cảm xúc | `success` (focused/happy) · `warning` (bored/hesitant) · `danger` (confused/frustrated/violation) · `info` (AI analyzing) |
| Palette phụ | `gray` (xám duy nhất), `red`, `amber`, `green`, `emerald`, `teal`, `blue`, `purple` |

- Đã gỡ khỏi theme (class không còn tác dụng): `slate/zinc/neutral/stone/sky/cyan/indigo/rose/pink/orange/yellow/lime/violet/fuchsia`, `font-light/extrabold/black`, `text-7xl+`, `shadow-xl/2xl`.

## 5. Bo góc & bóng đổ

| Thành phần | Bo góc |
|---|---|
| **Nút (mọi nút)** | `rounded-button` (10px) |
| Badge | `rounded-2xl` (16px) |
| Chip | `rounded-full` |
| Thanh tab | track `rounded-xl` (12px), tab `rounded-lg` (8px) |
| Ô nhập, select, dropdown | `rounded-xl` |
| Card, panel | `rounded-2xl` |
| Dialog, sheet | `rounded-3xl` |

Bóng đổ: card **không** bóng (chỉ viền). `shadow-xs` (tab đang chọn, badge trên ảnh) · `shadow-md` (popover) · `shadow-lg` (menu nổi, modal) · `shadow-side` (sidebar).
