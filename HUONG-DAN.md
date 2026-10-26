# BurgerShop POD Helper

Extension Chrome gắn một panel nổi lên `admin.burgershop.io` để làm nhanh quy trình trong `Trang đầu.docx`.

## Cài (1 lần)

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc phải trên)
3. Bấm **Load unpacked** → chọn thư mục `D:\Project\Searching\burgershop-pod-tool`
4. Mở lại (F5) trang admin.burgershop.io → panel **POD Helper** hiện ở góc phải

Sửa code xong thì bấm nút ⟳ của extension trong `chrome://extensions` rồi F5 trang.

## Dùng

| Nút | Việc tool làm | Việc bạn làm |
|---|---|---|
| ① Tạo POD + chọn áo | Bấm *Create POD product* → chọn đúng loại áo → Save trong hộp thoại | Mở trang *All products* trước |
| ② Chọn màu | Mở bảng màu, chọn đúng các màu đã tick trong tool (tối đa 12), bỏ màu thừa | — |
| *(tay)* | | Upload design → bấm **Save** |
| ③ Điền thông tin | Title, Description, Price và Compare price (2 giá riêng) cho mọi biến thể, chọn Tags | Kiểm tra → bấm **Save** |

- Tick **Chạy luôn ② sau ①** thì chỉ cần bấm ① là xong cả chọn áo lẫn chọn màu.
- Ô giá nào để trống thì cột đó giữ nguyên giá trang tự đặt.
- Sau mỗi bước tool tự **kiểm tra lại** (áo, màu, title, description, giá từng biến thể, tag) và hiện khung
  **⚠ Cần chỉnh tay** ngay dưới các nút. Log chi tiết tự ẩn khi chạy xong.
- Sửa tay xong thì tick vào từng dòng, hoặc bấm **🔍 Kiểm tra lại** để tool soát lại màn hình đang mở.
- **Quét tag từ trang**: mở trang điền thông tin (sau bước Save design) rồi bấm — tool cuộn hết danh sách tag và lưu lại để bạn tick.
- Cấu hình được lưu tự động trong Chrome.

## Khi có bước không chạy

Bấm **Chẩn đoán** ở cuối panel → kết quả được copy vào clipboard → dán cho Claude để sửa.
