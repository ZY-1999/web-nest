/**
 * 判断类型是否为 Promise
 */
type IsPromise<T> = T extends Promise<unknown> ? true : false;

/**
 * 将函数转换为异步，如果已经是异步则保持不变
 */
type AsyncifyFunction<T> = T extends (...args: infer A) => infer R
  ? IsPromise<R> extends true
    ? T
    : (...args: A) => Promise<R>
  : T;

/**
 * 将对象中的所有函数属性转换为异步函数
 *
 * @example
 * interface MyApi {
 *   syncMethod(): string
 *   asyncMethod(): Promise<number>
 *   value: string
 * }
 *
 * type AsyncApi = AsyncifyFunctions<MyApi>
 * // 等同于:
 * interface AsyncApi {
 *   syncMethod(): Promise<string>
 *   asyncMethod(): Promise<number>
 *   value: string
 * }
 */
export type AsyncifyFunctions<T> = {
  [K in keyof T]: AsyncifyFunction<T[K]>;
};
