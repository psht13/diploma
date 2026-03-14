export function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function extractJsonBlock(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  const direct = safeJsonParse(trimmed);

  if (direct.ok) {
    return direct.value;
  }

  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    const objectCandidate = trimmed.slice(objectStart, objectEnd + 1);
    const parsedObject = safeJsonParse(objectCandidate);

    if (parsedObject.ok) {
      return parsedObject.value;
    }
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");

  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    const arrayCandidate = trimmed.slice(arrayStart, arrayEnd + 1);
    const parsedArray = safeJsonParse(arrayCandidate);

    if (parsedArray.ok) {
      return parsedArray.value;
    }
  }

  return null;
}
