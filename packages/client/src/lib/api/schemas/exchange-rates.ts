/**
 * 汇率响应的运行时契约。
 *
 * 架构位置：
 * - `useExchangeRates` 直接访问第三方 API 和 localStorage 缓存，无法依赖后端统一校验。
 * - Frankfurter v2 外部响应是行数组，FloatRates 外部响应是按小写币种分组的对象；
 *   进入业务前都会被 adapter 压成内部缓存结构。
 * - 本地缓存只保存本项目 canonical `USD base + 正数汇率表` 结构，并记录用户请求的主来源。
 *
 * Caveat: 如果未来切换 base currency，必须同步换算公式、缓存 key 和统计页文案，否则历史缓存会按错误口径使用。
 */
import { z } from "zod";

export const exchangeRateProviderSchema = z.enum(["frankfurter", "floatrates"]);

export const exchangeRatesSchema = z.record(
  z.string().regex(/^[A-Z]{3}$/),
  z.number().finite().positive(),
);

export const frankfurterV2RateRowSchema = z.object({
  date: z.string().min(1),
  base: z.literal("USD"),
  quote: z.string().regex(/^[A-Z]{3}$/),
  rate: z.number().finite().positive(),
});

export const frankfurterV2RatesResponseSchema = z.array(frankfurterV2RateRowSchema);

export const floatRatesRateRowSchema = z.object({
  alphaCode: z.string().regex(/^[A-Z]{3}$/),
  rate: z.number().finite().positive(),
  date: z.string().min(1),
}).passthrough();

export const floatRatesResponseSchema = z.record(
  z.string().regex(/^[a-z]{3}$/),
  floatRatesRateRowSchema,
);

export const exchangeRateDataSchema = z.object({
  base: z.literal("USD"),
  date: z.string().min(1),
  rates: exchangeRatesSchema,
}).strict();

export const cachedExchangeRateDataSchema = exchangeRateDataSchema.extend({
  cachedAt: z.number().finite(),
  requestedProvider: exchangeRateProviderSchema,
  provider: exchangeRateProviderSchema,
}).strict();

export type ExchangeRateProvider = z.infer<typeof exchangeRateProviderSchema>;
export type ExchangeRates = z.infer<typeof exchangeRatesSchema>;
export type ExchangeRateData = z.infer<typeof exchangeRateDataSchema>;
export type CachedExchangeRateData = z.infer<typeof cachedExchangeRateDataSchema>;
export type FrankfurterV2RateRow = z.infer<typeof frankfurterV2RateRowSchema>;
