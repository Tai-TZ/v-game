import * as v from "valibot";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * GET a JSON resource from the backend and validate it against `schema`. Anything that
 * does not match the contract is treated as an error rather than rendered.
 */
export async function getJson<TSchema extends v.GenericSchema>(
  path: string,
  schema: TSchema,
  signal?: AbortSignal,
): Promise<v.InferOutput<TSchema>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.", 0);
  }

  if (!response.ok) {
    const message =
      response.status === 404
        ? "Không tìm thấy nội dung bạn yêu cầu."
        : "Máy chủ đang gặp sự cố. Thử lại sau ít phút.";
    throw new ApiError(message, response.status);
  }

  const result = v.safeParse(schema, await response.json());
  if (!result.success) {
    throw new ApiError("Dữ liệu từ máy chủ không đúng định dạng.", response.status);
  }
  return result.output;
}
