# Hướng dẫn Làm việc & Cập nhật Tài liệu cho AI Agent (`burgershop-pod-tool`)

> **Tệp tài liệu kiến trúc nguồn:** [`CODEBASE.md`](./CODEBASE.md)
> **Các tệp mã nguồn:** [`manifest.json`](./manifest.json) · [`page-bridge.js`](./page-bridge.js) · [`content.js`](./content.js) · [`panel.css`](./panel.css)

---

## 1. Mục đích của Tệp này

Tệp `agent.md` cung cấp quy trình chuẩn cho AI Agent ở mọi đoạn chat mới và cho tác giả khi bảo trì tiện ích mở rộng **BurgerShop POD Helper**:
- Hiểu ngay kiến trúc 2 ngữ cảnh (`MAIN` world + `ISOLATED` world) và các cơ chế xử lý Angular/PrimeNG/TinyMCE đặc thù của `admin.burgershop.io`.
- Giữ [`CODEBASE.md`](./CODEBASE.md) luôn đồng bộ tuyệt đối sau mỗi lần sửa đổi.

---

## 2. Quy trình BẮT BUỘC Trước Khi Sửa Code (Read-First Protocol)

1. **Bước 1:** Đọc **Mục 2** (Kiến trúc Dual-World & quy trình 3 bước) và **Mục 8** (Các bất biến không được phá vỡ) trong [`CODEBASE.md`](./CODEBASE.md).
2. **Bước 2 — Tra cứu nhanh vị trí cần đọc & sửa:**

| Khi cần thực hiện công việc... | Đọc mục nào trong `CODEBASE.md` | Mở và kiểm tra tệp nguồn |
| :--- | :--- | :--- |
| Sửa quyền Extension, URL trang đích hoặc cách nạp script | Mục 1.2, 2.2, 3 | `manifest.json` (`1–22`) |
| Sửa lỗi điền hoặc đọc lại ô Description (TinyMCE) | Mục 2.2, 4.1, 5.2 | `page-bridge.js` (`1–41`) và `callBridge()` trong `content.js` (`379–396`) |
| Sửa Bước ① (tìm/chọn phôi áo trong hộp thoại Create POD) | Mục 2.3, 4.2.D | `content.js`: `step1()` & `verifyStep1()` (`140–223`) |
| Sửa Bước ② (chọn/bỏ màu, quét màu, giới hạn 12 màu) | Mục 2.3, 4.2.E, 8.3 | `content.js`: `step2()`, `verifyStep2()`, `scanColors()` (`225–376`) |
| Sửa Bước ③ (Title, điền giá biến thể cuộn ảo/phân trang, chọn/quét Tags) | Mục 2.3, 4.2.F, 8.4 | `content.js`: `forEachVariantRow()`, `scanTags()`, `selectTags()`, `step3()`, `verifyStep3()` (`378–756`) |
| Bổ sung thông tin vào nút **Chẩn đoán** khi trang đổi DOM | Mục 4.2.F, 7.2 | `content.js`: `diagnose()` (`759–786`) |
| Sửa giao diện Panel nổi, kéo thả, danh sách lỗi cần chỉnh tay hoặc lưu trữ đa tab | Mục 4.2.A, 4.2.C, 4.2.G, 5.1, 6 | `content.js` (`22–39`, `86–133`, `789–1091`) & `panel.css` (`1–105`) |

---

## 3. Các Bất biến Kỹ thuật & Quy tắc An toàn Riêng của Dự án (Guardrails)

