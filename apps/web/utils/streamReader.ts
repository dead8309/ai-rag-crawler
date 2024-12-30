export async function* streamReader(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response reader');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(5);
        try {
          const parsed = JSON.parse(data);
          if (parsed.response) {
            yield parsed.response;
          }
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      }
    }
  }

  if (buffer) {
    try {
      const parsed = JSON.parse(buffer);
      if (parsed.response) {
        yield parsed.response;
      }
    } catch (error) {
      console.error('Error parsing JSON:', error);
    }
  }
}

