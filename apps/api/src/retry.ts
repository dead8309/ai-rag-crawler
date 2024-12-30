const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetries<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES
) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt >= retries) {
        console.error(`Failed after ${retries} attempts: ${error.message}`);
        throw error;
      }
      console.warn(`Retrying... (Attempt ${attempt + 1}/${retries})`);
      await sleep(2 ** attempt * 100);
    }
  }
}
