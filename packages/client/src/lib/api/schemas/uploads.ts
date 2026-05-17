/**
 * 上传参数的 Zod 契约。
 *
 * 架构位置：
 * - 二进制文件由 `Request.formData()` 和存储层校验。
 * - 这里仅约束业务用途，避免客户端把文件写入未知目录。
 */
export { uploadKindSchema, type UploadKind } from "@/lib/api/schemas/media";

/**
 * 上传图片相关的 Schema。
 *
 * 说明：
 * - 图片实际内容走 `multipart/form-data`（`Request.formData()`），Zod 不直接校验 File 二进制
 * - 这里主要约束“业务语义参数”，例如上传用途（logo/icon），便于后续扩展与维护
 */

/** 上传目录类型，存储层会据此生成 `{userId}/{kind}/{uuid}.{ext}`。 */