1. **Giữ nguyên `stopPropagation` cho `mousedown` và `click` trên `#pod-helper` (`content.js` dòng 1065):** Không để sự kiện click trong panel lan ra ngoài làm đóng mất `.p-overlaypanel` và `.p-multiselect-panel` của PrimeNG.
2. **Mọi CSS mới trong `panel.css` bắt buộc có tiền tố `#pod-helper`:** Tránh rò rỉ CSS làm biến dạng giao diện quản trị `admin.burgershop.io`.
3. **Gán giá trị cho `<input>` / `<textarea>` của Angular phải qua `setNativeValue(el, value)` kèm sự kiện `input`, `change` (và `blur` nếu cần):** Gán `el.value = ...` đơn thuần sẽ không cập nhật `FormControl` của Angular Reactive Forms, dẫn đến bấm Save trên trang bị mất dữ liệu.
4. **Tôn trọng cơ chế Virtual Scroll & Phân trang:** Khi đọc/ghi bảng biến thể hoặc danh sách tag, luôn dùng `forEachVariantRow` và `walkTagList` (kèm `scrollStep` kiểm tra độ nhích thực tế `el.scrollTop > before + 1` để không bao giờ gây vòng lặp vô tận).
5. **Bảo toàn cơ chế `loaded` + `ownWrites` khi lưu `chrome.storage.local`:** Tránh lỗi mở nhiều tab `admin.burgershop.io` cùng lúc làm mất cấu hình vừa nhập.
6. **Không tự động bấm nút `Save` sản phẩm cuối cùng ở Bước ③** trừ khi người dùng yêu cầu rõ: quy trình chuẩn cố tình dừng sau `verifyStep3()` và cuộn lên đầu trang để người dùng duyệt danh sách `"⚠ Cần chỉnh tay"` trước khi lưu.

---

## 4. Quy trình BẮT BUỘC Cập nhật Tài liệu Sau Mỗi Lần Sửa Code (Post-Edit Sync Protocol)

> **QUY TẮC BẮT BUỘC:** Sau bất kỳ chỉnh sửa nào trên mã nguồn extension, bạn **PHẢI** cập nhật [`CODEBASE.md`](./CODEBASE.md) trước khi kết thúc phiên làm việc!

| Loại thay đổi trong code | Các mục cần cập nhật trong `CODEBASE.md` | Cập nhật thêm tại `agent.md` / `HUONG-DAN.md`? |
| :--- | :--- | :--- |
| Thêm / xóa tệp hoặc đổi cấu hình `manifest.json` | **Mục 1.2**, **Mục 2.1**, **Mục 3** (File Map) | Cập nhật bảng tra cứu **Mục 2** trong `agent.md` |
| Thay đổi selector DOM Angular/PrimeNG hoặc logic các bước `step1/2/3`, `verifyStep1/2/3` | **Mục 2.3** và **Mục 4.1 / 4.2** (Cập nhật tên hàm, số dòng, giải thích thuật toán & selector mới) | Cập nhật `HUONG-DAN.md` nếu cách bấm nút của người dùng thay đổi |
| Thêm trường cấu hình mới vào `DEFAULTS` / `cfg` hoặc đổi bản tin `postMessage` | **Mục 5.1** (Bảng schema `podHelper`) và/hoặc **Mục 5.2** | Không cần |
| Thay đổi bố cục, màu sắc, trạng thái panel trong `panel.css` / HTML template | **Mục 4.2.G** và **Mục 6** | Không cần |
| Phát hiện hành vi DOM mới của BurgerShop hoặc ràng buộc mới | **Mục 8** (Invariants & Gotchas) | Bổ sung vào **Mục 3** của `agent.md` |

Đừng quên ghi thêm 1 dòng vào **Mục 9 (Nhật ký Cập nhật Tài liệu)** ở cuối `CODEBASE.md`!

---

## 5. Lệnh Kiểm tra Nhanh & Checklist Hoàn tất

### Kiểm tra cú pháp JavaScript & JSON trước khi bàn giao
```powershell
node --check "d:\Project\burgershop-pod-tool\content.js"
node --check "d:\Project\burgershop-pod-tool\page-bridge.js"
python -c "import json; json.load(open(r'd:\Project\burgershop-pod-tool\manifest.json', encoding='utf-8')); print('manifest OK')"
```

### Checklist hoàn tất
- [ ] Đã kiểm tra cú pháp `content.js`, `page-bridge.js` và `manifest.json` không có lỗi?
- [ ] Mọi selector CSS mới đều nằm dưới `#pod-helper`?
- [ ] Không làm hỏng `stopPropagation`, `ownWrites` và logic 3 vòng chọn màu?
- [ ] Đã cập nhật đầy đủ `CODEBASE.md` (kèm dòng mới ở Mục 9 Changelog) và `HUONG-DAN.md` (nếu đổi thao tác người dùng)?
