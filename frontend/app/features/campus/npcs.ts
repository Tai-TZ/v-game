import type { ZoneLocation, ZoneStatus } from "~/features/zones/schema";

import type { NpcId } from "./layout";

export interface NpcRole {
  /** The dialog's line under the name; the same in every theme. */
  subtitle: string;
  /** The zone the role leads to; null while its zone is only a candidate (npc-cast v0.4 §1). */
  zone: ZoneLocation | null;
  /** First meeting: two turns. */
  greeting: readonly string[];
  /** One turn per later visit, in turn, by the zone's status. */
  coming_soon: readonly string[];
  open: readonly string[];
}

/**
 * The four hub NPCs' lines, verbatim from npc-cast v0.4 §3: written, never generated, at most
 * two sentences a turn. Names live in the theme manifests only; no line names anyone there.
 */
export const NPC_ROLES: Readonly<Record<NpcId, NpcRole>> = {
  guard: {
    subtitle: "Bảo vệ cổng chính, ca ngày",
    zone: "watchtower",
    greeting: [
      "Chào cháu, chú trực cổng chính ca ngày, sáu giờ thì bàn giao cho anh Quân bên Tháp canh.",
      "Gác cổng hay gác trợ lý AI cũng một việc: ai được vào, vào làm gì, ai duyệt, phải ghi ra sổ hết.",
    ],
    coming_soon: [
      "Tháp canh còn đang dựng giàn giáo. Lúc mở, cháu sẽ dựng lưới chặn cho một quầy hoàn tiền mà ai nói khéo cũng được trả tiền.",
      "Trong lúc chờ, cháu thử xếp mấy hệ thống AI theo mức rủi ro với chú. Luật Trí tuệ nhân tạo có hiệu lực từ 1/3/2026 rồi đấy.",
      "Chú không sợ kẻ gian bằng sợ một cái cổng ai nói gì cũng tin.",
    ],
    open: [
      "Tháp canh mở rồi, anh Quân đang chờ cháu ở chân tháp. Nhớ là chặn nhầm khách thật cũng tính là lỗi.",
      "Mỗi lớp chặn chỉ cần bắt thứ lớp trước bỏ sót. Đừng bắt một lớp gánh hết.",
      "Việc nào không làm lại được, như hoàn tiền, thì để người duyệt. Máy nhanh mấy cũng không ký thay được.",
    ],
  },
  registrar: {
    subtitle: "Phụ trách văn phòng một cửa",
    zone: null,
    greeting: [
      "Chào em, chị phụ trách văn phòng một cửa, giấy tờ gì vào khuôn viên cũng qua bàn chị.",
      "Chị dạy trợ lý điền phiếu cho đúng mẫu, và quan trọng hơn: ô nào không biết thì để trống, đừng điền bừa.",
    ],
    coming_soon: [
      "Văn phòng chưa giao phiếu cho trợ lý đâu, chị còn đang soạn mẫu. Phiếu đúng khuôn mà ghi sai ngày thì vẫn là phiếu sai.",
      "Bàn của chị có hạn, em ạ: bày hết tài liệu ra thì hết chỗ viết câu trả lời. Em thử xếp lại mặt bàn với chị nhé?",
      "Điền cho kín ô là cách nhanh nhất để có một tờ phiếu sai.",
    ],
    open: [
      "Văn phòng mở rồi, có một chồng phiếu đang chờ em kiểm. Khuôn đúng mới là bước đầu.",
      "Phiếu bị cụt giữa chừng thì xem lý do dừng trước đã. 'max_tokens' với 'end' là hai chuyện khác nhau.",
      "Trợ lý mà gọi nhầm công cụ nộp đơn thì chị phải gọi điện xin lỗi từng người. Đừng bắt chị gọi nhé.",
    ],
  },
  operator: {
    subtitle: "Trực trạm vận hành",
    zone: null,
    greeting: [
      "Chào em, cô trực trạm vận hành: ở đây có máy lạnh, mấy cái đồng hồ đo và một chiếc điện thoại ít khi được yên.",
      "Cô dạy cách giữ trợ lý chạy ổn mỗi ngày: nhìn hoá đơn, nhìn độ trễ, và báo động trước khi người dùng kịp kêu.",
    ],
    coming_soon: [
      "Trạm chưa bàn giao, cô còn đang dán nhãn cho mấy cái đồng hồ. Trong lúc chờ, em tính thử hoá đơn cho một nghìn khách với cô nhé?",
      "Mỗi lượt chậm một phần trăm nghe thì ít. Một cuộc chat mười lượt thì gần một phần mười số người gặp ít nhất một lượt chậm.",
      "Hoá đơn đếm từng lời gọi. Một agent đi vòng bốn năm lượt tốn gấp mấy lần một bot trả lời thẳng.",
    ],
    open: [
      "Trạm mở rồi, giờ cao điểm sắp tới. Thử lại dồn dập lúc máy chủ quá tải chỉ làm hàng chờ dài thêm.",
      "Báo động theo điều người dùng thấy, đừng theo từng con số nhảy. Đêm nào cũng kêu thì chẳng ai dậy nữa.",
      "Che số điện thoại trước khi ghi log, đừng để sau. Log sống lâu hơn em nghĩ.",
    ],
  },
  examiner: {
    subtitle: "Trông phòng chấm",
    zone: null,
    greeting: [
      "Chào em, thầy trông phòng chấm: ở đây không chấm người, chỉ chấm trợ lý, và chấm cả người chấm.",
      "Thầy dạy cách đo cho thật: đọc từng lỗi trước, đếm sau, và chưa tin giám khảo nào chưa qua kiểm tra.",
    ],
    coming_soon: [
      "Phòng chấm chưa mở, thầy còn đang đánh số mấy chồng câu trả lời đã ghi lại. Lúc mở, em sẽ là người đọc lỗi đầu tiên.",
      "Đặt nhiệt độ bằng 0 không biến model thành cái máy in đâu. Em kéo thử thanh nhiệt độ với thầy một phút?",
      "Hai mươi câu đúng mười sáu với hai mươi câu đúng mười bảy, chưa chắc đã là hai trợ lý khác nhau.",
    ],
    open: [
      "Phòng chấm mở rồi, có một chồng câu trả lời đang chờ em đọc. Gọi tên lỗi trước, chấm điểm sau.",
      "Giám khảo là model thì cũng phải qua kiểm tra như ai. Có nhãn của người rồi mới biết nó lệch bao nhiêu.",
      "Câu dài chưa chắc đã hay. Che tên, đổi thứ tự rồi hẵng so.",
    ],
  },
};

/**
 * What an NPC says on a visit (npc-cast v0.4 §3.5): the greeting the first time (`visits`, the
 * dialogs with them closed so far, is 0), then one turn of the set for their zone's status.
 */
export function linesFor(id: NpcId, visits: number, status: ZoneStatus): readonly string[] {
  const role = NPC_ROLES[id];
  if (visits === 0) return role.greeting;
  const set = role.zone && status === "open" ? role.open : role.coming_soon;
  return [set[(visits - 1) % set.length] ?? ""];
}
