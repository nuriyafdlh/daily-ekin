// A timeout stops waiting in the UI; it does not cancel a request already sent.
export async function waitForCloudSave<T>(
  request: Promise<T>,
  timeoutMs = 20_000
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(
          'Cloud belum mengonfirmasi penyimpanan setelah 20 detik. Data lokal tetap tersimpan. Periksa koneksi lalu muat dari cloud untuk memastikan hasil sebelum mencoba lagi.'
        )), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
