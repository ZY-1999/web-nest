export function waitFor<T>(promiseT: Promise<T>, timeout: number = 100): Promise<T> {
  // 创建一个超时 Promise
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`waitFor timed out after ${timeout}ms`));
    }, timeout);
  });

  // 使用 Promise.race 来等待第一个完成的 Promise
  return Promise.race([promiseT, timeoutPromise]);
}
