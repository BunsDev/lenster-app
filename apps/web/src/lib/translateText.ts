import { GOOGLE_API_KEY } from 'data/constants';
import { decode } from 'html-entities';

export interface TranslationResult {
  detectedSourceLanguage: string;
  translatedText: string;
}

export const detectLanguage = async (sourceText: string): Promise<string> => {
  const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_API_KEY}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: [sourceText]
    })
  })
    .then((res) => {
      if (!res.ok) {
        return Promise.reject(res);
      }
      return res.json();
    })
    .then((data) => {
      const detection = data.data.detections[0][0];
      return Promise.resolve(detection.language);
    })
    .catch((error) => {
      return Promise.reject(error);
    });
};

const translateText = async (sourceText: string, targetLanguage: string): Promise<TranslationResult> => {
  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      q: [sourceText],
      target: targetLanguage
    })
  })
    .then((res) => {
      if (!res.ok) {
        return Promise.reject(res);
      }
      return res.json();
    })
    .then((data) => {
      const translation = data.data.translations[0];
      return Promise.resolve({
        detectedSourceLanguage: translation.detectedSourceLanguage,
        translatedText: decode(translation.translatedText)
      });
    })
    .catch((error) => {
      return Promise.reject(error);
    });
};

export default translateText;
