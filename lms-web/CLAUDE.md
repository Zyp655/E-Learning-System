# LMS Web — Quy ước dự án (Kế thừa 100% từ StrongBody Web)

> **Quy tắc giao diện đầy đủ: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** (bắt buộc đọc trước khi sửa UI).

## Rule bắt buộc khi thêm/sửa trang (page/route/layout)

1. **Một font duy nhất: Plus Jakarta Sans** (`font-sans`). Chỉ dùng `font-normal`, `font-medium`, `font-semibold`. Không dùng `font-bold` trong `(HOME_CATEGORY)`.
2. **Bố cục Nền xám (`bg-muted`) + Card trắng (`<Card>` / `cardVariants`)**: Không lồng card có viền trong card; khối con bên trong card dùng `rounded-xl bg-muted p-4`.
3. **Màu sắc theo vai trò**:
   - Học sinh (`student`): `brand` (`#da1f27`), `primary`, `soft-brand`.
   - Giảng viên (`teacher`): `seller` (`#1c906c`), `seller`, `soft-seller`.
   - Trợ lý Ảo AI (`ai-tutor`, `ConfusionInterventionOverlay`, `messages`): `chat` (`#0866ff`), `chat`, `soft-chat`.
4. **Một bộ icon duy nhất: Heroicons** qua `<Icon name="..." />` (`_components/iconMap.ts`).
5. **Thanh tab dùng `segmented.list` + `segmented.tab`**; chip (`chipVariants`) chỉ dùng cho bộ lọc hoặc chọn mức độ.
6. **Popup / Modal dùng `<Dialog>` từ `@/components/catalyst/dialog`** (tự động thành bottom sheet trên mobile `< 728px`).
7. **Kiểm tra tự động**: Chạy `npm run lint:ds -- --all` đảm bảo 0 vi phạm.
